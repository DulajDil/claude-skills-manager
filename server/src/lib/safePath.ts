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
  return containedJoin(baseDir, id);
}

/**
 * Like resolveWithin but for multi-segment relative paths such as
 * `.claude/skills/ui-ux-pro-max`. Used for subpaths that come from the repo's
 * own manifest rather than from a request, so nested segments are allowed —
 * but absolute paths and anything that climbs out of baseDir are still refused.
 */
export function resolveSubpathWithin(baseDir: string, relPath: unknown): string | null {
  if (typeof relPath !== 'string' || relPath.length === 0 || relPath.length > 255) return null;
  if (path.isAbsolute(relPath)) return null;
  if (relPath.split(/[/\\]/).some((seg) => seg === '..')) return null;
  return containedJoin(baseDir, relPath);
}

function containedJoin(baseDir: string, relPath: string): string | null {
  const base = path.resolve(baseDir);
  const target = path.resolve(base, relPath);
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}
