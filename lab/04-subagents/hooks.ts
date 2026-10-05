// Lesson 4 · TODO 3: deterministic context passing (task statement 1.3, reusing Lesson 3's hook skills).
// Subagents start with an empty context. The synthesizer knows ONLY what the coordinator writes into
// its Agent prompt. These hooks make "pass the complete findings" a guarantee instead of a hope.
//
// Agent tool shapes (checked against SDK v0.3.289):
//   PreToolUse  tool_name "Agent", tool_input { subagent_type, description, prompt }
//   PostToolUse tool_response { status, agentType, content: [{ type: "text", text: <subagent's final report> }] }
//   Calls made INSIDE a subagent carry input.agent_id and input.agent_type; the coordinator's own calls don't.
import type { HookCallback, HookCallbackMatcher, HookEvent, PostToolUseHookInput, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { ALL_SOURCE_IDS } from "./corpus.js";
import { AGENTS } from "./agents.js";

/** Per-run state. `sourcesReturned` = every source id that subagents have reported back to the coordinator. */
export type RunState = { sourcesReturned: Set<string> };
export const newState = (): RunState => ({ sourcesReturned: new Set() });

// ── Helpers (done for you) ────────────────────────────────────────────────────
/** Source ids (web URLs and library doc_ids) mentioned anywhere in a piece of text. A URL counts with or without https://. */
export const extractSourceIds = (text: string) => ALL_SOURCE_IDS.filter(id => text.includes(id.replace(/^https?:\/\//, "")));

/** The subagent's final report: the text blocks of an Agent tool_response. */
export function agentReport(input: PostToolUseHookInput): string {
  const content = (input.tool_response as { content?: unknown })?.content;
  if (!Array.isArray(content)) return typeof input.tool_response === "string" ? input.tool_response : "";
  return content.filter((b): b is { type: "text"; text: string } => b?.type === "text").map(b => b.text).join("\n");
}

export const deny = (reason: string) => ({
  hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const, permissionDecisionReason: reason },
});

// ── Done for you: keep the hub a hub ─────────────────────────────────────────
// Exam vs reality: in the SDK today (v0.3.289) every MCP tool is visible to the coordinator too, and in our
// test a top-level disallowedTools didn't hide it. So the coordinator's own research calls are denied here,
// and only the subagent types defined in agents.ts can be spawned (not the built-in general-purpose agent).
export const hubOnly: HookCallback = async (input) => {
  const pre = input as PreToolUseHookInput;
  if (pre.tool_name === "Agent" || pre.tool_name === "Task") {
    const type = (pre.tool_input as { subagent_type?: string }).subagent_type ?? "";
    return type in AGENTS ? {} : deny(`Unknown subagent_type '${type}'. Use one of: ${Object.keys(AGENTS).join(", ")}.`);
  }
  if (!pre.agent_id) return deny("The coordinator delegates research. Spawn a searcher or doc-analyst subagent with this query instead.");
  return {};
};

// ── TODO 3a · PostToolUse on Agent: remember which sources came back ─────────
// Add every source id in the subagent's report (agentReport + extractSourceIds) to state.sourcesReturned.
export const recordSources = (state: RunState): HookCallback => async (input) => {
  const post = input as PostToolUseHookInput;
  void post; void state;
  return {};
};

// ── TODO 3b · PreToolUse on Agent: the synthesizer must get the complete findings ─
// Only for subagent_type "synthesizer" (allow every other type):
//   • no sources returned yet → deny: research has to finish before synthesis
//   • any id in state.sourcesReturned missing from tool_input.prompt → deny, listing the missing ids, and say
//     WHY: subagents don't inherit the coordinator's context, so re-issue the call with the complete
//     findings (claim, evidence, source id, publisher, date, page) in the prompt
//   • otherwise allow ({})
export const requireCompleteBrief = (state: RunState): HookCallback => async (input) => {
  const pre = input as PreToolUseHookInput;
  void pre; void state;
  return {};
};

// ── Wiring (done for you) ────────────────────────────────────────────────────
export function createHooks(state: RunState = newState()): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  return {
    PreToolUse: [
      { matcher: "^(Agent|Task|mcp__research__.*)$", hooks: [hubOnly] },
      { matcher: "^(Agent|Task)$", hooks: [requireCompleteBrief(state)] },
    ],
    PostToolUse: [
      { matcher: "^(Agent|Task)$", hooks: [recordSources(state)] },
    ],
  };
}
