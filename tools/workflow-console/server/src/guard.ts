import path from 'node:path';

/**
 * Tool-call guard, run as a PreToolUse hook on every agent step. It only ever
 * denies; whether an allowed call also needs a human click is decided by the
 * step's permission mode in canUseTool.
 *
 * This is a best-effort safety net, not a sandbox: the real isolation is that
 * agents work in a throwaway git worktree on their own branch.
 */
export interface GuardContext {
  cwd: string;
  readOnly: boolean;
  /** Publish steps may push this branch and open a PR. */
  publishBranch?: string;
}

export type GuardResult = { ok: true } | { ok: false; reason: string };

const EDIT_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const PROTECTED_BRANCHES = /^(main|master|origin\/main|origin\/master)$/;

/** Commands a read-only agent may run. Matched against each `&&`/`;`/`|` segment. */
const READ_ONLY_COMMANDS: RegExp[] = [
  /^git (log|diff|show|status|blame|rev-parse|ls-files|grep|merge-base|describe|shortlog|cat-file|remote -v)\b/,
  /^git worktree list\b/,
  /^(ls|cat|head|tail|wc|grep|rg|pwd|echo|sort|uniq|cut|tr|jq|stat|du|tree|which|file|basename|dirname|realpath|true|diff)\b/,
  /^sed -n\b/,
  /^find\b(?!.*\s-(delete|exec|execdir|ok|fprint)\b)/,
  /^cd\b/,
  /^npm (run|test|ci)\b/,
  /^npm (install|i)(\s+--?[a-z-]+)*\s*$/,
  /^npx (tsc|vitest|jest|eslint|prettier --check|cdk synth)\b/,
  /^node (--version|-v)\b/,
  /^curl\b(?=.*https?:\/\/(localhost|127\.0\.0\.1)[:/])(?!.*\s(-o|--output|-T|--upload-file)\b)/,
];

/**
 * `git branch` in listing mode (any mix of -a/-r/-v/--list/--sort/--format/
 * --merged…) is read-only; with a write flag or a bare name it creates,
 * deletes or moves a branch.
 */
export function isReadOnlyGitBranch(seg: string): boolean {
  if (!/^git\s+branch\b/.test(seg)) return false;
  const toks = seg.replace(/'[^']*'|"[^"]*"/g, 'X').split(/\s+/).slice(2).filter(Boolean);
  let listing = toks.length === 0;
  let positional = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (/^(-[a-zA-Z]*[dDmMcCfu][a-zA-Z]*|--(delete|move|copy|force|set-upstream-to|unset-upstream|edit-description|track|no-track|create-reflog))(=|$)/.test(t)) return false;
    if (/^--(merged|no-merged|contains|no-contains|points-at|sort|format)$/.test(t)) { listing = true; i++; continue; }
    if (/^--(merged|no-merged|contains|no-contains|points-at|sort|format)=/.test(t) || /^(-[arlvi]+|--(all|remotes|list|verbose|show-current|ignore-case|color|no-color|column|no-column|no-abbrev|omit-empty)|--abbrev=\d+)$/.test(t)) { listing = true; continue; }
    if (t.startsWith('-')) return false;
    positional = true;
  }
  return listing || !positional;
}

/** `git --no-pager -C dir -c k=v log` → `git log`, so every rule sees the real subcommand. */
function normaliseGit(seg: string): string {
  return seg.replace(/^git((?:\s+(?:--no-pager|--no-optional-locks|--paginate|-p|-C\s+\S+|-c\s+\S+|--git-dir(?:=|\s+)\S+|--work-tree(?:=|\s+)\S+))+)(?=\s)/, 'git');
}

function segments(command: string): string[] {
  return command
    .split(/&&|\|\||;|\||\n/)
    .map((s) => normaliseGit(s.trim().replace(/^\(+|\)+$/g, '').trim()))
    .filter(Boolean);
}

