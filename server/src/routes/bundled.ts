import { Router, Request, Response } from 'express';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { isValidId, resolveWithin, resolveSubpathWithin } from '../lib/safePath';

const execFileAsync = promisify(execFile);
const router = Router();

/**
 * Skills that ship inside this repo, so a fresh clone has something to install
 * without any network access or API key. `bundled-skills/` sits at the repo
 * root, which is three levels up from both server/dist/routes and
 * server/src/routes — dist/ and src/ sit at the same depth, so one path works
 * for dev and production alike.
 */
function getBundledDir(): string {
  return process.env.BUNDLED_SKILLS_DIR || path.resolve(__dirname, '../../../bundled-skills');
}

function getSkillsDir(): string {
  return (
    process.env.SKILLS_DIR ||
    path.join(process.env.HOME || '~', '.claude-shared/skills')
  );
}

/**
 * A skill too large to sensibly vendor (or one whose author maintains it
 * upstream) is declared with a `source` instead of files. It gets fetched from
 * GitHub at install time. Only repos named in the manifest are ever fetched —
 * the client sends an id, never a URL — so this can't be pointed at arbitrary
 * hosts.
 */
interface ExternalSource {
  type: 'github';
  repo: string;
  ref?: string;
  /** Subdirectory within the repo holding SKILL.md, if not the root. */
  path?: string;
  author?: string;
  license?: string;
  homepage?: string;
  note?: string;
}

interface ManifestEntry {
  id: string;
  tagline?: string;
  source?: ExternalSource;
}

interface BundledSkill {
  id: string;
  name: string;
  description: string;
  tagline?: string;
  version?: string;
  content: string;
  installed: boolean;
  external: boolean;
  source?: ExternalSource;
}

interface Manifest {
  name: string;
  author: string;
  description: string;
  skills: ManifestEntry[];
}

const GITHUB_REPO = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;
const GIT_REF = /^[A-Za-z0-9._\-/]+$/;

async function readManifest(): Promise<Manifest | null> {
  const manifestPath = path.join(getBundledDir(), 'manifest.json');
  if (!(await fs.pathExists(manifestPath))) return null;
  return fs.readJson(manifestPath);
}

async function isInstalled(id: string): Promise<boolean> {
  const dir = resolveWithin(getSkillsDir(), id);
  return dir ? fs.pathExists(path.join(dir, 'SKILL.md')) : false;
}

async function readBundledSkill(entry: ManifestEntry): Promise<BundledSkill | null> {
  const { id, tagline, source } = entry;
  if (!isValidId(id)) return null;

  // External entries have no local files to read; describe them from the
  // manifest so the UI can still list and install them.
  if (source) {
    return {
      id,
      name: id,
      description: source.note || '',
      tagline,
      content: '',
      installed: await isInstalled(id),
      external: true,
      source,
    };
  }

  const dir = resolveWithin(getBundledDir(), id);
  if (!dir) return null;

  const skillMd = path.join(dir, 'SKILL.md');
  if (!(await fs.pathExists(skillMd))) return null;

  const raw = await fs.readFile(skillMd, 'utf-8');
  const { data, content } = matter(raw);

  return {
    id,
    name: data.name || id,
    description: data.description || '',
    tagline,
    version: data.version,
    content: content.trim(),
    installed: await isInstalled(id),
    external: false,
  };
}

/**
 * Download a GitHub repo tarball and copy the skill it contains into dest.
 * Uses the system `tar` via execFile (no shell), which is present on macOS,
 * Linux, and the node:20-alpine image.
 */
