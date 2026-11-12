import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { GITHUB_REPO, type ReferenceCheckout } from '../../shared/schema.js';
import { REFERENCE_CACHE } from './config.js';

const exec = promisify(execFile);
const TIMEOUT = 120_000;

let ghAvailable: boolean | undefined;
async function hasGh(): Promise<boolean> {
  if (ghAvailable === undefined) {
    ghAvailable = await exec('gh', ['auth', 'status'], { timeout: 10_000 }).then(() => true, () => false);
  }
  return ghAvailable;
}

/**
 * Shallow-clone (or refresh) each GitHub reference into the shared cache.
 * Uses `gh` when it's logged in, so private repos you can see work too;
 * otherwise plain `git clone` over HTTPS (public repos only).
 */
export async function ensureReferences(refs: string[], log: (text: string) => void): Promise<ReferenceCheckout[]> {
  await fs.mkdir(REFERENCE_CACHE, { recursive: true });
  return Promise.all(
    refs.map(async (ref): Promise<ReferenceCheckout> => {
      if (!GITHUB_REPO.test(ref)) return { ref, path: '', error: 'not an owner/name GitHub repo' };
      const dir = path.join(REFERENCE_CACHE, ref.replace('/', '__'));
      try {
        const exists = await fs.stat(path.join(dir, '.git')).then(() => true, () => false);
        if (exists) {
          log(`Refreshing reference ${ref}`);
          await exec('git', ['fetch', '--depth', '1', 'origin', 'HEAD'], { cwd: dir, timeout: TIMEOUT });
          await exec('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: dir, timeout: TIMEOUT });
        } else {
          log(`Cloning reference ${ref}`);
          if (await hasGh()) await exec('gh', ['repo', 'clone', ref, dir, '--', '--depth', '1'], { timeout: TIMEOUT });
          else await exec('git', ['clone', '--depth', '1', `https://github.com/${ref}.git`, dir], { timeout: TIMEOUT });
        }
        const sha = (await exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir })).stdout.trim();
        return { ref, path: dir, sha };
      } catch (err) {
        const message = ((err as { stderr?: string }).stderr || (err as Error).message).trim().split('\n').pop() ?? 'clone failed';
        log(`Reference ${ref} unavailable: ${message}`);
        return { ref, path: '', error: message };
      }
    }),
  );
}
