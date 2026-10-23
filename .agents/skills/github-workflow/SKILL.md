---
name: github-workflow
description: >-
  Comprehensive guide and cheatsheet for Git & GitHub workflows, CLI commands (git and gh), release management, and the mandatory contributor rule strictly forbidding adding Gemini/AI as a developer/contributor to any project other than tempestian.github.io.
---

# GitHub & Git Operational Workflow Skill

This skill serves as the single source of truth for all Git and GitHub CLI operations across all projects, repositories, and conversations. It provides an exhaustive reference of commands, workflows, release management, and the mandatory contributor attribution policy.

--------------------------------------------------------------------------------

## ⚠️ MANDATORY RULE: Contributor & Attribution Policy (CRITICAL)

> [!IMPORTANT]
> **Zero Exception Contributor Rule:**
> **DO NOT** add Gemini or any AI persona as a developer, author, co-author, contributor, or credit in README, documentation, `CONTRIBUTORS.md`, or package manifests to **ANY project EXCEPT `tempestian.github.io`**.
>
> 1. **`tempestian.github.io` ONLY:** This is the *only* project authorized to credit Gemini in the contributors list or append the Gemini co-author trailer to commit messages:
>    `Co-authored-by: Gemini <200291788+gemini-code-assist@users.noreply.github.com>`
> 2. **ALL OTHER PROJECTS (e.g. `tempestian-mobile`, fork projects, new apps, scripts):**
>    - **NEVER** add Gemini as a developer, contributor, or author in `README.md`, `CONTRIBUTING.md`, or documentation.
>    - The project owner/developer is **Bayram (Tempestian)** only.
>    - Do not append Gemini co-author trailers or credit lines in other repositories unless the user explicitly commands it for a specific repository.
> 3. **Persistent & Always-On:** This rule is active across every single session, prompt, and task without needing reminder.

--------------------------------------------------------------------------------

## 🛠️ Complete Git Command Reference

### 1. Repository Status & Inspection
- `git status`: Show working tree status (clean vs modified vs untracked).
  - Best practice: Always check before and after staging changes.
- `git status -s`: Short format status (`M` modified, `A` added, `D` deleted, `??` untracked).
- `git log -n <N> --oneline`: Show the last `N` commits in single-line summaries.
- `git log --graph --oneline --decorate -n 10`: Visualize branch history and merges.
- `git diff`: Show unstaged changes in the working tree.
- `git diff --staged` or `git diff --cached`: Show changes staged for commit.
- `git show <commit-hash>`: Show metadata and diff for a specific commit.
- `git show <commit-hash> --stat`: Summary of files altered in a commit.

### 2. Staging & Committing
- `git add <file1> <file2>`: Stage specific modified or new files.
  - Avoid `git add .` blindly to avoid staging unintended binaries, secret keys, or build artifacts.
- `git commit -m "<message>"`: Commit staged changes. Follow Conventional Commits:
  - `feat:` New user-facing feature
  - `fix:` Bug fix
  - `docs:` Documentation only changes
  - `style:` Formatting, whitespace changes (no code logic changes)
  - `refactor:` Code refactoring (neither fixes a bug nor adds a feature)
  - `perf:` Performance improvement
  - `chore:` Maintenance, dependency updates, tooling
- `git commit --amend --no-edit`: Append newly staged files to the previous commit without altering the message (use only on unpushed local commits).

### 3. Branching & Merging
- `git branch`: List local branches (* indicates current branch).
- `git branch -a`: List all local and remote tracking branches.
- `git checkout -b <branch-name>` or `git switch -c <branch-name>`: Create and switch to a new branch.
- `git switch <branch-name>`: Switch to an existing local branch.
- `git merge <branch-name>`: Merge target branch into current branch.
- `git branch -d <branch-name>`: Safely delete a merged local branch.

### 4. Remote Operations & Synchronization
- `git remote -v`: List configured remote repository URLs (`origin fetch/push`).
- `git remote add origin <url>`: Add remote repository URL.
- `git fetch origin`: Download latest commits and branch refs from remote without merging.
- `git pull origin <branch>`: Fetch and integrate remote changes into the current branch.
- `git push origin <branch>`: Push local commits to the remote branch.
- `git push origin --tags`: Push all local annotated tags to the remote.

