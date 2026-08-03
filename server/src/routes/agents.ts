import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';
import { isValidId, resolveWithin, toSafeId } from '../lib/safePath';

const router = Router();

function getAgentsDir(): string {
  return (
    process.env.AGENTS_DIR ||
    path.join(process.env.HOME || '~', '.claude/agents')
  );
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  skills: string[];
  subAgents: string[];
  raw: string;
  createdAt: string;
  updatedAt: string;
}

/** Resolve `<agentsDir>/<id>`, returning null if the id is not a safe slug. */
function resolveAgentDir(agentId: unknown): string | null {
  return resolveWithin(getAgentsDir(), agentId);
}

async function readAgent(agentId: string): Promise<Agent | null> {
  const agentDir = resolveAgentDir(agentId);
  if (!agentDir) return null;

  // Support legacy AGENT.json during transition
  const mdPath = path.join(agentDir, 'AGENT.md');
  const jsonPath = path.join(agentDir, 'AGENT.json');

  let raw: string;
  let filePath: string;

  if (await fs.pathExists(mdPath)) {
    raw = await fs.readFile(mdPath, 'utf-8');
    filePath = mdPath;
  } else if (await fs.pathExists(jsonPath)) {
    const data = await fs.readJson(jsonPath);
    // Migrate JSON → md
    raw = matter.stringify(data.systemPrompt || '', {
      name: data.name || agentId,
      description: data.description || '',
      version: '1.0.0',
      model: data.model || 'claude-sonnet-4-6',
      skills: data.skills || [],
      subAgents: data.subAgents || [],
    });
    await fs.ensureDir(path.dirname(mdPath));
    await fs.writeFile(mdPath, raw, 'utf-8');
    await fs.remove(jsonPath);
    filePath = mdPath;
  } else {
    return null;
  }

  const stat = await fs.stat(filePath);
  const { data, content } = matter(raw);

  return {
    id: agentId,
    name: data.name || agentId,
    description: data.description || '',
    model: data.model || 'claude-sonnet-4-6',
    systemPrompt: content.trim(),
    skills: data.skills || [],
    subAgents: data.subAgents || [],
    raw,
    createdAt: stat.birthtime.toISOString(),
    updatedAt: stat.mtime.toISOString(),
  };
}

async function writeAgentRaw(agentId: string, raw: string): Promise<void> {
  const dir = resolveAgentDir(agentId);
  if (!dir) throw new Error(`Invalid agent id: ${agentId}`);
  await fs.ensureDir(dir);
  await fs.writeFile(path.join(dir, 'AGENT.md'), raw, 'utf-8');
}

// GET /api/agents
router.get('/', async (_req: Request, res: Response) => {
  try {
    await fs.ensureDir(getAgentsDir());
    const entries = await fs.readdir(getAgentsDir(), { withFileTypes: true });
    const agents: Agent[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const agent = await readAgent(entry.name);
      if (agent) agents.push(agent);
    }
    agents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/agents/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid agent id' });
    const agent = await readAgent(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/agents — accepts { raw, model } or legacy fields
router.post('/', async (req: Request, res: Response) => {
  try {
    await fs.ensureDir(getAgentsDir());

    let raw: string = req.body.raw;

    // Legacy form fields → build raw markdown
    if (!raw) {
      const { name, description = '', model = 'claude-sonnet-4-6', systemPrompt = '', skills = [], subAgents = [] } = req.body;
      if (!name) return res.status(400).json({ error: 'name is required' });
      raw = matter.stringify(systemPrompt, { name, description, version: '1.0.0', model, skills, subAgents });
    }

    const { data } = matter(raw);
    if (!data.name) return res.status(400).json({ error: 'name is required in frontmatter' });

    // Override model if provided separately (from the model picker)
    if (req.body.model && req.body.model !== data.model) {
      const parsed = matter(raw);
      parsed.data.model = req.body.model;
      raw = matter.stringify(parsed.content, parsed.data);
    }

    const id = toSafeId(String(data.name));
    const agentDir = id ? resolveAgentDir(id) : null;
    if (!id || !agentDir) {
      return res.status(400).json({ error: 'Name must contain at least one letter or number' });
    }
    if (await fs.pathExists(path.join(agentDir, 'AGENT.md'))) {
      return res.status(409).json({ error: 'Agent with this name already exists' });
    }

    await writeAgentRaw(id, raw);
    res.status(201).json(await readAgent(id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/agents/:id — accepts { raw, model } or legacy fields
router.put('/:id', async (req: Request, res: Response) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ error: 'Invalid agent id' });
    const existing = await readAgent(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Agent not found' });

    let raw: string = req.body.raw;

    if (!raw) {
      // Legacy: patch individual fields onto existing raw
      const parsed = matter(existing.raw);
      if (req.body.name !== undefined) parsed.data.name = req.body.name;
      if (req.body.description !== undefined) parsed.data.description = req.body.description;
      if (req.body.model !== undefined) parsed.data.model = req.body.model;
      if (req.body.skills !== undefined) parsed.data.skills = req.body.skills;
      if (req.body.subAgents !== undefined) parsed.data.subAgents = req.body.subAgents;
      if (req.body.systemPrompt !== undefined) parsed.content = '\n' + req.body.systemPrompt;
      raw = matter.stringify(parsed.content, parsed.data);
    }

    // Override model from picker if provided alongside raw
    if (req.body.model && req.body.raw) {
      const parsed = matter(raw);
      parsed.data.model = req.body.model;
      raw = matter.stringify(parsed.content, parsed.data);
    }

    await writeAgentRaw(req.params.id, raw);
    res.json(await readAgent(req.params.id));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /api/agents/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const agentDir = resolveAgentDir(req.params.id);
    if (!agentDir) return res.status(400).json({ error: 'Invalid agent id' });
    if (!(await fs.pathExists(agentDir))) return res.status(404).json({ error: 'Agent not found' });
    await fs.remove(agentDir);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
