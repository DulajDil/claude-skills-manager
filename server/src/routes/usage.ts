import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs-extra';
import readline from 'readline';

const router = Router();

function getProjectsDir(): string {
  return path.join(process.env.HOME || '~', '.claude/projects');
}

interface DayModelStats {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  total_tokens: number;
  requests: number;
}

interface UsageRow {
  date: string; // YYYY-MM-DD
  model: string;
  stats: DayModelStats;
}

async function parseUsageFromFile(filePath: string): Promise<{ ts: string; model: string; usage: Record<string, number> }[]> {
  const results: { ts: string; model: string; usage: Record<string, number> }[] = [];
  const seen = new Set<string>();

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      const msg = entry?.message;
      if (!msg?.usage || !msg?.model || !entry?.timestamp) continue;

      // Deduplicate by message id
      const msgId = msg.id;
      if (msgId && seen.has(msgId)) continue;
      if (msgId) seen.add(msgId);

      results.push({ ts: entry.timestamp, model: msg.model, usage: msg.usage });
    } catch {
      // skip malformed lines
    }
  }

  return results;
}

// GET /api/usage
router.get('/', async (_req: Request, res: Response) => {
  try {
    const projectsDir = getProjectsDir();
    if (!(await fs.pathExists(projectsDir))) return res.json([]);

    const projectDirs = await fs.readdir(projectsDir, { withFileTypes: true });
    const dayModelMap = new Map<string, DayModelStats>();

    for (const dir of projectDirs) {
      if (!dir.isDirectory()) continue;
      const projectPath = path.join(projectsDir, dir.name);
      const files = await fs.readdir(projectPath);

      for (const file of files) {
        if (!file.endsWith('.jsonl')) continue;
        const entries = await parseUsageFromFile(path.join(projectPath, file));

        for (const { ts, model, usage } of entries) {
          const date = ts.slice(0, 10);
          const key = `${date}||${model}`;

          const existing = dayModelMap.get(key) ?? {
            input_tokens: 0, output_tokens: 0,
            cache_read_tokens: 0, cache_creation_tokens: 0,
            total_tokens: 0, requests: 0,
          };

          existing.input_tokens += usage.input_tokens ?? 0;
          existing.output_tokens += usage.output_tokens ?? 0;
          existing.cache_read_tokens += usage.cache_read_input_tokens ?? 0;
          existing.cache_creation_tokens += usage.cache_creation_input_tokens ?? 0;
          existing.requests += 1;
          existing.total_tokens =
            existing.input_tokens + existing.output_tokens +
            existing.cache_read_tokens + existing.cache_creation_tokens;

          dayModelMap.set(key, existing);
        }
      }
    }

    const rows: UsageRow[] = [];
    for (const [key, stats] of dayModelMap.entries()) {
      const [date, model] = key.split('||');
      rows.push({ date, model, stats });
    }

    rows.sort((a, b) => b.date.localeCompare(a.date) || a.model.localeCompare(b.model));
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