### 5. Stashing & Undoing Changes
- `git stash push -m "<label>"`: Stash unstaged/staged dirty working tree changes.
- `git stash pop`: Reapply most recent stash and remove it from stash list.
- `git restore <file>`: Discard unstaged working tree changes in `<file>`.
- `git restore --staged <file>`: Unstage `<file>` while keeping working tree modifications.
- `git reset --soft HEAD~1`: Undo last commit, keeping all changes staged in the index.
- `git reset --hard HEAD~1`: **DANGER!** Undo last commit and wipe working tree changes. Only use when explicitly intended.

### 6. Tagging
- `git tag -l`: List existing tags.
- `git tag -a v1.0.0 -m "Release v1.0.0"`: Create an annotated tag.
- `git push origin v1.0.0`: Push a specific tag to remote.
- `git tag -d <tag>`: Delete a local tag.

--------------------------------------------------------------------------------

## 🚀 GitHub CLI (`gh`) Command Reference

The `gh` CLI provides direct, scriptable access to GitHub workflows, releases, issues, and PRs.

### 1. Authentication & System Status
- `gh auth status`: Verify current authenticated GitHub user, token scopes, and protocols.
- `gh repo view`: Display the current GitHub repository README and metadata.
- `gh repo view <owner>/<repo>`: Inspect a specific remote repository.

### 2. GitHub Releases (Binary & APK Distribution)
- `gh release list --repo <owner>/<repo>`: List published releases, tags, and dates.
- `gh release view <tag> --repo <owner>/<repo>`: View release description and attached assets (APKs, checksums).
- `gh release create <tag> [asset-files...] --repo <owner>/<repo> --title "<title>" --notes "<notes>"`:
  - Create a new official GitHub release, tag it, and upload binary files directly.
  - Example for mobile APK:
    ```bash
    gh release create mobile-v1.3.0 /path/to/tempestian-mobile.apk \
      --repo tempestian/tempestian.github.io \
      --title "Tempestian Mobile v1.3.0 - IMDb & Admin Parity" \
      --notes "### 🚀 Tempestian Mobile v1.3.0 ...\n\n- Özellikler..."
    ```
- `gh release upload <tag> <file> --repo <owner>/<repo> --clobber`: Upload or overwrite an asset in an existing release.
- `gh release download <tag> -D <target-dir>`: Download release assets to a local directory.
- `gh release delete <tag> --repo <owner>/<repo> -y`: Delete a release.

### 3. Pull Requests (`gh pr`)
- `gh pr list`: View open pull requests.
- `gh pr create --title "<title>" --body "<body>"`: Open a new PR from current branch against default branch.
- `gh pr checkout <pr-number>`: Check out a pull request locally for testing.
- `gh pr merge <pr-number> --squash --delete-branch`: Squash merge a PR and clean up remote branch.

### 4. GitHub Actions / Workflows (`gh workflow` & `gh run`)
- `gh workflow list`: View all GitHub Action workflows in the repository.
- `gh workflow run <workflow-name-or-file>`: Manually trigger a `workflow_dispatch` event.
- `gh run list --limit 10`: View recent GitHub Actions workflow runs and their status (`completed`, `in_progress`, `failure`).
- `gh run watch <run-id>`: Live-tail execution of a running action until completion.
- `gh run view <run-id> --log-failed`: View failure logs for a failed run.

--------------------------------------------------------------------------------

## 📦 Mobile APK Release Playbook

When publishing an Android APK release:
1. **Version Bump:** Update `versionCode` (+1) and `versionName` (`vX.Y.Z`) in `app/build.gradle.kts`.
2. **Build APK:** Compile debug/release APK (`./gradlew assembleDebug` or `assembleRelease`).
3. **Verify Binary:** Ensure APK exists, check size (`ls -lh`) and hash (`sha256sum`).
4. **Target Repository:** For Tempestian apps, mobile releases are hosted under `tempestian/tempestian.github.io` under tag format `mobile-vX.Y.Z`.
5. **Publish Release:** Use `gh release create mobile-vX.Y.Z <apk-path> --repo tempestian/tempestian.github.io --title "..." --notes "..."`.
6. **Verify:** Confirm release is live via `gh release view mobile-vX.Y.Z --repo tempestian/tempestian.github.io`.
