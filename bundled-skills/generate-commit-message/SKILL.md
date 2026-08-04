---
name: generate-commit-message
description: >-
  Use this skill whenever you need to commit changes or generate a conventional
  commit message for user review.
---

## Purpose

Produce exactly one Conventional Commits v1.0.0 message derived strictly from the
git diff, fast, and **print it to the session CLI**. Output must pass
`@commitlint/config-conventional` defaults (with the documented Jira-scope caveat).

Two behaviours:

- **Generate (default)**: print the message to stdout in the CLI. No file is written. No repo mutation.
- **Commit (on request)**: print the message, then create a signed commit of the
  already-staged changes. Never stages, never writes any file.

There is **no `commit.tmp`**. The message always goes to the CLI. If a commit
can't proceed, print the message to the CLI and say why — never silently write a file.

## Speed mandate

This skill is latency-sensitive. Obey these to stay fast:

- **Minimum git calls.** Generate mode = at most two reads: `git rev-parse --abbrev-ref HEAD`
  and `git --no-pager diff --cached` (fallback to `git --no-pager diff` only if the first is empty).
- **No pre-output staleness re-read in generate mode.** Re-read the diff *only* in
  commit mode, immediately before committing.
- **No extra tooling.** Never run formatters, linters, tests, or `git log` history scans.
- **Single pass.** Derive type, scope, subject, body, and footers in one go; don't iterate
  unless validation (§Validate) actually fails.

## Inputs

- Preferred: staged diff via `git --no-pager diff --cached`
- Fallback: working-tree diff via `git --no-pager diff`

## When to commit

Enter commit mode only when ALL are true; otherwise generate mode:

1. **Intent to commit**: phrases like `commit this`, `/commit`, `go ahead and commit`,
   `git commit`, or post-draft `yes, commit it`. (Phrases like `write/draft/generate a
   commit message` always force generate mode.)
2. **Permission**: `git commit` is allowed this session (`acceptEdits`/`bypassPermissions`,
   or the user granted the prompt).
3. **Committable state**: non-empty staged diff, and branch is not `main`/`master` unless
   the user explicitly authorized that branch this turn.

## Hard safety boundary

- NEVER run `git add`, `git push`, `git rebase`, `git reset`, `git commit --amend`, or any
  history-mutating command. The only repo-mutating command allowed is `git commit -S` in commit mode.
- NEVER stage files. Commit only what is already staged. If nothing is staged, abort and tell the user.
- NEVER modify repository files — no source/docs/config edits, no formatters, no test runs.
- NEVER write any output file (no `commit.tmp`, no scratch files). The message goes to the CLI only.
- NEVER `--no-verify`, `--no-gpg-sign`, or any flag bypassing hooks or signing.
- NEVER infer scope from anything other than: user-provided key > branch name.
- AI/author attribution footer is MANDATORY. A message without it is a failure.
- NEVER commit on `main`/`master` unless the user explicitly directed it this turn.

## Conventional Commits v1.0.0 — enforced rules

Format:

```
<type>[optional scope][!]: <subject>

[optional body]

[optional footer(s)]
```

**Type** — one of `build chore ci docs feat fix perf refactor revert style test`;
lowercase; never empty. `feat` = new feature (MINOR), `fix` = bug fix (PATCH).

**Scope** (optional) — parens after type: `feat(parser):`. commitlint default is
lower-case; this skill emits **Jira keys uppercase** (`feat(PROJ-123):`). If you use Jira
keys, set in commitlint config: `rules: { 'scope-case': [0] }` (or `[2, 'always', 'upper-case']`).

**Subject** — one space after colon; no trailing period; not empty; not sentence/start/
pascal/upper-case; **≤ 72 chars**; imperative present-tense active voice.

**Body** (optional) — exactly one blank line after subject; lines ≤ 100 chars; single-line
bullets only; explain *what* and *why*, not *how*; group changes, don't list files.

**Breaking changes** — `feat(api)!: ...` (terse) and/or a `BREAKING CHANGE: <migration>`
footer (verbose, when migration steps are needed).

**Footers** — one blank line before; git-trailer form `Token-Name: value`; lines ≤ 100 chars
(fold with a leading space if longer); no `Signed-off-by`.

## Workflow

