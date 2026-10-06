// Lesson 6 grader: runs your state export against a temp dir, your session planner against fixture diffs,
// your review chain against a file list, and checks your explorer prompt. No model, no network.
// Run:  npm run l6:check            (your state.ts + freshness.ts + decompose.ts)
//       npm run l6:check:solution   (reference)
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { green, red } from "../shared/colors.js";

const dir = process.argv[2] === "solution" ? "./solution/" : "./";
const S = await import(`${dir}state.ts`) as typeof import("./solution/state.js");
const F = await import(`${dir}freshness.ts`) as typeof import("./solution/freshness.js");
const D = await import(`${dir}decompose.ts`) as typeof import("./solution/decompose.js");

// ── Fixtures ──────────────────────────────────────────────────────────────────
const NOW = "2026-10-05T10:00:00.000Z";
const mapper = {
  agent: "mapper", phase: 1, status: "done", summary: "Refund path: routes → refund-service → gateway → ledger; settlement reads the ledger.",
  findings: [{ fact: "postCredit is not idempotent", file: "src/services/ledger.ts", line: 6 },
             { fact: "only policy.ts has tests", file: "tests/policy.test.ts", line: null }],
  filesRead: ["src/services/ledger.ts", "tests/policy.test.ts", "src/services/refund-service.ts"],
  openQuestions: ["Does settlement tolerate duplicate credits?"], updatedAt: NOW,
};
const tracer = { ...mapper, agent: "refund-tracer", phase: 2, summary: "requestRefund calls refundCharge then postCredit.",
  findings: [{ fact: "requestRefund posts the credit after the gateway call", file: "src/services/refund-service.ts", line: 19 }], openQuestions: [] };
const interrupted = { ...mapper, agent: "test-finder", phase: 3, status: "in_progress", summary: "",
  findings: [{ fact: "no tests for settlement", file: "tests/policy.test.ts", line: null }], openQuestions: [] };
const valid = (s: unknown) => S.AgentState.safeParse(s).success;
const msgs = (s: unknown) => { const p = S.AgentState.safeParse(s); return p.success ? "" : p.error.issues.map(i => i.message).join(" | "); };
const tmp = () => mkdtempSync(join(tmpdir(), "l6-"));
function withDir<T>(fn: (d: string) => T): T { const d = tmp(); try { return fn(d); } finally { rmSync(d, { recursive: true, force: true }); } }
const throws = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const filesRead = ["src/routes/refunds.ts", "src/services/refund-service.ts", "src/services/ledger.ts", "src/services/policy.ts",
  "src/adapters/payment-gateway.ts", "src/jobs/settlement.ts"].map((path, i) => ({ path, hash: `h${i}` }));
const prior = {
  sessionId: "11111111-2222-3333-4444-555555555555", name: "refund-analysis",
  summary: "The refund path runs routes → refund-service → gateway → ledger. Settlement reads ledger entries nightly.",
  findings: [{ fact: "postCredit is not idempotent", file: "src/services/ledger.ts", line: 6 },
             { fact: "the window is 30 days", file: "src/services/policy.ts", line: 2 },
             { fact: "the gateway retries transient errors twice", file: "src/adapters/payment-gateway.ts", line: 4 }],
  filesRead,
};
const cur = (edit: Record<string, string | null> = {}) => {
  const c: Record<string, string> = Object.fromEntries(filesRead.map(f => [f.path, f.hash]));
  for (const [p, h] of Object.entries(edit)) h === null ? delete c[p] : (c[p] = h);
  c["src/repos/order-repo.ts"] = "hx"; // a file the session never read: irrelevant
  return c;
};
const same = () => F.planSession(prior, cur());
const small = () => F.planSession(prior, cur({ "src/services/ledger.ts": "new", "src/services/refund-service.ts": "new" }));
const del = () => F.planSession(prior, cur({ "src/jobs/settlement.ts": null }));
const big = () => F.planSession(prior, cur({ "src/services/ledger.ts": "n", "src/services/refund-service.ts": "n", "src/services/policy.ts": "n",
  "src/routes/refunds.ts": "n", "src/jobs/settlement.ts": null }));
