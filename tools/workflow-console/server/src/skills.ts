import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import { SLUG, type SkillInfo } from '../../shared/schema.js';
import { LIBRARY_ROOT } from './config.js';

export interface ResolvedSkill {
  name: string;
  dir: string;
  body: string;
}

/**
 * Find a skill's SKILL.md: the target repo's .claude/skills, then your user
 * skills (~/.claude/skills, SKILLS_DIR or ~/.claude-shared/skills), then the
 * starter set bundled in this repo. Symlinked skill folders are followed.
 */
function skillRoots(repoPath: string): { dir: string; source: SkillInfo['source'] }[] {
  const home = os.homedir();
  return [
    { dir: path.join(repoPath, '.claude/skills'), source: 'repo' },
    { dir: path.join(home, '.claude/skills'), source: 'user' },
    { dir: process.env.SKILLS_DIR || path.join(home, '.claude-shared/skills'), source: 'user' },
    { dir: path.join(LIBRARY_ROOT, 'bundled-skills'), source: 'bundled' },
  ];
}

/** Every skill available to a repo, first match per name winning (same order as resolveSkill). */
export async function listSkills(repoPath: string): Promise<SkillInfo[]> {
  const found = new Map<string, SkillInfo>();
  for (const { dir: root, source } of skillRoots(repoPath)) {
    let names: string[] = [];
    try {
      names = await fs.readdir(root);
    } catch {
      continue;
    }
    await Promise.all(
      names.filter((n) => SLUG.test(n) && !found.has(n)).map(async (name) => {
        try {
          const { data } = matter(await fs.readFile(path.join(root, name, 'SKILL.md'), 'utf8'));
          if (!found.has(name)) found.set(name, { name, description: String(data.description ?? '').replace(/\s+/g, ' ').trim(), source });
        } catch {
          /* not a skill folder */
        }
      }),
    );
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function resolveSkill(name: string, repoPath: string): Promise<ResolvedSkill | null> {
  if (!SLUG.test(name)) return null;
  for (const { dir: root } of skillRoots(repoPath)) {
    const dir = path.join(root, name);
    try {
      const raw = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
      return { name, dir: await fs.realpath(dir), body: matter(raw).content.trim() };
    } catch {
      /* try the next root */
    }
  }
  return null;
}
