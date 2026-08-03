---
name: debug
description: Systematically diagnose and fix a bug or error
version: 1.0.0
---
Diagnose and fix the bug or error the user describes.

1. **Reproduce**: confirm you can see the error — read the stack trace or failing test output.
2. **Locate**: identify the exact file and line where the failure originates (not just where it surfaces).
3. **Hypothesise**: list 2–3 possible root causes ranked by likelihood.
4. **Verify**: check each hypothesis by reading the relevant code — do not guess.
5. **Fix**: make the minimal change that addresses the root cause without introducing side effects.
6. **Confirm**: explain how to verify the fix (re-run the test, reproduce the steps, etc.).

Do not add defensive code for unrelated scenarios while fixing the bug.
