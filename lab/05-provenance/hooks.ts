// Lesson 5: the deterministic plumbing, done for you. Your report.ts and brief.ts are passed in.
//
//   SubagentStop (searcher, doc-analyst)  validate the final report against SubagentReport. If it doesn't parse,
//                                         block the stop with the Zod issues as the reason: the subagent fixes
//                                         its report and tries again (ONE retry; stop_hook_active stops loops).
//   PostToolUse on Agent                  parse the report the coordinator received and store it. Zod strips
//                                         unknown keys, so only the contract's fields are kept (5.1 trimming).
//                                         An unparseable report is stored as a "failed" report, not dropped.
//   PreToolUse on Agent (synthesizer)     no reports yet → deny. Otherwise rewrite the call's prompt:
//                                         <research_brief> from buildSynthesisBrief + the coordinator's own notes.
//                                         (updatedInput: the hook edits the tool input before the tool runs.)
//   hubOnly                               as in Lesson 4: the coordinator delegates, it doesn't search.
import type { HookCallback, HookCallbackMatcher, HookEvent, PostToolUseHookInput, PreToolUseHookInput, SubagentStopHookInput } from "@anthropic-ai/claude-agent-sdk";
import type { z } from "zod";
import { ALL_SOURCE_IDS } from "../04-subagents/corpus.js";

export type Report = {
  subtopic: string; status: "complete" | "partial" | "failed";
  findings: { claim: string; evidence: string; source: { id: string; publisher: string; published: string; page: number | null } }[];
  queries: { query: string; outcome: string; attempts: number }[];
  error: null | { failureType: string; attemptedQuery: string; message: string; alternatives: string[] };
};
export type Deps = {
  SubagentReport: z.ZodType<any>;
  buildSynthesisBrief: (question: string, reports: any[]) => string;
  question: string;
  agentTypes: string[];
};
export type RunState = { reports: Report[]; invalid: { agent: string; issues: string }[]; retries: number; injected?: string };
export const newState = (): RunState => ({ reports: [], invalid: [], retries: 0 });

const RESEARCHERS = ["searcher", "doc-analyst"];
export const extractSourceIds = (text: string) => ALL_SOURCE_IDS.filter(id => text.includes(id.replace(/^https?:\/\//, "")));

/** The last JSON object in a piece of text (tolerates ```json fences and prose around it). */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/g, "");
  const start = t.indexOf("{"), end = t.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no JSON object found");
  return JSON.parse(t.slice(start, end + 1));
}

export function parseReport(SubagentReport: z.ZodType<any>, text: string):
  { ok: true; report: Report } | { ok: false; issues: string } {
  let raw: unknown;
  try { raw = extractJson(text); } catch (e) { return { ok: false, issues: `not valid JSON (${(e as Error).message})` }; }
  const r = SubagentReport.safeParse(raw);
  if (r.success) return { ok: true, report: r.data };
  return { ok: false, issues: r.error.issues.map(i => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
}

function agentReport(input: PostToolUseHookInput): string {
  const content = (input.tool_response as { content?: unknown })?.content;
  if (!Array.isArray(content)) return typeof input.tool_response === "string" ? input.tool_response : "";
  return content.filter((b): b is { type: "text"; text: string } => b?.type === "text").map(b => b.text).join("\n");
}
const deny = (reason: string) => ({
  hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const, permissionDecisionReason: reason },
});

export const hubOnly = (agentTypes: string[]): HookCallback => async (input) => {
  const pre = input as PreToolUseHookInput;
  if (pre.tool_name === "Agent" || pre.tool_name === "Task") {
    const type = (pre.tool_input as { subagent_type?: string }).subagent_type ?? "";
    return agentTypes.includes(type) ? {} : deny(`Unknown subagent_type '${type}'. Use one of: ${agentTypes.join(", ")}.`);
  }
  if (!pre.agent_id) return deny("The coordinator delegates research. Spawn a searcher or doc-analyst subagent with this query instead.");
  return {};
};

export const validateOnStop = (deps: Deps, state: RunState): HookCallback => async (input) => {
  const stop = input as SubagentStopHookInput;
  if (!RESEARCHERS.includes(stop.agent_type)) return {};
  const parsed = parseReport(deps.SubagentReport, stop.last_assistant_message ?? "");
  if (parsed.ok) return {};
  state.invalid.push({ agent: stop.agent_type, issues: parsed.issues });
  if (stop.stop_hook_active) return {};               // already retried once: let it stop
  state.retries++;
  return { decision: "block" as const,
    reason: `Your final report does not match the report contract: ${parsed.issues}. ` +
      "Fix these and reply with ONLY the corrected JSON object. Don't run more searches unless a rule needs it." };
};

export const collectReport = (deps: Deps, state: RunState): HookCallback => async (input) => {
  const post = input as PostToolUseHookInput;
  const type = (post.tool_input as { subagent_type?: string }).subagent_type ?? "";
  if (!RESEARCHERS.includes(type)) return {};
  const desc = (post.tool_input as { description?: string }).description ?? type;
  const parsed = parseReport(deps.SubagentReport, agentReport(post));
  if (parsed.ok) state.reports.push(parsed.report);
  else state.reports.push({ subtopic: desc, status: "failed", findings: [], queries: [{ query: desc, outcome: "error", attempts: 1 }],
    error: { failureType: "unavailable", attemptedQuery: desc, message: `report did not match the contract: ${parsed.issues}`, alternatives: ["re-run this subagent"] } });
  return {};
};

export const injectBrief = (deps: Deps, state: RunState): HookCallback => async (input) => {
  const pre = input as PreToolUseHookInput;
  const ti = pre.tool_input as { subagent_type?: string; prompt?: string };
  if (ti.subagent_type !== "synthesizer") return {};
  if (!state.reports.length) return deny("No research reports have come back yet. Run the researchers first.");
  const brief = deps.buildSynthesisBrief(deps.question, state.reports);
  state.injected = brief;
  return { hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "allow" as const,
    updatedInput: { ...ti, prompt: `<research_brief>\n${brief}\n</research_brief>\n\n<coordinator_notes>\n${ti.prompt ?? ""}\n</coordinator_notes>` } } };
};

export function createHooks(deps: Deps, state: RunState, on = true): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  const hub = { matcher: "^(Agent|Task|mcp__research__.*)$", hooks: [hubOnly(deps.agentTypes)] };
  if (!on) return { PreToolUse: [hub] };
  return {
    PreToolUse: [hub, { matcher: "^(Agent|Task)$", hooks: [injectBrief(deps, state)] }],
    PostToolUse: [{ matcher: "^(Agent|Task)$", hooks: [collectReport(deps, state)] }],
    SubagentStop: [{ hooks: [validateOnStop(deps, state)] }],
  };
}
