export interface Skill {
  id: string;
  name: string;
  description: string;
  version?: string;
  content: string;
  filePath: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillInput {
  name: string;
  description: string;
  content: string;
  version?: string;
}

export interface ExternalSource {
  type: 'github';
  repo: string;
  ref?: string;
  path?: string;
  author?: string;
  license?: string;
  homepage?: string;
  note?: string;
}

export interface BundledSkill {
  id: string;
  name: string;
  description: string;
  tagline?: string;
  version?: string;
  content: string;
  installed: boolean;
  external: boolean;
  source?: ExternalSource;
}

export interface BundledSet {
  name: string | null;
  author: string | null;
  description: string | null;
  skills: BundledSkill[];
}

export interface InstallResult {
  success: boolean;
  installed: string[];
  skipped: { id: string; reason: string }[];
  skillsDir: string;
}

const BASE = '/api/skills';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  list: () => request<Skill[]>(BASE),
  get: (id: string) => request<Skill>(`${BASE}/${id}`),
  create: (data: SkillInput) => request<Skill>(BASE, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<SkillInput>) =>
    request<Skill>(`${BASE}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean }>(`${BASE}/${id}`, { method: 'DELETE' }),
};

export const bundledApi = {
  list: () => request<BundledSet>('/api/bundled'),
  install: (body: { id?: string; all?: boolean; overwrite?: boolean }) =>
    request<InstallResult>('/api/bundled/install', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
