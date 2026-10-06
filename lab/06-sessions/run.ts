// Lesson 6: decomposition, sessions and long exploration, live through the Agent SDK on your Claude Code login.
// Run:  npm run l6:ask -- <command>
//   explore            4 phase agents (mapper → refund-tracer → test-finder → planner) hand off through YOUR manifest.
//                      CRASH_AFTER=2 kills the run after 2 agents; run again to resume. RESET=1 starts from scratch.
//   review             YOUR reviewChain(): per-file passes in parallel, then the integration pass
//   session            baseline analysis in a session titled "refund-analysis"; saves .work/session.json
//   change small|big   edit the codebase: small = 2 files, big = event-driven rewrite + a deleted file
//   followup           YOUR planSession() picks resume (+ change notice) or fresh (+ summary). FORCE=resume|fresh overrides
//   fork               two forks of the baseline (unit vs integration testing), then resume the untouched original
// Env:  SOLUTION=1 (reference files) · MODEL=haiku|sonnet (default haiku)
import { query, type HookCallback, type Options } from "@anthropic-ai/claude-agent-sdk";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORK = join(HERE, ".work"), REPO = join(WORK, "refundly"), STATE = join(WORK, "state"), SESSION = join(WORK, "session.json");
const dir = process.env.SOLUTION ? "./solution/" : "./";
const S = await import(`${dir}state.ts`) as typeof import("./solution/state.js");
const F = await import(`${dir}freshness.ts`) as typeof import("./solution/freshness.js");
const D = await import(`${dir}decompose.ts`) as typeof import("./solution/decompose.js");
const MODEL = process.env.MODEL ?? "haiku";
const [cmd = "explore", arg] = process.argv.slice(2);
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5) + "s";