async function installFromGitHub(source: ExternalSource, dest: string): Promise<void> {
  const ref = source.ref || 'main';
  if (!GITHUB_REPO.test(source.repo)) throw new Error(`Invalid repo: ${source.repo}`);
  if (!GIT_REF.test(ref) || ref.includes('..')) throw new Error(`Invalid ref: ${ref}`);

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'claude-skill-'));
  try {
    const url = `https://codeload.github.com/${source.repo}/tar.gz/${ref}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed (${res.status}) from ${url}`);

    const archive = path.join(tmp, 'skill.tar.gz');
    await fs.writeFile(archive, Buffer.from(await res.arrayBuffer()));

    const extractDir = path.join(tmp, 'extract');
    await fs.ensureDir(extractDir);
    // --strip-components=1 drops the `<repo>-<ref>/` wrapper directory.
    await execFileAsync('tar', ['-xzf', archive, '-C', extractDir, '--strip-components=1']);

    let sourceRoot = extractDir;
    if (source.path) {
      const sub = resolveSubpathWithin(extractDir, source.path);
      if (!sub) throw new Error(`Invalid source path: ${source.path}`);
      sourceRoot = sub;
    }

    if (!(await fs.pathExists(path.join(sourceRoot, 'SKILL.md')))) {
      throw new Error(`No SKILL.md found in ${source.repo}${source.path ? `/${source.path}` : ''}`);
    }

    await fs.remove(dest);
    await fs.copy(sourceRoot, dest, {
      // Skip repo scaffolding that is meaningless once installed as a skill.
      filter: (src) => !/(^|\/)(\.git|\.github|node_modules)(\/|$)/.test(src),
    });
  } finally {
    await fs.remove(tmp);
  }
}

// GET /api/bundled — the starter library shipped with this repo
router.get('/', async (_req: Request, res: Response) => {
  try {
    const manifest = await readManifest();
    if (!manifest) {
      return res.json({ name: null, author: null, description: null, skills: [] });
    }

    const skills: BundledSkill[] = [];
    for (const entry of manifest.skills) {
      const skill = await readBundledSkill(entry);
      if (skill) skills.push(skill);
    }

    res.json({
      name: manifest.name,
      author: manifest.author,
      description: manifest.description,
      skills,
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/bundled/install — copy one bundled skill (or all) into SKILLS_DIR
router.post('/install', async (req: Request, res: Response) => {
  try {
    const { id, all, overwrite } = req.body as { id?: string; all?: boolean; overwrite?: boolean };

    if (!all && !isValidId(id)) {
      return res.status(400).json({ error: 'id is required (or pass all: true)' });
    }

    const manifest = await readManifest();
    if (!manifest) return res.status(404).json({ error: 'No bundled skills found in this install' });

    const targets: ManifestEntry[] = all
      ? manifest.skills
      : manifest.skills.filter((s) => s.id === id);

    if (!all && targets.length === 0) {
      return res.status(404).json({ error: `Skill "${id}" is not in this set.` });
    }

    const skillsDir = getSkillsDir();
    await fs.ensureDir(skillsDir);

    const installed: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const entry of targets) {
      const dest = resolveWithin(skillsDir, entry.id);
      if (!dest) {
        skipped.push({ id: entry.id, reason: 'invalid id' });
        continue;
      }

      if ((await fs.pathExists(dest)) && !overwrite) {
        skipped.push({ id: entry.id, reason: 'already exists' });
        continue;
      }

      try {
        if (entry.source) {
          await installFromGitHub(entry.source, dest);
        } else {
          const src = resolveWithin(getBundledDir(), entry.id);
          if (!src || !(await fs.pathExists(path.join(src, 'SKILL.md')))) {
            skipped.push({ id: entry.id, reason: 'not found in bundle' });
            continue;
          }
          await fs.copy(src, dest, { overwrite: true });
        }
        installed.push(entry.id);
      } catch (err) {
        // One failing download must not abort an install-all run.
        skipped.push({ id: entry.id, reason: String(err instanceof Error ? err.message : err) });
      }
    }

    // A single explicit install that got skipped is an error the UI should show,
    // not a silent success.
    if (!all && installed.length === 0) {
      const reason = skipped[0]?.reason ?? 'unknown error';
      const status = reason === 'already exists' ? 409 : 502;
      return res.status(status).json({ error: `Skill "${id}": ${reason}` });
    }

    res.json({ success: true, installed, skipped, skillsDir });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
