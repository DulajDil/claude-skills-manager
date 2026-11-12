import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { SLUG, type AgentInfo } from '../../shared/schema.js';
import { AGENTS_DIR } from './config.js';
import { agentDirsFor } from './repos.js';

export interface AgentDef extends AgentInfo {
  /** Markdown body: the agent's system prompt. */
  prompt: string;
  /** The .md file it was loaded from (library or repo override). */
  file: string;
}

const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];

function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

export function parseAgent(name: string, raw: string, source: AgentDef['source'] = 'library', file = ''): AgentDef {
  const { data, content } = matter(raw);
  const tools = data.tools === undefined ? null : toList(data.tools);
  const mcp: Record<string, string[]> = {};
  for (const tool of tools ?? []) {
    const m = /^mcp__([^_]+(?:_[^_]+)*)__(.+)$/.exec(tool);
    if (m) (mcp[m[1]] ??= []).push(m[2]);
  }
  return {
    name: typeof data.name === 'string' && SLUG.test(data.name) ? data.name : name,
    description: String(data.description ?? '').trim(),
    model: data.model ? String(data.model) : undefined,
    tools,
    skills: toList(data.skills),
    mcp,
    // Frontmatter `permissions: auto|read-only` wins; otherwise an agent without edit tools is read-only.
    readOnly: data.permissions === 'read-only' || (data.permissions === undefined && tools !== null && !tools.some((t) => EDIT_TOOLS.includes(t))),
    source,
    prompt: content.trim(),
    file,
  };
}

/**
 * The shared library agents, overlaid with the target repo's own
 * `.claude/agents/*.md` (same name wins) when a repo path is given.
 */
export async function loadAgents(repoPath?: string): Promise<Map<string, AgentDef>> {
  const agents = new Map<string, AgentDef>();
  const dirs = repoPath ? agentDirsFor(repoPath) : [AGENTS_DIR];
  for (const [i, dir] of dirs.entries()) {
    let files: string[] = [];
    try {
      files = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const file of files.filter((f) => f.endsWith('.md')).sort()) {
      const name = file.slice(0, -3);
      if (!SLUG.test(name)) continue;
      const full = path.join(dir, file);
      const agent = parseAgent(name, await fs.readFile(full, 'utf8'), i === 0 ? 'library' : 'repo', full);
      agents.set(agent.name, agent);
    }
  }
  return agents;
}

/**
 * Set (or clear) an agent's default model by editing just the `model:` line of
 * its frontmatter, so the rest of the file keeps its formatting.
 */
export async function setAgentModel(agent: AgentDef, model: string | null): Promise<void> {
  const raw = await fs.readFile(agent.file, 'utf8');
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!m) throw Object.assign(new Error(`${agent.name} has no frontmatter`), { status: 400 });
  let front = m[1].replace(/^model:.*(\r?\n)?/m, '');
  if (model) front = /^tools:.*$/m.test(front) ? front.replace(/^(tools:.*)$/m, `$1\nmodel: ${model}`) : `${front}\nmodel: ${model}`;
  await fs.writeFile(agent.file, raw.replace(m[1], front.replace(/\n+$/, '')));
}

/** Tools every agent with an explicit tool list shares — the UI shows these once instead of on every card. */
export function commonTools(agents: AgentDef[]): string[] {
  const lists = agents.map((a) => a.tools).filter((t): t is string[] => t !== null);
  if (lists.length === 0) return [];
  return lists[0].filter((t) => !t.startsWith('mcp__') && lists.every((l) => l.includes(t)));
}
