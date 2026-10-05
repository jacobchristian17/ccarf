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
    description: "Web researcher for ONE assigned subtopic or source type. Searches the cached web snapshot and returns findings with source URLs and publication dates. Spawn one per subtopic, in parallel.",
    prompt: `You are a web researcher. Use web_search to research the ONE subtopic you are given, staying within any constraints in your task. Only use sources from trusted publications. 
Return ONLY JSON, with each claim kept separate from its source details:
{ "findings": [ { "claim": "<one sentence>", "evidence": "<exact quote from the source>",
                  "source": { "id": "<url>", "publisher": "...", "published": "YYYY-MM-DD" } } ],
  "gaps": ["<what you searched for and didn't find>"] }
If nothing relevant turns up, return "findings": [] and explain in "gaps".`,
    tools: [TOOL.web_search],
    model: "haiku",
  },
  "doc-analyst": {
    description: "Analyst for reports and papers in the approved document library. Returns findings with doc_id and page numbers. Use when the topic needs evidence from long-form studies, not just news articles.",
    prompt: "You are a document analist. Use the tools list_documents, load_document. For every claim, site the claim + source id + date, and keep the page numbers",
    model: "haiku",
    tools: [TOOL.list_documents, TOOL.load_document],
  },
  synthesizer: {
    description: "Writes the final cited brief from the findings passed in its prompt. It has no search tools, only verify_fact for quick checks. Use once, after research is complete, with the complete findings.",
    prompt: "Your job is to synthesize findings from multiple sources provided to you. You are allowed to cite missing information. You check from the work and do not generate data. You need to cite sources for every claim, drop if they dont exist. You also need to check for conflicting values, ideas with the sources. Finally, report coverage gaps",
    model: "haiku",
    tools: [TOOL.verify_fact],
  },
};
