import { Bot, UserCheck, Users } from 'lucide-react';
import type { RunState, Step, StepState } from '../../../shared/schema';

const W = 132;
const H = 70;
const GAP = 34;
const PAD_X = 24;
const TOP = 36;
const LOOP_GAP = 24;

const STATUS_STYLE: Record<string, { box: string; dot: string; label: string }> = {
  pending: { box: 'border-line-strong bg-paper-raised', dot: 'bg-ink-faint/50', label: 'pending' },
  running: { box: 'border-accent bg-accent-soft pulse-ring', dot: 'bg-accent', label: 'running' },
  done: { box: 'border-emerald-400 bg-emerald-50', dot: 'bg-emerald-500', label: 'done' },
  changes_requested: { box: 'border-amber-400 bg-amber-50', dot: 'bg-amber-500', label: 'changes requested' },
  awaiting_approval: { box: 'border-violet-400 bg-violet-50 pulse-ring', dot: 'bg-violet-500', label: 'waiting for you' },
  failed: { box: 'border-red-400 bg-red-50', dot: 'bg-red-500', label: 'failed' },
  skipped: { box: 'border-dashed border-line-strong bg-paper-sunk', dot: 'bg-ink-faint/40', label: 'skipped' },
};

function subtitle(step: Step): string {
  if (step.type === 'approve') return 'you approve';
  if (step.type === 'parallel') return `${step.count} × ${step.agent}`;
  return step.agent;
}

interface Props {
  steps: Step[];
  run?: RunState;
  selected?: string;
  onSelect?: (stepId: string) => void;
}

export function FlowDiagram({ steps, run, selected, onSelect }: Props) {
  const index = new Map(steps.map((s, i) => [s.id, i]));
  const loops = steps
    .map((s, i) => (s.type !== 'approve' && s.loopTo && index.has(s.loopTo) ? { from: i, to: index.get(s.loopTo)!, max: s.maxLoops ?? 2, id: s.id } : null))
    .filter((l): l is NonNullable<typeof l> => l !== null && l.to < l.from);

  const width = PAD_X * 2 + steps.length * W + Math.max(0, steps.length - 1) * GAP;
  const height = Math.max(180, TOP + H + 28 + loops.length * LOOP_GAP + 24);
  const cx = (i: number) => PAD_X + i * (W + GAP) + W / 2;
  const bottom = TOP + H;

  return (
    <div className="canvas-dots overflow-x-auto rounded-xl border border-line">
      <div className="relative" style={{ width, height }}>
        <svg className="pointer-events-none absolute inset-0" width={width} height={height}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#b5ad9f" />
            </marker>
            <marker id="arrow-loop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#c99a3c" />
            </marker>
          </defs>
          {steps.slice(1).map((_, i) => (
            <line key={i} x1={cx(i) + W / 2} y1={TOP + H / 2} x2={cx(i + 1) - W / 2 - 2} y2={TOP + H / 2} stroke="#c9c2b5" strokeWidth={1.25} markerEnd="url(#arrow)" />
          ))}
          {loops.map((l, k) => {
            const y = bottom + 22 + k * LOOP_GAP;
            const x1 = cx(l.from) + 8;
            const x2 = cx(l.to) - 8;
            const used = run?.loopCounts[l.id] ?? 0;
            return (
              <g key={l.id}>
                <path d={`M${x1},${bottom} V${y} H${x2} V${bottom + 3}`} fill="none" stroke="#d4a64a" strokeWidth={1.25} strokeDasharray="4 3" markerEnd="url(#arrow-loop)" />
                <foreignObject x={(x1 + x2) / 2 - 60} y={y - 9} width={120} height={18}>
                  <div className="flex justify-center">
                    <span className="rounded bg-[#fbf6ea] px-1.5 font-mono text-[10.5px] leading-[18px] text-[#9a7425]">
                      changes{run ? ` ${used}/${l.max}` : ` (max ${l.max})`}
                    </span>
                  </div>
                </foreignObject>
              </g>
            );
          })}
        </svg>

        {steps.map((step, i) => {
          const state: StepState | undefined = run?.steps[step.id];
          const status = state?.status ?? 'pending';
          const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
          const conditional = step.type !== 'approve' && step.when === 'references';
          const attempts = state?.attempts.length ?? 0;
          const Icon = step.type === 'approve' ? UserCheck : step.type === 'parallel' ? Users : Bot;
          const isCurrent = run && run.definition.steps[run.currentIndex]?.id === step.id && !['completed'].includes(run.status);
          return (
            <button
              key={`${step.id}-${i}`}
              type="button"
              onClick={() => onSelect?.(step.id)}
              className={`absolute flex flex-col rounded-lg border px-2.5 py-2 text-left transition-shadow hover:shadow-sm ${style.box} ${conditional && status === 'pending' ? 'border-dashed' : ''} ${selected === step.id ? 'ring-2 ring-ink/70 ring-offset-1 ring-offset-[#f9f7f2]' : ''}`}
              style={{ left: PAD_X + i * (W + GAP), top: TOP, width: W, height: H }}
              title={`${step.id} — ${style.label}`}
            >
              <span className="flex items-center gap-1.5 font-mono text-[12px] font-semibold leading-4 text-ink">
                <Icon size={12} className="shrink-0 text-ink-soft" />
                <span className="truncate">{step.id}</span>
              </span>
              <span className="mt-0.5 truncate text-[11px] leading-4 text-ink-soft">{subtitle(step)}</span>
              <span className="mt-auto flex items-center gap-1.5 text-[10.5px] leading-4 text-ink-faint">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                <span className="truncate">
                  {style.label}
                  {conditional && status === 'pending' ? ' · if references' : ''}
                  {attempts > 1 ? ` · ×${attempts}` : ''}
                  {isCurrent && run?.status === 'awaiting_permission' ? ' · needs permission' : ''}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
