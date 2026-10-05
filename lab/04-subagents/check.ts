// Lesson 4 grader: checks your agent definitions and coordinator config, and calls your hooks with synthetic
// SDK inputs. No model, no network.
// Run:  npm run l4:check            (your agents.ts + coordinator.ts + hooks.ts)
//       npm run l4:check:solution   (reference)
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { green, red } from "../shared/colors.js";
import { TOOL } from "./tools.js";

const dir = process.argv[2] === "solution" ? "./solution/" : "./";
const { AGENTS } = await import(`${dir}agents.ts`) as { AGENTS: Record<string, AgentDefinition> };
const { COORDINATOR_PROMPT, COORDINATOR_TOOLS } = await import(`${dir}coordinator.ts`) as { COORDINATOR_PROMPT: string; COORDINATOR_TOOLS: string[] };
const H = await import(`${dir}hooks.ts`);

const ctx = { signal: new AbortController().signal };
const base = { session_id: "s", transcript_path: "", cwd: "." };
const preAgent = (subagent_type: string, prompt: string) =>
  ({ ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { subagent_type, description: "d", prompt }, tool_use_id: "t" });
const postAgent = (report: string) =>
  ({ ...base, hook_event_name: "PostToolUse", tool_name: "Agent", tool_input: { subagent_type: "searcher", description: "d", prompt: "p" }, tool_use_id: "t",
     tool_response: { status: "completed", agentType: "searcher", content: [{ type: "text", text: report }] } });
const decision = (out: any) => out?.hookSpecificOutput?.permissionDecision ?? "allow";
const reason = (out: any): string => out?.hookSpecificOutput?.permissionDecisionReason ?? "";

const MUSIC = "https://music-ledger.test/producers-ai-2026";
const VFX = "https://reelfacts.test/vfx-genai";
const DOC = "creative-economy-2026";
/** A run where two subagents have reported back: one web searcher (2 URLs) and the doc-analyst (1 doc). */
async function run() {
  const state = H.newState();
  await H.recordSources(state)(postAgent(`{"findings":[{"claim":"31%","source":{"id":"${MUSIC}"}},{"claim":"third of shots","source":{"id":"${VFX}"}}]}`), "t", ctx);
  await H.recordSources(state)(postAgent(`Report: employment flat (${DOC}, p.4)`), "t", ctx);
  return { state, brief: (type: string, prompt: string) => H.requireCompleteBrief(state)(preAgent(type, prompt), "t", ctx) };
}

const a = (name: string) => AGENTS[name] ?? ({} as AgentDefinition);
const tools = (name: string) => a(name).tools ?? [];
const RESEARCH = Object.values(TOOL);
const P = COORDINATOR_PROMPT;

