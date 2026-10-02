// Chooses which backend answers client.messages.create(). Set BACKEND in lab/.env:
//   BACKEND=mock        offline scripted responses (free, instant, not a real model)
//   BACKEND=claude-cli  a real model via `claude -p` on your Claude Code login (no API credits)
//   BACKEND=api         the real Anthropic API (needs ANTHROPIC_API_KEY and credits)
// Unset: api if ANTHROPIC_API_KEY is set, otherwise mock.
import Anthropic from "@anthropic-ai/sdk";
import { createMockClient } from "./mock-client.js";
import { createClaudeCliClient } from "./claude-cli-client.js";

export function createClient(): Anthropic {
  const backend = process.env.BACKEND ?? (process.env.ANTHROPIC_API_KEY ? "api" : "mock");
  switch (backend) {
    case "mock":
      console.log("[backend] mock: offline scripted responses, not a real model.");
      return createMockClient();
    case "claude-cli":
      console.log("[backend] claude-cli: real model via `claude -p` (each turn takes a few seconds).");
      return createClaudeCliClient();
    case "api":
      return new Anthropic();
    default:
      throw new Error(`Unknown BACKEND="${backend}". Use mock, claude-cli or api.`);
  }
}
