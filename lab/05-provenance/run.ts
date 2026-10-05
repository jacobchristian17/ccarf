// Lesson 5: run the research system with fault injection, through the Agent SDK on your Claude Code login.
// Run:  npm run l5:ask -- creative             scenarios: creative  dance  (or free text)
// Env:  OUTAGE=games   every web search that lands on that subtopic times out (persistent access failure)
//       FLAKY=1        the first call of each query times out, a retry succeeds (transient failure)
//       HOOKS=off      no report validation, no brief injection (the coordinator passes findings itself)
//       SOLUTION=1     use solution/report.ts + brief.ts + agents.ts + coordinator.ts
//       MODEL=haiku    coordinator model (default: sonnet). Subagents use haiku.
import { query, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { z } from "zod";
import { researchServer, FAULTS } from "./tools.js";
import { createHooks, newState, extractSourceIds, type Deps } from "./hooks.js";

const SCENARIOS: Record<string, string> = {
  creative: "Research the impact of AI on the creative industries. Give me a short brief with a citation for every claim.",
  dance:    "Research the impact of AI on the creative industries, including dance and live theatre. Short cited brief.",
};
const arg = process.argv.slice(2).join(" ");
const question = SCENARIOS[arg] ?? (arg || SCENARIOS.creative);
const dir = process.env.SOLUTION ? "./solution/" : "./";
const { AGENTS } = await import(`${dir}agents.ts`) as { AGENTS: Record<string, AgentDefinition> };
const { COORDINATOR_PROMPT, COORDINATOR_TOOLS } = await import(`${dir}coordinator.ts`) as { COORDINATOR_PROMPT: string; COORDINATOR_TOOLS: string[] };
const { SubagentReport } = await import(`${dir}report.ts`) as { SubagentReport: z.ZodType<any> };
const { buildSynthesisBrief } = await import(`${dir}brief.ts`) as { buildSynthesisBrief: Deps["buildSynthesisBrief"] };
const hooksOn = process.env.HOOKS !== "off";

const state = newState();
const deps: Deps = { SubagentReport, buildSynthesisBrief, question, agentTypes: Object.keys(AGENTS) };
const agents = Object.fromEntries(Object.entries(AGENTS).map(([k, d]) => [k, { ...d, model: d.model ?? "haiku", background: false }]));

type Spawn = { type: string; desc: string; t0: number; t1?: number; errors: number; calls: number; denied?: boolean };
const spawns = new Map<string, Spawn>();
const t0 = Date.now();
const secs = (t: number) => ((t - t0) / 1000).toFixed(1).padStart(5) + "s";
const short = (name: string) => name.replace("mcp__research__", "");
let finalText = "";

console.log(`[l5] ${dir} · hooks ${hooksOn ? "ON" : "OFF"}${process.env.OUTAGE ? " · OUTAGE=" + process.env.OUTAGE : ""}${process.env.FLAKY ? " · FLAKY" : ""}\n"${question}"\n`);
for await (const m of query({
  prompt: question,
  options: {
    systemPrompt: COORDINATOR_PROMPT,
    tools: COORDINATOR_TOOLS,
    allowedTools: [...COORDINATOR_TOOLS, "mcp__research__*"],
    mcpServers: { research: researchServer },
    agents,
    hooks: createHooks(deps, state, hooksOn),
    settingSources: [],
    strictMcpConfig: true,
    env: { ...process.env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" },
    model: process.env.MODEL ?? "sonnet",
    maxTurns: 30,
  },
})) {
  if (m.type === "assistant") for (const b of m.message.content) {
    const parent = m.parent_tool_use_id ? spawns.get(m.parent_tool_use_id) : undefined;
    if (b.type === "tool_use" && !m.parent_tool_use_id && (b.name === "Agent" || b.name === "Task")) {
      const i = b.input as { subagent_type?: string; description?: string };
      spawns.set(b.id, { type: i.subagent_type ?? "?", desc: i.description ?? "", t0: Date.now(), errors: 0, calls: 0 });
      console.log(`${secs(Date.now())}  COORD → ${b.name}(${i.subagent_type}) "${i.description}"`);
    }
    if (b.type === "tool_use" && parent) {
      parent.calls++;
      console.log(`${secs(Date.now())}      ${parent.type} → ${short(b.name)}(${JSON.stringify(b.input).slice(0, 70)})`);
    }
    if (b.type === "text" && b.text.trim() && !m.parent_tool_use_id) finalText = b.text;
  }
  if (m.type === "user" && Array.isArray(m.message.content)) for (const b of m.message.content) {
    if (b.type !== "tool_result") continue;
    const text = Array.isArray(b.content) ? b.content.map(c => ("text" in c ? c.text : "")).join("") : String(b.content ?? "");
    const parent = m.parent_tool_use_id ? spawns.get(m.parent_tool_use_id) : undefined;
    if (parent) {
      if (/timed out/.test(text)) { parent.errors++; console.log(`${secs(Date.now())}      ${parent.type} ← ✖ timeout`); }
      continue;
    }
    const s = spawns.get(b.tool_use_id);
    const blocked = /hook error:/.test(text);
    if (s) { s.t1 = Date.now(); s.denied = blocked; }
    const rep = s && !blocked ? state.reports.at(-1) : undefined;
    console.log(`${secs(Date.now())}  COORD ← ${blocked ? "⛔ HOOK " + text.replace(/^.*hook error:\s*/s, "").slice(0, 200)
      : s ? `${s.type} done${s.type !== "synthesizer" && hooksOn && rep ? ` · report ${rep.status} · ${rep.findings.length} findings${rep.error ? ` · ${rep.error.failureType}` : ""}` : ""}` : "result"}`);
  }
  if (m.type === "result") {
    console.log(`\n${secs(Date.now())}  [l5] ${m.subtype} · ${m.num_turns} turns`);
    if (m.subtype === "success") finalText = m.result || finalText;
  }
}

// ── Trace ──
console.log(`\n${"─".repeat(30)} FINAL ANSWER ${"─".repeat(30)}\n${finalText}\n`);
console.log(`${"─".repeat(33)} TRACE ${"─".repeat(34)}`);
console.log(`Faults injected: ${FAULTS.length ? FAULTS.map(f => `${f.kind} "${f.query}"`).join(", ") : "none"}`);
for (const s of spawns.values())
  console.log(`  ${s.type.padEnd(12)} ${s.denied ? "⛔ denied" : `${s.calls} calls, ${s.errors} timeouts`}  "${s.desc}"`);
if (hooksOn) {
  console.log(`\nReports parsed (${state.reports.length}):`);
  for (const r of state.reports)
    console.log(`  ${r.status.padEnd(8)} ${String(r.findings.length).padStart(2)} findings  ${r.subtopic}${r.error ? (r.error.failureType ? `  · ${r.error.failureType} on "${r.error.attemptedQuery}"` : `  · error ${JSON.stringify(r.error)} (no context)`) : ""}`);
  console.log(`Contract retries (SubagentStop blocked a bad report): ${state.retries}${state.invalid.length ? " · " + state.invalid.map(i => `${i.agent}: ${i.issues.slice(0, 120)}`).join(" | ") : ""}`);
  console.log(`Brief injected into synthesizer: ${state.injected ? `yes, ${state.injected.length} chars, ${extractSourceIds(state.injected).length} source ids` : "no"}`);
}
const ans = finalText;
const both = /31\s?%/.test(ans) && /25\s?%/.test(ans);
console.log(`\nConflict 31% vs 25% kept with both values: ${both ? "✓" : "✗"}${/contested|conflict|disagree/i.test(ans) ? "  (flagged as contested)" : ""}`);
if (process.env.OUTAGE) console.log(`Gap for ${process.env.OUTAGE} named in the final answer: ${new RegExp(process.env.OUTAGE.replace("-", ".?"), "i").test(ans) && /gap|unavailable|timed? ?out|could not|couldn't|missing/i.test(ans) ? "✓" : "✗"}`);
console.log(`Sources cited in the final answer: ${extractSourceIds(ans).length}`);
console.log(`Wall clock: ${secs(Date.now()).trim()}`);