function checkBash(command: string, ctx: GuardContext): GuardResult {
  const segs = segments(command);

  for (const seg of segs) {
    if (/^git\s+push\b/.test(seg)) {
      if (!ctx.publishBranch) return { ok: false, reason: 'git push is only allowed in a publish step' };
      if (/\s(-f|--force|--force-with-lease|--mirror|--all|--delete|-d)\b|\s\+/.test(seg)) return { ok: false, reason: 'force/delete/mirror pushes are never allowed' };
      const args = seg.split(/\s+/).slice(2).filter((a) => !a.startsWith('-'));
      const refs = args.slice(1);
      if (refs.length === 0 || refs.some((r) => r.split(':').pop() !== ctx.publishBranch)) {
        return { ok: false, reason: `push only the run branch explicitly: git push -u origin ${ctx.publishBranch}` };
      }
    }
    if (/^gh\s+pr\s+(merge|close|edit)\b/.test(seg)) return { ok: false, reason: `"${seg.split(/\s+/).slice(0, 3).join(' ')}" is not allowed` };
    if (/^gh\s+pr\s+create\b/.test(seg) && !ctx.publishBranch) return { ok: false, reason: 'gh pr create is only allowed in a publish step' };
    if (/^gh\s+(repo|release|api|secret|workflow)\b/.test(seg)) return { ok: false, reason: 'gh repo/release/api/secret/workflow commands are not allowed' };
    if (/^git\s+(checkout|switch)\b/.test(seg) && seg.split(/\s+/).some((a) => PROTECTED_BRANCHES.test(a))) {
      return { ok: false, reason: 'switching to the default branch is not allowed; stay on the run branch' };
    }
    if (/^git\s+branch\s+(-D|-d|--delete|-m|-M|-f)\b/.test(seg)) return { ok: false, reason: 'deleting, renaming or forcing branches is not allowed' };
    if (/^git\s+(worktree|update-ref|filter-branch|replace)\b/.test(seg) && !/^git\s+worktree\s+list\b/.test(seg)) return { ok: false, reason: `git ${seg.split(/\s+/)[1]} is not allowed inside a run` };
    if (/^rm\s+.*-[a-zA-Z]*r[a-zA-Z]*f?\s+(\/|~|\$HOME|\.\.)(\s|\/|$)/.test(seg)) return { ok: false, reason: 'recursive delete outside the worktree is not allowed' };
  }

  if (ctx.readOnly) {
    if (/`|\$\(/.test(command)) return { ok: false, reason: 'read-only: command substitution is not allowed' };
    if (/(^|[^0-9&])>{1,2}(?!\s*\/dev\/null|&)/.test(command)) return { ok: false, reason: 'read-only: output redirection is not allowed' };
    for (const seg of segs) {
      if (!READ_ONLY_COMMANDS.some((re) => re.test(seg)) && !isReadOnlyGitBranch(seg)) {
        return { ok: false, reason: `read-only step: "${seg.slice(0, 80)}" is not on the read-only command list (git log/diff/show/status, ls, cat, grep, find, npm run/test/ci, npx tsc, curl localhost…)` };
      }
    }
  }
  return { ok: true };
}

function inside(cwd: string, file: string): boolean {
  const root = path.resolve(cwd);
  const target = path.resolve(root, file);
  return target === root || target.startsWith(root + path.sep);
}

export function checkToolCall(toolName: string, input: unknown, ctx: GuardContext): GuardResult {
  const args = (input ?? {}) as Record<string, unknown>;
  if (EDIT_TOOLS.has(toolName)) {
    if (ctx.readOnly) return { ok: false, reason: `read-only step: ${toolName} is not allowed` };
    const file = String(args.file_path ?? args.notebook_path ?? '');
    if (file && !inside(ctx.cwd, file)) return { ok: false, reason: `edits must stay inside the run's working directory (${ctx.cwd})` };
  }
  if (toolName === 'Bash') return checkBash(String(args.command ?? ''), ctx);
  return { ok: true };
}
