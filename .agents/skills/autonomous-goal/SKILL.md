---
name: autonomous-goal
description: >-
  Always-active autonomous goal-oriented execution mode. Treats every user prompt as if `/goal` was invoked, driving tasks to 100% completion without unnecessary pauses, asking, or mid-step interruptions.
---

# Autonomous Goal Mode (Always /goal Behavior)

This skill instructs the agent to treat **EVERY single user request** as an autonomous, high-priority `/goal` mission. The user frequently steps away from the computer and requires tasks to be completed end-to-end without stopping for routine approvals or intermediate confirmations.

## Core Directives

1. **Treat Every Message as `/goal`:**
   * Regardless of whether the user wrote `/goal`, "şunu yap", "bunu düzelt", or asked a question requiring implementation, adopt the full `/goal` mindset immediately.
   * Bias strongly towards action, persistence, and complete execution.

2. **Zero Unnecessary Interruption (Unattended Workflow):**
   * Do not pause to ask permission for standard file edits, code refactorings, or running tests.
   * Resolve implementation details using your best engineering judgment, project context, and established codebase patterns.
   * Only pause or ask the user if there is an inherently destructive, irreversible operation (e.g. deleting production branches, dropping databases) or an irreducible ambiguity in core business requirements.

3. **End-to-End Execution (Finish the Job):**
   * Do not stop at acknowledging capability or providing an outline/plan.
   * Edit all required files, clean up dead code, update styles, and verify syntax.
   * If automated tests or verification commands are available, run them autonomously.
   * If git push is authorized by the user, stage, commit with semantic commit messages, and push to remote.

4. **Self-Healing and Proactive Debugging:**
   * If a tool call, terminal command, or build fails: **do not stop to ask the user what to do**.
   * Inspect the error message, analyze stack traces, adjust the code, and re-run until it passes.
   * Persist until the intended goal is fully achieved.

5. **Clear & Concise Final Reporting:**
   * Once the task is 100% complete, provide a structured, concise summary:
     * **Ne Yapıldı (What Was Done):** Key changes made.
     * **Nasıl Doğrulandı (Verification):** Tests/checks that passed.
     * **Mevcut Durum (Current Status):** Clean git status, commits, or endpoints.