### 1) Scope (issue-key precedence)

1. User-provided Jira/issue key (explicit in request).
2. Else branch name: `git --no-pager rev-parse --abbrev-ref HEAD`, extract first key.
3. Else omit scope.

Jira key regex (case-insensitive; normalize to uppercase in output): `[A-Z][A-Z0-9]+-\d+`.
Never invent a scope word when no key exists — omit it.

### 2) Acquire diff (once)

1. `git --no-pager diff --cached`.
2. If empty, `git --no-pager diff`.
3. If both empty/error, stop: "no diff to summarize."

### 3) Derive intent (diff-only)

Infer type, breaking flag, subject, body strictly from diff hunks — not chat history or prior
commits. Type heuristics, first match wins: API removed/signature changed/config key dropped →
breaking; new user-visible feature → `feat`; defect repair only → `fix`; perf w/o behavior change
→ `perf`; restructure w/o behavior change → `refactor`; whitespace/formatting → `style`;
tests-only → `test`; docs-only → `docs`; `.github/workflows`/CI config → `ci`; build/deps/packaging
→ `build`; revert → `revert`; maintenance w/o prod impact → `chore`. Scope comes from §1 only.

### 4) Attribution tier (diff + session only)

Pick exactly one: majority AI → `Generated-by`; ~half → `Co-authored-by`; minor AI assist →
`Assisted-by`; trivial (just wrote this message) → `Commit-generated-by`. If unsure, credit the
human (less-crediting tier).

### 5) Compose

```
<type>[(<scope>)][!]: <subject>

- <single-line bullet>
- <single-line bullet>

<footer(s)>
```

Footer order: issue refs (`Refs: PROJ-123` / `Closes #42`) → `BREAKING CHANGE:` (only if action
required and not captured by `!`) → exactly one attribution footer.

The human identity comes from the repo's own git config — never a hardcoded name.
Read it from the diff acquisition step's context, or with `git config user.name` and
`git config user.email` if not already known:

```
Commit-generated-by: <user.name> <user.email>
```

For AI-driven tiers, credit the model and add the human as co-author, e.g.:

```
Co-authored-by: <user.name> <user.email>
```

If `user.name` or `user.email` is unset, stop and ask rather than guessing an identity.

(For GitHub noreply attribution, the exact address is under GitHub → Settings →
Emails, and may look like `<ID>+<username>@users.noreply.github.com`.)

### 6) Validate (no git calls — fast)

- Header matches `^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?!?: .+$` and ≤ 72 chars.
- No body/footer line > 100 chars; subject has no trailing period; type lowercase + in enum.
- Exactly one attribution footer present.

If any check fails, regenerate before output.

### 7) Output

**Generate mode (default):** print the full message to the CLI inside a fenced block. Write nothing to disk. Done.

**Commit mode:**

1. Re-read staged diff once; if it changed since §2, re-derive. Confirm staged diff non-empty and
   branch allowed.
2. Print the message to the CLI, then commit:

   ```bash
   git commit -S -m "$(cat <<'EOF'
   <full message here, including blank lines and footers>
   EOF
   )"
   ```

3. No `--no-verify`/`--no-gpg-sign`. No staging. Commit only what's staged.
4. On success: report short SHA + subject.
5. On failure (hook/permission/signing): do NOT retry or amend. Print the message to the CLI so it
   isn't lost, surface the exact error + a one-line diagnosis, and stop.

## Examples

**Minor fix, AI assisted**

```
fix: pin qs to 6.14.2 to address prototype-pollution vulnerability

- add npm override for qs across the dependency tree
- align instantsearch.js resolution to the pinned version

Co-authored-by: Ada Lovelace <ada@example.com>
```

**Feature with Jira scope, AI majority**

```
feat(PROJ-123): add OAuth2 device-code flow to login

- support polling token endpoint with backoff
- surface user_code + verification_uri in CLI output

Refs: PROJ-123
Co-authored-by: Ada Lovelace <ada@example.com>
```

**Docs-only, trivial AI involvement**

```
docs: clarify token-refresh semantics in README

- note that refresh tokens rotate on every use
- add a sequence diagram for the silent-renewal flow

Commit-generated-by: Ada Lovelace <ada@example.com>
```
