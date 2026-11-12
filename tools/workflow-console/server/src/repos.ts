import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import YAML from 'yaml';
import { GITHUB_REPO, type RepoInfo, type RepoSettings } from '../../shared/schema.js';
import { AGENTS_DIR, DATA_DIR, EXTRA_REPO, LIBRARY_ROOT, REPOS_FILE, SCAN_ROOTS } from './config.js';

const exec = promisify(execFile);
const SETTINGS_FILE = '.claude/workflow-console.yaml';

interface RepoEntry {
  id: string;
  path: string;
  addedAt: string;
}

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });

async function readRegistry(): Promise<RepoEntry[]> {
  let entries: RepoEntry[] = [];
  try {
    entries = JSON.parse(await fs.readFile(REPOS_FILE, 'utf8'));
  } catch {
    /* first run */
  }
  // The library repo and WORKFLOW_REPO_ROOT are always available.
  let changed = false;
  for (const p of [LIBRARY_ROOT, EXTRA_REPO]) {
    if (p && !entries.some((e) => e.path === p)) {
      entries.push({ id: uniqueId(entries, path.basename(p)), path: p, addedAt: new Date().toISOString() });
      changed = true;
    }
  }
  if (changed) await writeRegistry(entries);
  return entries;
}

async function writeRegistry(entries: RepoEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPOS_FILE, JSON.stringify(entries, null, 2));
}

function uniqueId(entries: RepoEntry[], name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'repo';
  let id = base;
  for (let n = 2; entries.some((e) => e.id === id); n++) id = `${base}-${n}`;
  return id;
}

/** Normalise "owner/name", "github.com/owner/name", or a GitHub URL to "owner/name". */
export function normaliseReference(ref: string): string | null {
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:github\.com\/)?([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?(?:[#?].*)?$/.exec(ref.trim());
  return m && GITHUB_REPO.test(m[1]) ? m[1] : null;
}

/** GitHub repos mentioned in free text, e.g. a task that says "like https://github.com/x/y does". */
export function referencesInText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g)) {
    const ref = normaliseReference(m[1].replace(/[.]+$/, '')); // "…/repo." at the end of a sentence
    if (ref) found.add(ref);
  }
  return [...found];
}

export async function readSettings(repoPath: string): Promise<RepoSettings> {
  try {
    const data = YAML.parse(await fs.readFile(path.join(repoPath, SETTINGS_FILE), 'utf8')) ?? {};
    return {
      references: Array.isArray(data.references) ? data.references.map(String).map(normaliseReference).filter((r: string | null): r is string => r !== null) : [],
      notes: typeof data.notes === 'string' ? data.notes : '',
    };
  } catch {
    return { references: [], notes: '' };
  }
}

async function describe(entry: RepoEntry): Promise<RepoInfo> {
  const info: RepoInfo = { id: entry.id, name: path.basename(entry.path), path: entry.path, isLibrary: entry.path === LIBRARY_ROOT, exists: true, references: [], notes: '', agentOverrides: [] };
  try {
    info.branch = (await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: entry.path })).stdout.trim();
    info.dirty = (await exec('git', ['status', '--porcelain'], { cwd: entry.path })).stdout.trim().length > 0;
  } catch {
    info.exists = false;
    return info;
  }
  Object.assign(info, await readSettings(entry.path));
  if (!info.isLibrary) {
    try {
      info.agentOverrides = (await fs.readdir(path.join(entry.path, '.claude/agents'))).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
    } catch {
      /* none */
    }
  }
  return info;
}

export async function listRepos(): Promise<RepoInfo[]> {
  return Promise.all((await readRegistry()).map(describe));
}

export async function getRepo(id: string): Promise<RepoInfo> {
  const entry = (await readRegistry()).find((e) => e.id === id);
  if (!entry) throw fail(404, `Unknown repo "${id}"`);
  const info = await describe(entry);
  if (!info.exists) throw fail(409, `${entry.path} is missing or no longer a git repo`);
  return info;
}

export async function addRepo(input: string): Promise<RepoInfo> {
  const expanded = input.trim().replace(/^~(?=$|\/)/, os.homedir());
  if (!path.isAbsolute(expanded)) throw fail(400, 'Use an absolute path (or ~/…)');
  let top: string;
  try {
    top = path.resolve((await exec('git', ['rev-parse', '--show-toplevel'], { cwd: expanded })).stdout.trim());
  } catch {
    throw fail(400, `${expanded} is not inside a git repository`);
  }
  const entries = await readRegistry();
  const existing = entries.find((e) => e.path === top);
  if (existing) return describe(existing);
  const entry = { id: uniqueId(entries, path.basename(top)), path: top, addedAt: new Date().toISOString() };
  await writeRegistry([...entries, entry]);
  return describe(entry);
}

export async function removeRepo(id: string): Promise<void> {
  const entries = await readRegistry();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw fail(404, `Unknown repo "${id}"`);
  if (entry.path === LIBRARY_ROOT) throw fail(400, 'The console\'s own repo cannot be removed');
  await writeRegistry(entries.filter((e) => e.id !== id));
}

/** Writes `<repo>/.claude/workflow-console.yaml` — committed with the repo so the team shares it. */
export async function saveSettings(id: string, settings: RepoSettings): Promise<RepoInfo> {
  const repo = await getRepo(id);
  const references = [...new Set(settings.references.map((r) => {
    const n = normaliseReference(r);
    if (!n) throw fail(400, `"${r}" is not a GitHub repo (use owner/name or a github.com URL)`);
    return n;
  }))];
  const doc = new YAML.Document({ references, notes: settings.notes.trim() ? `${settings.notes.trim()}\n` : '' });
  doc.commentBefore = ' Used by tools/workflow-console: GitHub repos to study as references, and notes every agent gets about this repo.';
  await fs.mkdir(path.join(repo.path, '.claude'), { recursive: true });
  await fs.writeFile(path.join(repo.path, SETTINGS_FILE), doc.toString({ lineWidth: 0 }));
  return getRepo(id);
}

/** Git repos under SCAN_ROOTS (depth 4), for the "Find repos" list. Doesn't descend into repos. */
export async function discoverRepos(): Promise<string[]> {
  const SKIP = new Set(['node_modules', 'Library', 'Applications', 'Pictures', 'Music', 'Movies', 'Photos', 'dist', 'build', 'vendor', 'target', 'venv']);
  const found: string[] = [];
  const deadline = Date.now() + 4000;
  let queue = SCAN_ROOTS.map((r) => ({ dir: r, depth: 0 }));
  while (queue.length && Date.now() < deadline && found.length < 300) {
    const next: typeof queue = [];
    await Promise.all(
      queue.map(async ({ dir, depth }) => {
        let names: string[];
        try {
          names = await fs.readdir(dir);
        } catch {
          return;
        }
        if (names.includes('.git')) {
          found.push(dir);
          return;
        }
        if (depth >= 4) return;
        for (const name of names) {
          if (name.startsWith('.') || SKIP.has(name) || name.endsWith('.worktrees')) continue;
          const full = path.join(dir, name);
          try {
            if ((await fs.lstat(full)).isDirectory()) next.push({ dir: full, depth: depth + 1 });
          } catch {
            /* unreadable */
          }
        }
      }),
    );
    queue = next;
  }
  return found.sort();
}

/** Library agents dir plus the target repo's own overrides dir (same file name wins). */
export function agentDirsFor(repoPath: string): string[] {
  const own = path.join(repoPath, '.claude/agents');
  return own === AGENTS_DIR ? [AGENTS_DIR] : [AGENTS_DIR, own];
}
