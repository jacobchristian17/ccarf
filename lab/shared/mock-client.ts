// Offline stand-in for the Anthropic client, so the labs run without an API key or credits.
// It is NOT a model: it follows a fixed support-agent script, but it speaks the real
// Messages API protocol (stop_reason, parallel tool_use, tool_result rules) and rejects
// malformed histories with the same kind of 400 error the real API returns.
//
// Env:  MOCK_STOP=max_tokens | refusal | pause_turn   force that stop_reason on the first call
import Anthropic from "@anthropic-ai/sdk";

type Params = Anthropic.MessageCreateParamsNonStreaming;
type Call = { name: string; input: Record<string, string>; content: string; isError: boolean };

let nextId = 1;
const toolUse = (name: string, input: Record<string, string>): Anthropic.ToolUseBlock =>
  ({ type: "tool_use", id: `toolu_mock_${String(nextId++).padStart(3, "0")}`, name, input } as Anthropic.ToolUseBlock);
const text = (t: string): Anthropic.TextBlock => ({ type: "text", text: t, citations: null } as Anthropic.TextBlock);

function badRequest(msg: string): never {
  throw new Error(`400 invalid_request_error (mock): ${msg}`);
}

const blocks = (m: Anthropic.MessageParam) => (typeof m.content === "string" ? [] : m.content);

/** Enforces the tool_use → tool_result contract exactly where the real API does. */
export function validate(messages: Anthropic.MessageParam[]) {
  if (messages[0]?.role !== "user") badRequest("messages.0: first message must use the \"user\" role");
  if (messages.at(-1)?.role !== "user") badRequest("last message must be a user turn (did you forget to append the tool_results?)");
  const known = new Set<string>();
  messages.forEach((m, i) => {
    const ids = blocks(m).filter(b => b.type === "tool_use").map(b => (b as Anthropic.ToolUseBlockParam).id);
    ids.forEach(id => known.add(id));
    const results = blocks(m).filter(b => b.type === "tool_result") as Anthropic.ToolResultBlockParam[];
    for (const r of results)
      if (!known.has(r.tool_use_id))
        badRequest(`messages.${i}.content: unexpected \`tool_use_id\` found in \`tool_result\` blocks: ${r.tool_use_id}. ` +
          "Each `tool_result` block must have a corresponding `tool_use` block in the previous message.");
    if (m.role !== "assistant" || ids.length === 0) return;
    const next = messages[i + 1];
    const answered = new Set(next ? (blocks(next).filter(b => b.type === "tool_result") as Anthropic.ToolResultBlockParam[]).map(r => r.tool_use_id) : []);
    const missing = ids.filter(id => !answered.has(id));
    if (missing.length)
      badRequest(`messages.${i + 1}: \`tool_use\` ids were found without \`tool_result\` blocks immediately after: ${missing.join(", ")}. ` +
        "Each `tool_use` block must have a corresponding `tool_result` block in the next message.");
    const firstNonResult = blocks(next).findIndex(b => b.type !== "tool_result");
    if (firstNonResult !== -1 && blocks(next).slice(firstNonResult).some(b => b.type === "tool_result"))
      badRequest(`messages.${i + 1}: \`tool_result\` blocks must come FIRST in the user message, before any text.`);
  });
}

/** Pairs every tool_use in the history with its tool_result. */
function completedCalls(messages: Anthropic.MessageParam[]): Call[] {
  const uses = new Map<string, Anthropic.ToolUseBlockParam>();
  const calls: Call[] = [];
  for (const m of messages)
    for (const b of blocks(m)) {
      if (b.type === "tool_use") uses.set(b.id, b);
      if (b.type === "tool_result") {
        const u = uses.get(b.tool_use_id)!;
        const content = typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? "");
        calls.push({ name: u.name, input: u.input as Record<string, string>, content, isError: !!b.is_error });
      }
    }
  return calls;
}

function parse(content: string): any {
  try { return JSON.parse(content); } catch { return {}; }
}

