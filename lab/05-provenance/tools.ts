// Lesson 5: the Lesson 4 research tools plus FAULT INJECTION, done for you.
// Same corpus (../04-subagents/corpus.ts) and the same four tools, but web_search can now fail:
//   OUTAGE=<subtopic>   every search whose best match is in that subtopic times out, every time (an access
//                       failure the searcher can't fix locally: it must PROPAGATE a structured error)
//   FLAKY=1             the FIRST call of each distinct query times out; the same query again succeeds
//                       (a transient failure the searcher should RECOVER from locally, with one retry)
// A query that matches nothing is NOT a failure: it returns { results: [] } (a valid empty result).
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { WEB, DOCS, type Subtopic } from "../04-subagents/corpus.js";

const LATENCY_MS = Number(process.env.LATENCY_MS ?? 1500);
const OUTAGE = (process.env.OUTAGE ?? "") as Subtopic | "";
const FLAKY = !!process.env.FLAKY;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const json = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const toolError = (data: unknown) => ({ ...json(data), isError: true });
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g) ?? [];
const score = (query: string, hay: string[]) => {
  const q = new Set(words(query));
  return hay.flatMap(words).filter(w => q.has(w)).length;
};
const timeout = (query: string) => toolError({
  errorCategory: "transient", isRetryable: true, failureType: "timeout",
  message: `web_search timed out after 30 s for query '${query}'. The index shard may be slow or down.`,
});

/** Every fault the server injected this run, for the runner's trace. */
export const FAULTS: { query: string; kind: "outage" | "flaky" }[] = [];
const seen = new Set<string>();

export const researchServer = createSdkMcpServer({
  name: "research",
  version: "1.1.0",
  tools: [
    tool("web_search",
      "Search a cached snapshot of web articles about AI and the creative industries. URLs are the citable source ids. " +
      "Input: a short keyword query, e.g. 'music producers AI adoption'. Returns up to 3 results, each with url, title, publisher, published date and snippet. " +
      "Returns { results: [] } when nothing matches (a successful search with no matches). " +
      "On a timeout it returns isError with failureType 'timeout' and isRetryable true.",
      { query: z.string().describe("Keyword query") },
      async ({ query }) => {
        await sleep(LATENCY_MS);
        const ranked = WEB.map(w => ({ w, s: score(query, [w.title, w.snippet, ...w.tags]) }))
          .filter(x => x.s > 0).sort((a, b) => b.s - a.s);
        if (OUTAGE && ranked[0]?.w.subtopic === OUTAGE) { FAULTS.push({ query, kind: "outage" }); return timeout(query); }
        const key = words(query).sort().join(" ");
        if (FLAKY && !seen.has(key)) { seen.add(key); FAULTS.push({ query, kind: "flaky" }); return timeout(query); }
        const results = ranked.slice(0, 3)
          .map(({ w }) => ({ url: w.url, title: w.title, publisher: w.publisher, published: w.published, snippet: w.snippet }));
        return json({ results });
      }),
    tool("list_documents",
      "List the reports and papers in the approved document library: doc_id, title, publisher, published date. Call this before load_document.",
      {},
      async () => {
        await sleep(LATENCY_MS / 3);
        return json({ documents: DOCS.map(({ doc_id, title, publisher, published }) => ({ doc_id, title, publisher, published })) });
      }),
    tool("load_document",
      "Load one document from the approved library by doc_id (from list_documents). Returns every page as { page, text }. " +
      "Only library documents can be loaded; arbitrary URLs are rejected.",
      { doc_id: z.string().describe("A doc_id from list_documents") },
      async ({ doc_id }) => {
        await sleep(LATENCY_MS);
        const doc = DOCS.find(d => d.doc_id === doc_id);
        if (!doc) return toolError({ errorCategory: "validation", isRetryable: false,
          message: `Unknown doc_id '${doc_id}'. Call list_documents for valid ids; URLs are not accepted.` });
        return json({ doc_id, title: doc.title, publisher: doc.publisher, published: doc.published,
          pages: Object.entries(doc.pages).map(([page, text]) => ({ page: Number(page), text })) });
      }),
    tool("verify_fact",
      "Quick fact-check of ONE short claim (a date, name or statistic) against the indexed sources. Returns the best-matching source excerpt, or { match: null }. " +
      "For anything that needs real investigation, report the gap instead of calling this repeatedly.",
      { claim: z.string().describe("One short claim, e.g. '31% of producers use AI tools'") },
      async ({ claim }) => {
        await sleep(LATENCY_MS / 2);
        const pool = [...WEB.map(w => ({ source: w.url, text: w.snippet })),
                      ...DOCS.flatMap(d => Object.entries(d.pages).map(([p, text]) => ({ source: `${d.doc_id}#p${p}`, text })))];
        const best = pool.map(x => ({ ...x, s: score(claim, [x.text]) })).sort((a, b) => b.s - a.s)[0];
        return json({ match: best && best.s >= 3 ? { source: best.source, excerpt: best.text } : null });
      }),
  ],
});

export const TOOL = {
  web_search: "mcp__research__web_search",
  list_documents: "mcp__research__list_documents",
  load_document: "mcp__research__load_document",
  verify_fact: "mcp__research__verify_fact",
} as const;
