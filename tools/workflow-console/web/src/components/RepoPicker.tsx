import { FolderGit2, Loader2, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type RepoInfo } from '../api';

interface Props {
  repos: RepoInfo[];
  selected?: RepoInfo;
  onSelect: (id: string) => void;
  onChanged: (selectId?: string) => Promise<void>;
}

export function RepoPicker({ repos, selected, onSelect, onChanged }: Props) {
  const [dialog, setDialog] = useState<'add' | 'settings'>();

  return (
    <div className="px-4 pt-4">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11.5px] font-medium uppercase tracking-wide text-ink-faint">Repository</span>
        <div className="flex gap-1">
          <button className="rounded p-1 text-ink-soft hover:bg-paper-sunk hover:text-ink" title="Add a local repo" aria-label="Add repo" onClick={() => setDialog('add')}><Plus size={15} /></button>
          <button className="rounded p-1 text-ink-soft hover:bg-paper-sunk hover:text-ink disabled:opacity-40" title="Repo settings: reference repos and notes" aria-label="Repo settings" disabled={!selected} onClick={() => setDialog('settings')}><Settings2 size={15} /></button>
          {selected && !selected.isLibrary && (
            <button
              className="rounded p-1 text-ink-soft hover:bg-red-50 hover:text-red-600"
              title={`Remove ${selected.name} from the console`}
              aria-label="Remove repo"
              onClick={async () => (await confirmRemove(selected)) && onChanged(repos.find((r) => r.isLibrary)?.id)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <FolderGit2 size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft" />
        <select className="select w-full pl-8 font-mono" value={selected?.id ?? ''} onChange={(e) => onSelect(e.target.value)} aria-label="Repository">
          {repos.map((r) => (
            <option key={r.id} value={r.id} disabled={!r.exists}>
              {r.name}{r.exists ? '' : ' (missing)'}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <div className="mt-1.5 truncate text-[11.5px] text-ink-faint" title={selected.path}>
          {selected.branch && <span className="font-mono text-ink-soft">{selected.branch}</span>}
          {selected.dirty && <span className="text-amber-700"> · uncommitted changes</span>}
          {selected.references.length > 0 && <span> · {selected.references.length} reference{selected.references.length > 1 ? 's' : ''}</span>}
          <div className="truncate">{selected.path.replace(/^\/Users\/[^/]+/, '~')}</div>
        </div>
      )}

      {dialog === 'add' && (
        <AddRepoDialog
          onClose={() => setDialog(undefined)}
          onAdded={async (repo) => {
            setDialog(undefined);
            await onChanged(repo.id);
          }}
        />
      )}
      {dialog === 'settings' && selected && (
        <RepoSettingsDialog
          repo={selected}
          onClose={() => setDialog(undefined)}
          onSaved={async (removed) => {
            setDialog(undefined);
            await onChanged(removed ? repos.find((r) => r.isLibrary)?.id : selected.id);
          }}
        />
      )}
    </div>
  );
}

/** Confirm, then drop a repo from the console's list (nothing on disk is touched). Returns true if removed. */
async function confirmRemove(repo: RepoInfo): Promise<boolean> {
  if (repo.isLibrary) return false;
  if (!window.confirm(`Remove ${repo.name} from the console?\n\nNothing on disk is deleted: the repo, its branches and worktrees stay where they are.`)) return false;
  try {
    await api.removeRepo(repo.id);
    return true;
  } catch (e) {
    window.alert((e as Error).message);
    return false;
  }
}

/** Compact repo dropdown with add / remove, for the run form. Shares selection with the sidebar picker. */
export function RepoSelect({ repos, selected, onSelect, onChanged }: Props) {
  const [adding, setAdding] = useState(false);
  const library = repos.find((r) => r.isLibrary);
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="relative">
        <FolderGit2 size={14} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-soft" />
        <select className="select w-52 py-1 pl-7 font-mono text-[12.5px]" value={selected?.id ?? ''} onChange={(e) => onSelect(e.target.value)} aria-label="Repository for this run">
          {repos.map((r) => (
            <option key={r.id} value={r.id} disabled={!r.exists}>
              {r.name}{r.exists ? '' : ' (missing)'}
            </option>
          ))}
        </select>
      </span>
      <button className="rounded p-1 text-ink-soft hover:bg-paper-sunk hover:text-ink" title="Add a local repo" aria-label="Add repo" onClick={() => setAdding(true)}>
        <Plus size={15} />
      </button>
      {selected && !selected.isLibrary && (
        <button
          className="rounded p-1 text-ink-soft hover:bg-red-50 hover:text-red-600"
          title={`Remove ${selected.name} from the console`}
          aria-label="Remove repo"
          onClick={async () => (await confirmRemove(selected)) && onChanged(library?.id)}
        >
          <Trash2 size={14} />
        </button>
      )}
      {adding && (
        <AddRepoDialog
          onClose={() => setAdding(false)}
          onAdded={async (repo) => {
            setAdding(false);
            await onChanged(repo.id);
          }}
        />
      )}
    </span>
  );
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/25 p-6 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[620px] rounded-xl border border-line bg-paper-raised shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <button className="rounded p-1 text-ink-soft hover:bg-paper-sunk" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function AddRepoDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (repo: RepoInfo) => Promise<void> }) {
  const [path, setPath] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<string[]>();
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState('');

  const add = async (p: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await onAdded(await api.addRepo(p));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const scan = async () => {
    setScanning(true);
    try {
      setFound(await api.discoverRepos());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const visible = useMemo(() => (found ?? []).filter((p) => p.toLowerCase().includes(filter.toLowerCase())), [found, filter]);

  return (
    <Dialog title="Add a local repository" onClose={onClose}>
      <div>
        <label className="mb-1.5 block text-[13px] text-ink-soft">Path to a git repo on this machine</label>
        <div className="flex gap-2">
          <input
            autoFocus
            className="field flex-1 font-mono"
            placeholder="~/Nano/my-service"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && path.trim() && add(path)}
          />
          <button className="btn-primary" disabled={busy || !path.trim()} onClick={() => add(path)}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
          </button>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        {found === undefined ? (
          <button className="btn-ghost" disabled={scanning} onClick={scan}>
            {scanning ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} {scanning ? 'Looking for git repos…' : 'Find repos on this machine'}
          </button>
        ) : (
          <>
            <input className="field mb-2 w-full" placeholder={`Filter ${found.length} repos…`} value={filter} onChange={(e) => setFilter(e.target.value)} />
            <div className="max-h-[300px] overflow-y-auto rounded-lg border border-line">
              {visible.length === 0 && <p className="px-3 py-3 text-[13px] text-ink-faint">No matches.</p>}
              {visible.map((p) => (
                <button key={p} className="block w-full border-b border-line px-3 py-2 text-left last:border-b-0 hover:bg-paper" disabled={busy} onClick={() => add(p)}>
                  <span className="font-mono text-[13px] text-ink">{p.split('/').pop()}</span>
                  <span className="ml-2 font-mono text-[11.5px] text-ink-faint">{p.replace(/^\/Users\/[^/]+/, '~')}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {error && <p className="text-[12.5px] text-red-600">{error}</p>}
    </Dialog>
  );
}

function RepoSettingsDialog({ repo, onClose, onSaved }: { repo: RepoInfo; onClose: () => void; onSaved: (removed?: boolean) => Promise<void> }) {
  const [references, setReferences] = useState(repo.references.join('\n'));
  const [notes, setNotes] = useState(repo.notes);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await api.saveRepo(repo.id, { references: references.split(/[\n,]/).map((r) => r.trim()).filter(Boolean), notes });
      await onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (await confirmRemove(repo)) await onSaved(true);
  };

  return (
    <Dialog title={`${repo.name} settings`} onClose={onClose}>
      <p className="text-[12.5px] leading-relaxed text-ink-soft">
        Saved to <span className="font-mono text-ink">.claude/workflow-console.yaml</span> in the repo. Commit it to share with your team.
      </p>
      <div>
        <label className="mb-1 block text-[13px] font-medium text-ink">Reference repos</label>
        <p className="mb-1.5 text-[12px] text-ink-faint">GitHub repos the reference-researcher studies before design. One per line: owner/name or a github.com URL. Runs can add or remove some.</p>
        <textarea className="field min-h-[84px] w-full font-mono" placeholder={'aws-samples/serverless-patterns\nvercel/next.js'} value={references} onChange={(e) => setReferences(e.target.value)} />
      </div>
      <div>
        <label className="mb-1 block text-[13px] font-medium text-ink">Repo notes</label>
        <p className="mb-1.5 text-[12px] text-ink-faint">Given to every agent: stack, where things live, the checks to run, conventions, threat model.</p>
        <textarea className="field min-h-[200px] w-full font-mono text-[12.5px] leading-relaxed" placeholder={'TypeScript CDK app. Checks: npm run lint, npm test, npx cdk synth.\nMulti-tenant: every query must filter by tenantId.'} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {repo.agentOverrides.length > 0 && (
        <p className="text-[12.5px] text-ink-soft">
          This repo overrides: {repo.agentOverrides.map((a) => <span key={a} className="chip mr-1 border-line bg-paper text-ink-soft">{a}</span>)}
        </p>
      )}
      {error && <p className="whitespace-pre-wrap text-[12.5px] text-red-600">{error}</p>}
      <div className="flex items-center gap-2 border-t border-line pt-4">
        <button className="btn-primary" disabled={busy} onClick={save}>{busy && <Loader2 size={14} className="animate-spin" />} Save</button>
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        {!repo.isLibrary && (
          <button className="btn ml-auto text-red-600 hover:bg-red-50" onClick={remove}><Trash2 size={14} /> Remove from console</button>
        )}
      </div>
    </Dialog>
  );
}
