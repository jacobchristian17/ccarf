// Lesson 6 · TODO 1 (reference): structured state export + manifest (task statement 5.4).
import { z } from "zod";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const Finding = z.object({
  fact: z.string().min(1),
  file: z.string().min(1).refine(f => !/^([a-z]:)?[\\/]/i.test(f), "file must be a repo-relative path like src/services/ledger.ts"),
  line: z.number().int().positive().nullable(),
});
export type Finding = z.infer<typeof Finding>;

export const AgentState = z.object({
  agent: z.string().min(1),
  phase: z.number().int().nonnegative(),
  status: z.enum(["done", "in_progress", "failed"]),
  summary: z.string(),
  findings: z.array(Finding),
  filesRead: z.array(z.string()),
  openQuestions: z.array(z.string()),
  updatedAt: z.iso.datetime(),
}).superRefine((s, ctx) => {
  if (s.status === "done" && !s.summary.trim())
    ctx.addIssue({ code: "custom", path: ["summary"], message: "a done agent needs a summary: the next phase starts from it" });
  s.findings.forEach((f, i) => {
    if (!s.filesRead.includes(f.file))
      ctx.addIssue({ code: "custom", path: ["findings", i, "file"], message: `finding cites ${f.file}, which this agent never read: cite only files you read` });
  });
});
export type AgentState = z.infer<typeof AgentState>;

export const Manifest = z.object({
  runId: z.string(),
  updatedAt: z.string(),
  agents: z.record(z.string(), z.object({ status: z.enum(["done", "in_progress", "failed"]), stateFile: z.string() })),
});
export type Manifest = z.infer<typeof Manifest>;
export type Loaded = { manifest: Manifest; states: AgentState[] };

function writeAtomic(path: string, data: unknown) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, path);
}

export function writeState(dir: string, state: AgentState, runId = "run"): void {
  const s = AgentState.parse(state);
  mkdirSync(dir, { recursive: true });
  const stateFile = `${s.agent}.json`;
  writeAtomic(join(dir, stateFile), s);
  const mPath = join(dir, "manifest.json");
  const prev = existsSync(mPath) ? Manifest.safeParse(JSON.parse(readFileSync(mPath, "utf8"))) : undefined;
  const manifest: Manifest = prev?.success ? prev.data : { runId, updatedAt: "", agents: {} };
  manifest.agents[s.agent] = { status: s.status, stateFile };
  manifest.updatedAt = new Date().toISOString();
  writeAtomic(mPath, manifest);
}

export function loadManifest(dir: string): Loaded | null {
  const mPath = join(dir, "manifest.json");
  if (!existsSync(mPath)) return null;
  const m = Manifest.safeParse(JSON.parse(readFileSync(mPath, "utf8")));
  if (!m.success) return null;
  const states: AgentState[] = [];
  for (const { stateFile } of Object.values(m.data.agents)) {
    try {
      const p = AgentState.safeParse(JSON.parse(readFileSync(join(dir, stateFile), "utf8")));
      if (p.success) states.push(p.data);
    } catch { /* missing or corrupt state file: that agent counts as pending */ }
  }
  return { manifest: m.data, states };
}

const cite = (f: Finding) => `- ${f.fact} (${f.file}${f.line ? `:${f.line}` : ""})`;

export function buildResumeContext(loaded: Loaded | null, pending: string[]): string {
  if (!loaded) return "";
  const done = loaded.states.filter(s => s.status === "done").sort((a, b) => a.phase - b.phase);
  const partial = loaded.states.filter(s => s.status === "in_progress");
  if (!done.length && !partial.length) return "";
  const out = ["## State from earlier phases (loaded from the manifest)"];
  if (done.length) out.push(`Already complete, do not redo: ${done.map(s => s.agent).join(", ")}`);
  for (const s of done) out.push("", `### ${s.agent} (done)`, s.summary, ...s.findings.map(cite),
    ...(s.openQuestions.length ? ["Open questions:", ...s.openQuestions.map(q => `- ${q}`)] : []));
  for (const s of partial) out.push("", `### ${s.agent} (interrupted, unverified: re-check before relying on these)`, ...s.findings.map(cite));
  if (pending.length) out.push("", `Still pending: ${pending.join(", ")}`);
  return out.join("\n");
}
