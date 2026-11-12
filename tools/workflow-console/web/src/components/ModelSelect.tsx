import { MODEL_OPTIONS, modelLabel } from '../../../shared/schema';

interface Props {
  value?: string;
  onChange: (model: string | undefined) => void;
  /** Label for the empty choice, e.g. "agent default (Opus 5.5)". */
  emptyLabel: string;
  className?: string;
  title?: string;
}

/** Model picker: the empty option means "inherit"; unknown values (full ids from YAML) are kept and shown. */
export function ModelSelect({ value, onChange, emptyLabel, className = 'select w-52', title }: Props) {
  const custom = value && !MODEL_OPTIONS.some((o) => o.value === value);
  return (
    <select className={className} value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)} title={title} aria-label={title ?? 'Model'}>
      <option value="">{emptyLabel}</option>
      {MODEL_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      {custom && <option value={value}>{modelLabel(value)}</option>}
    </select>
  );
}
