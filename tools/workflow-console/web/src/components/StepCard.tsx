import { ArrowDown, ArrowUp, Bot, UserCheck, Users, X } from 'lucide-react';
import type { AgentInfo, Step } from '../../../shared/schema';
import { PERMISSIONS, defaultInputs } from '../../../shared/schema';

interface Props {
  step: Step;
  index: number;
  steps: Step[];
  agents: AgentInfo[];
  commonTools: string[];
  readOnlyWorkflow: boolean;
  planId?: string;
  onChange: (next: Step) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
}

const TYPE_LABEL: Record<Step['type'], string> = {
  agent: 'runs an agent',
  parallel: 'runs agents in parallel',
  approve: 'you approve before the run goes on',
};

export function AgentChips({ agent, commonTools }: { agent: AgentInfo; commonTools: string[] }) {
  const extraTools = agent.tools?.filter((t) => !t.startsWith('mcp__') && !commonTools.includes(t)) ?? [];
  return (
    <div className="flex flex-wrap gap-1.5">
      {agent.tools === null && <span className="chip border-amber-300 bg-amber-50 text-amber-800">every tool</span>}
      {extraTools.map((t) => (
        <span key={t} className="chip border-sky-200 bg-sky-50 text-sky-800">{t}</span>
      ))}
      {Object.entries(agent.mcp).map(([server, tools]) => (
        <span key={server} className="chip border-sky-200 bg-sky-50 text-sky-800">{server}: {tools.join(', ')}</span>
      ))}
      {agent.skills.map((s) => (
        <span key={s} className="chip border-violet-200 bg-violet-50 text-violet-700">skill: {s}</span>
      ))}
      {agent.readOnly && <span className="chip border-line bg-paper-sunk text-ink-soft">read-only</span>}
      {agent.model && <span className="chip border-line bg-paper-raised text-ink-faint">model: {agent.model}</span>}
      {agent.source === 'repo' && <span className="chip border-emerald-200 bg-emerald-50 text-emerald-800">repo override</span>}
    </div>
  );
}

