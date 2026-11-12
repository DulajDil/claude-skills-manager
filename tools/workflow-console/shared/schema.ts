/**
 * Workflow definition schema, shared by the runner (server) and the editor (web).
 * Workflows live in `.claude/workflows/<name>.yaml`.
 */
import { z } from 'zod';

export const SLUG = /^[a-z0-9][a-z0-9-]*$/;
/** "owner/name" */
export const GITHUB_REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const slug = z.string().min(1).max(64).regex(SLUG, 'lowercase letters, digits and dashes only');

export const PERMISSIONS = ['auto', 'ask', 'read-only'] as const;
export type Permission = (typeof PERMISSIONS)[number];

const agentFields = {
  id: slug,
  agent: slug,
  /** Extra per-step instructions, appended to the agent's prompt. */
  instructions: z.string().optional(),
  /** auto: allow the agent's tools; ask: ask in the UI per tool call; read-only: no edits, Bash limited to safe commands. */
  permissions: z.enum(PERMISSIONS).optional(),
  /** Earlier step ids whose latest output this step receives. Defaults to the workflow's first agent step. */
  inputs: z.array(slug).optional(),
  /** On a `changes_requested` verdict with blocking findings, jump back to this step with the findings. */
  loopTo: slug.optional(),
  maxLoops: z.number().int().min(1).max(10).optional(),
  /** Skills (by name) whose SKILL.md is given to the agent for this step, e.g. generate-commit-message. */
  skills: z.array(slug).optional(),
  /** `references`: only runs when the run has GitHub reference repos; skipped otherwise. */
  when: z.enum(['references']).optional(),
};

export const AgentStepSchema = z.object({
  ...agentFields,
  type: z.literal('agent'),
  /** Allowed to `git push` the run branch and `gh pr create`. Must directly follow an approve step. */
  publish: z.boolean().optional(),
});

export const ParallelStepSchema = z.object({
  ...agentFields,
  type: z.literal('parallel'),
  count: z.number().int().min(1).max(6),
  /** One focus per parallel agent; missing focuses become "general". */
  focuses: z.array(z.string().min(1)).optional(),
});

export const ApproveStepSchema = z.object({
  id: slug,
  type: z.literal('approve'),
  message: z.string().optional(),
});

export const StepSchema = z.discriminatedUnion('type', [AgentStepSchema, ParallelStepSchema, ApproveStepSchema]);

export const WorkflowSchema = z
  .object({
    name: slug,
    description: z.string().default(''),
    /** Read-only workflows run in the repo itself (no worktree) and every step is forced read-only. */
    readOnly: z.boolean().optional(),
    /**
     * Run in the repo's own checkout instead of a fresh worktree, so uncommitted
     * changes are included (e.g. committing and opening a PR for your current work).
     */
    inPlace: z.boolean().optional(),
    /** The step whose output is handed on as "## Plan". Defaults to the first agent step without a `when`. */
    plan: slug.optional(),
    steps: z.array(StepSchema).min(1),
  })
  .superRefine((wf, ctx) => {
    const seen = new Map<string, number>();
    wf.steps.forEach((step, i) => {
      if (seen.has(step.id)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'id'], message: `duplicate step id "${step.id}"` });
      seen.set(step.id, i);
    });
    if (wf.readOnly && wf.inPlace) ctx.addIssue({ code: 'custom', path: ['inPlace'], message: 'readOnly workflows already run in place; drop one of them' });
    if (wf.plan !== undefined) {
      const at = seen.get(wf.plan);
      if (at === undefined || wf.steps[at].type === 'approve') ctx.addIssue({ code: 'custom', path: ['plan'], message: `plan must name an agent step (got "${wf.plan}")` });
    }
    wf.steps.forEach((step, i) => {
      if (step.type === 'approve') return;
      if (step.loopTo !== undefined) {
        const target = seen.get(step.loopTo);
        if (target === undefined || target >= i) {
          ctx.addIssue({ code: 'custom', path: ['steps', i, 'loopTo'], message: `loopTo must name an earlier step (got "${step.loopTo}")` });
        } else if (wf.steps[target].type === 'approve') {
          ctx.addIssue({ code: 'custom', path: ['steps', i, 'loopTo'], message: 'loopTo cannot target an approve step' });
        }
      }
      for (const input of step.inputs ?? []) {
        const at = seen.get(input);
        if (at === undefined || at >= i) ctx.addIssue({ code: 'custom', path: ['steps', i, 'inputs'], message: `input "${input}" must be an earlier step` });
      }
      if (step.type === 'parallel' && (step.focuses?.length ?? 0) > step.count) {
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'focuses'], message: 'more focuses than count' });
      }
      if (step.type === 'agent' && step.publish) {
        if (wf.readOnly) ctx.addIssue({ code: 'custom', path: ['steps', i, 'publish'], message: 'a read-only workflow cannot publish' });
        if (i === 0 || wf.steps[i - 1].type !== 'approve') {
          ctx.addIssue({ code: 'custom', path: ['steps', i, 'publish'], message: 'a publish step must directly follow an approve step' });
        }
      }
    });
  });

export type AgentStep = z.infer<typeof AgentStepSchema>;
export type ParallelStep = z.infer<typeof ParallelStepSchema>;
export type ApproveStep = z.infer<typeof ApproveStepSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

/** The step whose output other steps receive as "## Plan" by default. */
export function planStepId(wf: Pick<Workflow, 'steps' | 'plan'>): string | undefined {
  return wf.plan ?? wf.steps.find((s) => s.type !== 'approve' && !s.when)?.id;
}

