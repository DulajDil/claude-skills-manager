import YAML from 'yaml';
import type { AgentInfo, LogEntry, RepoInfo, RunState, SkillInfo, Step, Workflow } from '../../shared/schema';
import { WorkflowSchema, formatZodError } from '../../shared/schema';

export interface WorkflowFile {
  name: string;
  yaml: string;
  workflow?: Workflow;
  error?: string;
}

async function call<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data as T;
}

export const api = {
  agents: (repo?: string) => call<{ agents: AgentInfo[]; commonTools: string[] }>(`/api/agents${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`),
  repos: () => call<RepoInfo[]>('/api/repos'),
  skills: (repo?: string) => call<SkillInfo[]>(`/api/skills${repo ? `?repo=${encodeURIComponent(repo)}` : ''}`),
  discoverRepos: () => call<string[]>('/api/repos/discover'),
  addRepo: (path: string) => call<RepoInfo>('/api/repos', { method: 'POST', json: { path } }),
  saveRepo: (id: string, settings: { references: string[]; notes: string }) => call<RepoInfo>(`/api/repos/${id}`, { method: 'PUT', json: settings }),
  removeRepo: (id: string) => call<void>(`/api/repos/${id}`, { method: 'DELETE' }),
  workflows: () => call<WorkflowFile[]>('/api/workflows'),
  createWorkflow: (name: string) => call<WorkflowFile>('/api/workflows', { method: 'POST', json: { name } }),
  saveWorkflow: (name: string, yaml: string) => call<WorkflowFile>(`/api/workflows/${name}`, { method: 'PUT', json: { yaml } }),
  deleteWorkflow: (name: string) => call<void>(`/api/workflows/${name}`, { method: 'DELETE' }),
  runs: (workflow: string, repo: string) => call<RunState[]>(`/api/runs?workflow=${encodeURIComponent(workflow)}&repo=${encodeURIComponent(repo)}`),
  startRun: (body: { workflow: string; repo: string; task: string; dryRun: boolean; references: string[] }) => call<RunState>('/api/runs', { method: 'POST', json: body }),
  approve: (id: string) => call<RunState>(`/api/runs/${id}/approve`, { method: 'POST', json: {} }),
  reject: (id: string, feedback: string) => call<RunState>(`/api/runs/${id}/reject`, { method: 'POST', json: { feedback } }),
  stop: (id: string) => call<RunState>(`/api/runs/${id}/stop`, { method: 'POST', json: {} }),
  rerunFrom: (id: string, stepId: string) => call<RunState>(`/api/runs/${id}/rerun`, { method: 'POST', json: { stepId } }),
  publishLater: (id: string) => call<RunState>(`/api/runs/${id}/publish`, { method: 'POST', json: {} }),
  resume: (id: string) => call<RunState>(`/api/runs/${id}/resume`, { method: 'POST', json: {} }),
  permission: (id: string, requestId: string, allow: boolean) => call<RunState>(`/api/runs/${id}/permission`, { method: 'POST', json: { requestId, allow } }),
  fileUrl: (id: string, file: string) => `/api/runs/${id}/files/${encodeURIComponent(file)}`,
};

export type { AgentInfo, LogEntry, RepoInfo, RunState, SkillInfo, Step, Workflow };

// ---------------------------------------------------------------- YAML <-> workflow

const STEP_KEY_ORDER = ['id', 'type', 'agent', 'count', 'focuses', 'when', 'skills', 'permissions', 'inputs', 'loopTo', 'maxLoops', 'publish', 'message', 'instructions'];

/** Stable, readable YAML: fixed key order, empty values dropped. */
export function toYaml(wf: Workflow): string {
  const steps = wf.steps.map((s) => {
    const src = s as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of STEP_KEY_ORDER) {
      const v = src[key];
      if (v === undefined || v === '' || v === false) continue;
      if (Array.isArray(v) && v.length === 0 && key !== 'inputs') continue;
      out[key] = v;
    }
    return out;
  });
  const doc: Record<string, unknown> = { name: wf.name, description: wf.description ?? '' };
  if (wf.readOnly) doc.readOnly = true;
  if (wf.inPlace) doc.inPlace = true;
  if (wf.plan) doc.plan = wf.plan;
  doc.steps = steps;
  return YAML.stringify(doc, { lineWidth: 0 });
}

export function parseYaml(text: string): { workflow?: Workflow; error?: string } {
  let data: unknown;
  try {
    data = YAML.parse(text);
  } catch (err) {
    return { error: `YAML: ${(err as Error).message}` };
  }
  const parsed = WorkflowSchema.safeParse(data);
  return parsed.success ? { workflow: parsed.data } : { error: formatZodError(parsed.error) };
}

export function validate(wf: Workflow): string | undefined {
  const parsed = WorkflowSchema.safeParse(wf);
  return parsed.success ? undefined : formatZodError(parsed.error);
}