export function StepCard({ step, index, steps, agents, commonTools, readOnlyWorkflow, planId, onChange, onMove, onDelete }: Props) {
  const Icon = step.type === 'approve' ? UserCheck : step.type === 'parallel' ? Users : Bot;
  const earlier = steps.slice(0, index);
  const set = (patch: Partial<Step>) => onChange({ ...step, ...patch } as Step);

  const changeType = (type: Step['type']) => {
    if (type === step.type) return;
    if (type === 'approve') return onChange({ id: step.id, type: 'approve', message: '' });
    const base =
      step.type === 'approve'
        ? { id: step.id, agent: agents[0]?.name ?? 'implementer' }
        : { id: step.id, agent: step.agent, instructions: step.instructions, permissions: step.permissions, inputs: step.inputs, loopTo: step.loopTo, maxLoops: step.maxLoops };
    onChange(type === 'parallel' ? { ...base, type, count: 2 } : { ...base, type });
  };

  return (
    <div className="rounded-xl border border-line bg-paper-raised px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon size={16} className="shrink-0 text-ink-soft" />
        <input
          className="field w-44 font-mono text-[14px]"
          value={step.id}
          onChange={(e) => set({ id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
          aria-label="Step id"
        />
        <select className="cursor-pointer appearance-none bg-transparent text-[13px] text-ink-soft outline-none hover:text-ink" value={step.type} onChange={(e) => changeType(e.target.value as Step['type'])} aria-label="Step type">
          {Object.entries(TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-0.5 text-ink-soft">
          <button className="rounded p-1 hover:bg-paper-sunk disabled:opacity-30" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up"><ArrowUp size={15} /></button>
          <button className="rounded p-1 hover:bg-paper-sunk disabled:opacity-30" disabled={index === steps.length - 1} onClick={() => onMove(1)} aria-label="Move down"><ArrowDown size={15} /></button>
          <button className="rounded p-1 hover:bg-red-50 hover:text-red-600" onClick={onDelete} aria-label="Delete step"><X size={15} /></button>
        </div>
      </div>

      {step.type === 'approve' ? (
        <div className="mt-3 pl-7">
          <input className="field w-full" placeholder="What should you check before approving?" value={step.message ?? ''} onChange={(e) => set({ message: e.target.value })} />
        </div>
      ) : (
        <AgentFields step={step} steps={steps} planId={planId} earlier={earlier} agents={agents} commonTools={commonTools} readOnlyWorkflow={readOnlyWorkflow} set={set} />
      )}
    </div>
  );
}

function AgentFields({
  step,
  steps,
  planId,
  earlier,
  agents,
  commonTools,
  readOnlyWorkflow,
  set,
}: {
  step: Exclude<Step, { type: 'approve' }>;
  steps: Step[];
  planId?: string;
  earlier: Step[];
  agents: AgentInfo[];
  commonTools: string[];
  readOnlyWorkflow: boolean;
  set: (patch: Partial<Step>) => void;
}) {
  const agent = agents.find((a) => a.name === step.agent);
  const loopTargets = earlier.filter((s) => s.type !== 'approve');
  const inputs = step.inputs ?? defaultInputs({ steps, plan: planId }, step.id);

  return (
    <div className="mt-3 space-y-3 pl-7">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="text-[13px] text-ink-soft">Agent</label>
        <select className="select w-56" value={step.agent} onChange={(e) => set({ agent: e.target.value })}>
          {!agent && <option value={step.agent}>{step.agent} (missing)</option>}
          {agents.map((a) => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>
        {step.type === 'parallel' && (
          <>
            <label className="ml-2 text-[13px] text-ink-soft">Agents</label>
            <input type="number" min={1} max={6} className="field w-16" value={step.count} onChange={(e) => set({ count: Math.max(1, Math.min(6, Number(e.target.value) || 1)) } as Partial<Step>)} />
            <label className="ml-2 text-[13px] text-ink-soft">Focuses</label>
            <input
              className="field min-w-[16rem] flex-1 font-mono"
              placeholder="correctness, tests, readability"
              value={(step.focuses ?? []).join(', ')}
              onChange={(e) => set({ focuses: e.target.value.split(',').map((f) => f.trim()).filter(Boolean) } as Partial<Step>)}
            />
          </>
        )}
      </div>

      {agent ? (
        <>
          <p className="text-[13px] leading-relaxed text-ink-soft">{agent.description}</p>
          <AgentChips agent={agent} commonTools={commonTools} />
        </>
      ) : (
        <p className="text-[13px] text-red-600">No agent named “{step.agent}” in .claude/agents.</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="text-[13px] text-ink-soft">Permissions</label>
        <select className="select w-40" value={readOnlyWorkflow ? 'read-only' : step.permissions ?? (agent?.readOnly ? 'read-only' : 'auto')} disabled={readOnlyWorkflow} onChange={(e) => set({ permissions: e.target.value as (typeof PERMISSIONS)[number] })}>
          {PERMISSIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <label className="ml-2 text-[13px] text-ink-soft">Loop to</label>
        <select className="select w-36" value={step.loopTo ?? ''} onChange={(e) => set({ loopTo: e.target.value || undefined, maxLoops: e.target.value ? step.maxLoops ?? 2 : undefined })}>
          <option value="">none</option>
          {loopTargets.map((s) => (
            <option key={s.id} value={s.id}>{s.id}</option>
          ))}
        </select>
        {step.loopTo && (
          <>
            <label className="text-[13px] text-ink-soft">max</label>
            <input type="number" min={1} max={10} className="field w-16" value={step.maxLoops ?? 2} onChange={(e) => set({ maxLoops: Math.max(1, Math.min(10, Number(e.target.value) || 1)) })} />
          </>
        )}
        {step.type === 'agent' && (
          <label className="ml-2 inline-flex items-center gap-1.5 text-[13px] text-ink-soft" title="May push the run branch and open a PR. Must directly follow an approve step.">
            <input type="checkbox" checked={Boolean(step.publish)} onChange={(e) => set({ publish: e.target.checked || undefined } as Partial<Step>)} />
            publishes (push + PR)
          </label>
        )}
        <label className="ml-2 inline-flex items-center gap-1.5 text-[13px] text-ink-soft" title="Skip this step unless the run has GitHub reference repos.">
          <input type="checkbox" checked={step.when === 'references'} onChange={(e) => set({ when: e.target.checked ? 'references' : undefined })} />
          only with reference repos
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="text-[13px] text-ink-soft" title="Each skill's SKILL.md is given to the agent for this step. Looked up in the repo's .claude/skills, ~/.claude/skills, then the bundled set.">Skills</label>
        <input
          className="field min-w-[16rem] flex-1 font-mono"
          placeholder="e.g. generate-commit-message"
          value={(step.skills ?? []).join(', ')}
          onChange={(e) => {
            const skills = e.target.value.split(',').map((k) => k.trim()).filter(Boolean);
            set({ skills: skills.length ? skills : undefined });
          }}
        />
        {(step.skills ?? []).map((k) => (
          <span key={k} className="chip border-violet-200 bg-violet-50 text-violet-700">skill: {k}</span>
        ))}
      </div>

      {earlier.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1.5 text-[13px] text-ink-soft">Gets output of</span>
          {earlier
            .filter((s) => s.type !== 'approve')
            .map((s) => {
              const on = inputs.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`chip transition-colors ${on ? 'border-ink/30 bg-ink text-paper-raised' : 'border-line bg-paper text-ink-faint hover:text-ink'}`}
                  onClick={() => set({ inputs: on ? inputs.filter((x) => x !== s.id) : [...inputs, s.id] })}
                >
                  {s.id}
                </button>
              );
            })}
          {step.inputs === undefined && <span className="text-[12px] text-ink-faint">(default: the plan step)</span>}
        </div>
      )}

      <textarea
        className="field min-h-[56px] w-full resize-y font-mono text-[12.5px] leading-relaxed"
        placeholder="Instructions"
        rows={step.instructions ? Math.min(8, step.instructions.split('\n').length + 1) : 2}
        value={step.instructions ?? ''}
        onChange={(e) => set({ instructions: e.target.value || undefined })}
      />
    </div>
  );
}
