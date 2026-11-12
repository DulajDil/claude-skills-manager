import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The repo this console lives in. Its `.claude/agents`, `.claude/workflows` and
 * `.claude/commands` are the shared library every target repo uses, and run
 * state lives in its `.workflow-runs/`.
 */
export const LIBRARY_ROOT = path.resolve(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: here, encoding: 'utf8' }).trim());

export const AGENTS_DIR = path.join(LIBRARY_ROOT, '.claude/agents');
export const WORKFLOWS_DIR = path.join(LIBRARY_ROOT, '.claude/workflows');
export const COMMANDS_DIR = path.join(LIBRARY_ROOT, '.claude/commands');
export const RUNS_DIR = path.join(LIBRARY_ROOT, '.workflow-runs');

/** Per-machine state: the list of local repos you've added, and the reference-repo clone cache. */
export const DATA_DIR = process.env.WORKFLOW_CONSOLE_DATA_DIR || path.join(os.homedir(), '.claude', 'workflow-console');
export const REPOS_FILE = path.join(DATA_DIR, 'repos.json');
export const REFERENCE_CACHE = path.join(DATA_DIR, 'references');

/** Optional extra repo to register on startup (kept for `WORKFLOW_REPO_ROOT=… npm run console`). */
export const EXTRA_REPO = process.env.WORKFLOW_REPO_ROOT ? path.resolve(process.env.WORKFLOW_REPO_ROOT) : undefined;

/** Where "Find repos" looks for git repos. Colon-separated. */
export const SCAN_ROOTS = (process.env.WORKFLOW_REPO_SCAN_ROOTS || os.homedir()).split(':').filter(Boolean);

/** Worktrees live next to the target repo, not inside it, so agents in a worktree can't see the main checkout. */
export function worktreesDirFor(repoRoot: string): string {
  return path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}.worktrees`);
}

export const HOST = '127.0.0.1';
export const PORT = Number(process.env.WORKFLOW_CONSOLE_PORT || 3020);
