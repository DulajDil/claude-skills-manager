# Claude Skills Manager

A local web UI to create, browse, edit, and install Claude Code skills. Skills are written to your local skills directory so Claude Code picks them up automatically. Ships with **Hitman's Skill Set** — a small starter library you can install in one click — and integrates with [skillsmp.com](https://skillsmp.com) to search 1.3M+ community skills.

---

## Features

- **My Skills** — full CRUD for your personal skill library
- **Starter Set** — install the skills bundled in this repo, no network or API key needed
- **Agents** — compose agents from your skills and export them as `CLAUDE.md`
- **Usage** — token and cost breakdown from your local Claude Code logs
- **Marketplace** — search skillsmp.com and download skills directly into Claude
- **Dark / Light mode** — persisted to localStorage
- **Mobile responsive** — works on phone and tablet

---

## Install the shared skills (start here)

If a friend sent you this repo, this is the whole flow:

```bash
git clone https://github.com/DulajDil/claude-skills-manager.git
cd claude-skills-manager
npm run install:all
npm run dev
```

Open <http://localhost:5173>, click **Starter Set**, hit **Install all**, then restart Claude Code. The skills land in your local skills directory and show up as `/commit`, `/debug`, `/explain`, and so on.

Prefer to skip the UI entirely? Copy them by hand:

```bash
cp -R bundled-skills/commit ~/.claude/skills/
# ...or every offline one at once:
for d in bundled-skills/*/; do
  [ -f "$d/SKILL.md" ] && cp -R "$d" ~/.claude/skills/
done
```

### What's in the set

| Skill | What it does |
|-------|--------------|
| `commit` | Conventional commit message read off the staged diff |
| `commit-and-push` | Format, build-check, commit, then push — with approval gates |
| `code-reviewer` | Review a diff for correctness, security, and maintainability, ranked by severity |
| `code-simplifier` | Clean up recently changed code for clarity — without changing behaviour |
| `debug` | Reproduce, locate, hypothesise, verify, fix — no guessing |
| `explain` | Explain code: what, how, why, and the gotchas |
| `pr-description` | Draft a PR title, summary, and test plan from branch commits |
| `test` | Thorough unit tests following the project's existing framework |
| `ui-ux-pro-max` † | Design intelligence: UI styles, colour palettes, font pairings, UX guidelines |

† Fetched from [its upstream repo](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT, by NextLevelBuilder) when you install it, rather than copied into this repo — so you always get the current version. Needs a network connection; the other eight work offline.

**See [`bundled-skills/README.md`](bundled-skills/README.md)** for what each skill does in practice, how to trigger it, and how to add your own to the set.

---

## Quick Start (Local Dev)

### Prerequisites

- Node.js 20+
- npm

### 1. Clone / open the project

```bash
git clone https://github.com/DulajDil/claude-skills-manager.git
cd claude-skills-manager
```

### 2. Install all dependencies

```bash
npm run install:all
```

### 3. Configure environment (optional)

```bash
cp .env.example server/.env
# Edit server/.env to set a custom port or SKILLS_DIR
```

### 4. Start both servers

```bash
npm run dev
```

This starts:
- **Vite dev server** → http://localhost:5173 (frontend, with hot reload)
- **Express API** → http://localhost:3002 (backend)

Open **http://localhost:5173** in your browser.

---

## Security: keep this on localhost

This server reads, writes, and deletes files in your skills directory by design. It has **no authentication**. Anyone who can reach the port can create and delete skills on that machine.

So: run it on `localhost`, or on a LAN you trust. Do **not** put it on a public tunnel or a public Railway URL without adding auth in front of it first. Skill and agent ids are validated as strict slugs so a request can't escape the skills directory ([`server/src/lib/safePath.ts`](server/src/lib/safePath.ts)), but that limits the blast radius — it isn't a substitute for access control.

### Access from your phone (same Wi-Fi)

Find your machine's local IP, then open `http://<your-ip>:3002` on your phone:

```bash
ipconfig getifaddr en0
```

---

## Production Build

Build the React app and compile the server:

```bash
npm run build
```

Start the production server (serves the built React app + API on one port):

```bash
npm start
# → http://localhost:3002
```

---

## Deploy to Railway

> A public Railway URL puts an unauthenticated file-writing API on the internet. Only do this if you add authentication first, and never point `SKILLS_DIR` at a real home directory. See [Security](#security-keep-this-on-localhost).

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app), create a new project → "Deploy from GitHub"
3. Select this repo
4. Railway auto-detects the `Dockerfile` and builds it
5. Add environment variables in Railway's dashboard:
   - `PORT` = `3002` (Railway sets this automatically)
   - `SKILLS_DIR` = `/data/skills` (use a Railway volume for persistence)
   - `SKILLSMP_API_KEY` = your key (optional, raises rate limit to 500/day)

