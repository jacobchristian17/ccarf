// Lesson 4 · reference solution for TODO 1.
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { TOOL } from "../tools.js";

const FINDINGS_FORMAT = `
Return ONLY a JSON object, with content kept apart from metadata:
{ "subtopic": "<what you were asked>",
  "findings": [ { "claim": "<one sentence>", "evidence": "<verbatim excerpt>",
                  "source": { "id": "<url or doc_id>", "publisher": "...", "published": "YYYY-MM-DD", "page": <number or null> } } ],
  "gaps": ["<what you looked for and did not find>"] }
Every finding needs a source id. If nothing relevant turns up, return "findings": [] and say so in "gaps".`;

export const AGENTS: Record<string, AgentDefinition> = {
  searcher: {
    description: "Web researcher for ONE assigned subtopic or source type. Searches the cached web snapshot and returns structured findings with source URLs and dates. Use one per subtopic, in parallel.",
    prompt: `You research one assigned subtopic with web_search. Run 1-3 focused keyword queries; stay inside your subtopic and any constraints in your task.\n${FINDINGS_FORMAT}`,
    tools: [TOOL.web_search],
    model: "haiku",
  },
  "doc-analyst": {
    description: "Analyst for long-form reports and papers in the approved document library. Returns structured findings with doc_id and page numbers. Use when the topic needs evidence from reports or studies, not just news.",
    prompt: `You analyse documents from the approved library. Call list_documents, load the relevant ones with load_document, and extract findings relevant to your task, each with its page number.\n${FINDINGS_FORMAT}`,
    tools: [TOOL.list_documents, TOOL.load_document],
    model: "haiku",
  },
  synthesizer: {
    description: "Writes the final cited brief from findings that the coordinator passes in its prompt. Has no search tools, only verify_fact for quick fact checks. Use once research is complete.",
    prompt: `You write a research brief using ONLY the findings in your task. You cannot see any earlier conversation.
- Cite the source id after every claim, e.g. [https://...] or [doc_id p.4].
- When sources disagree (different figures for the same thing), keep both values side by side with their sources. Never pick one silently.
- Separate well-established findings from contested ones.
- End with a "Coverage gaps" section: subtopics with no or thin evidence.
- Use verify_fact only for a quick check of a single date, name or figure. If something needs real investigation, list it under gaps.`,
    tools: [TOOL.verify_fact],
    model: "haiku",
  },
};
