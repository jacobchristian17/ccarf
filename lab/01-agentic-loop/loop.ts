// Lesson 1 lab: write the agentic loop yourself.
// Run:  npm run l1 -- "Where is order #12345? My email is jane@example.com"
// Env:  MODEL=claude-opus-5-5 (default)   TOOL_CHOICE=auto | any | none | tool:<name>
import Anthropic from "@anthropic-ai/sdk";
import { tools, executeTool } from "../shared/backend.js";
import { createClient } from "../shared/client.js";

const client = createClient(); // real API if ANTHROPIC_API_KEY is set, otherwise the offline mock
const MODEL = process.env.MODEL ?? "claude-opus-5-5";
const MAX_ITERATIONS = 10; // a safety backstop, NOT the stopping mechanism

function parseToolChoice(raw = process.env.TOOL_CHOICE ?? "auto"): Anthropic.ToolChoice {
  if (raw.startsWith("tool:")) return { type: "tool", name: raw.slice(5) };
  return { type: raw as "auto" | "any" | "none" };
}

/** Prints one line per content block so you can SEE what each turn returned. */
function logTurn(i: number, res: Anthropic.Message) {
  console.log(`\n── iteration ${i} · stop_reason=${res.stop_reason}`);
  for (const b of res.content) {
    if (b.type === "text") console.log(`   text: ${b.text.slice(0, 120)}`);
    else if (b.type === "tool_use") console.log(`   tool_use: ${b.name}(${JSON.stringify(b.input)}) id=${b.id}`);
    else console.log(`   ${b.type}`);
  }
}

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

    // TODO 1 — Branch on res.stop_reason (NOT on whether text is present):
    if (res.stop_reason === "end_turn") {
      return res.content.filter(b => b.type === "text").map(b => (b as Anthropic.TextBlockParam).text).join(" ");
    } else if (res.stop_reason === "tool_use") {
      // TODO 2 — Append the assistant turn to history. Push res.content AS-IS
      //          (it may contain thinking blocks you must not drop or edit).
      messages.push({ role: "assistant", content: res.content });


      // TODO 3 — Execute EVERY tool_use block in res.content (there may be several: parallel calls).
      //          Build one tool_result per tool_use: { type, tool_use_id, content, is_error? }.
      //          If executeTool throws, still return a tool_result, with is_error: true and the message.
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of res.content) {
        if (block.type === "tool_use") {
          try {
            const result = executeTool(block.name, block.input);
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result)
            });
          } catch (error) {
            results.push({
              type: "tool_result",
              tool_use_id: block.id,
              is_error: true,
              content: String(error)
            })
          }
        }
      }

      // TODO 4 — Append ONE user message containing ALL the tool_results (tool_results first, no text before them).
      messages.push({ role: "user", content: results });
    } else {
      throw new Error(`Unexpected stop_reason=${res.stop_reason}; investigate, don't just raise the cap`);
    }

    
  }
  throw new Error(`Gave up after ${MAX_ITERATIONS} iterations; investigate, don't just raise the cap`);
}

const prompt = process.argv.slice(2).join(" ") || "Where is order #12345? My email is jane@example.com";
runAgent(prompt).then(answer => console.log(`\n══ FINAL ══\n${answer}`));
