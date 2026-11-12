---
description: "Workflow: Commit your current changes with a /generate-commit-message message on a feature branch, write the PR description, preview it, and on your approval push the branch and open the PR on GitHub."
argument-hint: <task, idea, ticket or bug report>
---
<!-- Generated from .claude/workflows/create-pr.yaml by tools/workflow-console. Edit the workflow (or save it in the console) instead of this file. -->

Run the **create-pr** workflow on this task:

<task>
$ARGUMENTS
</task>

You are the orchestrator. Do not do the steps' work yourself: run each agent step by delegating to the named subagent with the Agent tool, and give it only what it needs — the task, the outputs listed for it, and any findings or feedback — under the headings `## Task`, `## Plan`, `## Output of step "<id>"`, `## Findings to fix`, `## Human feedback`, `## Focus`, `## Instructions`.

## Rules

- This workflow runs **in place**, in the current checkout, so uncommitted changes are included. If you are on the default branch, create a feature branch (`git switch -c <type>/<name>`) before anything is committed. Never commit to or push `main`/`master`.
- **Approve steps:** STOP. Show me the relevant output, ask the question, and wait for my answer. If I reject with feedback, re-run the previous agent step with my feedback under `## Human feedback` (and its previous output), then come back to the same approve step.
- **Loops:** reviewing agents end with a fenced JSON verdict. If any verdict is `changes_requested` with at least one `blocking` finding, go back to the named step with the merged findings under `## Findings to fix`, then continue forward again. When the loop limit is reached, STOP and ask me whether to continue anyway or loop again.
- **Parallel steps:** launch all the agents in a single message (one Agent call per focus) and merge their findings.
- **Repo notes:** if `.claude/workflow-console.yaml` has `notes`, give them to every subagent under `## Repo notes`.
- `security-reviewer` has no shell: pass it the changed files (`git diff --name-only <base>...HEAD`) and the diff.
- Nothing is pushed or opened as a PR except by a publish step, and only after I have approved the step before it in this conversation.
- Keep a short running status: which step, which attempt, verdicts. Finish with a summary of every step's outcome and where the branch is.

## Steps

1. **commit** — subagent `committer`. It must use the `/generate-commit-message` skill for this step.
2. **pr** — subagent `pr-writer`. Give it the output of: `commit`. Instructions: Create the PR against the "PR base branch" from the run context, and use that branch instead of main in all git commands. If the repo has a PR template, follow it and fill in every section. Write the description in plain, non-technical English that anyone can understand, focusing on what changed and why. Do not add "Generated with Claude Code" or any other AI attribution to the description.
3. **approve-publish** — APPROVAL GATE. STOP and ask me: "Preview the PR below. Approve to push the branch and open it on GitHub, or reject with feedback to rewrite the description."
4. **publish** — subagent `implementer`. Give it the output of: `pr`. This step may push the run branch and open the PR — nothing else. Instructions: Push the current branch and open the PR, nothing else: 1. `git push -u origin <current branch>` 2. Write the body (everything after the TITLE line) to a temp file under /tmp with a Bash heredoc (not the Write tool), then `gh pr create --base <PR base branch> --head <current branch> --title "<TITLE>" --body-file <temp file>`. 3. Finish with the PR URL on its own line. If a PR for this branch already exists, don't create another: push, then give its URL (`gh pr view --json url -q .url`).
