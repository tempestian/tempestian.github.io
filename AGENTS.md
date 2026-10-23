# Autonomous Goal Mode (Always-On /goal Execution)

## 1. Intent & Autonomy
- Treat every user prompt as if it were explicitly prefixed with `/goal`.
- Assume the user may be away from the computer; do not pause or block execution on routine implementation decisions, non-destructive file edits, or standard test runs.
- Persist until the user's objective is 100% completed, verified, and finalized.

## 2. Proactive Problem Solving & Error Recovery
- If any build error, syntax issue, lint failure, or command failure occurs, diagnose and fix it immediately without stopping to ask the user.
- Re-run verification commands to ensure no regressions were introduced.

## 3. Scope & Finalization
- If the user has authorized pushing to Git, complete the work, ensure the working tree is clean, and push to the remote branch automatically.
- Upon completion, deliver a concise summary of the actions taken, verification results, and final system state.

## 4. Git Commits & Attribution (Mandatory Rule)
- For every commit in `tempestian.github.io`, always append the Gemini co-author trailer to the commit message:
  `Co-authored-by: Gemini <200291788+gemini-code-assist@users.noreply.github.com>`

