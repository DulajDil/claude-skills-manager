import express from 'express';
import cors from 'cors';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import skillsRouter from './routes/skills';
import marketplaceRouter from './routes/marketplace';
import usageRouter from './routes/usage';
import agentsRouter from './routes/agents';
import bundledRouter from './routes/bundled';
import { resolveWithin } from './lib/safePath';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/skills', skillsRouter);
app.use('/api/marketplace', marketplaceRouter);
app.use('/api/usage', usageRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/bundled', bundledRouter);

app.post('/api/agents/:id/export', async (req, res) => {
  try {
    const skillsDir = process.env.SKILLS_DIR ||
      path.join(process.env.HOME || '~', '.claude-shared/skills');

    const { default: fs } = await import('fs-extra');
    const { default: matter } = await import('gray-matter');

    // Use the same readAgent logic: check AGENT.md first, fall back to AGENT.json
    const agentsDir = process.env.AGENTS_DIR ||
      path.join(process.env.HOME || '~', '.claude/plugins/claude-skills-manager/agents');

    const agentDir = resolveWithin(agentsDir, req.params.id);
    if (!agentDir) return res.status(400).json({ error: 'Invalid agent id' });

    const mdPath = path.join(agentDir, 'AGENT.md');
    const jsonPath = path.join(agentDir, 'AGENT.json');

    let agent: { id: string; name: string; description: string; model: string; systemPrompt: string; skills: string[] };

    if (await fs.pathExists(mdPath)) {
      const raw = await fs.readFile(mdPath, 'utf-8');
      const { data, content } = matter(raw);
      agent = { id: req.params.id, name: data.name || req.params.id, description: data.description || '', model: data.model || 'claude-sonnet-4-6', systemPrompt: content.trim(), skills: data.skills || [] };
    } else if (await fs.pathExists(jsonPath)) {
      const data = await fs.readJson(jsonPath);
      agent = { id: req.params.id, ...data };
    } else {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Read assigned skill content
    const skillSections: string[] = [];
    for (const skillId of (agent.skills || [])) {
      // Skill ids come from the agent's frontmatter, which is user-editable.
      const skillDir = resolveWithin(skillsDir, skillId);
      if (!skillDir) continue;
      const skillFile = path.join(skillDir, 'SKILL.md');
      if (await fs.pathExists(skillFile)) {
        const raw = await fs.readFile(skillFile, 'utf-8');
        const { data, content } = matter(raw);
        skillSections.push(`### /${data.name || skillId}\n${content.trim()}`);
      }
    }

    const claudeMd = [
      `# ${agent.name}`,
      '',
      agent.description ? `${agent.description}\n` : '',
      '## Agent Instructions',
      '',
      agent.systemPrompt || `You are ${agent.name}. Be helpful and concise.`,
      '',
      `## Model\n\n${agent.model}`,
      '',
      skillSections.length > 0
        ? `## Skills\n\nThis agent has the following skills available as slash commands:\n\n${skillSections.join('\n\n')}`
        : '',
    ].filter(Boolean).join('\n').trim() + '\n';

    const exportDir = process.env.AGENTS_EXPORT_DIR
      ? process.env.AGENTS_EXPORT_DIR
      : path.join(process.env.HOME || '~', 'Nano/ClaudeAi/Agents');
    await fs.ensureDir(exportDir);

    const safeName = agent.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || agent.id;
    const exportFile = path.join(exportDir, `${safeName}.md`);
    if (await fs.pathExists(exportFile)) {
      return res.status(409).json({ error: `File "${safeName}.md" already exists in the Agents folder` });
    }
    await fs.writeFile(exportFile, claudeMd, 'utf-8');

    exec(`open "${exportDir}"`, () => {});
    res.json({ success: true, exportFile });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/open-skills-folder', (_req, res) => {
  const skillsDir = process.env.SKILLS_DIR ||
    path.join(process.env.HOME || '~', '.claude-shared/skills');
  exec(`open "${skillsDir}"`, (err) => {
    if (err) return res.status(500).json({ error: String(err) });
    res.json({ success: true });
  });
});

// Serve React build in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Skills dir: ${process.env.SKILLS_DIR || path.join(process.env.HOME || '~', '.claude-shared/skills')}`);
});
