// Lesson 4: run the research coordinator for real, through the Agent SDK on your Claude Code login.
// Run:  npm run l4:ask -- creative             a named scenario (list below)
//       npm run l4:ask -- "free text topic"
// Env:  SOLUTION=1     use solution/agents.ts + coordinator.ts + hooks.ts
//       SEQUENTIAL=1   tell the coordinator to spawn one subagent per response (latency comparison)
//       LOSSY=1        fault injection: tell the coordinator to hand the synthesizer a short summary, not the findings
//       HOOKS=off      no context-passing hooks (hubOnly stays on)
//       MODEL=haiku    coordinator model (default: sonnet). Subagents use their own model (haiku).
import { query, type AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { researchServer } from "./tools.js";

const SCENARIOS: Record<string, string> = {
  creative:  "Research the impact of AI on the creative industries. Give me a short brief with a citation for every claim.",
  simple:    "Quick question: which publication reported that 31% of music producers use AI tools, and when was it published?",
  since2026: "Research the impact of AI on the creative industries, using ONLY sources published in 2026. Short cited brief.",
};
const SUBTOPICS: [string, RegExp][] = [
  ["visual-arts", /visual|illustrat|graphic|design|photo|\bart\b|artists/i],
  ["music", /music|audio|producer|song/i],
  ["writing", /writ|publish|book|author|literat/i],
  ["film-tv", /film|\btv\b|television|screen|vfx|movie|cinema/i],
  ["games", /\bgam(e|es|ing)\b/i],
];

const arg = process.argv.slice(2).join(" ");
const prompt = SCENARIOS[arg] ?? (arg || SCENARIOS.creative);
const dir = process.env.SOLUTION ? "./solution/" : "./";
const { AGENTS } = await import(`${dir}agents.ts`) as { AGENTS: Record<string, AgentDefinition> };
const { COORDINATOR_PROMPT, COORDINATOR_TOOLS } = await import(`${dir}coordinator.ts`) as { COORDINATOR_PROMPT: string; COORDINATOR_TOOLS: string[] };
const H = await import(`${dir}hooks.ts`);
const hooksOn = process.env.HOOKS !== "off";
const sequential = !!process.env.SEQUENTIAL;
const lossy = !!process.env.LOSSY;

const systemPrompt = COORDINATOR_PROMPT + (sequential
  ? "\n\nOVERRIDE FOR THIS RUN: spawn exactly ONE subagent per response and wait for its result before spawning the next."
  : "") + (lossy
  ? "\n\nOVERRIDE FOR THIS RUN: keep the synthesizer's prompt short. Give it a 3-sentence summary of what the researchers found, not their raw findings or URLs."
  : "");
// Foreground subagents (the SDK default is background), defaulting to haiku.
const agents = Object.fromEntries(Object.entries(AGENTS).map(([k, d]) => [k, { ...d, model: d.model ?? "haiku", background: false }]));
const hooks = hooksOn ? H.createHooks() : { PreToolUse: [{ matcher: "^(Agent|Task|mcp__research__.*)$", hooks: [H.hubOnly] }] };

type Spawn = { id: string; type: string; desc: string; prompt: string; msg: string; t0: number; t1?: number; calls: Record<string, number>; denied?: string };
const spawns = new Map<string, Spawn>();
const t0 = Date.now();
const secs = (t: number) => ((t - t0) / 1000).toFixed(1).padStart(5) + "s";
const short = (name: string) => name.replace("mcp__research__", "");
let finalText = "";

console.log(`[l4] ${dir} · hooks ${hooksOn ? "ON" : "OFF"}${sequential ? " · SEQUENTIAL" : ""}${lossy ? " · LOSSY" : ""} · coordinator tools ${JSON.stringify(COORDINATOR_TOOLS)}\n"${prompt}"\n`);
for await (const m of query({
  prompt,
  options: {
    systemPrompt,
    tools: COORDINATOR_TOOLS,                          // built-in tools for the coordinator
    allowedTools: [...COORDINATOR_TOOLS, "mcp__research__*"],
    mcpServers: { research: researchServer },
    agents,
    hooks,
    settingSources: [],
    strictMcpConfig: true,                             // ignore your own MCP servers / connectors
    env: { ...process.env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" },
    model: process.env.MODEL ?? "sonnet",
    maxTurns: 24,
  },
})) {
  if (m.type === "assistant") for (const b of m.message.content) {
    const parent = m.parent_tool_use_id ? spawns.get(m.parent_tool_use_id) : undefined;
    if (b.type === "tool_use" && !m.parent_tool_use_id) {
      if (b.name === "Agent" || b.name === "Task") {
        const i = b.input as { subagent_type?: string; description?: string; prompt?: string };
        spawns.set(b.id, { id: b.id, type: i.subagent_type ?? "?", desc: i.description ?? "", prompt: i.prompt ?? "", msg: m.message.id, t0: Date.now(), calls: {} });
        console.log(`${secs(Date.now())}  COORD → ${b.name}(${i.subagent_type}) "${i.description}"  [prompt ${i.prompt?.length ?? 0} chars]`);
      } else console.log(`${secs(Date.now())}  COORD → ${short(b.name)}(${JSON.stringify(b.input).slice(0, 80)})`);
    }
    if (b.type === "tool_use" && parent) {
      parent.calls[short(b.name)] = (parent.calls[short(b.name)] ?? 0) + 1;
      console.log(`${secs(Date.now())}      ${parent.type} → ${short(b.name)}(${JSON.stringify(b.input).slice(0, 70)})`);
    }
    if (b.type === "text" && b.text.trim() && !m.parent_tool_use_id) finalText = b.text;
  }
  if (m.type === "user" && !m.parent_tool_use_id && Array.isArray(m.message.content)) for (const b of m.message.content) {
    if (b.type !== "tool_result") continue;
    const text = Array.isArray(b.content) ? b.content.map(c => ("text" in c ? c.text : "")).join("") : String(b.content ?? "");
    const s = spawns.get(b.tool_use_id);
    const blocked = /hook error:/.test(text);
    if (s) { s.t1 = Date.now(); if (blocked) s.denied = text.replace(/^.*hook error:\s*/s, ""); }
    console.log(`${secs(Date.now())}  COORD ← ${blocked ? "⛔ HOOK " + text.replace(/^.*hook error:\s*/s, "").slice(0, 300) : (s ? `${s.type} done` : "result") + (b.is_error ? " (isError)" : "")}`);
  }
  if (m.type === "result") {
    console.log(`\n${secs(Date.now())}  [l4] ${m.subtype} · ${m.num_turns} turns`);
    if (m.subtype === "success") finalText = m.result || finalText;
  }
}

// ── Trace ──
console.log(`\n${"─".repeat(30)} FINAL ANSWER ${"─".repeat(30)}\n${finalText}\n`);
console.log(`${"─".repeat(33)} TRACE ${"─".repeat(34)}`);
const byMsg = new Map<string, Spawn[]>();
for (const s of spawns.values()) byMsg.set(s.msg, [...(byMsg.get(s.msg) ?? []), s]);
let r = 0;
for (const group of byMsg.values()) {
  r++;
  console.log(`Coordinator response ${r}: ${group.length} Agent call${group.length > 1 ? "s → PARALLEL" : ""}`);
  for (const s of group) {
    const calls = Object.entries(s.calls).map(([k, v]) => `${k}×${v}`).join(" ") || "no tool calls";
    console.log(`  ${s.type.padEnd(12)} ${secs(s.t0)} → ${s.t1 ? secs(s.t1) : "  ?  "}  ${s.denied ? "⛔ denied" : calls}  "${s.desc}"`);
  }
}
const research = [...spawns.values()].filter(s => s.type !== "synthesizer" && !s.denied);
const coverage = SUBTOPICS.map(([k, re]) => `${k} ${research.some(s => re.test(s.desc + " " + s.prompt)) ? "✓" : "✗"}`);
console.log(`\nSubtopics assigned to researchers (sample Q7):  ${coverage.join("  ")}`);
const synth = [...spawns.values()].filter(s => s.type === "synthesizer");
if (synth.length) {
  const last = synth[synth.length - 1];
  console.log(`Synthesizer prompt (last call, ${last.prompt.length} chars) cites ${H.extractSourceIds(last.prompt).length} source id(s)${last.denied ? " · ⛔ denied" : ""}`);
}
console.log(`Sources cited in the final answer: ${H.extractSourceIds(finalText).length}`);
console.log(`Wall clock: ${secs(Date.now()).trim()}`);
