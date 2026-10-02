// Reference solution for the Lesson 1 lab. Try the TODOs yourself first.
import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool } from "../../shared/backend.js";
import { createClient } from "../../shared/client.js";

const client = createClient();
const MODEL = process.env.MODEL ?? "claude-opus-5-5";
const MAX_ITERATIONS = 10; // safety backstop only

function parseToolChoice(raw = process.env.TOOL_CHOICE ?? "auto"): Anthropic.ToolChoice {
  if (raw.startsWith("tool:")) return { type: "tool", name: raw.slice(5) };
  return { type: raw as "auto" | "any" | "none" };
}

function logTurn(i: number, res: Anthropic.Message) {
  console.log(`\n── iteration ${i} · stop_reason=${res.stop_reason}`);
  for (const b of res.content) {
    if (b.type === "text") console.log(`   text: ${b.text.slice(0, 120)}`);
    else if (b.type === "tool_use") console.log(`   tool_use: ${b.name}(${JSON.stringify(b.input)}) id=${b.id}`);
    else console.log(`   ${b.type}`);
  }
}

const finalText = (res: Anthropic.Message) =>
  res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map(b => b.text).join("\n");

export async function runAgent(userInput: string): Promise<string> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userInput }];

  for (let i = 1; i <= MAX_ITERATIONS; i++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: "You are a customer support agent for an online store. Verify the customer before discussing their orders.",
      tools,
      tool_choice: parseToolChoice(),
      messages,
    });
    logTurn(i, res);

    // 1. stop_reason is the control signal.
    switch (res.stop_reason) {
      case "end_turn":
        return finalText(res);
      case "tool_use":
        break; // handled below
      case "pause_turn": // server-tool loop paused; send the turn back unchanged to continue
        messages.push({ role: "assistant", content: res.content });
        continue;
      case "max_tokens":
        throw new Error("Truncated at max_tokens; a tool_use block may be incomplete. Raise max_tokens and retry.");
      case "refusal":
        return `[refused] ${res.stop_details?.explanation ?? ""}`;
      default:
        throw new Error(`Unhandled stop_reason: ${res.stop_reason}`);
    }

    // 2. Append the assistant turn verbatim (keeps thinking blocks intact).
    messages.push({ role: "assistant", content: res.content });

    // 3. Execute every tool_use block; failures become is_error results, never dropped.
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      try {
        const out = executeTool(block.name, block.input);
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(out) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(err), is_error: true });
      }
    }

    // 4. One user message carrying ALL results, tool_results first.
    messages.push({ role: "user", content: results });
  }
  throw new Error(`Gave up after ${MAX_ITERATIONS} iterations; investigate, don't just raise the cap`);
}

const prompt = process.argv.slice(2).join(" ") || "Where is order #12345? My email is jane@example.com";
runAgent(prompt).then(answer => console.log(`\n══ FINAL ══\n${answer}`));
