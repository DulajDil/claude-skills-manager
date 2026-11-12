---
description: "Workflow: Reproduce and diagnose a bug, approve the fix plan, fix it with a regression test, review, verify, and open the PR."
argument-hint: <task, idea, ticket or bug report>
---
<!-- Generated from .claude/workflows/bug-fix.yaml by tools/workflow-console. Edit the workflow (or save it in the console) instead of this file. -->

Run the **bug-fix** workflow on this task:

<task>
$ARGUMENTS
</task>

You are the orchestrator. Do not do the steps' work yourself: run each agent step by delegating to the named subagent with the Agent tool, and give it only what it needs — the task, the outputs listed for it, and any findings or feedback — under the headings `## Task`, `## Plan`, `## Output of step "<id>"`, `## Findings to fix`, `## Human feedback`, `## Focus`, `## Instructions`.

## Rules

- **Setup:** create an isolated worktree on a new branch before the first step: `git worktree add -b wf/bug-fix-<short-id> ../$(basename "$PWD").worktrees/<short-id> HEAD`. Tell every subagent the worktree path, and that every command and file edit must happen inside it. Never commit to, reset, or push `main`.
- **Approve steps:** STOP. Show me the relevant output, ask the question, and wait for my answer. If I reject with feedback, re-run the previous agent step with my feedback under `## Human feedback` (and its previous output), then come back to the same approve step.
- **Loops:** reviewing agents end with a fenced JSON verdict. If any verdict is `changes_requested` with at least one `blocking` finding, go back to the named step with the merged findings under `## Findings to fix`, then continue forward again. When the loop limit is reached, STOP and ask me whether to continue anyway or loop again.
- **Parallel steps:** launch all the agents in a single message (one Agent call per focus) and merge their findings.
- **Repo notes:** if `.claude/workflow-console.yaml` has `notes`, give them to every subagent under `## Repo notes`.
- **Reference repos:** collect GitHub repos from `references` in `.claude/workflow-console.yaml` and any github.com links in the task. Shallow-clone each to `~/.claude/workflow-console/references/<owner>__<name>` (`gh repo clone <owner>/<name> <dir> -- --depth 1`, or refresh with `git fetch --depth 1 origin HEAD && git reset --hard FETCH_HEAD`), then pass the paths under `## Reference repos`. Steps marked "only with reference repos" are skipped when there are none.
- `security-reviewer` has no shell: pass it the changed files (`git diff --name-only <base>...HEAD`) and the diff.
- Nothing is pushed or opened as a PR except by a publish step, and only after I have approved the step before it in this conversation.
- Keep a short running status: which step, which attempt, verdicts. Finish with a summary of every step's outcome and where the branch is.

## Steps

1. **research** — subagent `reference-researcher` (permissions: read-only). Only when there are reference repos; otherwise skip it. Instructions: Focus on how the references handle the failing behaviour (e.g. how an upstream library fixed the same bug).
2. **diagnose** — subagent `bug-diagnoser` (permissions: read-only). Give it the output of: `research`.
3. **approve** — APPROVAL GATE. STOP and ask me: "Is the root cause right, and is the fix minimal?"
4. **fix** — subagent `implementer`. Give it the output of: `diagnose`.
5. **review** — run 2 `reviewer` subagents in parallel with focuses: `correctness`, `tests`. Give it the output of: `diagnose`. On blocking findings, loop back to `fix` (max 3 times). Instructions: Confirm the regression test (or reproduction check) fails without the fix and passes with it.
6. **security** — subagent `security-reviewer`. Give it the output of: `diagnose`. On blocking findings, loop back to `fix` (max 2 times).
7. **verify** — subagent `verifier`. Give it the output of: `diagnose`. On blocking findings, loop back to `fix` (max 2 times).
8. **pr** — subagent `pr-writer`. Give it the output of: `diagnose`, `verify`.
9. **approve-publish** — APPROVAL GATE. STOP and ask me: "Approving pushes the branch and opens the PR."
10. **publish** — subagent `implementer`. Give it the output of: `pr`. This step may push the run branch and open the PR — nothing else. Instructions: Push the run branch to origin and open the PR with the pr step's TITLE and body. Nothing else.
