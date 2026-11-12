import { defaultInputs, type Step, type Workflow } from '../../shared/schema.js';

/**
 * Render `.claude/commands/<name>.md`: the same workflow, orchestrated by the
 * main Claude Code session instead of the console. Regenerated on every save.
 */
export function renderCommand(wf: Workflow): string {
  const lines: string[] = [];
  const out = (s = '') => lines.push(s);

  out('---');
  out(`description: ${JSON.stringify(`Workflow: ${wf.description || wf.name}`)}`);
  out('argument-hint: <task, idea, ticket or bug report>');
  out('---');
  out(`<!-- Generated from .claude/workflows/${wf.name}.yaml by tools/workflow-console. Edit the workflow (or save it in the console) instead of this file. -->`);
  out();
  out(`Run the **${wf.name}** workflow on this task:`);
  out();
  out('<task>');
  out('$ARGUMENTS');
  out('</task>');
  out();
  out('You are the orchestrator. Do not do the steps\' work yourself: run each agent step by delegating to the named subagent with the Agent tool, and give it only what it needs — the task, the outputs listed for it, and any findings or feedback — under the headings `## Task`, `## Plan`, `## Output of step "<id>"`, `## Findings to fix`, `## Human feedback`, `## Focus`, `## Instructions`.');
  out();
  out('## Rules');
  out();
  if (wf.inPlace) {
    out('- This workflow runs **in place**, in the current checkout, so uncommitted changes are included. If you are on the default branch, create a feature branch (`git switch -c <type>/<name>`) before anything is committed. Never commit to or push `main`/`master`.');
  } else if (wf.readOnly) {
    out('- This workflow is **read-only**. Work in the current checkout; no subagent may edit files, commit, or push.');
  } else {
    out('- **Setup:** create an isolated worktree on a new branch before the first step: `git worktree add -b wf/' + wf.name + '-<short-id> ../$(basename "$PWD").worktrees/<short-id> HEAD`. Tell every subagent the worktree path, and that every command and file edit must happen inside it. Never commit to, reset, or push `main`.');
  }
  out('- **Approve steps:** STOP. Show me the relevant output, ask the question, and wait for my answer. If I reject with feedback, re-run the previous agent step with my feedback under `## Human feedback` (and its previous output), then come back to the same approve step.');
  out('- **Loops:** reviewing agents end with a fenced JSON verdict. If any verdict is `changes_requested` with at least one `blocking` finding, go back to the named step with the merged findings under `## Findings to fix`, then continue forward again. When the loop limit is reached, STOP and ask me whether to continue anyway or loop again.');
  out('- **Parallel steps:** launch all the agents in a single message (one Agent call per focus) and merge their findings.');
  out('- **Repo notes:** if `.claude/workflow-console.yaml` has `notes`, give them to every subagent under `## Repo notes`.');
  if (wf.steps.some((s) => s.type !== 'approve' && s.when === 'references')) {
    out('- **Reference repos:** collect GitHub repos from `references` in `.claude/workflow-console.yaml` and any github.com links in the task. Shallow-clone each to `~/.claude/workflow-console/references/<owner>__<name>` (`gh repo clone <owner>/<name> <dir> -- --depth 1`, or refresh with `git fetch --depth 1 origin HEAD && git reset --hard FETCH_HEAD`), then pass the paths under `## Reference repos`. Steps marked "only with reference repos" are skipped when there are none.');
  }
  out('- `security-reviewer` has no shell: pass it the changed files (`git diff --name-only <base>...HEAD`) and the diff.');
  out('- Nothing is pushed or opened as a PR except by a publish step, and only after I have approved the step before it in this conversation.');
  out('- Keep a short running status: which step, which attempt, verdicts. Finish with a summary of every step\'s outcome and where the branch is.');
  out();
  out('## Steps');
  out();
  wf.steps.forEach((step, i) => {
    out(`${i + 1}. ${describeStep(step, wf)}`);
  });
  out();
  return `${lines.join('\n')}`;
}

function describeStep(step: Step, wf: Workflow): string {
  if (step.type === 'approve') {
    return `**${step.id}** — APPROVAL GATE. STOP and ask me: "${step.message ?? 'Approve to continue?'}"`;
  }
  const perms = wf.readOnly ? 'read-only' : step.permissions;
  const head =
    step.type === 'parallel'
      ? `**${step.id}** — run ${step.count} \`${step.agent}\` subagents in parallel` +
        (step.focuses?.length ? ` with focuses: ${step.focuses.map((f) => `\`${f}\``).join(', ')}` : '')
      : `**${step.id}** — subagent \`${step.agent}\``;
  const inputs = step.inputs ?? defaultInputs(wf, step.id);
  const parts = [`${head}${perms ? ` (permissions: ${perms})` : ''}.`];
  if (step.when === 'references') parts.push('Only when there are reference repos; otherwise skip it.');
  if (step.skills?.length) parts.push(`It must use the ${step.skills.map((k) => `\`/${k}\``).join(', ')} skill${step.skills.length > 1 ? 's' : ''} for this step.`);
  if (inputs.length) parts.push(`Give it the output of: ${inputs.map((s) => `\`${s}\``).join(', ')}.`);
  if (step.loopTo) parts.push(`On blocking findings, loop back to \`${step.loopTo}\` (max ${step.maxLoops ?? 2} times).`);
  if (step.type === 'agent' && step.publish) parts.push('This step may push the run branch and open the PR — nothing else.');
  if (step.instructions?.trim()) parts.push(`Instructions: ${step.instructions.trim().replace(/\s*\n\s*/g, ' ')}`);
  return parts.join(' ');
}