const exactlyHalf = () => F.planSession(prior, cur({ "src/services/ledger.ts": "n", "src/services/policy.ts": "n", "src/routes/refunds.ts": "n" }));
const line = (text: string, needle: string) => text.split("\n").find(l => l.includes(needle)) ?? "";

const FILES = ["src/routes/refunds.ts", "src/services/refund-service.ts", "src/services/ledger.ts", "src/jobs/settlement.ts"];
const chain = () => D.reviewChain(FILES);
const perFile = () => chain().filter(s => s.kind === "per-file");
const integ = () => chain().filter(s => s.kind === "integration");
const P = D.EXPLORER_PROMPT;
const sp = D.SCRATCHPAD.replace(".", "\\.");

let pass = 0, total = 0;
const groups: [string, [string, () => boolean][]][] = [
  ["5.4 · State schema (TODO 1a)", [
    ["a done state with sourced findings parses", () => valid(mapper)],
    ["an interrupted (in_progress) state parses", () => valid(interrupted)],
    ["unknown status is rejected", () => !valid({ ...mapper, status: "finished" })],
    ["updatedAt must be an ISO datetime", () => !valid({ ...mapper, updatedAt: "yesterday" })],
    ["absolute file paths are rejected (/… and C:\\…)", () => !valid({ ...mapper, filesRead: [...mapper.filesRead, "/src/x.ts"], findings: [{ fact: "x", file: "/src/x.ts", line: 1 }] })
      && !valid({ ...mapper, filesRead: [...mapper.filesRead, "C:\\repo\\x.ts"], findings: [{ fact: "x", file: "C:\\repo\\x.ts", line: 1 }] })],
    ["line must be a positive integer or null", () => !valid({ ...mapper, findings: [{ ...mapper.findings[0], line: 0 }] })],
    ["done with an empty summary is rejected", () => !valid({ ...mapper, summary: "  " })],
    ["a finding citing a file never read is rejected", () => !valid({ ...mapper, findings: [{ fact: "settlement double-counts", file: "src/jobs/settlement.ts", line: 9 }] })],
    ["…and the message names the file and says to cite files you read", () => /settlement\.ts/.test(msgs({ ...mapper, findings: [{ fact: "x", file: "src/jobs/settlement.ts", line: 9 }] }))
      && /read/i.test(msgs({ ...mapper, findings: [{ fact: "x", file: "src/jobs/settlement.ts", line: 9 }] }))],
  ]],
  ["5.4 · writeState + manifest (TODO 1b, 1c)", [
    ["writes <agent>.json", () => withDir(d => { S.writeState(d, mapper as any, "r1"); return existsSync(join(d, "mapper.json")); })],
    ["writes manifest.json with runId and the agent's status + stateFile", () => withDir(d => {
      S.writeState(d, mapper as any, "r1"); const m = readJson(join(d, "manifest.json"));
      return m.runId === "r1" && m.agents?.mapper?.status === "done" && m.agents?.mapper?.stateFile === "mapper.json"; })],
    ["a second agent is added and the first is kept", () => withDir(d => {
      S.writeState(d, mapper as any, "r1"); S.writeState(d, tracer as any, "r1"); const m = readJson(join(d, "manifest.json"));
      return !!m.agents?.mapper && !!m.agents?.["refund-tracer"]; })],
    ["re-writing an agent updates its status in place", () => withDir(d => {
      S.writeState(d, interrupted as any); S.writeState(d, { ...interrupted, status: "done", summary: "3 untested modules" } as any);
      return readJson(join(d, "manifest.json")).agents["test-finder"].status === "done"; })],
    ["an invalid state throws and writes nothing", () => withDir(d => throws(() => S.writeState(d, { ...mapper, status: "nope" } as any))
      && !existsSync(join(d, "mapper.json")) && !existsSync(join(d, "manifest.json")))],
    ["writes are atomic (no .tmp files left behind)", () => withDir(d => { S.writeState(d, mapper as any); S.writeState(d, tracer as any);
      return readdirSync(d).every(f => !f.endsWith(".tmp")); })],
    ["loadManifest returns null when there is no manifest", () => withDir(d => S.loadManifest(d) === null)],
    ["loadManifest returns the manifest and every valid state", () => withDir(d => {
      S.writeState(d, mapper as any); S.writeState(d, tracer as any); const l = S.loadManifest(d);
      return !!l && l.states.length === 2 && l.states.some(s => s.agent === "refund-tracer"); })],
    ["a corrupt state file is skipped (that agent counts as pending), not a crash", () => withDir(d => {
      S.writeState(d, mapper as any); S.writeState(d, tracer as any); writeFileSync(join(d, "refund-tracer.json"), "{ half a fi");
      const l = S.loadManifest(d); return !!l && l.states.length === 1 && l.states[0].agent === "mapper"; })],
  ]],
  ["5.4 · Resume context (TODO 1d)", [
    ["nothing loaded → empty string", () => S.buildResumeContext(null, ["mapper"]) === ""],
    ["has the header and lists completed agents as 'do not redo'", () => withDir(d => {
      S.writeState(d, mapper as any); S.writeState(d, tracer as any); const c = S.buildResumeContext(S.loadManifest(d), ["test-finder", "planner"]);
      return /State from earlier phases/i.test(c) && /do not redo[^\n]*mapper[^\n]*refund-tracer/i.test(c); })],
    ["includes each done agent's summary", () => withDir(d => {
      S.writeState(d, mapper as any); const c = S.buildResumeContext(S.loadManifest(d), []);
      return c.includes(mapper.summary); })],
    ["findings keep file:line ('- fact (file:line)')", () => withDir(d => {
      S.writeState(d, mapper as any); const c = S.buildResumeContext(S.loadManifest(d), []);
      return c.includes("- postCredit is not idempotent (src/services/ledger.ts:6)") && c.includes("(tests/policy.test.ts)"); })],
    ["carries open questions", () => withDir(d => { S.writeState(d, mapper as any); return S.buildResumeContext(S.loadManifest(d), []).includes("Does settlement tolerate duplicate credits?"); })],
    ["done agents appear in phase order", () => withDir(d => {
      S.writeState(d, tracer as any); S.writeState(d, mapper as any); const c = S.buildResumeContext(S.loadManifest(d), []);
      return c.indexOf("### mapper") >= 0 && c.indexOf("### mapper") < c.indexOf("### refund-tracer"); })],
    ["interrupted findings are marked interrupted + unverified, never 'done'", () => withDir(d => {
      S.writeState(d, mapper as any); S.writeState(d, interrupted as any); const c = S.buildResumeContext(S.loadManifest(d), ["planner"]);
      const h = line(c, "test-finder"); return /interrupted/i.test(c) && /unverified/i.test(c) && !/test-finder \(done\)/.test(c) && !/do not redo[^\n]*test-finder/i.test(c) && !!h; })],
    ["lists what is still pending", () => withDir(d => { S.writeState(d, mapper as any); return /pending[^\n]*test-finder[^\n]*planner/i.test(S.buildResumeContext(S.loadManifest(d), ["test-finder", "planner"])); })],
  ]],
  ["1.7 · Resume or start fresh (TODO 2)", [
    ["nothing changed → resume the same session id", () => { const p = same(); return p.mode === "resume" && (p as any).sessionId === prior.sessionId; }],
    ["…and the notice says nothing changed", () => /no files have changed/i.test(same().prompt)],
    ["2 of 6 changed → resume (prior context mostly valid)", () => small().mode === "resume"],
    ["…changed lists exactly the two modified files", () => small().changed.slice().sort().join() === "src/services/ledger.ts,src/services/refund-service.ts"],
    ["…notice names each changed file with (modified)", () => /src\/services\/ledger\.ts \(modified\)/.test(small().prompt) && /refund-service\.ts \(modified\)/.test(small().prompt)],
    ["…notice says re-read only those, the rest still holds", () => /re-?read only/i.test(small().prompt) && /(still (valid|holds))/i.test(small().prompt)],
    ["…notice doesn't name unchanged files", () => !/policy\.ts|payment-gateway\.ts/.test(small().prompt)],
    ["a deleted file is detected and named (deleted)", () => del().deleted.join() === "src/jobs/settlement.ts" && /settlement\.ts \(deleted\)/.test(del().prompt)],
    ["files the session never read are ignored", () => !small().changed.includes("src/repos/order-repo.ts")],
    ["exactly half stale → still resume (<= limit)", () => exactlyHalf().mode === "resume"],
    ["5 of 6 stale → fresh", () => big().mode === "fresh"],
    ["…fresh prompt is a structured summary with the prior summary", () => /^## Summary of an earlier analysis/m.test(big().prompt) && big().prompt.includes(prior.summary)],
    ["…findings in changed files are tagged STALE + re-verify", () => /STALE/.test(line(big().prompt, "postCredit is not idempotent")) && /re-?verify/i.test(line(big().prompt, "postCredit is not idempotent"))],
    ["…findings in unchanged files are not tagged", () => !/STALE/.test(line(big().prompt, "retries transient errors"))],
    ["…lists the changed and deleted files", () => /settlement\.ts \(deleted\)/.test(big().prompt) && /policy\.ts \(modified\)/.test(big().prompt)],
    ["no filesRead → fresh (nothing to trust)", () => F.planSession({ ...prior, filesRead: [] }, cur()).mode === "fresh"],
  ]],
  ["1.6 · Review chain (TODO 3a)", [
    ["one per-file step per file", () => perFile().length === FILES.length],
    ["each per-file step covers exactly its own file", () => perFile().every((s, i) => s.files.length === 1 && s.files[0] === FILES[i])],
    ["per-file steps read source and depend on nothing", () => perFile().every(s => s.input === "source" && s.dependsOn.length === 0)],
    ["per-file prompts keep the review local to the file", () => perFile().every((s, i) => s.prompt.includes(FILES[i]) && /only|local/i.test(s.prompt))],
    ["exactly one integration step, and it's last", () => integ().length === 1 && chain().at(-1)?.kind === "integration"],
    ["integration gets findings, not the raw source again", () => integ()[0]?.input === "findings"],
    ["integration depends on every per-file step", () => { const ids = perFile().map(s => s.id); return ids.length > 0 && ids.every(id => integ()[0]?.dependsOn.includes(id)); }],
    ["integration prompt targets cross-file issues", () => /cross-file|across files|between (modules|files)/i.test(integ()[0]?.prompt ?? "") && /data flow|contract|interface/i.test(integ()[0]?.prompt ?? "")],
  ]],
  ["5.4 · 1.6 · Explorer prompt (TODO 3b)", [
    ["reads the scratchpad first", () => new RegExp(`read[^.\\n]*${sp}[^.\\n]*first|first[^.\\n]*read[^.\\n]*${sp}`, "i").test(P)],
    ["appends findings to the scratchpad with file:line", () => new RegExp(`append[^\\n]*${sp}`, "i").test(P) && /file[^\n]*line|<file>:<line>|file:line/i.test(P)],
    ["maps the structure before digging in", () => /map|structure|glob/i.test(P) && /before|first/i.test(P)],
    ["adapts the plan to discovered dependencies", () => /adapt|update (the|your) plan|add it to (the|your) plan/i.test(P) && /dependenc/i.test(P)],
    ["prioritises high-impact areas", () => /high-impact|priorit/i.test(P)],
    ["specific names, never 'typical patterns'", () => /typical patterns|usually/i.test(P) && /specific|actual|name/i.test(P)],
    ["cites only files actually read", () => /(only|must) cite[^.\n]*read|cite (only )?(a )?files? you (actually )?read/i.test(P)],
  ]],
];

for (const [title, checks] of groups) {
  console.log(`\n${title}`);
  for (const [name, fn] of checks) {
    total++;
    let ok = false;
    try { ok = !!fn(); } catch { ok = false; }
    if (ok) pass++;
    console.log((ok ? green : red)(`  ${ok ? "✓" : "✗"} ${name}`));
  }
}
console.log((pass === total ? green : red)(`\n══ L6 check: ${pass}/${total}`));
