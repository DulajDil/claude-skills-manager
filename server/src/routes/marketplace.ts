import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import matter from 'gray-matter';

const router = Router();
const SKILLSMP_API = 'https://skillsmp.com/api/v1/skills';

function getSkillsDir(): string {
  return (
    process.env.SKILLS_DIR ||
    path.join(process.env.HOME || '~', '.claude-shared/skills')
  );
}

// Convert GitHub tree URL to raw SKILL.md URL
// https://github.com/user/repo/tree/branch/path -> https://raw.githubusercontent.com/user/repo/branch/path/SKILL.md
function toRawUrl(githubUrl: string): string {
  const match = githubUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/
  );
  if (match) {
    const [, user, repo, branch, filePath] = match;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${filePath}/SKILL.md`;
  }
  // If it's already a raw URL or blob URL, handle those too
  if (githubUrl.includes('raw.githubusercontent.com')) return githubUrl;
  if (githubUrl.includes('/blob/')) {
    return githubUrl
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }
  return githubUrl;
}

// GET /api/marketplace/search
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, page = '1', limit = '20', sortBy, category, occupation } = req.query;
    if (!q) return res.status(400).json({ error: 'q is required' });

    const params = new URLSearchParams({ q: String(q), page: String(page), limit: String(limit) });
    if (sortBy) params.set('sortBy', String(sortBy));
    if (category) params.set('category', String(category));
    if (occupation) params.set('occupation', String(occupation));

    const apiKey = process.env.SKILLSMP_API_KEY;
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const upstream = await fetch(`${SKILLSMP_API}/search?${params}`, { headers });

    if (!upstream.ok) {
      const body = await upstream.text();
      return res.status(upstream.status).json({ error: body });
    }

    const data = await upstream.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/marketplace/download
router.post('/download', async (req: Request, res: Response) => {
  try {
    const { githubUrl, name, description } = req.body as {
      githubUrl: string;
      name: string;
      description?: string;
    };

    if (!githubUrl || !name) {
      return res.status(400).json({ error: 'githubUrl and name are required' });
    }

    const rawUrl = toRawUrl(githubUrl);
    const rawRes = await fetch(rawUrl);

    if (!rawRes.ok) {
      return res.status(502).json({ error: `Failed to fetch SKILL.md from GitHub: ${rawRes.status}` });
    }

    const rawContent = await rawRes.text();
    const { data: frontmatter, content } = matter(rawContent);

    const skillName = (frontmatter.name || name).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const skillsDir = getSkillsDir();
    const skillDir = path.join(skillsDir, skillName);

    if (await fs.pathExists(skillDir)) {
      return res.status(409).json({ error: `Skill "${skillName}" already exists. Delete it first or rename.` });
    }

    await fs.ensureDir(skillDir);

    // Preserve original frontmatter, fall back to passed metadata
    const finalFrontmatter: Record<string, string> = {
      name: frontmatter.name || skillName,
      description: frontmatter.description || description || '',
      ...(frontmatter.version ? { version: frontmatter.version } : {}),
      source: githubUrl,
    };

    const fileContent = matter.stringify(content.trim(), finalFrontmatter);
    await fs.writeFile(path.join(skillDir, 'SKILL.md'), fileContent, 'utf-8');

    res.json({ success: true, id: skillName, name: finalFrontmatter.name, filePath: path.join(skillDir, 'SKILL.md') });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
