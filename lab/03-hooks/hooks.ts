// Lesson 3: deterministic enforcement with Agent SDK hooks.
// Grader:  npm run l3:check        (calls your callbacks directly, no model)
// Agent:   npm run l3:ask -- big   (real model via the Agent SDK on your Claude Code login)
//
// Each callback gets (input, toolUseID, { signal }) and returns a HookJSONOutput.
// Return {} to allow / leave unchanged. Hooks run in parallel and a single "deny" wins,
// so write each one to stand alone.
import type { HookCallback, HookCallbackMatcher, HookEvent, PostToolUseHookInput, PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { AUTO_REFUND_LIMIT } from "../shared/store.js";

/** Per-conversation state that the hooks share. One per session; never global. */
export type SessionState = { verifiedCustomerId: string | null };
export const newState = (): SessionState => ({ verifiedCustomerId: null });

// ── Helpers (done for you) ────────────────────────────────────────────────────
/** Short tool name: "mcp__support__lookup_order" → "lookup_order". */
export const shortName = (toolName: string) => toolName.replace(/^mcp__support__/, "");

/** The JSON an MCP tool returned. tool_response is the MCP content array: [{ type: "text", text }]. */
export function resultJson(input: PostToolUseHookInput): any {
  const blocks = input.tool_response;
  if (!Array.isArray(blocks)) return null;
  const text = blocks.find((b): b is { type: "text"; text: string } => b?.type === "text")?.text;
  try { return text ? JSON.parse(text) : null; } catch { return null; }
}

/** Block the call. The reason goes back to the model as an is_error tool_result, so make it actionable. */
export const deny = (reason: string) => ({
  hookSpecificOutput: { hookEventName: "PreToolUse" as const, permissionDecision: "deny" as const, permissionDecisionReason: reason },
});

/** Replace the tool output the model will see (same MCP content-array shape it came in). */
export const replaceOutput = (data: unknown) => ({
  hookSpecificOutput: { hookEventName: "PostToolUse" as const, updatedToolOutput: [{ type: "text", text: JSON.stringify(data) }] },
});

/** Add a note the model sees next to the (unchanged) tool result. */
export const addContext = (note: string) => ({
  hookSpecificOutput: { hookEventName: "PostToolUse" as const, additionalContext: note },
});

// ── TODO 1 · PostToolUse on get_customer: record who is verified ─────────────
// Exactly one match → state.verifiedCustomerId = that id.
// Zero or several matches → verifiedCustomerId = null. With several, also return addContext(...)
// telling the agent to ask for another identifier (email) and NOT pick one (task 5.2).
export const recordVerification = (state: SessionState): HookCallback => async (input) => {
  const post = input as PostToolUseHookInput;
  void post; void state;
  return {};
};

// ── TODO 2 · PreToolUse prerequisite gate ────────────────────────────────────
// Block lookup_order, track_shipment and process_refund until get_customer has returned
// exactly one verified customer. Also block process_refund when its customer_id is not the
// verified one. The deny reason should say what to do instead (call get_customer / ask for email).
// Must NOT block get_customer or escalate_to_human.
export const requireVerifiedCustomer = (state: SessionState): HookCallback => async (input) => {
  const pre = input as PreToolUseHookInput;
  void pre; void state;
  return {};
};

// ── TODO 3 · PreToolUse policy: refunds over the limit go to a human ─────────
// process_refund with amount > AUTO_REFUND_LIMIT ($500) → deny, and redirect: the reason must tell
// the agent to call escalate_to_human with a complete handoff. Exactly $500 is allowed.
export const enforceRefundLimit: HookCallback = async (input) => {
  const pre = input as PreToolUseHookInput;
  void pre; void AUTO_REFUND_LIMIT;
  return {};
};

// ── TODO 4 · PostToolUse normalisation of the carrier's format ───────────────
// track_shipment returns { shipment: { tracking_no, status: 3, eta: 1791331200, last_scan: 1790864520 } }
// (epoch SECONDS, numeric status). Rewrite it before the model reads it:
//   status → label: 1 label_created · 2 picked_up · 3 in_transit · 4 out_for_delivery · 5 delivered · 9 exception
//            anything else → "unknown"
//   eta, last_scan → ISO 8601 strings (new Date(sec * 1000).toISOString())
// { shipment: null } passes through untouched (return {}).
export const normalizeShipment: HookCallback = async (input) => {
  const post = input as PostToolUseHookInput;
  void post;
  return {};
};

// ── Wiring (done for you). Matchers are regexes on the tool name: mcp__<server>__<tool>.
export function createHooks(state: SessionState = newState()): Partial<Record<HookEvent, HookCallbackMatcher[]>> {
  return {
    PreToolUse: [
      { matcher: "^mcp__support__(lookup_order|track_shipment|process_refund)$", hooks: [requireVerifiedCustomer(state)] },
      { matcher: "^mcp__support__process_refund$", hooks: [enforceRefundLimit] },
    ],
    PostToolUse: [
      { matcher: "^mcp__support__get_customer$", hooks: [recordVerification(state)] },
      { matcher: "^mcp__support__track_shipment$", hooks: [normalizeShipment] },
    ],
  };
}
