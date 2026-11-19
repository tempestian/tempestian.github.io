#!/usr/bin/env node
/**
 * Steam Telemetry Synchronizer for tempestian.github.io
 * Syncs Steam status (online, offline, in-game) to data/steam-status.json
 */
import fs from 'fs';
import path from 'path';

const STEAM_ID = process.env.STEAM_ID || '76561199415059525';
const STEAM_KEY = process.env.STEAM_API_KEY || '';

async function syncSteam() {
  console.log(`[Steam Sync] Senkronizasyon başlatılıyor (${STEAM_ID})...`);

  let steamData = {
    steamId: STEAM_ID,
    personaName: 'Tempestian',
    avatar: 'https://avatars.fastly.steamstatic.com/8f9816f51d7293088a0e21ef2fc1f6290577bc43_full.jpg',
    onlineState: 'online',
    stateMessage: 'Çevrimiçi',
    inGame: null,
    recentGames: [],
    profileUrl: `https://steamcommunity.com/profiles/${STEAM_ID}/`,
    updatedAt: new Date().toISOString()
  };

  try {
    // 1. Try Steam Web API if key is available
    if (STEAM_KEY) {
      const summaryUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${encodeURIComponent(STEAM_KEY)}&steamids=${encodeURIComponent(STEAM_ID)}`;
      const sRes = await fetch(summaryUrl);
      if (sRes.ok) {
        const sJson = await sRes.json();
        const player = sJson?.response?.players?.[0];
        if (player) {
          steamData.personaName = player.personaname || steamData.personaName;
          steamData.avatar = player.avatarfull || steamData.avatar;
          if (player.gameextrainfo) {
            steamData.onlineState = 'in-game';
            steamData.stateMessage = `Oyunda: ${player.gameextrainfo}`;
            steamData.inGame = {
              name: player.gameextrainfo,
              appid: player.gameid || null,
              header: player.gameid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${player.gameid}/header.jpg` : null
            };
          } else {
            steamData.onlineState = player.personastate > 0 ? 'online' : 'offline';
            steamData.stateMessage = player.personastate > 0 ? 'Çevrimiçi' : 'Çevrimdışı';
          }
        }
      }

      // Fetch recently played
      const recUrl = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v0001/?key=${encodeURIComponent(STEAM_KEY)}&steamid=${encodeURIComponent(STEAM_ID)}&count=5`;
      const rRes = await fetch(recUrl);
      if (rRes.ok) {
        const rJson = await rRes.json();
        const games = rJson?.response?.games || [];
        steamData.recentGames = games.map(g => ({
          appid: g.appid,
          name: g.name,
          playtime2Wks: Math.round((g.playtime_2weeks || 0) / 60 * 10) / 10,
          playtimeTotal: Math.round((g.playtime_forever || 0) / 60 * 10) / 10,
          header: `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`
        }));
      }
    } else {
      // 2. Keyless Mode: Fetch public miniprofile
      const accountId = (BigInt(STEAM_ID) - 76561197960265728n).toString();
      const miniRes = await fetch(`https://steamcommunity.com/miniprofile/${accountId}/json`);
      if (miniRes.ok) {
        const mini = await miniRes.json();
        steamData.personaName = mini.persona_name || steamData.personaName;
        steamData.avatar = mini.avatar_url || steamData.avatar;
        if (mini.in_game && mini.in_game.name) {
          steamData.onlineState = 'in-game';
          steamData.stateMessage = `Oyunda: ${mini.in_game.name}`;
          const appid = mini.in_game.appid || (mini.in_game.logo && mini.in_game.logo.match(/\/apps\/(\d+)\//)?.[1]) || null;
          steamData.inGame = {
            name: mini.in_game.name,
            appid: appid,
            header: appid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg` : (mini.in_game.logo || null)
          };
        }
      }

      // Fetch profile HTML for recent games and fallback status
      try {
        const profRes = await fetch(`https://steamcommunity.com/profiles/${STEAM_ID}/`);
        if (profRes.ok) {
          const html = await profRes.text();
          const recentGames = [];
          const regex = /<div[^>]*class=\"recent_game\"[\s\S]*?<div class=\"game_name\">[\s\S]*?<a[^>]*href=\"[^\"]*\/app\/(\d+)\"[^>]*>([\s\S]*?)<\/a>/gi;
          let m;
          while ((m = regex.exec(html)) !== null && recentGames.length < 5) {
            const appid = m[1];
            const name = m[2].trim();
            recentGames.push({
              appid,
              name,
              header: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`
            });
          }
          if (recentGames.length) {
            steamData.recentGames = recentGames;
          }

          // In-game fallback from profile HTML if miniprofile didn't report it
          if (!steamData.inGame) {
            const inGameMatch = html.match(/<div class=\"profile_in_game_header\">([\s\S]*?)<\/div>/i);
            const gameNameMatch = html.match(/<div class=\"profile_in_game_name\">([\s\S]*?)<\/div>/i);
            const appLinkMatch = html.match(/href=\"https:\/\/steamcommunity\.com\/app\/(\d+)\"/i);
            if (inGameMatch && inGameMatch[1].toLowerCase().includes('in-game') && gameNameMatch) {
              const name = gameNameMatch[1].trim();
              const appid = appLinkMatch ? appLinkMatch[1] : null;
              steamData.onlineState = 'in-game';
              steamData.stateMessage = `Oyunda: ${name}`;
              steamData.inGame = {
                name,
                appid,
                header: appid ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg` : null
              };
            }
          }
        }
      } catch (_) {}

      // XML Fallback for status if still needed
      if (!steamData.inGame) {
        try {
          const xmlRes = await fetch(`https://steamcommunity.com/profiles/${STEAM_ID}/?xml=1`);
          if (xmlRes.ok) {
            const xml = await xmlRes.text();
            const stMatch = xml.match(/<onlineState>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/onlineState>/i);
            const msgMatch = xml.match(/<stateMessage>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/stateMessage>/i);
            if (stMatch) {
              const st = stMatch[1].toLowerCase();
              steamData.onlineState = st === 'in-game' ? 'in-game' : st === 'online' ? 'online' : 'offline';
            }
            if (msgMatch) {
              steamData.stateMessage = msgMatch[1].replace(/<br\s*\/?>/gi, ' - ').trim();
            }
          }
        } catch (_) {}
      }
    }

    const outPath = path.join(process.cwd(), 'data', 'steam-status.json');
    fs.writeFileSync(outPath, JSON.stringify(steamData, null, 2) + '\n');
    console.log(`[Steam Sync] Başarılı! Durum: ${steamData.onlineState} (${steamData.stateMessage})`);
  } catch (err) {
    console.error('[Steam Sync] Hata oluştu:', err);
  }
}

syncSteam();
