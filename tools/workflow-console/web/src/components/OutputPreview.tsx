import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from '../api';

/** Agents sometimes wrap their whole answer in one fenced block; unwrap it so it renders. */
function unwrap(text: string): string {
  const m = /^\s*```[a-z]*\n([\s\S]*?)\n```\s*$/.exec(text);
  return m ? m[1] : text;
}

/**
 * Renders a step's output file as markdown. A pr-writer output ("TITLE: …"
 * then the body) is shown the way GitHub will show the PR.
 */
export function OutputPreview({ runId, file, version }: { runId: string; file: string; version?: string }) {
  const [text, setText] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setText(undefined);
    setError(undefined);
    fetch(api.fileUrl(runId, file), { cache: 'no-store' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then(setText)
      .catch((e: Error) => setError(e.message));
  }, [runId, file, version]);

  if (error) return <p className="text-[12.5px] text-red-600">Couldn't load {file}: {error}</p>;
  if (text === undefined) return <p className="text-[12.5px] text-ink-faint">Loading {file}…</p>;

  const body = unwrap(text.trim());
  const title = /^TITLE:\s*(.+)$/m.exec(body);
  const rest = title ? body.slice(body.indexOf(title[0]) + title[0].length).trim() : body;

  return (
    <div className="max-h-[520px] overflow-y-auto rounded-lg border border-line bg-white px-5 py-4">
      {title && (
        <div className="mb-3 border-b border-line pb-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">Pull request</div>
          <h1 className="mt-0.5 text-[19px] font-semibold text-ink">{title[1]}</h1>
        </div>
      )}
      <div className="md-preview">
        <Markdown remarkPlugins={[remarkGfm]}>{rest}</Markdown>
      </div>
    </div>
  );
}
