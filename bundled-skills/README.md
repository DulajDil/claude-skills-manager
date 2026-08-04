# Hitman's Skill Set

The skills that ship with this repo. Install them from the **Starter Set** tab in
the dashboard, or copy the folders straight into your skills directory.

- [What each skill does](#what-each-skill-does)
- [How skills get triggered](#how-skills-get-triggered)
- [Installing](#installing)
- [Adding your own skill to the set](#adding-your-own-skill-to-the-set)
- [Adding an external skill](#adding-an-external-skill)
- [manifest.json reference](#manifestjson-reference)
- [Licensing](#licensing)

---

## What each skill does

### `commit`
Reads `git diff --staged` and writes a Conventional Commits message from what
actually changed — type, scope, imperative subject, and a body explaining *why*
when the change warrants one.

> "commit this", "write a commit message"

### `commit-and-push`
The full finish-the-job workflow: sanity-check the repo, run the formatter, run
the build, read the staged diff, compose the message, commit, and push. Stops and
asks rather than committing over a failing build, and won't stage things on your
behalf.

> "commit and push", "wrap this up and push it"

### `code-reviewer`
Reviews the current diff for correctness, security, resource handling,
maintainability, and test coverage. Findings are grouped by severity with a
concrete failure scenario for each, and it is told to drop any finding it cannot
actually construct a failure for — so it reports fewer, realer problems.

> "review my changes", "check this before I merge"

### `code-simplifier`
Tidies recently changed code for clarity while holding behaviour fixed. Reads the
project's existing conventions first and follows those over its own defaults.
Explicitly avoids the usual over-simplification traps — dense one-liners, clever
code, collapsing separate concerns.

> "simplify this", "clean this up"

### `debug`
Walks a bug in order: reproduce, locate the true origin (not just where it
surfaced), rank hypotheses, verify each by reading code rather than guessing, fix
minimally, then explain how to confirm.

> "debug this", "why is this failing?"

### `explain`
Explains code in four passes — what it does, how it works, why it's written that
way, and the gotchas. Aimed at a competent developer who is new to the codebase.

> "explain this function", "what does this do?"

### `pr-description`
Builds a PR title, a 2–4 bullet summary, a reviewer test plan, and notes on
breaking changes from the branch's commits and diffstat. Outputs paste-ready
Markdown.

> "write a PR description"

### `test`
Generates unit tests using the framework the project already uses. Covers happy
path, boundaries, and error paths; mocks only external I/O; tests observable
behaviour rather than implementation details.

> "write tests for this"

### `ui-ux-pro-max` (external)
Design intelligence with a large searchable local database — UI styles, colour
palettes, font pairings, UX guidelines, icons, motion presets, and chart types
across many stacks. Maintained upstream by
[NextLevelBuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill)
under MIT; this repo fetches it on install instead of vendoring a copy.

> "design a landing page", "pick a colour palette"

---

## How skills get triggered

Claude Code reads the `description` in each skill's frontmatter and invokes the
skill when your request matches it. You don't have to name the skill — asking
"review my changes" is enough. You *can* also invoke one directly as a slash
command, e.g. `/code-reviewer`.

This is why the `description` field matters more than the body: it is the only
part Claude sees when deciding whether the skill is relevant. Write it as trigger
conditions ("Use when the user asks to…"), not as a summary.

---

## Installing

**From the dashboard** — `npm run dev`, open the **Starter Set** tab, then
**Install all** or install individually. Restart Claude Code afterwards.

**By hand** — copy the folders you want:

```bash
cp -R bundled-skills/code-reviewer ~/.claude/skills/
```

**All of the offline ones at once** (skips the external entry, which has no local
files):

```bash
for d in bundled-skills/*/; do
  [ -f "$d/SKILL.md" ] && cp -R "$d" ~/.claude/skills/
done
```

Confirm they registered by running `/help` in Claude Code, or ask it to list its
available skills.

---

## Adding your own skill to the set

1. Create the folder and file:

   ```bash
   mkdir -p bundled-skills/my-skill
   ```

2. Write `bundled-skills/my-skill/SKILL.md`:

   ```markdown
   ---
   name: my-skill
   description: >-
     Use this skill when the user asks to ... (spell out the trigger phrases).
   version: 1.0.0
   ---
   # My Skill

   ## Scope
   What this applies to, and what it deliberately does not.

   ## Instructions
   Numbered steps. Give the reasoning behind each one so Claude can adapt
   instead of following blindly.

   ## Output
   The shape you want back.
   ```

3. Register it in [`manifest.json`](manifest.json):

   ```json
   { "id": "my-skill", "tagline": "One line for the card in the UI." }
   ```

   The `id` must match the folder name and be a lowercase slug
   (`^[a-z0-9][a-z0-9-]*$`).

4. Refresh the Starter Set page — it appears immediately, no rebuild needed.

Folders may contain more than `SKILL.md`; `references/`, `scripts/`, and `data/`
subdirectories are copied along with it.

### Writing a skill that actually works

- **Put the triggers in `description`.** That is what routing keys off.
- **Say what's out of scope.** Skills that don't bound themselves tend to run on
  everything.
- **Explain why, not just what.** A step with a rationale gets adapted correctly;
  a bare command gets followed off a cliff.
- **Name the failure modes.** "Avoid nested ternaries", "don't apply fixes unless
  asked" — the negative constraints do a lot of the work.

---

## Adding an external skill

For skills that are large or maintained by someone else, add a `source` instead
of files. Nothing is copied into this repo; the server downloads it from GitHub
at install time.

```json
{
  "id": "some-skill",
  "tagline": "What it does.",
  "source": {
    "type": "github",
    "repo": "owner/repo",
    "ref": "main",
    "path": ".claude/skills/some-skill",
    "author": "Author Name",
    "license": "MIT",
    "homepage": "https://github.com/owner/repo",
    "note": "Why this one isn't vendored."
  }
}
```

`path` is optional — omit it when `SKILL.md` sits at the repo root. Only repos
named in this manifest are ever fetched; the dashboard sends an id, never a URL.

Two things to keep in mind:

- **Check the licence before adding one.** Redistribution and fetch-on-install
  are different things, but either way you're pointing people at someone else's
  work — credit the author and record the licence.
- **External installs need the network** and will fail if upstream moves or
  renames the path. The install surfaces that error rather than silently skipping.

---

## manifest.json reference

| Field | Required | Meaning |
|-------|----------|---------|
| `name` | yes | Set name shown as the page heading |
| `author` | no | Credited under the description |
| `description` | no | Sub-heading text |
| `skills[].id` | yes | Folder name / install id; lowercase slug |
| `skills[].tagline` | no | One-line card description; falls back to the skill's own `description` |
| `skills[].source` | no | Present ⇒ external, fetched from GitHub instead of vendored |

---

## Licensing

The skills authored in this repo are MIT, same as the project — see
[`../LICENSE`](../LICENSE). Use and adapt them freely.

`ui-ux-pro-max` is MIT © NextLevelBuilder and is fetched from its own repo, so
its licence travels with it.
