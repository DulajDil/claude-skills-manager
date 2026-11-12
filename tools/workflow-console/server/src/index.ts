import fs from 'node:fs/promises';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { SLUG, skillMentions } from '../../shared/schema.js';
import { commonTools, loadAgents } from './agents.js';
import { HOST, LIBRARY_ROOT, PORT } from './config.js';
import { listSkills } from './skills.js';
import { addRepo, discoverRepos, getRepo, listRepos, normaliseReference, referencesInText, removeRepo, saveSettings } from './repos.js';
import { RunManager, type RunEvent } from './runner.js';
import { deleteWorkflow, listWorkflows, newWorkflowYaml, parseWorkflowYaml, readWorkflow, saveWorkflow } from './workflows.js';

const runs = new RunManager();
await runs.init();

const app = express();
app.use(express.json({ limit: '1mb' }));

// Localhost only, no auth: refuse requests addressed to any other host name
// (DNS rebinding) and cross-site browser requests, since this API starts
// agents that can edit code and run commands.
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (!LOCAL_HOST.test(req.headers.host ?? '')) return res.status(403).json({ error: 'Forbidden host' });
  if (origin && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)) return res.status(403).json({ error: 'Forbidden origin' });
  next();
});

type Handler = (req: Request, res: Response) => Promise<unknown>;
const h = (fn: Handler) => (req: Request, res: Response) =>
  fn(req, res).catch((err: Error & { status?: number }) => res.status(err.status ?? 500).json({ error: err.message }));

const nameParam = (req: Request) => {
  const name = String(req.params.name);
  if (!SLUG.test(name)) throw Object.assign(new Error('Invalid workflow name'), { status: 400 });
  return name;
};

// ------------------------------------------------------------------ agents
app.get('/api/agents', h(async (req, res) => {
  const repo = req.query.repo ? await getRepo(String(req.query.repo)) : undefined;
  const all = [...(await loadAgents(repo?.path)).values()];
  res.json({ agents: all.map(({ prompt: _prompt, ...info }) => info), commonTools: commonTools(all) });
}));

app.get('/api/skills', h(async (req, res) => {
  const repo = req.query.repo ? await getRepo(String(req.query.repo)) : undefined;
  res.json(await listSkills(repo?.path ?? LIBRARY_ROOT));
}));

// ------------------------------------------------------------------ repos
app.get('/api/repos', h(async (_req, res) => res.json(await listRepos())));
app.get('/api/repos/discover', h(async (_req, res) => {
  const known = new Set((await listRepos()).map((r) => r.path));
  res.json((await discoverRepos()).filter((p) => !known.has(p)));
}));
app.post('/api/repos', h(async (req, res) => res.status(201).json(await addRepo(String(req.body?.path ?? '')))));
app.put('/api/repos/:id', h(async (req, res) => {
  const references = Array.isArray(req.body?.references) ? req.body.references.map(String).filter((r: string) => r.trim()) : [];
  res.json(await saveSettings(String(req.params.id), { references, notes: String(req.body?.notes ?? '') }));
}));
app.delete('/api/repos/:id', h(async (req, res) => {
  await removeRepo(String(req.params.id));
  res.status(204).end();
}));

// ------------------------------------------------------------------ workflows
app.get('/api/workflows', h(async (_req, res) => res.json(await listWorkflows())));

app.get('/api/workflows/:name', h(async (req, res) => {
  const wf = await readWorkflow(nameParam(req));
  return wf ? res.json(wf) : res.status(404).json({ error: 'Not found' });
}));

app.post('/api/workflows', h(async (req, res) => {
  const name = String(req.body?.name ?? '');
  if (!SLUG.test(name)) return res.status(400).json({ error: 'Name must be lowercase letters, digits and dashes' });
  if (await readWorkflow(name)) return res.status(409).json({ error: `"${name}" already exists` });
  res.status(201).json(await saveWorkflow(name, newWorkflowYaml(name)));
}));

app.put('/api/workflows/:name', h(async (req, res) => res.json(await saveWorkflow(nameParam(req), String(req.body?.yaml ?? '')))));

app.delete('/api/workflows/:name', h(async (req, res) => {
  await deleteWorkflow(nameParam(req));
  res.status(204).end();
}));

