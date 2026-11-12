import { Check, ExternalLink, FileText, GitBranch, GitPullRequest, Loader2, Play, RotateCw, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type LogEntry, type RepoInfo, type RunState, type SkillInfo } from '../api';
import { SkillTextarea } from './SkillTextarea';
import { ModelSelect } from './ModelSelect';
import { modelLabel } from '../../../shared/schema';
import { OutputPreview } from './OutputPreview';
import { RepoSelect } from './RepoPicker';

export function useRunStream(runId: string | undefined) {
  const [run, setRun] = useState<RunState>();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  useEffect(() => {
    setRun(undefined);
    setLogs([]);
    if (!runId) return;
    const es = new EventSource(`/api/runs/${runId}/events`);
    es.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'state') setRun(ev.run);
      else if (ev.type === 'log') setLogs((prev) => [...prev, ev.entry]);
    };
    return () => es.close();
  }, [runId]);
  return { run, logs };
}

const RUN_STATUS: Record<RunState['status'], string> = {
  running: 'bg-accent-soft text-accent',
  awaiting_approval: 'bg-violet-100 text-violet-700',
  awaiting_permission: 'bg-violet-100 text-violet-700',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  stopped: 'bg-paper-sunk text-ink-soft',
  interrupted: 'bg-amber-100 text-amber-800',
};

