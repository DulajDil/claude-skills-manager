import { Sparkles, X } from 'lucide-react';
import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { skillMentions, type SkillInfo } from '../../../shared/schema';

interface Props {
  value: string;
  onChange: (value: string) => void;
  skills: SkillInfo[];
  placeholder?: string;
  className?: string;
}

const SOURCE_LABEL: Record<SkillInfo['source'], string> = { repo: 'repo', user: 'yours', bundled: 'starter set' };

/**
 * A textarea where typing "/" opens a skill picker, like Claude Code's slash
 * menu. Picked skills appear as "/name" in the text; the run loads every one.
 */
export function SkillTextarea({ value, onChange, skills, placeholder, className }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<{ start: number; text: string } | null>(null);
  const [active, setActive] = useState(0);

  const matches = useMemo(() => {
    if (!query) return [];
    const q = query.text.toLowerCase();
    return skills
      .filter((s) => s.name.includes(q) || s.description.toLowerCase().includes(q))
      .sort((a, b) => Number(!a.name.startsWith(q)) - Number(!b.name.startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [query, skills]);

  /** Is the caret right after "/partial" at a word start? */
  const detect = (el: HTMLTextAreaElement) => {
    const before = el.value.slice(0, el.selectionStart);
    const m = /(?:^|[\s(])\/([a-z0-9-]*)$/.exec(before);
    setQuery(m ? { start: el.selectionStart - m[1].length - 1, text: m[1] } : null);
    setActive(0);
  };

  const pick = (name: string) => {
    const el = ref.current;
    if (!el || !query) return;
    const after = value.slice(el.selectionStart).replace(/^[a-z0-9-]*/, '');
    const insert = `/${name}${after.startsWith(' ') ? '' : ' '}`;
    onChange(value.slice(0, query.start) + insert + after);
    const caret = query.start + insert.length;
    setQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!query || matches.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      pick(matches[active].name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setQuery(null);
    }
  };

  const known = new Map(skills.map((s) => [s.name, s]));
  const mentioned = skillMentions(value);

  const removeMention = (name: string) => {
    onChange(value.replace(new RegExp(`(^|[\\s(])\\/${name}(?=$|[\\s.,;:!?)])\\s?`, 'g'), '$1'));
  };

  return (
    <div>
      <div className="relative">
        <textarea
          ref={ref}
          className={className}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            detect(e.target);
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => detect(e.currentTarget)}
          onBlur={() => setTimeout(() => setQuery(null), 150)}
          role="combobox"
          aria-expanded={Boolean(query && matches.length)}
          aria-controls="skill-menu"
          aria-autocomplete="list"
        />
        {query && matches.length > 0 && (
          <ul id="skill-menu" role="listbox" className="absolute left-0 right-0 top-full z-20 mt-1 max-h-[320px] overflow-y-auto rounded-lg border border-line bg-paper-raised py-1 shadow-lg">
            {matches.map((s, i) => (
              <li
                key={s.name}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-baseline gap-3 px-3 py-1.5 ${i === active ? 'bg-paper-selected' : 'hover:bg-paper'}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s.name);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <span className="shrink-0 font-mono text-[13px] text-ink">/{s.name}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink-faint">{s.description}</span>
                <span className="shrink-0 text-[10.5px] uppercase tracking-wide text-ink-faint">{SOURCE_LABEL[s.source]}</span>
              </li>
            ))}
          </ul>
        )}
        {query && matches.length === 0 && skills.length > 0 && (
          <div className="absolute left-0 top-full z-20 mt-1 rounded-lg border border-line bg-paper-raised px-3 py-2 text-[12.5px] text-ink-faint shadow-lg">No skill matches “/{query.text}”</div>
        )}
      </div>

      {mentioned.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Sparkles size={13} className="text-violet-600" />
          <span className="text-[12px] text-ink-soft">Skills for this run:</span>
          {mentioned.map((name) =>
            known.has(name) ? (
              <span key={name} className="chip gap-1 border-violet-200 bg-violet-50 text-violet-700" title={known.get(name)!.description}>
                /{name}
                <button type="button" className="rounded hover:text-violet-900" onClick={() => removeMention(name)} aria-label={`Remove /${name}`}>
                  <X size={11} />
                </button>
              </span>
            ) : (
              <span key={name} className="chip border-amber-200 bg-amber-50 text-amber-800" title="Not a skill in this repo, ~/.claude/skills or the starter set; it stays plain text">
                /{name}?
              </span>
            ),
          )}
        </div>
      )}
    </div>
  );
}
