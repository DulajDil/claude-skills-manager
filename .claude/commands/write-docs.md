---
description: "Workflow: Write or update documentation — outline, approve, write it on a branch, check every claim against the code, PR."
argument-hint: <task, idea, ticket or bug report>
---
<!-- Generated from .claude/workflows/write-docs.yaml by tools/workflow-console. Edit the workflow (or save it in the console) instead of this file. -->

Run the **write-docs** workflow on this task:

<task>
$ARGUMENTS
</task>

You are the orchestrator. Do not do the steps' work yourself: run each agent step by delegating to the named subagent with the Agent tool, and give it only what it needs — the task, the outputs listed for it, and any findings or feedback — under the headings `## Task`, `## Plan`, `## Output of step "<id>"`, `## Findings to fix`, `## Human feedback`, `## Focus`, `## Instructions`.

## Rules

- **Setup:** create an isolated worktree on a new branch before the first step: `git worktree add -b wf/write-docs-<short-id> ../$(basename "$PWD").worktrees/<short-id> HEAD`. Tell every subagent the worktree path, and that every command and file edit must happen inside it. Never commit to, reset, or push `main`.
- **Approve steps:** STOP. Show me the relevant output, ask the question, and wait for my answer. If I reject with feedback, re-run the previous agent step with my feedback under `## Human feedback` (and its previous output), then come back to the same approve step.
- **Loops:** reviewing agents end with a fenced JSON verdict. If any verdict is `changes_requested` with at least one `blocking` finding, go back to the named step with the merged findings under `## Findings to fix`, then continue forward again. When the loop limit is reached, STOP and ask me whether to continue anyway or loop again.
- **Parallel steps:** launch all the agents in a single message (one Agent call per focus) and merge their findings.
- **Repo notes:** if `.claude/workflow-console.yaml` has `notes`, give them to every subagent under `## Repo notes`.
- `security-reviewer` has no shell: pass it the changed files (`git diff --name-only <base>...HEAD`) and the diff.
- Nothing is pushed or opened as a PR except by a publish step, and only after I have approved the step before it in this conversation.
- Keep a short running status: which step, which attempt, verdicts. Finish with a summary of every step's outcome and where the branch is.

## Steps

1. **outline** — subagent `feature-designer` (permissions: read-only). Instructions: This is a documentation task, not a code change. Produce a doc outline instead of a design: audience, which files to create or update, section headings with one line each on what goes there, and the code each section must be checked against.
2. **approve** — APPROVAL GATE. STOP and ask me: "Approve the outline."
3. **write** — subagent `implementer`. Give it the output of: `outline`. Instructions: Write the documentation from the approved outline. Change docs only (Markdown, comments if asked) — no code changes. Every command and path you mention must exist. Commit with a docs(...) message.
4. **review** — subagent `reviewer`. Give it the output of: `outline`. On blocking findings, loop back to `write` (max 3 times). Instructions: Review the documentation diff for accuracy. Verify every command, path, option and behaviour claim against the code; a wrong claim is blocking. Also flag gaps against the outline.
5. **pr** — subagent `pr-writer`. Give it the output of: `outline`.
6. **approve-publish** — APPROVAL GATE. STOP and ask me: "Approving pushes the branch and opens the PR."
7. **publish** — subagent `implementer`. Give it the output of: `pr`. This step may push the run branch and open the PR — nothing else. Instructions: Push the run branch to origin and open the PR with the pr step's TITLE and body. Nothing else.
