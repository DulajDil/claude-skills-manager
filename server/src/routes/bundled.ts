import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { isValidId, resolveWithin } from '../lib/safePath';

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

interface BundledSkill {
  id: string;
  name: string;
  description: string;
  tagline?: string;
  version?: string;
  content: string;
  installed: boolean;
}

interface Manifest {
  name: string;
  author: string;
  description: string;
  skills: { id: string; tagline?: string }[];
}

async function readManifest(): Promise<Manifest | null> {
  const manifestPath = path.join(getBundledDir(), 'manifest.json');
  if (!(await fs.pathExists(manifestPath))) return null;
  return fs.readJson(manifestPath);
}

async function readBundledSkill(id: string, tagline?: string): Promise<BundledSkill | null> {
  const dir = resolveWithin(getBundledDir(), id);
  if (!dir) return null;

  const skillMd = path.join(dir, 'SKILL.md');
  if (!(await fs.pathExists(skillMd))) return null;

  const raw = await fs.readFile(skillMd, 'utf-8');
  const { data, content } = matter(raw);

  const installedDir = resolveWithin(getSkillsDir(), id);
  const installed = installedDir
    ? await fs.pathExists(path.join(installedDir, 'SKILL.md'))
    : false;

  return {
    id,
    name: data.name || id,
    description: data.description || '',
    tagline,
    version: data.version,
    content: content.trim(),
    installed,
  };
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
      const skill = await readBundledSkill(entry.id, entry.tagline);
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

    const targets = all ? manifest.skills.map((s) => s.id) : [id as string];
    const skillsDir = getSkillsDir();
    await fs.ensureDir(skillsDir);

    const installed: string[] = [];
    const skipped: { id: string; reason: string }[] = [];

    for (const target of targets) {
      const source = resolveWithin(getBundledDir(), target);
      const dest = resolveWithin(skillsDir, target);

      if (!source || !dest || !(await fs.pathExists(path.join(source, 'SKILL.md')))) {
        skipped.push({ id: target, reason: 'not found in bundle' });
        continue;
      }

      if ((await fs.pathExists(dest)) && !overwrite) {
        skipped.push({ id: target, reason: 'already exists' });
        continue;
      }

      await fs.copy(source, dest, { overwrite: true });
      installed.push(target);
    }

    // A single explicit install that got skipped is an error the UI should show,
    // not a silent success.
    if (!all && installed.length === 0) {
      const reason = skipped[0]?.reason ?? 'unknown error';
      const status = reason === 'already exists' ? 409 : 404;
      return res.status(status).json({ error: `Skill "${id}" ${reason}.` });
    }

    res.json({ success: true, installed, skipped, skillsDir });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
