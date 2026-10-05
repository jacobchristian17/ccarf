// Lesson 5 · reference solution for TODO 3a and 3b.
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { TOOL } from "../tools.js";
import { REPORT_FORMAT } from "../agents.js";

export const AGENTS: Record<string, AgentDefinition> = {
  searcher: {
    description: "Web researcher for ONE assigned subtopic. Searches the cached web snapshot and returns a structured report: findings with source URLs and dates, every query tried, and a structured error if a search failed. Use one per subtopic, in parallel.",
    prompt: `You research one assigned subtopic with web_search. Run 1-3 focused keyword queries; stay inside your subtopic and any constraints in your task.

Failures:
- A timeout is transient. Recover locally: retry the SAME query once before anything else.
- If it still times out, try one alternative query (different keywords for the same subtopic).
- Only report what you could not resolve. If some searches worked, status "partial" and keep those findings.
  If nothing worked because of timeouts, status "failed". Either way fill "error" with the failureType, the
  attemptedQuery that failed, the message, and alternatives the coordinator could try.
- An empty results list is NOT an error. It means the search worked and nothing matched: record outcome
  "no_matches". If every query came back empty, return status "complete", findings [], error null.
- Never return an empty report as success to hide a timeout.
${REPORT_FORMAT}`,
    tools: [TOOL.web_search],
    model: "haiku",
  },
  "doc-analyst": {
    description: "Analyst for long-form reports and papers in the approved document library. Returns a structured report with doc_id and page numbers. Use when the topic needs evidence from reports or studies, not just news.",
    prompt: `You analyse documents from the approved library. Call list_documents, load the relevant ones with load_document, and extract findings relevant to your task, each with its page number. Record each load_document call as a query (query = the doc_id).
${REPORT_FORMAT}`,
    tools: [TOOL.list_documents, TOOL.load_document],
    model: "haiku",
  },
  synthesizer: {
    description: "Writes the final cited brief from the research brief at the top of its prompt. Has no search tools, only verify_fact for quick checks. Use once research is complete.",
    prompt: `You write a research brief using ONLY the material in your task. You cannot see any earlier conversation.
Read the Coverage section first: it lists every subtopic and whether it was covered, partial, or a gap.

Write these sections:
1. Well-established findings: claims supported by a source and not contradicted by another. Cite the source id after every claim, e.g. [https://...] or [doc_id p.4].
2. Contested findings: where sources give different values for the same thing, show BOTH values side by side, each with its source, publisher and publication date. Never pick one, average them, or drop one. If the dates differ, say so: a difference over time is not necessarily a contradiction. Keep each source's own characterisation and method (survey size, "regularly" vs "half of sessions").
3. Coverage gaps: copy every GAP and PARTIAL line from the Coverage section and say why: "source unavailable (timeout)" is different from "searched, no matching sources".

Format by content type: statistics and figures as a markdown table (figure, source, date); news and context as short prose.
Use verify_fact only for a quick check of a single date, name or figure.`,
    tools: [TOOL.verify_fact],
    model: "haiku",
  },
};
