// Lesson 5 · TODO 3a + 3b: the subagent prompts (task statements 5.3 and 5.6).
// The doc-analyst and REPORT_FORMAT are done for you. REPORT_FORMAT tells researchers the TODO 1 contract.
//
// TODO 3a · searcher: add failure handling to its prompt.
//   • a timeout is transient: recover LOCALLY first by retrying the same query once (contract rule R5)
//   • still failing → try an alternative query; then report what it could NOT resolve:
//     status "partial" (keep the findings that worked) or "failed", with error { failureType, attemptedQuery,
//     message, alternatives }
//   • an empty results list is not an error: outcome "no_matches"; all empty → status "complete", findings []
//   • never return an empty report as success to hide a failure
// TODO 3b · synthesizer: structure the report for provenance and uncertainty.
//   • sections: well-established findings / contested findings / coverage gaps
//   • conflicting values: keep BOTH, each with source and publication date; never pick, average or drop one
//   • dates explain differences: a change over time is not a contradiction
//   • coverage gaps: carry every GAP / PARTIAL line from the Coverage section, keeping the reason
//     (unavailable vs no matching sources)
//   • render by content type: figures as a table, news as prose
// `npm run l5:check` grades the prompts; `npm run l5:ask` shows the behaviour.
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { TOOL } from "./tools.js";

export const REPORT_FORMAT = `
End with ONLY one JSON object (no prose around it) in this exact shape:
{ "subtopic": "<what you were asked>",
  "status": "complete" | "partial" | "failed",
  "findings": [ { "claim": "<one sentence>", "evidence": "<verbatim excerpt>",
                  "source": { "id": "<url or doc_id>", "publisher": "...", "published": "YYYY-MM-DD", "page": <number or null> } } ],
  "queries": [ { "query": "<what you ran>", "outcome": "ok" | "no_matches" | "timeout" | "error", "attempts": <number> } ],
  "error": null | { "failureType": "timeout" | "unavailable" | "permission", "attemptedQuery": "...",
                    "message": "...", "alternatives": ["<another query or source the coordinator could try>"] } }
Every finding needs a source id and a publication date. Put reasoning nowhere: only the JSON.`;

export const AGENTS: Record<string, AgentDefinition> = {
  searcher: {
    description: "Web researcher for ONE assigned subtopic. Searches the cached web snapshot and returns a structured report: findings with source URLs and dates, every query tried, and a structured error if a search failed. Use one per subtopic, in parallel.",
    prompt: `You research one assigned subtopic with web_search. Run 1-3 focused keyword queries; stay inside your subtopic and any constraints in your task.
${/* TODO 3a: failure handling */ ""}${REPORT_FORMAT}`,
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
    prompt: `You write a research brief using ONLY the material in your task. Cite a source for every claim.`, // TODO 3b
    tools: [TOOL.verify_fact],
    model: "haiku",
  },
};
