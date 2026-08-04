---
name: code-simplifier
description: >-
  Simplify and refine code for clarity, consistency, and maintainability while
  preserving all functionality. Use this skill when the user asks to "simplify
  this", "clean this up", "tidy this code", "make this more readable", or
  "refactor for clarity". Focuses on recently modified code unless told
  otherwise.
version: 1.0.0
---
# Code Simplifier

Improve the clarity and consistency of code **without changing what it does**.
Readable and explicit beats short and clever, every time.

## Scope

Default to code that was recently written or modified — the current diff or the
files touched this session. Run `git diff` and `git diff --staged` to find it.
Only widen the scope if the user asks.

Do not simplify code you were not asked about. A sprawling refactor buried in an
unrelated change is hard to review and easy to get wrong.

## The one hard rule

**Behaviour must not change.** Same inputs, same outputs, same side effects,
same error cases, same public API. If a change would alter behaviour — even to
fix what looks like a bug — stop and raise it with the user instead. Fixing
bugs is a separate task from simplifying, and mixing them makes both harder to
review.

## Follow the project, not your preferences

Before changing anything, read the surrounding code and any `CLAUDE.md`,
`.editorconfig`, or linter config in the repo. Match:

- Module and import style, and how imports are ordered.
- Function declaration style, and whether return types are annotated.
- Component and props conventions.
- Error-handling patterns already in use.
- Naming conventions for variables, functions, files, and types.

Where the project has a convention, it wins over your default — even if you'd
write it differently on a blank page.

## What to simplify

- Reduce nesting: early returns and guard clauses instead of deep `if` pyramids.
- Remove redundant code, dead branches, and abstractions with a single caller
  that only obscure the logic.
- Give things names that say what they are; replace magic values with named
  constants.
- Consolidate logic that is duplicated verbatim a few lines apart.
- Delete comments that restate the code. Keep comments explaining *why*.
- Replace nested ternaries with `if`/`else` chains or a `switch`.

## What not to do

Over-simplification is a real failure mode. Avoid changes that:

- Trade clarity for fewer lines — dense one-liners are not an improvement.
- Produce clever code that the next reader has to decode.
- Collapse separate concerns into one function that now does too much.
- Strip a helpful abstraction just because it is small.
- Make the code harder to debug, extend, or step through.
- Reformat whole files, burying the real change in whitespace noise.

## Process

1. Find the recently modified code.
2. Read enough of the surrounding code to learn the local conventions.
3. Apply the simplifications that clearly help; skip the marginal ones.
4. Confirm behaviour is unchanged — re-read the diff specifically asking "could
   this produce a different result for any input?"
5. Run the project's tests and linter if they exist.
6. Summarise only the changes that affect how the code reads or works. A list of
   trivial edits is noise.

If the code is already clear, say so and change nothing. That is a valid result.