app.post('/api/validate', h(async (req, res) => res.json(parseWorkflowYaml(String(req.body?.yaml ?? '')))));

// ------------------------------------------------------------------ runs
app.get('/api/runs', h(async (req, res) => {
  const workflow = req.query.workflow ? String(req.query.workflow) : undefined;
  const repo = req.query.repo ? String(req.query.repo) : undefined;
  res.json(runs.list().filter((r) => (!workflow || r.workflow === workflow) && (!repo || r.repoId === repo)));
}));

app.post('/api/runs', h(async (req, res) => {
  const name = String(req.body?.workflow ?? '');
  const wf = SLUG.test(name) ? await readWorkflow(name) : null;
  if (!wf?.workflow) return res.status(400).json({ error: wf?.error ?? 'Unknown workflow' });
  // An empty task falls back to the workflow's description (useful for create-pr: "PR my current changes").
  const task = String(req.body?.task ?? '').trim() || wf.workflow.description.trim();
  if (!task) return res.status(400).json({ error: 'Task is required' });
  const repo = await getRepo(String(req.body?.repo ?? ''));
  // References: what the form sent (pre-filled from the repo's settings) plus any github.com links in the task.
  const requested: string[] = Array.isArray(req.body?.references) ? req.body.references.map(String) : repo.references;
  const references = [...new Set([...requested.map((r) => normaliseReference(r)), ...referencesInText(task)])].filter((r): r is string => r !== null);
  // Skills: every `/name` in the task that is a real skill for this repo.
  const known = new Set((await listSkills(repo.path)).map((k) => k.name));
  const skills = skillMentions(task).filter((k) => known.has(k));
  res.status(201).json(await runs.start(wf.workflow, task, Boolean(req.body?.dryRun), repo, references, skills));
}));

const runOr404 = (req: Request) => {
  const run = runs.get(String(req.params.id));
  if (!run) throw Object.assign(new Error('Run not found'), { status: 404 });
  return run;
};

app.get('/api/runs/:id', h(async (req, res) => res.json(runOr404(req))));
app.post('/api/runs/:id/approve', h(async (req, res) => res.json(await runs.approve(runOr404(req).id))));
app.post('/api/runs/:id/reject', h(async (req, res) => res.json(await runs.reject(runOr404(req).id, String(req.body?.feedback ?? '')))));
app.post('/api/runs/:id/stop', h(async (req, res) => res.json(await runs.stop(runOr404(req).id))));
app.post('/api/runs/:id/rerun', h(async (req, res) => res.json(await runs.rerunFrom(runOr404(req).id, String(req.body?.stepId ?? '')))));
app.post('/api/runs/:id/publish', h(async (req, res) => res.json(await runs.publishLater(runOr404(req).id))));
app.post('/api/runs/:id/resume', h(async (req, res) => res.json(await runs.resume(runOr404(req).id))));
app.post('/api/runs/:id/permission', h(async (req, res) =>
  res.json(await runs.answerPermission(runOr404(req).id, String(req.body?.requestId ?? ''), Boolean(req.body?.allow))),
));

/** Step output files. Only plain `<name>.md` files directly in the run folder. */
app.get('/api/runs/:id/files/:file', h(async (req, res) => {
  const run = runOr404(req);
  const file = String(req.params.file);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.md$/.test(file)) return res.status(400).json({ error: 'Invalid file' });
  const full = path.join(runs.runDir(run.id), file);
  try {
    res.type('text/markdown').send(await fs.readFile(full, 'utf8'));
  } catch {
    res.status(404).json({ error: 'Not found' });
  }
}));

app.get('/api/runs/:id/events', h(async (req, res) => {
  const run = runOr404(req);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event: RunEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  send({ type: 'state', run });
  for (const entry of (await runs.readLog(run.id)).slice(-2000)) send({ type: 'log', entry });
  const onEvent = (id: string, event: RunEvent) => id === run.id && send(event);
  runs.on('event', onEvent);
  const ping = setInterval(() => res.write(': ping\n\n'), 20_000);
  req.on('close', () => {
    clearInterval(ping);
    runs.off('event', onEvent);
  });
}));

app.listen(PORT, HOST, () => {
  console.log(`workflow-console API on http://${HOST}:${PORT} · library ${LIBRARY_ROOT}`);
});
