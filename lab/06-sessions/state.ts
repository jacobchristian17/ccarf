// Lesson 6 · TODO 1: structured state export + manifest for crash recovery (task statement 5.4).
//
// run.ts is a code coordinator. It runs four phase agents in order (mapper → refund-tracer → test-finder → planner).
// After each agent, it calls YOUR writeState(). Before each agent, it calls YOUR loadManifest() + buildResumeContext()
// and puts the result in that agent's prompt. So the manifest is how phases hand off to each other, and crash
// recovery comes free: CRASH_AFTER=2 kills the run after two agents, and the rerun picks up from the manifest.
//
// 1a · AgentState: tighten the schema
//   • status: "done" | "in_progress" | "failed"
//   • updatedAt: an ISO datetime (z.iso.datetime())
//   • Finding.file: a repo-relative path (reject "/abs/path" and "C:\…"); line: positive int or null
//   • rule: a "done" state must have a non-empty summary (the next phase starts from it)
//   • rule: every finding's file must appear in filesRead. run.ts fills filesRead from the agent's real Read calls,
//     so this rejects findings about files the agent never opened (the "typical patterns" failure)
//   Write issue messages as instructions.
// 1b · writeState(dir, state, runId)
//   • validate with AgentState.parse (throw on invalid)
//   • write <dir>/<agent>.json, then update <dir>/manifest.json: { runId, updatedAt, agents: { [agent]: { status, stateFile } } }
//     keep other agents' entries; create the manifest if missing
//   • write atomically: write "<path>.tmp", then renameSync. A crash mid-write must never leave half a JSON file
// 1c · loadManifest(dir) → { manifest, states } | null
//   • null if there's no manifest (or it doesn't parse)
//   • load each agent's stateFile; skip one that's missing or invalid (that agent counts as pending)
// 1d · buildResumeContext(loaded, pending) → string ("" when there's nothing to inject)
//   • header: "## State from earlier phases (loaded from the manifest)"
//   • "Already complete, do not redo: a, b"
//   • per done agent, in phase order: "### <agent> (done)", its summary, findings as "- <fact> (<file>:<line>)", open questions
//   • an in_progress agent's findings appear under a heading that says "interrupted" and "unverified"
//   • "Still pending: …"
// `npm run l6:check` grades this; `npm run l6:ask -- explore` shows it.
import { z } from "zod";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const Finding = z.object({
  fact: z.string(),
  file: z.string(),
  line: z.number().nullable(),
});
export type Finding = z.infer<typeof Finding>;

export const AgentState = z.object({
  agent: z.string(),
  phase: z.number(),
  status: z.string(),
  summary: z.string(),
  findings: z.array(Finding),
  filesRead: z.array(z.string()),
  openQuestions: z.array(z.string()),
  updatedAt: z.string(),
});
export type AgentState = z.infer<typeof AgentState>;

export type Manifest = { runId: string; updatedAt: string; agents: Record<string, { status: string; stateFile: string }> };
export type Loaded = { manifest: Manifest; states: AgentState[] };

export function writeState(dir: string, state: AgentState, _runId = "run"): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${state.agent}.json`), JSON.stringify(state)); // TODO 1b: validate, atomic write, manifest
}

export function loadManifest(_dir: string): Loaded | null {
  return null; // TODO 1c
}

export function buildResumeContext(_loaded: Loaded | null, _pending: string[]): string {
  return ""; // TODO 1d
}
