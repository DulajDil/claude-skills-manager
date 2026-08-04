---
name: code-reviewer
description: >-
  Review a diff or a set of files for correctness, security, and maintainability
  and report findings ranked by severity. Use this skill when the user asks to
  "review this", "review my changes", "look over this PR", "check this code
  before I merge", "what's wrong with this", or asks for a second pair of eyes
  on code they are about to ship.
version: 1.0.0
---
# Code Reviewer

Review code the way a careful senior colleague would: find the things that will
actually bite, say so plainly, and skip the noise.

## Scope

Default to reviewing **uncommitted or recently changed code**, not the whole
repository:

1. `git status --short` to see what's in flight.
2. `git diff` for unstaged, `git diff --staged` for staged work.
3. For a branch: `git diff main...HEAD` (or `master`).

If the user names specific files, review those instead. If there is no diff and
no target named, ask what to review rather than reviewing everything.

## What to look for

Work through these in order. The first two earn their keep; the rest are
supporting.

### 1. Correctness

- Off-by-one errors, inverted conditions, wrong operator precedence.
- Unhandled `null`/`undefined`, empty collections, zero, and negative numbers.
- `async` work that isn't awaited; promises whose rejections nobody catches.
- Race conditions between concurrent writes to the same resource.
- Error paths that swallow the error or return a success shape on failure.
- Logic that contradicts what the surrounding code or its callers assume.

### 2. Security

- **Untrusted input reaching a dangerous sink.** Trace the path: request params
  and bodies, CLI args, file contents, and third-party API responses are all
  untrusted. Dangerous sinks include SQL, shell commands, `path.join`, `eval`,
  deserialization, and template rendering.
- Path traversal specifically: any id from a request that gets joined onto a
  directory needs validation, not sanitisation.
- Secrets in source, in logs, or in error messages returned to a caller.
- Authorization checks that are missing, or that run after the side effect.
- Sensitive data written to logs (tokens, PII, full request bodies).

### 3. Resource handling

- Files, sockets, and DB connections opened but not closed on the error path.
- Unbounded growth: reading an entire file or result set into memory, queues
  with no cap, caches with no eviction.
- Queries inside loops that should be a single batched call.

### 4. Maintainability

- Names that mislead about what the thing actually does.
- Duplicated logic that has already drifted between copies.
- Comments that contradict the code — one of them is wrong.
- Dead code and unreachable branches.

### 5. Tests

- Does the change have tests? Do they test behaviour or just restate the
  implementation?
- Are the error paths covered, or only the happy path?

## How to verify before reporting

Do not report a finding you have not checked. For each candidate:

1. Read the surrounding code — the guard you think is missing may be upstream.
2. Construct the concrete failure: what input, what state, what wrong result.
3. If you cannot construct one, either downgrade it to a note or drop it.

A confident, wrong finding costs the reader more than a missed one.

## Output

Group findings by severity. Within each group, most serious first.

```
### Critical      data loss, security holes, crashes on ordinary input
### Important     wrong behaviour in a real edge case, resource leaks
### Minor         naming, duplication, dead code, style inconsistencies
### Notes         things worth knowing that are not defects
```

For each finding, give:

- **Where** — `path/to/file.ts:42`
- **What** — one sentence stating the defect.
- **Why it matters** — the concrete failure: inputs → wrong outcome.
- **Fix** — the smallest change that resolves it, as a snippet where useful.

End with a one-line verdict: safe to merge, merge after fixing the criticals, or
needs rework.

If you find nothing above Minor, say that plainly instead of inflating small
observations into problems. "This looks correct; two minor naming nits" is a
complete and useful review.

## Stay in your lane

- Review the change in front of you, not the architecture it sits in — unless
  the change actively makes that architecture worse.
- Do not rewrite working code to match personal style preferences.
- Follow the conventions already in the file over your own defaults.
- Do not apply fixes unless the user asks you to; report first.
