---
name: pr-description
description: Draft a pull request title and description from the current branch commits
version: 1.0.0
---
Draft a pull request description for the current branch.

1. Run `git log main..HEAD --oneline` (or `master` if no `main`) to list commits.
2. Run `git diff main...HEAD --stat` for a file-level summary.
3. Write:
   - **Title**: under 70 chars, imperative mood, describes the change not the ticket.
   - **Summary**: 2–4 bullet points — what changed and why, not how.
   - **Test plan**: bulleted checklist of things a reviewer should verify manually.
   - **Notes** (optional): breaking changes, follow-up work, or deploy considerations.
4. Output as Markdown, ready to paste into GitHub.