let pass = 0, total = 0;
const groups: [string, [string, () => boolean | Promise<boolean>][]][] = [
  ["1.3 · 2.3 · Subagent definitions (TODO 1)", [
    ["searcher, doc-analyst and synthesizer are defined", () => ["searcher", "doc-analyst", "synthesizer"].every(n => n in AGENTS)],
    ["every description says what the agent is for (≥ 40 chars, not 'TODO')", () => Object.values(AGENTS).every(d => d.description.length >= 40 && !/TODO/.test(d.description))],
    ["every agent has an explicit tools list (omitted = inherits every tool)", () => Object.values(AGENTS).every(d => Array.isArray(d.tools) && d.tools.length > 0)],
    ["searcher: web_search only", () => tools("searcher").length === 1 && tools("searcher")[0] === TOOL.web_search],
    ["doc-analyst: list_documents + load_document, no web_search", () =>
      tools("doc-analyst").includes(TOOL.load_document) && tools("doc-analyst").includes(TOOL.list_documents) && !tools("doc-analyst").includes(TOOL.web_search)],
    ["synthesizer: scoped verify_fact, no search or document tools", () =>
      tools("synthesizer").includes(TOOL.verify_fact) && ![TOOL.web_search, TOOL.load_document, TOOL.list_documents].some(t => tools("synthesizer").includes(t))],
    ["no subagent can spawn subagents (no Agent/Task in tools)", () => Object.values(AGENTS).every(d => !(d.tools ?? []).some(t => t === "Agent" || t === "Task"))],
    ["searcher + doc-analyst return claim + source id + date (content apart from metadata)", () =>
      ["searcher", "doc-analyst"].every(n => /claim/i.test(a(n).prompt) && /(url|source|doc_id)/i.test(a(n).prompt) && /(date|published)/i.test(a(n).prompt))],
    ["doc-analyst keeps page numbers", () => /page/i.test(a("doc-analyst").prompt)],
    ["synthesizer cites a source for every claim", () => /(cite|citation|source id)/i.test(a("synthesizer").prompt)],
    ["synthesizer keeps conflicting values with their sources", () => /(conflict|disagree|contradict|both values)/i.test(a("synthesizer").prompt)],
    ["synthesizer reports coverage gaps", () => /gap/i.test(a("synthesizer").prompt)],
  ]],
  ["1.2 · 1.3 · Coordinator (TODO 2)", [
    ["coordinator can spawn subagents (\"Agent\", exam: \"Task\")", () => COORDINATOR_TOOLS.includes("Agent") || COORDINATOR_TOOLS.includes("Task")],
    ["coordinator holds no research tools (the hub delegates)", () => !COORDINATOR_TOOLS.some(t => RESEARCH.includes(t as any) || t.startsWith("mcp__research"))],
    ["prompt sets a coverage goal: the full breadth of the topic", () => /(breadth|full range|every (area|aspect|subtopic)|all (the )?(relevant|major|distinct) (areas|aspects|subtopics)|cover(age)?)/i.test(P)],
    ["prompt partitions work so subagents don't duplicate each other", () => /(distinct|non-overlapping|duplicat|overlap)/i.test(P)],
    ["prompt scales effort to the query (not always the full pipeline)", () => /(simple|single factual|complexity|proportion|scale)/i.test(P)],
    ["prompt asks for parallel spawns in ONE response", () => /parallel/i.test(P) && /(one|single|same) (response|turn|message)/i.test(P)],
    ["prompt says subagents don't inherit context", () => /(inherit|only (see|know)|see only|cannot see|can't see|don't see|do not see)/i.test(P)],
    ["prompt passes complete findings to the synthesizer", () => /(complete|full|all|verbatim)[^.\n]{0,40}findings/i.test(P)],
    ["prompt checks for gaps and re-delegates", () => /gap/i.test(P) && /(re-?delegat|re-?run|again|targeted)/i.test(P)],
    ["goals and criteria, not a numbered procedure (no 'Step 1')", () => !/step\s*\d/i.test(P)],
  ]],
  ["1.3 · Context-passing hooks (TODO 3)", [
    ["recordSources: both URLs from a searcher's report are recorded", async () => { const { state } = await run(); return state.sourcesReturned.has(MUSIC) && state.sourcesReturned.has(VFX); }],
    ["recordSources: a doc_id from the doc-analyst's report is recorded", async () => (await run()).state.sourcesReturned.has(DOC)],
    ["synthesizer before any findings came back → deny", async () => { const s = H.newState(); return decision(await H.requireCompleteBrief(s)(preAgent("synthesizer", "write it"), "t", ctx)) === "deny"; }],
    ["synthesizer prompt missing a source → deny", async () => decision(await (await run()).brief("synthesizer", `Findings: ${MUSIC} ${DOC}`)) === "deny"],
    ["…and the reason names the missing source", async () => reason(await (await run()).brief("synthesizer", `Findings: ${MUSIC} ${DOC}`)).includes(VFX)],
    ["…and says why (subagents don't inherit context)", async () => /(inherit|only (see|sees)|sees only|context)/i.test(reason(await (await run()).brief("synthesizer", `Findings: ${MUSIC}`)))],
    ["synthesizer prompt with every source → allow", async () => decision(await (await run()).brief("synthesizer", `Findings: ${MUSIC} ${VFX} ${DOC}`)) === "allow"],
    ["searcher spawns are never blocked by the brief check", async () => decision(await (await run()).brief("searcher", "AI in music")) === "allow"],
    ["state is per run (a new run starts empty)", async () => { await run(); return H.newState().sourcesReturned.size === 0; }],
  ]],
];

for (const [title, checks] of groups) {
  console.log(`\n${title}`);
  for (const [name, fn] of checks) {
    total++;
    let ok = false, err = "";
    try { ok = await fn(); } catch (e) { err = ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
    if (ok) pass++;
    console.log(ok ? green(`  ✓ ${name}`) : red(`  ✗ ${name}${err}`));
  }
}
console.log((pass === total ? green : red)(`\n══ L4 check: ${pass}/${total}${pass === total ? " · all green" : ""}`));