/** Inputs a step gets when it doesn't list any: the plan step (unless it is the plan step). */
export function defaultInputs(wf: Pick<Workflow, 'steps' | 'plan'>, stepId: string): string[] {
  const plan = planStepId(wf);
  if (!plan || plan === stepId) return [];
  const planAt = wf.steps.findIndex((s) => s.id === plan);
  const at = wf.steps.findIndex((s) => s.id === stepId);
  return planAt < at ? [plan] : [];
}

/** "design → approve → implement" */
export function stepSummary(wf: Pick<Workflow, 'steps'>): string {
  return wf.steps.map((s) => s.id).join(' → ');
}

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => `${i.path.length ? i.path.join('.') + ': ' : ''}${i.message}`).join('\n');
}

/** `<repo>/.claude/workflow-console.yaml` — committed with the repo. */
export interface RepoSettings {
  /** GitHub repos ("owner/name") the reference-researcher studies. */
  references: string[];
  /** Stack, checks, conventions, threat model: given to every agent working on this repo. */
  notes: string;
}

export interface RepoInfo extends RepoSettings {
  id: string;
  name: string;
  path: string;
  /** The repo the console itself lives in (holds the shared agents and workflows). */
  isLibrary: boolean;
  exists: boolean;
  branch?: string;
  dirty?: boolean;
  /** Agents this repo overrides with its own `.claude/agents/<name>.md`. */
  agentOverrides: string[];
}

export interface ReferenceCheckout {
  ref: string;
  path: string;
  sha?: string;
  error?: string;
}

export interface SkillInfo {
  name: string;
  description: string;
  /** Where it was found: the target repo, your user skills, or the starter set bundled with this console. */
  source: 'repo' | 'user' | 'bundled';
}

/** `/skill-name` mentions in free text (a run's task). */
export function skillMentions(text: string): string[] {
  return [...new Set([...text.matchAll(/(?:^|[\s(])\/([a-z0-9][a-z0-9-]*)(?=$|[\s.,;:!?)])/g)].map((m) => m[1]))];
}

/** Shape the agent list endpoint returns. */
export interface AgentInfo {
  name: string;
  description: string;
  model?: string;
  /** null = every tool */
  tools: string[] | null;
  skills: string[];
  /** MCP tools grouped by server: { atlassian: ['getJiraIssue'] } */
  mcp: Record<string, string[]>;
  /** true when the agent has no edit tools: Bash is limited to read-only commands. */
  readOnly: boolean;
  /** "library" or "repo" (overridden by the target repo's own .claude/agents). */
  source: 'library' | 'repo';
}

export interface Finding {
  severity: 'blocking' | 'minor';
  file: string;
  line: number;
  issue: string;
  fix: string;
  focus?: string;
}

export interface Verdict {
  verdict: 'pass' | 'changes_requested';
  findings: Finding[];
}

export type RunStatus = 'running' | 'awaiting_approval' | 'awaiting_permission' | 'completed' | 'failed' | 'stopped' | 'interrupted';
export type StepStatus = 'pending' | 'running' | 'done' | 'failed' | 'awaiting_approval' | 'skipped' | 'changes_requested';

export interface Attempt {
  n: number;
  reason: 'initial' | 'loop' | 'feedback' | 'resume';
  startedAt: string;
  endedAt?: string;
  /** Relative to the run folder. Parallel steps list one file per agent plus the merged file. */
  files: string[];
  costUsd: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  verdict?: Verdict['verdict'] | 'unparsed';
  error?: string;
}

export interface StepState {
  status: StepStatus;
  attempts: Attempt[];
}

export interface PendingApproval {
  stepId: string;
  kind: 'approve' | 'max_loops' | 'unparsed_verdict' | 'no_changes';
  message: string;
}

export interface PendingPermission {
  requestId: string;
  stepId: string;
  toolName: string;
  input: unknown;
}

export interface RunState {
  id: string;
  workflow: string;
  repoId: string;
  repoName: string;
  /** GitHub reference repos for this run ("owner/name"). */
  references: string[];
  /** Skills picked for the whole run with `/name` in the task; every agent step gets them. */
  skills?: string[];
  referenceCheckouts?: ReferenceCheckout[];
  /** The workflow as it was when the run started; edits don't affect running runs. */
  definition: Workflow;
  task: string;
  dryRun: boolean;
  status: RunStatus;
  currentIndex: number;
  repoRoot: string;
  cwd: string;
  worktree?: { path: string; branch: string; base: string };
  /** Branch PRs target: the worktree base, or the remote's default branch for in-place runs. */
  base: string;
  /** Pull request opened by a publish step. */
  prUrl?: string;
  /** The human chose to continue although the branch had no changes; don't ask again at later gates. */
  noChangesAck?: boolean;
  steps: Record<string, StepState>;
  loopCounts: Record<string, number>;
  /** Findings waiting to be handed to a loop target, keyed by target step id. */
  pendingFindings: Record<string, { from: string; text: string }>;
  /** Human feedback waiting for a step, keyed by step id. */
  pendingFeedback: Record<string, string>;
  approval?: PendingApproval;
  permission?: PendingPermission;
  totalCostUsd: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface LogEntry {
  t: string;
  stepId: string;
  attempt: number;
  focus?: string;
  kind: 'text' | 'tool' | 'tool_result' | 'result' | 'error' | 'system' | 'human';
  text: string;
}
