import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import { SLUG, WorkflowSchema, formatZodError, type Workflow } from '../../shared/schema.js';
import { COMMANDS_DIR, WORKFLOWS_DIR } from './config.js';
import { renderCommand } from './commands.js';

export interface WorkflowFile {
  name: string;
  yaml: string;
  workflow?: Workflow;
  error?: string;
}

export function parseWorkflowYaml(text: string): { workflow?: Workflow; error?: string } {
  let data: unknown;
  try {
    data = YAML.parse(text);
  } catch (err) {
    return { error: `YAML: ${(err as Error).message}` };
  }
  const parsed = WorkflowSchema.safeParse(data);
  return parsed.success ? { workflow: parsed.data } : { error: formatZodError(parsed.error) };
}

function fileFor(name: string): string {
  if (!SLUG.test(name)) throw new Error('Invalid workflow name');
  return path.join(WORKFLOWS_DIR, `${name}.yaml`);
}

export async function listWorkflows(): Promise<WorkflowFile[]> {
  await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  const files = (await fs.readdir(WORKFLOWS_DIR)).filter((f) => /\.ya?ml$/.test(f)).sort();
  return Promise.all(
    files
      .map((f) => f.replace(/\.ya?ml$/, ''))
      .filter((n) => SLUG.test(n))
      .map((name) => readWorkflow(name) as Promise<WorkflowFile>),
  );
}

export async function readWorkflow(name: string): Promise<WorkflowFile | null> {
  let text: string;
  try {
    text = await fs.readFile(fileFor(name), 'utf8');
  } catch {
    return null;
  }
  return { name, yaml: text, ...parseWorkflowYaml(text) };
}

/** Validates, writes the YAML, and regenerates the matching slash command. */
export async function saveWorkflow(name: string, text: string): Promise<WorkflowFile> {
  const { workflow, error } = parseWorkflowYaml(text);
  if (!workflow) throw Object.assign(new Error(error), { status: 400 });
  if (workflow.name !== name) throw Object.assign(new Error(`name in YAML ("${workflow.name}") must match "${name}"`), { status: 400 });
  await fs.mkdir(WORKFLOWS_DIR, { recursive: true });
  await fs.writeFile(fileFor(name), text.endsWith('\n') ? text : `${text}\n`);
  await writeCommand(workflow);
  return { name, yaml: text, workflow };
}

export async function deleteWorkflow(name: string): Promise<void> {
  await fs.rm(fileFor(name));
  await fs.rm(path.join(COMMANDS_DIR, `${name}.md`), { force: true });
}

export async function writeCommand(workflow: Workflow): Promise<void> {
  await fs.mkdir(COMMANDS_DIR, { recursive: true });
  await fs.writeFile(path.join(COMMANDS_DIR, `${workflow.name}.md`), renderCommand(workflow));
}

export function newWorkflowYaml(name: string): string {
  return YAML.stringify({
    name,
    description: '',
    steps: [
      { id: 'design', type: 'agent', agent: 'feature-designer', permissions: 'read-only' },
      { id: 'approve', type: 'approve', message: 'Approve the plan before any code changes.' },
      { id: 'implement', type: 'agent', agent: 'implementer' },
    ],
  });
}
