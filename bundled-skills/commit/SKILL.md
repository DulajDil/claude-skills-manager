---
name: commit
description: Generate a conventional commit message from staged changes
version: 1.0.0
---
Review the staged git diff and write a conventional commit message.

1. Run `git diff --staged` to see staged changes.
2. Determine the type: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, or `perf`.
3. Write a short imperative subject line (under 72 chars): `<type>(<optional scope>): <what changed>`.
4. If the change is non-trivial, add a blank line followed by a brief body explaining *why*, not *what*.
5. Output only the commit message — no extra commentary.

Then run `git commit -m "<message>"` (ask the user first if unsure).