// ── Workspace helpers ─────────────────────────────────────────────────────────
function ensureRepo(reset = false) {
  if (reset) rmSync(WORK, { recursive: true, force: true });
  if (!existsSync(REPO)) { mkdirSync(WORK, { recursive: true }); cpSync(join(HERE, "fixture", "refundly"), REPO, { recursive: true }); }
}
const rel = (p: string) => relative(REPO, p).replace(/\\/g, "/");
function walk(d: string): string[] {
  return readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
function hashes(): Record<string, string> {
  return Object.fromEntries(walk(REPO).filter(p => p.endsWith(".ts")).map(p => [rel(p), createHash("sha1").update(readFileSync(p)).digest("hex").slice(0, 12)]));
}

// ── One agent run, with a compact trace ───────────────────────────────────────
type Run = { text: string; structured: any; sessionId: string; reads: string[]; calls: number; turns: number };
async function runAgent(label: string, prompt: string, opts: Partial<Options>, quiet = false): Promise<Run> {
  const r: Run = { text: "", structured: undefined, sessionId: "", reads: [], calls: 0, turns: 0 };
  const tools = (opts.tools as string[] | undefined) ?? ["Read", "Grep", "Glob"];
  for await (const m of query({
    prompt,
    options: {
      cwd: REPO, tools, allowedTools: tools, settingSources: [], strictMcpConfig: true, model: MODEL, maxTurns: 25,
      env: { ...process.env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" },
      ...opts,
    },
  })) {
    if (m.type === "system" && m.subtype === "init") r.sessionId = m.session_id;
    if (m.type === "assistant") for (const b of m.message.content) {
      if (b.type !== "tool_use") continue;
      r.calls++;
      const i = b.input as { file_path?: string; pattern?: string; path?: string };
      if (b.name === "Read" && i.file_path) r.reads.push(rel(i.file_path));
      if (!quiet) console.log(`${secs()}    ${label} → ${b.name}(${i.file_path ? rel(i.file_path) : JSON.stringify(b.input).slice(0, 60)})`);
    }
    if (m.type === "result") {
      r.sessionId = m.session_id; r.turns = m.num_turns;
      if (m.subtype === "success") { r.text = m.result; r.structured = m.structured_output; }
      else console.log(`${secs()}    ${label} ✖ ${m.subtype}`);
    }
  }
  r.reads = [...new Set(r.reads)];
  return r;
}

const FINDINGS_SCHEMA = {
  type: "object", additionalProperties: false, required: ["summary", "findings", "openQuestions"],
  properties: {
    summary: { type: "string", description: "3-6 sentences a later phase can start from" },
    findings: { type: "array", items: { type: "object", additionalProperties: false, required: ["fact", "file", "line"],
      properties: { fact: { type: "string" }, file: { type: "string", description: "repo-relative path, e.g. src/services/ledger.ts" }, line: { type: ["integer", "null"] } } } },
    openQuestions: { type: "array", items: { type: "string" } },
  },
};

// The scratchpad is the only file a phase agent may write.
const scratchpadOnly: HookCallback = async (input) => {
  const p = String((input as any).tool_input?.file_path ?? "");
  return basename(p) === D.SCRATCHPAD ? {} : { hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const,
    permissionDecisionReason: `Read-only exploration. The only file you may write is ${D.SCRATCHPAD}.` } };
};

// ── explore: phases hand off through the manifest; crash + resume ─────────────
const PHASES = [
  { agent: "mapper", task: "Map the structure of this repo: its modules and what each is responsible for. Then rank the 3 highest-impact areas for new tests (on the money path and untested)." },
  { agent: "refund-tracer", task: "Trace the refund flow dependencies from the HTTP route to the ledger, and anything that reads the ledger afterwards. Name each function in call order." },
  { agent: "test-finder", task: "Find all test files and what each covers. List the functions on the refund path that no test covers." },
  { agent: "planner", task: "Write a prioritized plan of the 5 most valuable tests to add, each naming the function it targets and why. Build on the earlier phases; read code only to settle open questions." },
];

async function explore() {
  ensureRepo(!!process.env.RESET);
  const crashAfter = Number(process.env.CRASH_AFTER ?? 0);
  const before = S.loadManifest(STATE);
  console.log(`[l6 explore] ${dir} · ${MODEL} · ${before ? `manifest found (${before.states.filter(s => s.status === "done").length} done) → RESUMING` : "no manifest → fresh run"}${crashAfter ? ` · CRASH_AFTER=${crashAfter}` : ""}\n`);
  let completedNow = 0, totalReads = 0;
  const thisRun = new Map<string, { summary: string; findings: { fact: string; file: string; line: number | null }[] }>();
  const report: string[] = [];
  for (const [i, p] of PHASES.entries()) {
    const loaded = S.loadManifest(STATE);
    if (loaded?.states.some(s => s.agent === p.agent && s.status === "done")) {
      console.log(`${secs()}  ↷ ${p.agent}: done in manifest, skipped`); report.push(`  ${p.agent.padEnd(14)} skipped (manifest)`); continue;
    }
    if (crashAfter && completedNow === crashAfter) {
      S.writeState(STATE, { agent: p.agent, phase: i + 1, status: "in_progress", summary: "", findings: [], filesRead: [], openQuestions: [], updatedAt: new Date().toISOString() }, "explore");
      console.log(`\n${secs()}  💥 simulated crash while ${p.agent} was starting. Run the same command again to resume.`);
      process.exit(1);
    }
    const pending = PHASES.slice(i).map(x => x.agent);
    const ctx = S.buildResumeContext(loaded, pending);
    console.log(`${secs()}  ▶ ${p.agent} · injected context: ${ctx ? `${ctx.length} chars` : "none"}`);
    const r = await runAgent(p.agent, `${ctx ? ctx + "\n\n" : ""}## Your question\n${p.task}`, {
      systemPrompt: D.EXPLORER_PROMPT, tools: ["Read", "Grep", "Glob", "Write", "Edit"],
      hooks: { PreToolUse: [{ matcher: "Write|Edit", hooks: [scratchpadOnly] }] },
      outputFormat: { type: "json_schema", schema: FINDINGS_SCHEMA },
    });
    totalReads += r.reads.length;
    const out = r.structured ?? { summary: r.text, findings: [], openQuestions: [] };
    const state = { agent: p.agent, phase: i + 1, status: "done", summary: out.summary ?? "", findings: (out.findings ?? []).map((f: any) => ({ ...f, file: String(f.file).replace(/\\/g, "/").replace(/^\.\//, "") })),
      filesRead: r.reads, openQuestions: out.openQuestions ?? [], updatedAt: new Date().toISOString() };
    let note = "";
    try { S.writeState(STATE, state as any, "explore"); }
    catch (e: any) {
      const unsourced = state.findings.filter((f: any) => !r.reads.includes(f.file));
      note = ` · state REJECTED (${(e.issues?.[0]?.message ?? e.message).slice(0, 90)}) → dropped ${unsourced.length} unsourced finding(s)`;
      try { S.writeState(STATE, { ...state, findings: state.findings.filter((f: any) => r.reads.includes(f.file)) } as any, "explore"); }
      catch { S.writeState(STATE, { ...state, status: "failed", findings: [] } as any, "explore"); note += ", still invalid → failed"; }
    }
    thisRun.set(p.agent, state);
    completedNow++;
    const line = `  ${p.agent.padEnd(14)} ${String(r.reads.length).padStart(2)} files read · ${String(state.findings.length).padStart(2)} findings · ${r.turns} turns${note}`;
    console.log(`${secs()}  ✔${line}`); report.push(line);
  }
  // ── Trace ──
  const final = S.loadManifest(STATE);
  const planner = final?.states.find(s => s.agent === "planner") ?? thisRun.get("planner");
  console.log(`\n${"─".repeat(30)} PLANNER OUTPUT ${"─".repeat(30)}\n${planner?.summary ?? "(no planner output)"}`);
  for (const f of planner?.findings ?? []) console.log(`- ${f.fact} (${f.file}${f.line ? ":" + f.line : ""})`);
  console.log(`\n${"─".repeat(33)} TRACE ${"─".repeat(34)}`);
  report.forEach(l => console.log(l));
  console.log(`Files read this run: ${totalReads}`);
  console.log(`Manifest: ${final ? Object.entries(final.manifest.agents).map(([a, v]) => `${a}=${v.status}`).join(", ") : "none (loadManifest returned null)"}`);
  const sp = join(REPO, D.SCRATCHPAD);
  console.log(`Scratchpad: ${existsSync(sp) ? `${readFileSync(sp, "utf8").split("\n").filter(l => l.trim().startsWith("-")).length} finding lines in ${D.SCRATCHPAD}` : "not written"}`);
  const planText = `${planner?.summary ?? ""} ${(planner?.findings ?? []).map(f => f.fact).join(" ")}`;
  const names = ["requestRefund", "postCredit", "settle", "scoreRefund", "refundCharge", "isWithinWindow"].filter(n => new RegExp(`\\b${n}\\b`).test(planText));
  console.log(`Plan names specific functions: ${names.length}/6 (${names.join(", ") || "none"})${/typical|usually|common pattern/i.test(planText) ? " · ⚠ generic language" : ""}`);
  console.log(`Wall clock: ${secs().trim()}`);
}

// ── review: prompt chain ──────────────────────────────────────────────────────
async function review() {
  ensureRepo();
  const files = walk(join(REPO, "src")).map(rel).sort();
  const steps = D.reviewChain(files);
  console.log(`[l6 review] ${dir} · ${MODEL} · ${steps.length} steps: ${steps.map(s => `${s.id}(${s.kind}, ${s.files.length} file${s.files.length > 1 ? "s" : ""}, ${s.input})`).join(" ")}\n`);
  const out = new Map<string, string>();
  const src = (fs: string[]) => fs.map(f => `<file path="${f}">\n${readFileSync(join(REPO, f), "utf8")}\n</file>`).join("\n");
  const runStep = async (s: (typeof steps)[number]) => {
    const body = s.input === "source" ? src(s.files) : s.dependsOn.map(id => `<findings step="${id}">\n${out.get(id) ?? ""}\n</findings>`).join("\n");
    const r = await runAgent(s.id, `${body}\n\n${s.prompt}\nBe concise: at most 6 bullets.`, { tools: [], maxTurns: 1 }, true);
    out.set(s.id, r.text);
    console.log(`${secs()}  ✔ ${s.id.padEnd(12)} ${s.kind.padEnd(11)} → ${r.text.split("\n").filter(l => l.trim()).length} lines`);
  };
  const ready = (s: (typeof steps)[number]) => s.dependsOn.every(id => out.has(id));
  let left = [...steps];
  while (left.length) {
    const wave = left.filter(ready);
    if (!wave.length) { console.log("✖ dependency cycle or unknown dependsOn id"); break; }
    await Promise.all(wave.map(runStep));
    left = left.filter(s => !wave.includes(s));
  }
  const last = steps.at(-1)!;
  const text = out.get(last.id) ?? "";
  console.log(`\n${"─".repeat(28)} FINAL STEP: ${last.id} ${"─".repeat(28)}\n${text}\n`);
  console.log(`${"─".repeat(33)} TRACE ${"─".repeat(34)}`);
  console.log(`Cross-file: settlement depends on the ledger entry shape: ${/settle/i.test(text) && /ledger/i.test(text) ? "✓" : "✗"}`);
  console.log(`Cross-file: non-idempotent credit after the gateway call: ${/idempot|twice|duplicate|double/i.test(text) ? "✓" : "✗"}`);
  const local = [...out.entries()].filter(([id]) => id !== last.id).map(([, t]) => t).join("\n");
  console.log(`Local issue spotted somewhere (e.g. fraud score, missing validation, retry): ${/fraud|valid|retry|NaN|negative/i.test(local + text) ? "✓" : "✗"}`);
  console.log(`Wall clock: ${secs().trim()}`);
}

// ── session / change / followup / fork ────────────────────────────────────────
const BASELINE_Q = "Analyze the refund flow end to end: every function on the path in call order, with file and line, and the main risks. Read the code; don't guess.";
async function session() {
  ensureRepo(true);
  console.log(`[l6 session] ${MODEL} · baseline analysis, title "refund-analysis" (fresh copy of the codebase)\n`);
  const r = await runAgent("baseline", BASELINE_Q, { title: "refund-analysis", outputFormat: { type: "json_schema", schema: FINDINGS_SCHEMA } });
  const h = hashes();
  const out = r.structured ?? { summary: r.text, findings: [] };
  const rec = { sessionId: r.sessionId, name: "refund-analysis", summary: out.summary, findings: out.findings ?? [], filesRead: r.reads.filter(p => p in h).map(path => ({ path, hash: h[path] })) };
  writeFileSync(SESSION, JSON.stringify(rec, null, 2));
  console.log(`\n${out.summary}\n`);
  console.log(`Session ${r.sessionId} · ${rec.filesRead.length} files read · ${rec.findings.length} findings → saved to .work/session.json`);
  console.log(`Interactive equivalent: cd lab/06-sessions/.work/refundly; claude --resume refund-analysis`);
}

function change(kind: string | undefined) {
  if (kind !== "small" && kind !== "big") { console.log("usage: l6:ask -- change small|big"); process.exit(1); }
  if (!existsSync(REPO)) { console.log("Run `l6:ask -- session` first."); process.exit(1); }
  const overlay = join(HERE, "fixture", "changes", kind);
  const before = hashes();
  cpSync(join(overlay, "src"), join(REPO, "src"), { recursive: true });
  const delFile = join(overlay, "deleted.txt");
  if (existsSync(delFile)) for (const p of readFileSync(delFile, "utf8").split("\n").map(s => s.trim()).filter(Boolean)) rmSync(join(REPO, p), { force: true });
  const after = hashes();
  const changed = Object.keys(before).filter(p => p in after && after[p] !== before[p]);
  const deleted = Object.keys(before).filter(p => !(p in after));
  const added = Object.keys(after).filter(p => !(p in before));
  console.log(`[l6 change ${kind}] modified: ${changed.join(", ") || "none"} · deleted: ${deleted.join(", ") || "none"} · added: ${added.join(", ") || "none"}`);
}

const FOLLOWUP_Q = "Quick follow-up on the refund flow: which function posts the ledger credit, with what arguments, and is it safe to call twice for the same refund? Cite file:line.";
async function followup() {
  if (!existsSync(SESSION)) { console.log("Run `l6:ask -- session` first."); process.exit(1); }
  const prior = JSON.parse(readFileSync(SESSION, "utf8"));
  const now = hashes();
  const actuallyChanged = new Set<string>(prior.filesRead.filter((f: { path: string; hash: string }) => now[f.path] !== f.hash).map((f: { path: string }) => f.path));
  let plan = F.planSession(prior, now);
  const force = process.env.FORCE;
  if (force === "resume" && plan.mode !== "resume") plan = { mode: "resume", sessionId: prior.sessionId, prompt: "", changed: plan.changed, deleted: plan.deleted };
  if (force === "fresh" && plan.mode !== "fresh") plan = { mode: "fresh", prompt: "", changed: plan.changed, deleted: plan.deleted };
  console.log(`[l6 followup] ${dir} · ${MODEL} · plan: ${plan.mode.toUpperCase()}${force ? ` (FORCE=${force})` : ""} · changed ${plan.changed.length} · deleted ${plan.deleted.length} of ${prior.filesRead.length} files read`);
  console.log(`Injected prompt (${plan.prompt.length} chars):\n${plan.prompt ? plan.prompt.replace(/^/gm, "  │ ") : "  │ (none)"}\n`);
  const r = await runAgent(plan.mode, `${plan.prompt ? plan.prompt + "\n\n" : ""}${FOLLOWUP_Q}`,
    plan.mode === "resume" ? { resume: plan.sessionId } : { title: "refund-analysis (fresh)" });
  const a = r.text;
  console.log(`\n${"─".repeat(30)} ANSWER ${"─".repeat(30)}\n${a}\n`);
  console.log(`${"─".repeat(33)} TRACE ${"─".repeat(34)}`);
  console.log(`Session: ${plan.mode === "resume" ? `resumed ${r.sessionId === prior.sessionId ? "the same id ✓" : r.sessionId}` : `new ${r.sessionId}`}`);
  console.log(`Files actually changed or deleted since baseline: ${actuallyChanged.size} · your plan reported ${plan.changed.length + plan.deleted.length}`);
  console.log(`Files re-read: ${r.reads.length} (${r.reads.filter(p => actuallyChanged.has(p)).length} of them changed) · ${r.reads.join(", ") || "none"}`);
  const isNew = existsSync(join(REPO, "src/services/refund-worker.ts"));
  console.log(`Answer names postRefundCredit (current code): ${/postRefundCredit/.test(a) ? "✓" : "✗"}${/\bpostCredit\b/.test(a) && !/postRefundCredit/.test(a) ? "  ⚠ cites the OLD postCredit (stale context)" : ""}`);
  console.log(`Answer says it's idempotent now: ${/idempot/i.test(a) && !/not idempotent/i.test(a) ? "✓" : "✗"}`);
  if (isNew) console.log(`Answer reflects the event-driven rewrite (worker/event): ${/worker|event/i.test(a) ? "✓" : "✗"}`);
  console.log(`Wall clock: ${secs().trim()}`);
}

async function fork() {
  if (!existsSync(SESSION)) { console.log("Run `l6:ask -- session` first."); process.exit(1); }
  const prior = JSON.parse(readFileSync(SESSION, "utf8"));
  console.log(`[l6 fork] ${MODEL} · baseline ${prior.sessionId}\n`);
  const branches = [
    ["unit", "Propose a testing strategy for the refund path built on UNIT tests with the gateway and ledger mocked. Name the first 3 tests. Don't write files."],
    ["integration", "Propose a testing strategy for the refund path built on INTEGRATION tests against the real in-memory ledger and order repo, stubbing only the processor network call. Name the first 3 tests. Don't write files."],
  ];
  const ids: string[] = [];
  for (const [name, prompt] of branches) {
    const r = await runAgent(`fork:${name}`, prompt, { resume: prior.sessionId, forkSession: true, maxTurns: 8 });
    ids.push(r.sessionId);
    console.log(`\n── fork:${name} (${r.sessionId}) · ${r.reads.length} files re-read ──\n${r.text.slice(0, 900)}${r.text.length > 900 ? "…" : ""}\n`);
  }
  const back = await runAgent("original", "Quick check: which testing strategy have we chosen in THIS conversation so far? One sentence.", { resume: prior.sessionId, maxTurns: 2 });
  console.log(`── original, resumed (${back.sessionId}) ──\n${back.text}\n`);
  console.log(`${"─".repeat(33)} TRACE ${"─".repeat(34)}`);
  console.log(`Fork ids differ from the baseline and each other: ${new Set([prior.sessionId, ...ids]).size === 3 ? "✓" : "✗"} (${ids.join(", ")})`);
  console.log(`Original kept its id on resume: ${back.sessionId === prior.sessionId ? "✓" : "✗"}`);
  console.log(`Original knows nothing of either fork: ${!/unit test|integration test/i.test(back.text) || /no(t| testing)|haven't|none/i.test(back.text) ? "✓" : "✗ (check the answer above)"}`);
  console.log(`Wall clock: ${secs().trim()}`);
}

switch (cmd) {
  case "explore": await explore(); break;
  case "review": await review(); break;
  case "session": await session(); break;
  case "change": change(arg); break;
  case "followup": await followup(); break;
  case "fork": await fork(); break;
  default: console.log("commands: explore | review | session | change small|big | followup | fork");
}
