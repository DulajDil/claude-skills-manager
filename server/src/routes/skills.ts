import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { isValidId, resolveWithin, toSafeId } from '../lib/safePath';

const router = Router();

function getSkillsDir(): string {
  return (
    process.env.SKILLS_DIR ||
    path.join(process.env.HOME || '~', '.claude-shared/skills')
  );
}

async function ensurePluginStructure() {
  const skillsDir = getSkillsDir();
  await fs.ensureDir(skillsDir);
}

const isValidSkillId = isValidId;

/** Resolve `<skillsDir>/<id>`, returning null if the id is not a safe slug. */
function resolveSkillDir(id: unknown): string | null {
  return resolveWithin(getSkillsDir(), id);
}

interface Skill {
  id: string;
  name: string;
  description: string;
  version?: string;
  content: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

async function readSkill(skillName: string): Promise<Skill | null> {
  const skillDir = resolveSkillDir(skillName);
  if (!skillDir) return null;
  const skillMdPath = path.join(skillDir, 'SKILL.md');
  const skillJsonPath = path.join(skillDir, 'skill.json');

  if (await fs.pathExists(skillMdPath)) {
    const raw = await fs.readFile(skillMdPath, 'utf-8');
    const { data, content } = matter(raw);
    const stat = await fs.stat(skillMdPath);
    return {
      id: skillName,
      name: data.name || skillName,
      description: data.description || '',
      version: data.version,
      content: content.trim(),
      filePath: skillMdPath,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }

  if (await fs.pathExists(skillJsonPath)) {
    const meta = await fs.readJson(skillJsonPath);
    const stat = await fs.stat(skillJsonPath);
    const readmePath = path.join(skillDir, 'README.md');
    const content = await fs.pathExists(readmePath)
      ? await fs.readFile(readmePath, 'utf-8')
      : '';
    return {
      id: skillName,
      name: meta.name || skillName,
      description: meta.description || '',
      version: meta.version,
      content: content.trim(),
      filePath: skillJsonPath,
      createdAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }

  return null;
}

async function writeSkill(skillName: string, skill: Partial<Skill>): Promise<void> {
  const skillDir = resolveSkillDir(skillName);
  if (!skillDir) throw new Error(`Invalid skill id: ${skillName}`);
  await fs.ensureDir(skillDir);

  const frontmatter: Record<string, string> = {
    name: skill.name || skillName,
    description: skill.description || '',
  };
  if (skill.version) frontmatter.version = skill.version;

  const fileContent = matter.stringify(skill.content || '', frontmatter);
  await fs.writeFile(path.join(skillDir, 'SKILL.md'), fileContent, 'utf-8');
}

// GET /api/skills
router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensurePluginStructure();
    const skillsDir = getSkillsDir();
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: Skill[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      const skill = await readSkill(entry.name);
      if (skill) skills.push(skill);
    }

    skills.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(skills);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/skills/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!isValidSkillId(req.params.id)) return res.status(400).json({ error: 'Invalid skill id' });
    const skill = await readSkill(req.params.id);
    if (!skill) return res.status(404).json({ error: 'Skill not found' });
    res.json(skill);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/skills
router.post('/', async (req: Request, res: Response) => {
  try {
    await ensurePluginStructure();
    const { name, description, content, version } = req.body as Partial<Skill>;

    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = toSafeId(name);
    const skillDir = id ? resolveSkillDir(id) : null;
    if (!id || !skillDir) {
      return res.status(400).json({ error: 'Name must contain at least one letter or number' });
    }
    if (await fs.pathExists(skillDir)) {
      return res.status(409).json({ error: 'Skill with this name already exists' });
    }

    await writeSkill(id, { name, description, content, version });
    const skill = await readSkill(id);
    res.status(201).json(skill);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/skills/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!isValidSkillId(id)) return res.status(400).json({ error: 'Invalid skill id' });
    const existing = await readSkill(id);
    if (!existing) return res.status(404).json({ error: 'Skill not found' });

    const { name, description, content, version } = req.body as Partial<Skill>;
    await writeSkill(id, {
      name: name ?? existing.name,
      description: description ?? existing.description,
      content: content ?? existing.content,
      version: version ?? existing.version,
    });

    const skill = await readSkill(id);
    res.json(skill);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/skills/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const skillDir = resolveSkillDir(req.params.id);
    if (!skillDir) return res.status(400).json({ error: 'Invalid skill id' });

    if (!(await fs.pathExists(skillDir))) {
      return res.status(404).json({ error: 'Skill not found' });
    }

    await fs.remove(skillDir);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
