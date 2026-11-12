/** Regenerate every `.claude/commands/<workflow>.md` from `.claude/workflows/*.yaml`. */
import { listWorkflows, writeCommand } from '../workflows.js';

let failed = 0;
for (const wf of await listWorkflows()) {
  if (!wf.workflow) {
    failed++;
    console.error(`✗ ${wf.name}: ${wf.error}`);
    continue;
  }
  await writeCommand(wf.workflow);
  console.log(`✓ .claude/commands/${wf.name}.md`);
}
process.exit(failed ? 1 : 0);