function answer(calls: Call[], orderId?: string): string {
  const customer = [...calls].reverse().find(c => c.name === "get_customer");
  const matches = customer ? parse(customer.content).matches ?? [] : [];
  if (customer?.isError) return "Sorry, I couldn't reach our customer system to verify you. Please try again shortly.";
  if (matches.length === 0) return "I couldn't find an account with that email, so I can't share order details. Could you double-check the address?";
  const who = matches[0];
  if (!orderId) return `Thanks, ${who.name}, you're verified. Which order can I help you with?`;
  const lookup = [...calls].reverse().find(c => c.name === "lookup_order");
  if (!lookup) return `Thanks, ${who.name}. I wasn't able to look up order #${orderId}.`;
  if (lookup.isError) return `Thanks, ${who.name}. Our order system is temporarily unavailable (${lookup.content}). Please try again in a few minutes.`;
  const order = parse(lookup.content).order;
  if (!order) return `I couldn't find order #${orderId}. Could you check the number?`;
  if (order.customerId !== who.id) return `Order #${orderId} isn't on the account for ${who.email}, so I can't share its details.`;
  return `Hi ${who.name}! Order #${order.id} (${order.items.join(", ")}, $${order.total.toFixed(2)}) was placed on ${order.placedAt} and is currently **${order.status}**.`;
}

function respond(params: Params): Pick<Anthropic.Message, "content" | "stop_reason"> {
  const first = params.messages[0];
  const prompt = typeof first.content === "string" ? first.content
    : first.content.filter(b => b.type === "text").map(b => (b as Anthropic.TextBlockParam).text).join(" ");
  const email = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0];
  const orderId = prompt.match(/#?\b(\d{5})\b/)?.[1];
  const calls = completedCalls(params.messages);
  const choice = params.tool_choice ?? { type: "auto" };

  if (choice.type === "none")
    return { stop_reason: "end_turn", content: [text("(tool_choice=none) I can't use tools on this turn, so I can't look anything up.")] };

  // Forced tool use (any / tool:<name>) never lets the model end its turn; watch your MAX_ITERATIONS backstop fire.
  if (choice.type === "any" || choice.type === "tool") {
    const name = choice.type === "tool" ? choice.name : "get_customer";
    const input: Record<string, string> = name === "lookup_order" ? { order_id: orderId ?? "12345" } : { email: email ?? "unknown@example.com" };
    return { stop_reason: "tool_use", content: [text(`(tool_choice=${choice.type}) Calling ${name} again.`), toolUse(name, input)] };
  }

  const verified = calls.some(c => c.name === "get_customer");
  if (!email && !verified)
    return { stop_reason: "end_turn", content: [text("Happy to help! To verify your identity, what email address is on your account?")] };
  if (!verified) {
    // First turn: verify identity and fetch the order in parallel. Your loop must answer BOTH.
    const content: Anthropic.ContentBlock[] = [text("Let me verify your account and pull up that order.")];
    content.push(toolUse("get_customer", { email: email! }));
    if (orderId) content.push(toolUse("lookup_order", { order_id: orderId }));
    return { stop_reason: "tool_use", content };
  }
  if (orderId && !calls.some(c => c.name === "lookup_order"))
    return { stop_reason: "tool_use", content: [toolUse("lookup_order", { order_id: orderId })] };
  return { stop_reason: "end_turn", content: [text(answer(calls, orderId))] };
}

export function createMockClient(): Anthropic {
  let firstCall = true;
  const create = async (params: Params): Promise<Anthropic.Message> => {
    validate(params.messages);
    const forced = firstCall ? process.env.MOCK_STOP : undefined;
    firstCall = false;
    const { content, stop_reason } = forced === "max_tokens"
      ? { content: [text("The order you asked about was placed on")], stop_reason: "max_tokens" as const }
      : forced === "refusal" ? { content: [], stop_reason: "refusal" as const }
      : forced === "pause_turn" ? { content: [text("(paused mid-turn)")], stop_reason: "pause_turn" as const }
      : respond(params);
    return {
      id: `msg_mock_${nextId++}`, type: "message", role: "assistant", model: `${params.model} (mock)`,
      content, stop_reason, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as Anthropic.Message;
  };
  return { messages: { create } } as unknown as Anthropic;
}
