---
description: "Workflow: Answer a technical question by exploring the code and docs — read-only, ends with a written report and a recommendation."
argument-hint: <task, idea, ticket or bug report>
---
<!-- Generated from .claude/workflows/spike.yaml by tools/workflow-console. Edit the workflow (or save it in the console) instead of this file. -->

Run the **spike** workflow on this task:

<task>
$ARGUMENTS
</task>

You are the orchestrator. Do not do the steps' work yourself: run each agent step by delegating to the named subagent with the Agent tool, and give it only what it needs — the task, the outputs listed for it, and any findings or feedback — under the headings `## Task`, `## Plan`, `## Output of step "<id>"`, `## Findings to fix`, `## Human feedback`, `## Focus`, `## Instructions`.

## Rules

- This workflow is **read-only**. Work in the current checkout; no subagent may edit files, commit, or push.
- **Approve steps:** STOP. Show me the relevant output, ask the question, and wait for my answer. If I reject with feedback, re-run the previous agent step with my feedback under `## Human feedback` (and its previous output), then come back to the same approve step.
- **Loops:** reviewing agents end with a fenced JSON verdict. If any verdict is `changes_requested` with at least one `blocking` finding, go back to the named step with the merged findings under `## Findings to fix`, then continue forward again. When the loop limit is reached, STOP and ask me whether to continue anyway or loop again.
- **Parallel steps:** launch all the agents in a single message (one Agent call per focus) and merge their findings.
- **Repo notes:** if `.claude/workflow-console.yaml` has `notes`, give them to every subagent under `## Repo notes`.
- **Reference repos:** collect GitHub repos from `references` in `.claude/workflow-console.yaml` and any github.com links in the task. Shallow-clone each to `~/.claude/workflow-console/references/<owner>__<name>` (`gh repo clone <owner>/<name> <dir> -- --depth 1`, or refresh with `git fetch --depth 1 origin HEAD && git reset --hard FETCH_HEAD`), then pass the paths under `## Reference repos`. Steps marked "only with reference repos" are skipped when there are none.
- `security-reviewer` has no shell: pass it the changed files (`git diff --name-only <base>...HEAD`) and the diff.
- Nothing is pushed or opened as a PR except by a publish step, and only after I have approved the step before it in this conversation.
- Keep a short running status: which step, which attempt, verdicts. Finish with a summary of every step's outcome and where the branch is.

## Steps

1. **research** — subagent `reference-researcher` (permissions: read-only). Only when there are reference repos; otherwise skip it.
2. **explore** — subagent `feature-designer` (permissions: read-only). Give it the output of: `research`. Instructions: This is a spike, not a build. Investigate the question in the Task: read the relevant code, check library docs if needed, and lay out the realistic options with evidence (file paths, measurements, doc links), trade-offs and unknowns. Skip the Build plan section; replace it with "Options".
3. **report** — subagent `feature-designer` (permissions: read-only). Give it the output of: `research`, `explore`. Instructions: Write the final spike report from the explore output: Question, Short answer, What we found (with evidence), Options compared, Recommendation, Next steps (as tickets someone could pick up), Open questions. Re-check any claim you're not sure of against the code.