### Persistent storage on Railway

In Railway, add a **volume** mounted at `/data`. Then set:

```
SKILLS_DIR=/data/skills
```

Skills will survive deploys.

---

## Deploy with Docker

```bash
# Build
docker build -t claude-skills .

# Run (mounts your local Claude skills dir)
docker run -p 3002:3002 \
  -e SKILLS_DIR=/skills \
  -v ~/.claude/skills:/skills \
  claude-skills
```

---

## How Skills Work

Each skill you create or install becomes a `SKILL.md` file in your skills directory:

```
<SKILLS_DIR>/                 ← ~/.claude-shared/skills by default
└── <skill-name>/
    └── SKILL.md              ← Claude Code reads this
```

Claude Code discovers skills in `~/.claude/skills` (user-level) and `.claude/skills` (project-level). If you keep a shared library elsewhere — as the default `~/.claude-shared/skills` implies — symlink it in:

```bash
ln -s ~/.claude-shared/skills/commit ~/.claude/skills/commit
```

Set `SKILLS_DIR` in `server/.env` to point straight at `~/.claude/skills` if you'd rather skip the symlinks. Restart Claude Code after installing so it rescans.

### SKILL.md format

```markdown
---
name: my-skill
description: Use this skill when the user asks to... (trigger conditions)
version: 1.0.0
---

# My Skill

## When This Skill Applies
...

## Instructions
...
```

---

## Marketplace Integration

The Marketplace tab connects to [skillsmp.com](https://skillsmp.com):

- **Anonymous**: 50 searches/day (no key needed)
- **Free API key**: 500 searches/day → [sign up at skillsmp.com](https://skillsmp.com)

To use your API key, add it to `server/.env`:

```bash
SKILLSMP_API_KEY=sk_live_your_key_here
```

---

## Project Structure

```
claude-skills-manager/
├── bundled-skills/          # Hitman's Skill Set — ships with the repo
│   ├── README.md            # what each skill does + how to add your own
│   ├── manifest.json        # which skills appear on the Starter Set page
│   └── <skill-name>/SKILL.md
├── server/                  # Express API (TypeScript)
│   ├── src/
│   │   ├── lib/
│   │   │   └── safePath.ts  # slug validation / directory containment
│   │   ├── routes/
│   │   │   ├── skills.ts       # CRUD for local skills
│   │   │   ├── bundled.ts      # starter set listing + install
│   │   │   ├── agents.ts       # agent CRUD
│   │   │   ├── usage.ts        # local token/cost stats
│   │   │   └── marketplace.ts  # SkillsMP proxy + download
│   │   └── index.ts
│   └── package.json
├── client/                  # React + Vite + shadcn/ui
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SkillsPage.tsx
│   │   │   ├── SkillDetailPage.tsx
│   │   │   ├── EditSkillPage.tsx
│   │   │   ├── StarterPage.tsx
│   │   │   ├── MarketplacePage.tsx
│   │   │   ├── UsagePage.tsx
│   │   │   └── Agent*.tsx
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── Dockerfile
├── railway.json
└── .env.example
```

---

## API Reference

### Local Skills

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/skills` | List all skills |
| GET | `/api/skills/:id` | Get a skill |
| POST | `/api/skills` | Create a skill |
| PUT | `/api/skills/:id` | Update a skill |
| DELETE | `/api/skills/:id` | Delete a skill |

Skill ids must match `^[a-z0-9][a-z0-9-]*$`; anything else returns `400`.

### Starter Set (bundled)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bundled` | List bundled skills and whether each is installed |
| POST | `/api/bundled/install` | Install one (`{ id }`) or all (`{ all: true }`); `{ overwrite: true }` replaces |

`install` returns `{ installed, skipped }` — check `skipped` for entries that already existed or whose upstream download failed. Only repos named in `bundled-skills/manifest.json` are ever fetched.

### Marketplace

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/marketplace/search?q=...` | Search skillsmp.com |
| POST | `/api/marketplace/download` | Download skill from GitHub to Claude |

---

## License

MIT — see [LICENSE](LICENSE). The skills authored in this repo are MIT too; use and adapt them freely.

`ui-ux-pro-max` is MIT © [NextLevelBuilder](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) and is fetched from its own repository on install, so its licence travels with it.
