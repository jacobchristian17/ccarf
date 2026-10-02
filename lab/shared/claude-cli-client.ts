// Stand-in for the Anthropic client that runs a real model through `claude -p`, using your
// Claude Code login (subscription usage) instead of API credits.
//
// How it works: each messages.create() call becomes ONE `claude -p` run with all of Claude
// Code's own tools disabled. The model sees your system prompt, tool definitions and the full
// message history, and replies through a JSON schema as content blocks. This adapter then turns
// those blocks back into an Anthropic.Message, so YOUR loop still executes the tools.
//
// Differences from the real API: stop_reason is derived (tool_use if any tool_use block, else
// end_turn); there are no thinking blocks, no max_tokens truncation, and each call takes seconds.
import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { validate } from "./mock-client.js";

type Params = Anthropic.MessageCreateParamsNonStreaming;
type OutBlock = { type: "text" | "tool_use"; text?: string; name?: string; input?: Record<string, unknown> };

const SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { enum: ["text", "tool_use"] },
          text: { type: "string", description: "For text blocks" },
          name: { type: "string", description: "For tool_use blocks: the tool name" },
          input: { type: "object", description: "For tool_use blocks: arguments matching the tool's input_schema" },
        },
        required: ["type"],
      },
    },
  },
  required: ["blocks"],
};

const FRAME = `You are the model behind an Anthropic Messages API call made by a developer's agent loop.
You have NO tools of your own and you cannot execute anything. Instead, to call one of the
developer's tools, put a tool_use block {"type":"tool_use","name":...,"input":{...}} in your
structured output. The developer's loop runs it and sends the result back in a later user turn
as a tool_result. You may emit several tool_use blocks in one reply to call tools in parallel.
Never pretend a tool was called or invent its result. When you have what you need, reply with
text blocks only; that ends your turn. Always answer through the structured output.`;

function render(block: Anthropic.ContentBlockParam): string {
  switch (block.type) {
    case "text": return block.text;
    case "tool_use": return `[tool_use id=${block.id} name=${block.name}] ${JSON.stringify(block.input)}`;
    case "tool_result": {
      const body = typeof block.content === "string" ? block.content
        : (block.content ?? []).map(b => (b.type === "text" ? b.text : `[${b.type}]`)).join("\n");
      return `[tool_result for ${block.tool_use_id}${block.is_error ? " ERROR" : ""}] ${body}`;
    }
    default: return ""; // thinking, images, etc. are not forwarded
  }
}

function buildPrompt(p: Params): string {
  const system = typeof p.system === "string" ? p.system : (p.system ?? []).map(b => b.text).join("\n");
  const tools = (p.tools ?? []) as Anthropic.Tool[];
  const choice = p.tool_choice ?? { type: "auto" };
  const rule = choice.type === "none" ? "You must NOT emit any tool_use block this turn."
    : choice.type === "any" ? "You MUST emit at least one tool_use block this turn."
    : choice.type === "tool" ? `You MUST emit a tool_use block for the tool "${choice.name}" this turn.`
    : "Decide for yourself whether to call tools.";
  const history = p.messages.map(m => {
    const body = typeof m.content === "string" ? m.content : m.content.map(render).filter(Boolean).join("\n");
    return `<${m.role}>\n${body}\n</${m.role}>`;
  }).join("\n\n");
  return [
    `<developer_system_prompt>\n${system}\n</developer_system_prompt>`,
    `<tools>\n${tools.map(t => JSON.stringify({ name: t.name, description: t.description, input_schema: t.input_schema })).join("\n")}\n</tools>`,
    `<tool_choice>${rule}</tool_choice>`,
    `<conversation>\n${history}\n</conversation>`,
    "Write the assistant's next turn.",
  ].join("\n\n");
}

function runClaude(model: string, prompt: string): Promise<any> {
  const args = ["-p", "--model", model, "--tools", "", "--strict-mcp-config", "--no-session-persistence",
    "--system-prompt", FRAME, "--output-format", "json", "--json-schema", JSON.stringify(SCHEMA)];
  return new Promise((resolve, reject) => {
    // Run from the temp dir so no project CLAUDE.md or settings leak into the "model".
    const child = spawn("claude", args, { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (err += d));
    child.on("error", e => reject(new Error(`Could not start \`claude\`: ${e.message}. Is Claude Code installed and on PATH?`)));
    child.on("close", code => {
      try {
        const res = JSON.parse(out);
        if (res.is_error || !res.structured_output) reject(new Error(`claude -p failed: ${res.result ?? res.subtype ?? out}`));
        else resolve(res.structured_output);
      } catch {
        reject(new Error(`claude -p exited with code ${code}: ${err || out}`));
      }
    });
    child.stdin.end(prompt);
  });
}

export function createClaudeCliClient(): Anthropic {
  const create = async (params: Params): Promise<Anthropic.Message> => {
    validate(params.messages); // same protocol checks as the real API, before spending any usage
    const { blocks } = (await runClaude(params.model, buildPrompt(params))) as { blocks: OutBlock[] };
    const toolNames = new Set(((params.tools ?? []) as Anthropic.Tool[]).map(t => t.name));
    const content = blocks.flatMap((b): Anthropic.ContentBlock[] => {
      if (b.type === "tool_use") {
        if (!b.name || !toolNames.has(b.name)) throw new Error(`claude -p requested an unknown tool: ${b.name}`);
        const id = `toolu_cli_${randomBytes(6).toString("hex")}`;
        return [{ type: "tool_use", id, name: b.name, input: b.input ?? {} } as Anthropic.ToolUseBlock];
      }
      return b.text ? [{ type: "text", text: b.text, citations: null } as Anthropic.TextBlock] : [];
    });
    const stop_reason = content.some(b => b.type === "tool_use") ? "tool_use" : "end_turn";
    return {
      id: `msg_cli_${randomBytes(6).toString("hex")}`, type: "message", role: "assistant",
      model: `${params.model} (claude -p)`, content, stop_reason, stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    } as unknown as Anthropic.Message;
  };
  return { messages: { create } } as unknown as Anthropic;
}