export function StatusPill({ status }: { status: RunState['status'] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-medium ${RUN_STATUS[status]}`}>{status.replace('_', ' ')}</span>;
}

interface Props {
  repo?: RepoInfo;
  repos: RepoInfo[];
  onSelectRepo: (id: string) => void;
  onReposChanged: (selectId?: string) => Promise<void>;
  workflow: string;
  /** The workflow runs in the repo's own checkout (uncommitted changes included). */
  inPlace: boolean;
  dirty: boolean;
  runs: RunState[];
  run?: RunState;
  logs: LogEntry[];
  selectedStep?: string;
  onSelectRun: (id: string | undefined) => void;
  onSelectStep: (id: string | undefined) => void;
  onRunsChanged: () => void;
}

export function RunPanel({ repo, repos, onSelectRepo, onReposChanged, workflow, inPlace, dirty, runs, run, logs, selectedStep, onSelectRun, onSelectStep, onRunsChanged }: Props) {
  const [task, setTask] = useState('');
  // In-place workflows (create-pr) exist to publish, and still stop for approval before pushing.
  const [dryRun, setDryRun] = useState(!inPlace);
  useEffect(() => setDryRun(!inPlace), [workflow, inPlace]);
  const [references, setReferences] = useState('');
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [model, setModel] = useState<string>();
  useEffect(() => {
    api.skills(repo?.id).then(setSkills).catch(() => setSkills([]));
  }, [repo?.id]);
  useEffect(() => setReferences(repo?.references.join(', ') ?? ''), [repo?.id, repo?.references]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await fn();
      onRunsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = () =>
    act(async () => {
      if (!repo) throw new Error('Pick a repository first');
      const created = await api.startRun({
        workflow,
        repo: repo.id,
        task,
        dryRun,
        references: references.split(/[\s,]+/).map((r) => r.trim()).filter(Boolean),
        model,
      });
      setTask('');
      onSelectRun(created.id);
    });

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-line bg-paper-raised p-4">
        {repo && (
          <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-ink-soft">
            Runs on <RepoSelect repos={repos} selected={repo} onSelect={onSelectRepo} onChanged={onReposChanged} />
            {repo.branch && <> from <span className="font-mono text-ink">{repo.branch}</span></>}
            <span className="text-ink-faint"> · {repo.path.replace(/^\/Users\/[^/]+/, '~')}</span>
            {inPlace ? (
              <span className="text-emerald-700"> · runs in your checkout{repo.dirty ? ': your uncommitted changes are included' : ' (no uncommitted changes right now)'}</span>
            ) : (
              repo.dirty && <span className="text-amber-700"> · uncommitted changes are not included (runs start from the last commit)</span>
            )}
          </p>
        )}
        <SkillTextarea
          className="field min-h-[84px] w-full resize-y leading-relaxed"
          placeholder={`${inPlace ? 'Optional: what these changes are about, a ticket key, anything the PR should mention…' : `Describe the task for ${workflow}: the idea, ticket, or bug report…`}  Type / to add skills.`}
          value={task}
          onChange={setTask}
          skills={skills}
        />
        <div className="mt-3 flex items-center gap-2">
          <label className="shrink-0 text-[12.5px] text-ink-soft" htmlFor="run-refs">Reference repos</label>
          <input
            id="run-refs"
            className="field flex-1 font-mono text-[12.5px]"
            placeholder="owner/name, owner/name — studied by reference-researcher (github.com links in the task are added too)"
            value={references}
            onChange={(e) => setReferences(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <button className="btn-primary" disabled={busy || (!task.trim() && !inPlace) || !repo} onClick={start}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run
          </button>
          <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft">
            Model
            <ModelSelect
              value={model}
              onChange={setModel}
              emptyLabel="each step's own"
              className="select w-44 py-1 text-[12.5px]"
              title="Use one model for every agent step of this run (overrides step and agent models)"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-[13px] text-ink-soft" title="Publish steps are skipped: nothing is pushed and no PR is opened.">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Dry run (skip publish)
          </label>
          {dirty && <span className="text-[12.5px] text-amber-700">Unsaved edits — runs use the saved version.</span>}
          {error && <span className="text-[12.5px] text-red-600">{error}</span>}
        </div>
      </section>

      {runs.length > 0 && (
        <section>
          <h3 className="mb-2 text-[12px] font-medium uppercase tracking-wide text-ink-faint">Runs</h3>
          <div className="overflow-hidden rounded-xl border border-line bg-paper-raised">
            {runs.map((r) => (
              <button
                key={r.id}
                className={`flex w-full items-center gap-3 border-b border-line px-4 py-2 text-left last:border-b-0 hover:bg-paper ${run?.id === r.id ? 'bg-paper-selected' : ''}`}
                onClick={() => onSelectRun(run?.id === r.id ? undefined : r.id)}
              >
                <StatusPill status={r.status} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.task.split('\n')[0]}</span>
                {r.dryRun && <span className="text-[11.5px] text-ink-faint">dry run</span>}
                <span className="font-mono text-[11.5px] text-ink-faint">${r.totalCostUsd.toFixed(2)}</span>
                <span className="font-mono text-[11.5px] text-ink-faint">{new Date(r.createdAt).toLocaleString()}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {run && <RunDetail run={run} logs={logs} busy={busy} act={act} selectedStep={selectedStep} onSelectStep={onSelectStep} />}
    </div>
  );
}

function RunDetail({
  run,
  logs,
  busy,
  act,
  selectedStep,
  onSelectStep,
}: {
  run: RunState;
  logs: LogEntry[];
  busy: boolean;
  act: (fn: () => Promise<unknown>) => Promise<void>;
  selectedStep?: string;
  onSelectStep: (id: string | undefined) => void;
}) {
  const [feedback, setFeedback] = useState('');
  const stepIds = run.definition.steps.map((s) => s.id);
  const focusStep = selectedStep && stepIds.includes(selectedStep) ? selectedStep : undefined;
  const visible = useMemo(() => logs.filter((l) => !focusStep || l.stepId === focusStep || l.stepId === '-'), [logs, focusStep]);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 120) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  const approvalStep = run.approval?.stepId;
  const approvalIdx = stepIds.indexOf(approvalStep ?? '');
  // What to preview: the agent step before an approval gate (or before a gate with nothing to review); the gate itself after a review loop.
  const prevAgent =
    run.approval?.kind === 'approve' || run.approval?.kind === 'no_changes'
      ? [...run.definition.steps.slice(0, approvalIdx)].reverse().find((s) => s.type !== 'approve' && run.steps[s.id]?.attempts.length)
      : run.definition.steps[approvalIdx];
  const prevAttempt = prevAgent ? run.steps[prevAgent.id]?.attempts.at(-1) : undefined;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-paper-raised px-4 py-3 text-[13px]">
        <StatusPill status={run.status} />
        <span className="font-mono text-[12px] text-ink-soft">{run.repoName} · {run.id}</span>
        {run.worktree ? (
          <span className="inline-flex items-center gap-1 font-mono text-[12px] text-ink-soft" title={run.worktree.path}>
            <GitBranch size={13} /> {run.worktree.branch} ← {run.worktree.base}
          </span>
        ) : run.definition.inPlace ? (
          <span className="text-[12px] text-ink-soft">in place: your checkout · PR base <span className="font-mono">{run.base}</span></span>
        ) : (
          <span className="text-[12px] text-ink-faint">read-only, no worktree</span>
        )}
        <span className="font-mono text-[12px] text-ink-soft">${run.totalCostUsd.toFixed(3)}</span>
        {run.model && <span className="chip border-line bg-paper text-ink-soft">all steps: {modelLabel(run.model)}</span>}
        {run.prUrl && (
          <a className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[12.5px] font-medium text-emerald-800 hover:underline" href={run.prUrl} target="_blank" rel="noreferrer">
            <GitPullRequest size={13} /> {run.prUrl.replace('https://github.com/', '')} <ExternalLink size={11} />
          </a>
        )}
        <div className="ml-auto flex gap-2">
          {['running', 'awaiting_approval', 'awaiting_permission'].includes(run.status) && (
            <button className="btn-ghost" disabled={busy} onClick={() => act(() => api.stop(run.id))}><Square size={13} /> Stop</button>
          )}
          {run.status === 'completed' && run.dryRun && run.definition.steps.some((s) => s.type === 'agent' && s.publish && run.steps[s.id]?.status === 'skipped') && (
            <button className="btn-ghost" disabled={busy} title="Go back to the approval before publish, with dry run off" onClick={() => act(() => api.publishLater(run.id))}>
              <GitPullRequest size={13} /> Publish now…
            </button>
          )}
          {['interrupted', 'stopped', 'failed'].includes(run.status) && (
            <button className="btn-ghost" disabled={busy} onClick={() => act(() => api.resume(run.id))}><RotateCw size={13} /> Resume</button>
          )}
        </div>
        {run.skills?.length ? (
          <p className="w-full text-[12px] text-ink-soft">
            Skills:{' '}
            {run.skills.map((k) => (
              <span key={k} className="chip mr-1 border-violet-200 bg-violet-50 text-violet-700">/{k}</span>
            ))}
          </p>
        ) : null}
        {run.referenceCheckouts?.length ? (
          <p className="w-full text-[12px] text-ink-soft">
            References:{' '}
            {run.referenceCheckouts.map((c) => (
              <span key={c.ref} className={`chip mr-1 ${c.error ? 'border-red-200 bg-red-50 text-red-700' : 'border-line bg-paper text-ink-soft'}`} title={c.error ?? c.path}>
                {c.ref}{c.sha ? ` @ ${c.sha}` : ' ✕'}
              </span>
            ))}
          </p>
        ) : run.references.length ? (
          <p className="w-full text-[12px] text-ink-faint">References: {run.references.join(', ')}</p>
        ) : null}
        {run.error && <p className="w-full text-[12.5px] text-red-600">{run.error}</p>}
      </div>

      {run.status === 'awaiting_approval' && run.approval && (
        <div className="rounded-xl border border-violet-300 bg-violet-50/70 p-4">
          <p className="text-[13px] font-medium text-violet-900">
            <span className="font-mono">{run.approval.stepId}</span> · {run.approval.message}
          </p>
          {prevAgent && prevAttempt && (
            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between text-[12px] text-violet-900/80">
                <span>Preview of <span className="font-mono">{prevAgent.id}</span> (attempt {prevAttempt.n})</span>
                <a className="inline-flex items-center gap-1 font-mono underline" href={api.fileUrl(run.id, `${prevAgent.id}.md`)} target="_blank" rel="noreferrer">
                  {prevAgent.id}.md <ExternalLink size={11} />
                </a>
              </div>
              <OutputPreview runId={run.id} file={`${prevAgent.id}.md`} version={prevAttempt.endedAt} />
            </div>
          )}
          <textarea
            className="field mt-3 min-h-[60px] w-full bg-white"
            placeholder={run.approval.kind === 'approve' ? `Feedback (required to reject — re-runs "${prevAgent?.id}" with it)` : 'Feedback (required to reject — loops back with it)'}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => act(() => api.approve(run.id))}>
              <Check size={14} /> {run.approval.kind === 'approve' ? 'Approve' : 'Continue anyway'}
            </button>
            <button className="btn-ghost" disabled={busy || !feedback.trim()} onClick={() => act(async () => { await api.reject(run.id, feedback); setFeedback(''); })}>
              <X size={14} /> Reject with feedback
            </button>
          </div>
        </div>
      )}

      {run.permission && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-[13px] font-medium text-amber-900">
            <span className="font-mono">{run.permission.stepId}</span> wants to use <span className="font-mono">{run.permission.toolName}</span>
          </p>
          <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-amber-200 bg-white p-2 font-mono text-[12px] text-ink">{JSON.stringify(run.permission.input, null, 2)}</pre>
          <div className="mt-2 flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => act(() => api.permission(run.id, run.permission!.requestId, true))}><Check size={14} /> Allow</button>
            <button className="btn-ghost" disabled={busy} onClick={() => act(() => api.permission(run.id, run.permission!.requestId, false))}><X size={14} /> Deny</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-line bg-paper-raised">
          <button className={`block w-full border-b border-line px-3 py-2 text-left text-[12.5px] ${!focusStep ? 'bg-paper-selected font-medium' : 'hover:bg-paper'}`} onClick={() => onSelectStep(undefined)}>
            All steps
          </button>
          {run.definition.steps.map((s) => {
            const st = run.steps[s.id];
            return (
              <div key={s.id} className={`border-b border-line last:border-b-0 ${focusStep === s.id ? 'bg-paper-selected' : ''}`}>
                <div className="group flex items-center">
                  <button className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left hover:bg-paper" onClick={() => onSelectStep(s.id)}>
                    <span className="font-mono text-[12.5px] text-ink">{s.id}</span>
                    <span className="ml-auto text-[11px] text-ink-faint">{st?.status.replace('_', ' ')}</span>
                  </button>
                  {['failed', 'stopped', 'interrupted', 'completed'].includes(run.status) && s.type !== 'approve' && (
                    <button
                      className="mr-2 rounded p-1 text-ink-faint opacity-0 transition-opacity hover:bg-paper-sunk hover:text-ink focus:opacity-100 group-hover:opacity-100"
                      title={`Re-run from "${s.id}" (later steps run again too)`}
                      aria-label={`Re-run from ${s.id}`}
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Re-run this run from "${s.id}"? Every step after it runs again.`)) void act(() => api.rerunFrom(run.id, s.id));
                      }}
                    >
                      <RotateCw size={12} />
                    </button>
                  )}
                </div>
                {st?.attempts.length ? (
                  <div className="space-y-1 px-3 pb-2">
                    {st.attempts.map((a) => (
                      <div key={a.n} className="text-[11.5px] text-ink-soft">
                        <span className="font-mono">#{a.n}</span> {a.reason}
                        {a.verdict && <span className={a.verdict === 'pass' ? ' text-emerald-700' : ' text-amber-700'}> · {a.verdict.replace('_', ' ')}</span>}
                        {a.costUsd > 0 && <span className="font-mono text-ink-faint"> · ${a.costUsd.toFixed(3)} · {Math.round((a.tokens.input + a.tokens.output + a.tokens.cacheRead + a.tokens.cacheWrite) / 1000)}k tok</span>}
                        <div className="mt-0.5 flex flex-wrap gap-x-2">
                          {a.files.map((f) => (
                            <a key={f} className="inline-flex items-center gap-0.5 font-mono text-accent hover:underline" href={api.fileUrl(run.id, f)} target="_blank" rel="noreferrer">
                              <FileText size={11} />{f}
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        <div ref={logRef} className="max-h-[560px] min-h-[240px] overflow-auto rounded-xl border border-line bg-[#fcfbf8] p-3 font-mono text-[12px] leading-relaxed">
          {visible.length === 0 && <p className="text-ink-faint">No log yet.</p>}
          {visible.map((l, i) => (
            <LogLine key={i} entry={l} showStep={!focusStep} />
          ))}
        </div>
      </div>
    </section>
  );
}

const KIND_STYLE: Record<LogEntry['kind'], string> = {
  text: 'text-ink whitespace-pre-wrap',
  tool: 'text-sky-800',
  tool_result: 'text-red-700',
  result: 'text-emerald-700',
  error: 'text-red-700 font-medium',
  system: 'text-ink-faint',
  human: 'text-violet-700 font-medium',
};

function LogLine({ entry, showStep }: { entry: LogEntry; showStep: boolean }) {
  return (
    <div className="flex gap-2 border-b border-dashed border-line/70 py-1 last:border-b-0">
      <span className="shrink-0 text-ink-faint">{entry.t.slice(11, 19)}</span>
      {showStep && entry.stepId !== '-' && <span className="shrink-0 text-ink-soft">{entry.stepId}</span>}
      {entry.focus && <span className="shrink-0 text-ink-faint">[{entry.focus}]</span>}
      <span className={`min-w-0 break-words ${KIND_STYLE[entry.kind]}`}>{entry.kind === 'tool' ? `› ${entry.text}` : entry.text}</span>
    </div>
  );
}
