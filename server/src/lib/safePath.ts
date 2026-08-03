import path from 'path';

/**
 * Ids arrive from URL params and request bodies, then get joined onto a base
 * directory. Without validation an id like `../../.zshrc` escapes that
 * directory, which matters a lot here because the API also exposes PUT and
 * DELETE — that turns into arbitrary file write and delete on the host. The
 * README suggests exposing this server over a tunnel or Railway, so treat every
 * id as untrusted even though the app is nominally localhost-only.
 *
 * Skill and agent directories are always lowercase slugs, so anything else is
 * rejected rather than sanitised into something that merely looks valid.
 */
const SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && id.length <= 100 && SAFE_ID.test(id);
}

/** Turn a display name into a safe slug, or null if nothing usable is left. */
export function toSafeId(name: string): string | null {
  const id = name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/^-+/, '');
  return isValidId(id) ? id : null;
}

/**
 * Resolve `<baseDir>/<id>`, returning null unless the id is a safe slug and the
 * result really does land inside baseDir.
 */
export function resolveWithin(baseDir: string, id: unknown): string | null {
  if (!isValidId(id)) return null;
  const base = path.resolve(baseDir);
  const target = path.resolve(base, id);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}
