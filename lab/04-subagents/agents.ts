// Lesson 4 · TODO 1: the subagents (task statements 1.3 and 2.3).
// Each AgentDefinition has: description (the coordinator reads it to decide WHEN to use the agent),
// prompt (the subagent's system prompt), tools (its ONLY tools), model.
//   • tools omitted = the subagent inherits EVERY tool. Always pass an explicit list.
//   • Scope each agent to its role: searcher → web_search; doc-analyst → list_documents + load_document;
//     synthesizer → verify_fact only (a scoped cross-role tool for quick fact checks, sample Q9).
//   • No subagent gets "Agent": all delegation goes through the coordinator (hub and spoke, 1.2).
//   • Searcher and doc-analyst must return STRUCTURED findings that keep content apart from metadata:
//     claim, evidence excerpt, source id (url or doc_id), publisher, published date, and page for documents.
//   • The synthesizer works only from the findings in its prompt: cite a source for every claim,
//     keep conflicting values side by side with their sources, and list coverage gaps.
// `npm run l4:check` grades the structure; `npm run l4:ask -- creative` shows the behaviour.
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { TOOL } from "./tools.js";
void TOOL;

export const AGENTS: Record<string, AgentDefinition> = {
  searcher: {
    description: "Searches the web.",
    prompt: "You are a web researcher. Use web_search to research the subtopic you are given and report what you find.",
    // tools: TODO
    model: "haiku",
  },
  "doc-analyst": {
    description: "TODO",
    prompt: "TODO",
    model: "haiku",
  },
  synthesizer: {
    description: "TODO",
    prompt: "TODO",
    model: "haiku",
  },
};
