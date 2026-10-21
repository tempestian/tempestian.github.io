(() => {
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];

  const gfMul = (a, b) => (a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]]);

  const polyMul = (p, q) => {
    const out = new Uint8Array(p.length + q.length - 1);
    for (let i = 0; i < p.length; i++) {
      for (let j = 0; j < q.length; j++) {
        out[i + j] ^= gfMul(p[i], q[j]);
      }
    }
    return out;
  };

  const rsGenPoly = degree => {
    let g = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) g = polyMul(g, new Uint8Array([1, GF_EXP[i]]));
    return g;
  };

  const rsEncode = (data, ecLen) => {
    const gen = rsGenPoly(ecLen);
    const msg = new Uint8Array(data.length + ecLen);
    msg.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const coef = msg[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) {
          msg[i + j] ^= gfMul(gen[j], coef);
        }
      }
    }
    return msg.slice(data.length);
  };

  const VERSIONS = [
    null,
    [26, 7, 1, 19, 0, 0, []],
    [44, 10, 1, 34, 0, 0, [6, 18]],
    [70, 15, 1, 55, 0, 0, [6, 22]],
    [100, 20, 1, 80, 0, 0, [6, 26]],
    [134, 26, 1, 108, 0, 0, [6, 30]],
    [172, 18, 2, 68, 0, 0, [6, 34]],
    [196, 20, 2, 78, 0, 0, [6, 22, 38]],
    [242, 24, 2, 97, 0, 0, [6, 24, 42]],
    [292, 30, 2, 116, 0, 0, [6, 26, 46]],
    [346, 18, 2, 68, 2, 69, [6, 28, 50]]
  ];

  function encodeQRMatrix(text) {
    const bytes = new TextEncoder().encode(text);
    let ver = 1;
    while (ver <= 10) {
      const [, , b1, d1, b2, d2] = VERSIONS[ver];
      const cap = b1 * d1 + b2 * d2;
      const hdrBits = ver < 10 ? 12 : 20;
      if (Math.ceil((hdrBits + bytes.length * 8) / 8) <= cap) break;
      ver++;
    }
    if (ver > 10) throw new Error('QR veri boyutu sınırı aşıldı');

    const [, ecLen, b1, d1, b2, d2, align] = VERSIONS[ver];
    const dataCap = b1 * d1 + b2 * d2;
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };

    pushBits(0b0100, 4);
    pushBits(bytes.length, ver < 10 ? 8 : 16);
    for (const b of bytes) pushBits(b, 8);
    pushBits(0, Math.min(4, dataCap * 8 - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);

    const dataBytes = new Uint8Array(dataCap);
    for (let i = 0; i < bits.length / 8; i++) {
      let v = 0;
      for (let j = 0; j < 8; j++) v = (v << 1) | bits[i * 8 + j];
      dataBytes[i] = v;
    }
    let padIdx = Math.floor(bits.length / 8);
    let padToggle = true;
    while (padIdx < dataCap) {
      dataBytes[padIdx++] = padToggle ? 0xec : 0x11;
      padToggle = !padToggle;
    }

    const blocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (let i = 0; i < b1; i++) {
      const blk = dataBytes.slice(offset, offset + d1);
      offset += d1;
      blocks.push(blk);
      ecBlocks.push(rsEncode(blk, ecLen));
    }
    for (let i = 0; i < b2; i++) {
      const blk = dataBytes.slice(offset, offset + d2);
      offset += d2;
      blocks.push(blk);
      ecBlocks.push(rsEncode(blk, ecLen));
    }

    const finalBytes = [];
    const maxDataLen = Math.max(d1, d2);
    for (let i = 0; i < maxDataLen; i++) {
      for (const blk of blocks) if (i < blk.length) finalBytes.push(blk[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const ec of ecBlocks) finalBytes.push(ec[i]);
    }

    const size = ver * 4 + 17;
    const grid = Array.from({ length: size }, () => new Int8Array(size));
    const used = Array.from({ length: size }, () => new Uint8Array(size));

    const setMod = (r, c, val) => {
      if (r < 0 || r >= size || c < 0 || c >= size) return;
      grid[r][c] = val ? 1 : 0;
      used[r][c] = 1;
    };

    const finder = (r0, c0) => {
      for (let dr = -1; dr <= 7; dr++) {
        for (let dc = -1; dc <= 7; dc++) {
          const on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
          setMod(r0 + dr, c0 + dc, on);
        }
      }
    };
    finder(0, 0);
    finder(0, size - 7);
    finder(size - 7, 0);

    for (let i = 8; i < size - 8; i++) {
      setMod(6, i, i % 2 === 0);
      setMod(i, 6, i % 2 === 0);
    }

    for (const r of align) {
      for (const c of align) {
        if ((r < 9 && c < 9) || (r < 9 && c > size - 10) || (r > size - 10 && c < 9)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            setMod(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
          }
        }
      }
    }

    setMod(size - 8, 8, true);
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        used[8][i] = 1;
        used[i][8] = 1;
      }
    }
    for (let i = 0; i < 8; i++) {
      used[8][size - 1 - i] = 1;
      used[size - 1 - i][8] = 1;
    }

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      const vBits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = ((vBits >>> i) & 1) !== 0;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        setMod(b, a, bit);
        setMod(a, b, bit);
      }
    }

    let bitIdx = 0;
    const totalBits = finalBytes.length * 8;
    let up = true;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        const r = up ? size - 1 - vert : vert;
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          if (!used[r][c]) {
            let dark = false;
            if (bitIdx < totalBits) {
              dark = ((finalBytes[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
              bitIdx++;
            }
            if ((r + c) % 2 === 0) dark = !dark;
            grid[r][c] = dark ? 1 : 0;
          }
        }
      }
      up = !up;
    }

    const fmtBits = 0x77c4;
    for (let i = 0; i <= 5; i++) grid[8][i] = (fmtBits >>> i) & 1;
    grid[8][7] = (fmtBits >>> 6) & 1;
    grid[8][8] = (fmtBits >>> 7) & 1;
    grid[7][8] = (fmtBits >>> 8) & 1;
    for (let i = 9; i < 15; i++) grid[14 - i][8] = (fmtBits >>> i) & 1;

    for (let i = 0; i < 8; i++) grid[8][size - 1 - i] = (fmtBits >>> i) & 1;
    for (let i = 8; i < 15; i++) grid[size - 15 + i][8] = (fmtBits >>> i) & 1;

    return grid;
  }

  function renderQRSVG(text, margin = 3) {
    const matrix = encodeQRMatrix(text);
    const n = matrix.length;
    const total = n + margin * 2;
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (matrix[r][c]) {
          path += `M${c + margin},${r + margin}h1v1h-1z`;
        }
      }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="QR Kod"><rect width="${total}" height="${total}" fill="#ffffff" rx="2"/><path d="${path}" fill="#000000"/></svg>`;
  }

  window.QRGenerator = { renderQRSVG, encodeQRMatrix };
})();
