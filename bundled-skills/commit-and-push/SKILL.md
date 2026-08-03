---
name: commit-and-push
description: >-
  Format, build-check, generate a Conventional Commits message from the staged
  diff, then commit and (with approval) push. Use this skill whenever the user
  asks to "commit", "commit and push", "make a commit", "write a commit
  message", "push these changes", "wrap this up and push it", or similar
  phrasing — even when they don't explicitly mention conventional commits.
  Default to using this skill any time the workflow is "I've staged some
  changes, finish the job."
---
# Commit and Push

A safe, repeatable workflow for taking staged changes from "ready" to "pushed", with a Conventional Commits message generated from the actual diff.

## When to use

Trigger this skill when the user wants to finalize staged work — typical phrasings:

- "commit and push"
- "commit this"
- "write a commit message for these changes"
- "push my changes"
- "wrap this up and push it"

If nothing is staged yet, stop and ask the user what they want staged before proceeding.

## Workflow

Follow these steps in order. Each step has a rationale — read it and adapt rather than executing blindly.

### 1. Sanity check the repo state

Run `git status --short` to confirm:

- We're inside a git repo.
- Something is actually staged (lines starting with `M `, `A `, `D `, `R `, etc. in the first column).
- A commit identity is configured. Check with `git config user.name` and `git config user.email`. If either is empty, **stop and ask the user** what identity to use — don't guess, and don't silently write to global git config.

If nothing is staged, stop and tell the user — don't try to stage things on their behalf.

### 2. Format the code

Run `npm run format` to apply formatting and auto-fix lint errors.

- If the script doesn't exist (e.g. `npm ERR! Missing script: "format"`), **warn the user** ("no `format` script in package.json — skipping") and continue.
- If the repo isn't a Node project at all (no `package.json`), skip silently.
- If formatting fails with real errors (not "missing script"), surface them and stop — don't commit broken code.

**Important:** Formatting may modify files. Any modifications land in the working tree as *unstaged* changes. After formatting:

1. Run `git status --short` again.
2. If formatting touched files that overlap with what was already staged, ask the user: "Formatting modified files that overlap with your staged changes. Re-stage them so the formatting is included in this commit?" If yes, run `git add` on those paths.
3. If formatting touched unrelated files, leave them alone — the user can decide what to do with them separately.

### 3. Build check

Run `npm run build` to catch type errors and broken imports before committing.

- If the script doesn't exist, warn the user and continue.
- If it fails, stop and report the errors. Do not commit. The user will want to fix the build first.

### 4. Inspect the staged diff

Run `git diff --staged` and read it carefully. This is the source of truth for the commit message — not memory of the conversation, not assumptions about what changed. The diff is what gets committed.

If the diff is very large, also run `git diff --staged --stat` to get the file-level summary so you can describe the change at the right altitude.

### 5. Compose the commit message

Use the Conventional Commits format:
