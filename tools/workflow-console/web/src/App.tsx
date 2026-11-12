import { Plus, RotateCcw, Save, Trash2, UserCheck, Bot } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { stepSummary } from '../../shared/schema';
import { api, parseYaml, toYaml, validate, type AgentInfo, type RepoInfo, type RunState, type Step, type Workflow, type WorkflowFile } from './api';
import { FlowDiagram } from './components/FlowDiagram';
import { RepoPicker } from './components/RepoPicker';
import { RunPanel, StatusPill, useRunStream } from './components/RunPanel';
import { StepCard } from './components/StepCard';

type Tab = 'steps' | 'yaml' | 'runs';

const REPO_KEY = 'workflow-console.repo';
const storedRepo = () => {
  try {
    return localStorage.getItem(REPO_KEY) ?? undefined;
  } catch {
    return undefined;
  }
};

function readHash(): { name?: string; tab?: Tab; runId?: string } {
  const [, name, tab, runId] = window.location.hash.split('/');
  return { name: name || undefined, tab: (['steps', 'yaml', 'runs'] as Tab[]).includes(tab as Tab) ? (tab as Tab) : undefined, runId };
}

export default function App() {
  const initial = useMemo(readHash, []);
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [repoId, setRepoId] = useState<string | undefined>(storedRepo);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [commonTools, setCommonTools] = useState<string[]>([]);
  const [files, setFiles] = useState<WorkflowFile[]>([]);
  const [selected, setSelected] = useState<string | undefined>(initial.name);
  const [tab, setTab] = useState<Tab>(initial.tab ?? 'steps');
  const [draft, setDraft] = useState<Workflow>();
  const [yamlText, setYamlText] = useState('');
  const [savedYaml, setSavedYaml] = useState('');
  const [problem, setProblem] = useState<string>();
  const [newName, setNewName] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string }>();
  const [runs, setRuns] = useState<RunState[]>([]);
  const [runId, setRunId] = useState<string | undefined>(initial.runId);
  const [selectedStep, setSelectedStep] = useState<string>();
  const { run, logs } = useRunStream(runId);

  const loadFiles = useCallback(async () => {
    const list = await api.workflows();
    setFiles(list);
    return list;
  }, []);

  const loadRepos = useCallback(async (selectId?: string) => {
    const list = await api.repos();
    setRepos(list);
    setRepoId((current) => {
      const want = selectId ?? current;
      return list.some((r) => r.id === want && r.exists) ? want : list.find((r) => r.isLibrary)?.id ?? list[0]?.id;
    });
  }, []);
  const repo = repos.find((r) => r.id === repoId);

  useEffect(() => {
    if (!repoId) return;
    try {
      localStorage.setItem(REPO_KEY, repoId);
    } catch {
      /* private mode */
    }
    api.agents(repoId).then((a) => { setAgents(a.agents); setCommonTools(a.commonTools); }).catch((e) => setNotice({ kind: 'err', text: e.message }));
  }, [repoId]);

  useEffect(() => {
    loadRepos().catch((e) => setNotice({ kind: 'err', text: `Can't reach the console server: ${e.message}` }));
    loadFiles().then((list) => { if (!initial.name && list[0]) setSelected(list[0].name); }).catch((e) => setNotice({ kind: 'err', text: `Can't reach the console server: ${e.message}` }));
  }, [loadFiles, loadRepos, initial.name]);

  // Load the selected workflow into the editor.
  const file = files.find((f) => f.name === selected);
  useEffect(() => {
    if (!file) return;
    setYamlText(file.yaml);
    setSavedYaml(file.yaml);
    setDraft(file.workflow);
    setProblem(file.error);
    if (!file.workflow) setTab('yaml');
    // Only when switching workflows or after a save/reload, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.name, file?.yaml]);

  useEffect(() => {
    if (!selected) return;
    window.history.replaceState(null, '', `#/${selected}/${tab}${tab === 'runs' && runId ? `/${runId}` : ''}`);
  }, [selected, tab, runId]);

  const loadRuns = useCallback(async () => {
    if (selected && repoId) setRuns(await api.runs(selected, repoId));
  }, [selected, repoId]);
  useEffect(() => {
    setRunId(undefined);
    setSelectedStep(undefined);
  }, [repoId]);
  useEffect(() => {
    void loadRuns();
    if (tab !== 'runs') return;
    const t = setInterval(loadRuns, 4000);
    return () => clearInterval(t);
  }, [loadRuns, tab]);

  const dirty = yamlText !== savedYaml;

  const select = (name: string) => {
    if (name === selected) return;
    if (dirty && !window.confirm('Discard unsaved changes?')) return;
    setSelected(name);
    setRunId(undefined);
    setSelectedStep(undefined);
    if (tab === 'yaml') setTab('steps');
  };

  const updateDraft = (next: Workflow) => {
    setDraft(next);
    setYamlText(toYaml(next));
    setProblem(validate(next));
  };

  const onYaml = (text: string) => {
    setYamlText(text);
    const parsed = parseYaml(text);
    if (parsed.workflow) setDraft(parsed.workflow);
    setProblem(parsed.error);
  };

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    setTimeout(() => setNotice(undefined), 4000);
  };

  const save = async () => {
    if (!selected) return;
    try {
      await api.saveWorkflow(selected, yamlText);
      await loadFiles();
      flash('ok', `Saved .claude/workflows/${selected}.yaml and regenerated /${selected}`);
    } catch (e) {
      flash('err', (e as Error).message);
    }
  };

  const revert = () => {
    if (!file) return;
    setYamlText(file.yaml);
    setDraft(file.workflow);
    setProblem(file.error);
  };

  const remove = async () => {
    if (!selected || !window.confirm(`Delete workflow "${selected}" and its /${selected} command?`)) return;
    try {
      await api.deleteWorkflow(selected);
      const list = await loadFiles();
      setSelected(list[0]?.name);
    } catch (e) {
      flash('err', (e as Error).message);
    }
  };

  const create = async () => {
    const name = newName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name) return;
    try {
      await api.createWorkflow(name);
      await loadFiles();
      setNewName('');
      setSelected(name);
      setTab('steps');
    } catch (e) {
      flash('err', (e as Error).message);
    }
  };

  const setSteps = (steps: Step[]) => draft && updateDraft({ ...draft, steps });
  const changeStep = (i: number, next: Step) => {
    if (!draft) return;
    const oldId = draft.steps[i].id;
    let steps = draft.steps.map((s, j) => (j === i ? next : s));
    if (next.id !== oldId) {
      // Keep loopTo / inputs references pointing at the renamed step.
      steps = steps.map((s) =>
        s.type === 'approve' ? s : { ...s, loopTo: s.loopTo === oldId ? next.id : s.loopTo, inputs: s.inputs?.map((x) => (x === oldId ? next.id : x)) },
      );
    }
    setSteps(steps);
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    if (!draft) return;
    const steps = [...draft.steps];
    [steps[i], steps[i + dir]] = [steps[i + dir], steps[i]];
    setSteps(steps);
  };
  const addStep = (type: 'agent' | 'approve') => {
    if (!draft) return;
    const ids = new Set(draft.steps.map((s) => s.id));
    let n = draft.steps.length + 1;
    while (ids.has(`step-${n}`)) n++;
    const step: Step = type === 'approve' ? { id: `approve-${n}`, type, message: '' } : { id: `step-${n}`, type, agent: agents[0]?.name ?? 'implementer' };
    setSteps([...draft.steps, step]);
  };

  const showingRun = tab === 'runs' && run && run.workflow === selected;
  const diagramSteps = showingRun ? run.definition.steps : draft?.steps ?? [];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="flex w-[300px] shrink-0 flex-col border-r border-line bg-paper">
        <RepoPicker repos={repos} selected={repo} onSelect={setRepoId} onChanged={loadRepos} />
        <div className="mt-3 border-t border-line px-4 pb-3 pt-4">
          <h1 className="text-[15px] font-semibold text-ink">Workflows</h1>
          <div className="mt-3 flex gap-2">
            <input
              className="field min-w-0 flex-1 font-mono"
              placeholder="new-workflow-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <button className="btn-muted hover:bg-ink" onClick={create} disabled={!newName.trim()}>
              <Plus size={14} /> New
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto border-t border-line">
          {files.map((f) => (
            <button
              key={f.name}
              onClick={() => select(f.name)}
              className={`block w-full border-b border-l-[3px] border-b-line px-4 py-3 text-left transition-colors ${f.name === selected ? 'border-l-accent/70 bg-paper-selected' : 'border-l-transparent hover:bg-paper-sunk'}`}
            >
              <div className="font-mono text-[15px] font-medium text-ink">{f.name}</div>
              <div className={`mt-1 text-[12.5px] leading-snug ${f.workflow ? 'text-ink-soft' : 'text-red-600'}`}>
                {f.workflow ? stepSummary(f.workflow) : `invalid: ${f.error?.split('\n')[0]}`}
              </div>
            </button>
          ))}
          {files.length === 0 && <p className="px-4 py-6 text-[13px] text-ink-faint">No workflows in .claude/workflows yet.</p>}
        </nav>
      </aside>

      {/* Main */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        {selected && file ? (
          <div className="mx-auto max-w-[1400px] space-y-5 px-7 py-6">
            <header className="flex items-start gap-4">
              <div className="min-w-0 flex-1 space-y-3">
                <h2 className="font-mono text-[24px] font-bold leading-tight text-ink">{selected}</h2>
                <input
                  className="field w-full max-w-[1080px] text-[13.5px]"
                  placeholder="What this workflow is for"
                  value={draft?.description ?? ''}
                  disabled={!draft}
                  onChange={(e) => draft && updateDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="flex shrink-0 items-center gap-2 pt-1">
                <button className={dirty && !problem ? 'btn-primary' : 'btn-muted'} disabled={!dirty || Boolean(problem)} onClick={save} title={problem ? 'Fix the errors first' : undefined}>
                  <Save size={14} /> Save
                </button>
                <button className="icon-btn" disabled={!dirty} onClick={revert} title="Revert to saved" aria-label="Revert"><RotateCcw size={15} /></button>
                <button className="icon-btn hover:text-red-600" onClick={remove} title="Delete workflow" aria-label="Delete"><Trash2 size={15} /></button>
              </div>
            </header>

            {notice && (
              <div className={`rounded-lg border px-3 py-2 text-[13px] ${notice.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div>
            )}

            {diagramSteps.length > 0 && (
              <div className="space-y-2">
                {showingRun && (
                  <div className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                    <StatusPill status={run.status} /> showing run <span className="font-mono">{run.id}</span>
                  </div>
                )}
                <FlowDiagram
                  steps={diagramSteps}
                  run={showingRun ? run : undefined}
                  selected={showingRun ? selectedStep : undefined}
                  onSelect={(id) => {
                    if (showingRun) setSelectedStep(selectedStep === id ? undefined : id);
                    else if (tab === 'steps') document.getElementById(`step-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
              </div>
            )}

            <div className="flex gap-1 border-b border-line">
              {(['steps', 'yaml', 'runs'] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[13.5px] transition-colors ${tab === t ? 'border-accent font-medium text-ink' : 'border-transparent text-ink-soft hover:text-ink'}`}
                >
                  {t === 'steps' ? 'Steps' : t === 'yaml' ? 'YAML' : `Runs${runs.length ? ` (${runs.length})` : ''}`}
                </button>
              ))}
            </div>

            {problem && tab !== 'runs' && (
              <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-mono text-[12px] text-red-700">{problem}</pre>
            )}

            {tab === 'steps' && draft && (
              <div className="space-y-3">
                <p className="text-[13px] text-ink-soft">
                  {commonTools.length ? (
                    <>Every agent here can use {commonTools.map((t, i) => <span key={t}><span className="font-mono text-ink">{t}</span>{i < commonTools.length - 1 ? ', ' : ''}</span>)}. Each step shows what its agent adds.</>
                  ) : (
                    'Each step shows the tools, MCP servers and skills its agent can use.'
                  )}
                  {draft.readOnly && <span className="ml-2 rounded bg-paper-sunk px-1.5 py-0.5 text-[12px]">read-only workflow · no worktree</span>}
                  {draft.inPlace && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[12px] text-emerald-800">runs in your checkout · uncommitted changes included</span>}
                </p>
                {draft.steps.map((step, i) => (
                  <div key={i} id={`step-${step.id}`}>
                    <StepCard
                      step={step}
                      index={i}
                      steps={draft.steps}
                      agents={agents}
                      commonTools={commonTools}
                      readOnlyWorkflow={Boolean(draft.readOnly)}
                      planId={draft.plan}
                      onChange={(next) => changeStep(i, next)}
                      onMove={(dir) => moveStep(i, dir)}
                      onDelete={() => setSteps(draft.steps.filter((_, j) => j !== i))}
                    />
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <button className="btn-ghost" onClick={() => addStep('agent')}><Bot size={14} /> Add agent step</button>
                  <button className="btn-ghost" onClick={() => addStep('approve')}><UserCheck size={14} /> Add approval</button>
                </div>
              </div>
            )}

            {tab === 'yaml' && (
              <textarea
                className="field min-h-[560px] w-full resize-y font-mono text-[12.5px] leading-relaxed"
                spellCheck={false}
                value={yamlText}
                onChange={(e) => onYaml(e.target.value)}
              />
            )}

            {tab === 'runs' && (
              <RunPanel
                repo={repo}
                repos={repos}
                onSelectRepo={setRepoId}
                onReposChanged={loadRepos}
                workflow={selected}
                inPlace={Boolean(file.workflow?.inPlace)}
                dirty={dirty}
                runs={runs}
                run={run}
                logs={logs}
                selectedStep={selectedStep}
                onSelectRun={(id) => { setRunId(id); setSelectedStep(undefined); }}
                onSelectStep={setSelectedStep}
                onRunsChanged={loadRuns}
              />
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-ink-faint">{notice?.text ?? 'Select a workflow'}</div>
        )}
      </main>
    </div>
  );
}
