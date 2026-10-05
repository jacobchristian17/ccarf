// Lesson 5 grader: runs your report contract against fixture reports, your brief builder against fixture runs,
// and checks your prompts. No model, no network.
// Run:  npm run l5:check            (your report.ts + brief.ts + agents.ts + coordinator.ts)
//       npm run l5:check:solution   (reference)
import type { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import type { z } from "zod";
import { green, red } from "../shared/colors.js";
import { parseReport } from "./hooks.js";

const dir = process.argv[2] === "solution" ? "./solution/" : "./";
const { SubagentReport } = await import(`${dir}report.ts`) as { SubagentReport: z.ZodType<any> };
const { buildSynthesisBrief } = await import(`${dir}brief.ts`) as { buildSynthesisBrief: (q: string, r: any[]) => string };
const { AGENTS } = await import(`${dir}agents.ts`) as { AGENTS: Record<string, AgentDefinition> };
const { COORDINATOR_PROMPT } = await import(`${dir}coordinator.ts`) as { COORDINATOR_PROMPT: string };

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MUSIC_A = { claim: "31% of producers use AI in at least half their sessions", evidence: "31% of working music producers say they use AI tools in at least half of their sessions",
  source: { id: "https://music-ledger.test/producers-ai-2026", publisher: "Music Ledger", published: "2026-02-02", page: null } };
const MUSIC_B = { claim: "25% of producers use AI tools regularly", evidence: "25% of producers use AI tools regularly, according to a survey of 1,200 studio professionals",
  source: { id: "https://soundcheck-daily.test/ai-survey", publisher: "Soundcheck Daily", published: "2026-02-18", page: null } };
const DOC_F = { claim: "Freelance visual artists saw an 18% median income drop", evidence: "Visual arts saw the largest income drop for freelancers (-18% median)",
  source: { id: "creative-economy-2026", publisher: "Institute for Creative Work", published: "2026-05-01", page: 11 } };
const VFX_F = { claim: "VFX vendors use generative fill on about a third of shots", evidence: "using generative fill for roto and cleanup on roughly a third of shots",
  source: { id: "https://reelfacts.test/vfx-genai", publisher: "ReelFacts", published: "2026-05-22", page: null } };

const complete = { subtopic: "music", status: "complete", findings: [MUSIC_A, MUSIC_B], queries: [{ query: "music producers AI", outcome: "ok", attempts: 1 }], error: null };
const docs = { subtopic: "reports", status: "complete", findings: [DOC_F], queries: [{ query: "creative-economy-2026", outcome: "ok", attempts: 1 }], error: null };
const empty = { subtopic: "dance", status: "complete", findings: [], queries: [{ query: "dance AI choreography", outcome: "no_matches", attempts: 1 }, { query: "theatre AI", outcome: "no_matches", attempts: 1 }], error: null };
const err = (q: string) => ({ failureType: "timeout", attemptedQuery: q, message: "web_search timed out after 30 s", alternatives: ["search 'video game AI dialogue'", "ask doc-analyst for library evidence"] });
const failed = { subtopic: "games", status: "failed", findings: [], queries: [{ query: "games AI NPC", outcome: "timeout", attempts: 2 }], error: err("games AI NPC") };
const partial = { subtopic: "film-tv", status: "partial", findings: [VFX_F],
  queries: [{ query: "film VFX generative", outcome: "ok", attempts: 1 }, { query: "guild digital replicas", outcome: "timeout", attempts: 2 }], error: err("guild digital replicas") };
const ok = (r: unknown) => SubagentReport.safeParse(r).success;
const issues = (r: unknown) => { const p = SubagentReport.safeParse(r); return p.success ? "" : p.error.issues.map(i => i.message).join(" | "); };

const Q = "Research the impact of AI on the creative industries, including dance.";
const NOTES = "I first considered searching for photography but decided music was the better fit because";
const run = () => [complete, docs, empty, failed, partial].map(r => ({ ...r }));
const brief = () => buildSynthesisBrief(Q, run());
const briefWithNotes = () => buildSynthesisBrief(Q, run().map(r => ({ ...r, notes: NOTES })));
const lines = (b: string) => b.split("\n");
function coverage(b: string) {
  const L = lines(b); const i = L.findIndex(l => /^##\s.*coverage/i.test(l));
  if (i < 0) return [];
  const end = L.findIndex((l, j) => j > i && /^##\s/.test(l));
  return L.slice(i + 1, end < 0 ? undefined : end).filter(l => l.trim());
}
const covLine = (b: string, subtopic: string) => coverage(b).find(l => l.startsWith(`- ${subtopic}:`)) ?? "";
const allFindings = [MUSIC_A, MUSIC_B, DOC_F, VFX_F];

const S = (n: string) => AGENTS[n]?.prompt ?? "";
const P = COORDINATOR_PROMPT;

let pass = 0, total = 0;
const groups: [string, [string, () => boolean | Promise<boolean>][]][] = [
  ["5.3 · 5.6 · Report contract (TODO 1)", [
    ["a complete report with findings parses", () => ok(complete)],
    ["a valid empty result parses (complete, no findings, no_matches)", () => ok(empty)],
    ["a failed report with a structured error parses", () => ok(failed)],
    ["a partial report (findings kept + error) parses", () => ok(partial)],
    ["1a · published must be YYYY-MM-DD ('Feb 2026' rejected)", () => !ok({ ...complete, findings: [{ ...MUSIC_A, source: { ...MUSIC_A.source, published: "Feb 2026" } }] })],
    ["1b · error needs attemptedQuery", () => !ok({ ...failed, error: { ...failed.error, attemptedQuery: undefined } })],
    ["1b · error needs at least one alternative", () => !ok({ ...failed, error: { ...failed.error, alternatives: [] } })],
    ["1b · failureType is an enum ('oops' rejected)", () => !ok({ ...failed, error: { ...failed.error, failureType: "oops" } })],
    ["R1 · complete with an error → rejected", () => !ok({ ...complete, error: err("x") })],
    ["R2 · failed with error null → rejected (generic 'search unavailable')", () => !ok({ ...failed, error: null })],
    ["R3 · failed WITH findings → rejected (that's partial)", () => !ok({ ...failed, findings: [MUSIC_A] })],
    ["R3 · partial with NO findings → rejected", () => !ok({ ...partial, findings: [] })],
    ["R4 · only no_matches but status failed → rejected (empty ≠ access failure)", () => !ok({ ...empty, status: "failed", error: err("dance AI") })],
    ["R5 · timeout after 1 attempt → rejected (retry locally first)", () => !ok({ ...failed, queries: [{ query: "games AI NPC", outcome: "timeout", attempts: 1 }] })],
    ["rule messages tell the subagent what to fix (R4 message mentions 'no' matches / empty)", () => /(no.?match|empty)/i.test(issues({ ...empty, status: "failed", error: err("dance AI") }))],
    ["unknown keys are stripped on parse (reasoning notes don't flow on)", () => {
      const r = parseReport(SubagentReport, JSON.stringify({ ...complete, notes: NOTES })); return r.ok && !("notes" in r.report); }],
  ]],
  ["5.1 · 5.3 · 5.6 · Synthesis brief (TODO 2)", [
    ["starts with the question", () => brief().startsWith(`QUESTION: ${Q}`)],
    ["Coverage section comes before any finding (key facts first)", () => {
      const b = brief(); const c = b.search(/^##\s.*coverage/im); return c >= 0 && allFindings.every(f => b.indexOf(f.claim) > c); }],
    ["one coverage line per report: '- <subtopic>:'", () => ["music", "reports", "dance", "games", "film-tv"].every(s => covLine(brief(), s))],
    ["covered subtopic says covered + finding count", () => /covered/i.test(covLine(brief(), "music")) && /\b2\b/.test(covLine(brief(), "music"))],
    ["valid empty → 'no matching sources', never timeout/unavailable", () => { const l = covLine(brief(), "dance"); return /no match/i.test(l) && !/timeout|unavailable/i.test(l); }],
    ["…and lists the queries that were tried", () => /dance AI choreography/.test(covLine(brief(), "dance"))],
    ["failed → GAP with failureType, attemptedQuery, an alternative", () => { const l = covLine(brief(), "games"); return /gap/i.test(l) && /timeout/.test(l) && l.includes("games AI NPC") && l.includes("video game AI dialogue"); }],
    ["partial → PARTIAL with findings kept and what failed", () => { const l = covLine(brief(), "film-tv"); return /partial/i.test(l) && l.includes("guild digital replicas") && /\b1\b/.test(l); }],
    ["a '## ' header per subtopic that has findings, none for empty ones", () => {
      const H = lines(brief()).filter(l => /^##\s/.test(l)); return ["music", "reports", "film-tv"].every(s => H.some(h => h.includes(s))) && !H.some(h => /dance|games/.test(h)); }],
    ["every claim and verbatim evidence survives", () => allFindings.every(f => brief().includes(f.claim) && brief().includes(f.evidence))],
    ["every source id, publisher and published date survives (claim-source mapping)", () => allFindings.every(f => [f.source.id, f.source.publisher, f.source.published].every(x => brief().includes(x)))],
    ["page numbers survive (p.11)", () => /p\.\s?11\b/.test(brief())],
    ["both conflicting values reach the synthesizer (31% and 25%)", () => brief().includes("31%") && brief().includes("25%")],
    ["trimmed: no reasoning notes, no raw query log JSON", () => { const b = briefWithNotes(); return !b.includes(NOTES) && !/"outcome"|"attempts"/.test(b); }],
  ]],
  ["5.3 · 5.6 · Prompts (TODO 3)", [
    ["3a · searcher retries a timeout locally before reporting", () => /(retry|again)/i.test(S("searcher")) && /(timeout|transient)/i.test(S("searcher"))],
    ["3a · searcher tries an alternative query", () => /alternative/i.test(S("searcher").replace(/"alternatives"[^\n]*/g, ""))],
    ["3a · searcher reports partial results, not all-or-nothing", () => /partial/i.test(S("searcher").replace(/"status"[^\n]*/g, ""))],
    ["3a · searcher: empty results are not an error (no_matches)", () => /(empty|no results|nothing match|no match)/i.test(S("searcher").replace(/If nothing relevant[^\n]*/g, "")) && /(not (an )?error|isn't an error|is not a failure|not a failure)/i.test(S("searcher"))],
    ["3a · searcher never hides a failure as success", () => /(never|don't|do not)[^.\n]{0,60}(hide|suppress|success)/i.test(S("searcher"))],
    ["3b · synthesizer separates well-established from contested", () => /(well.established|established)/i.test(S("synthesizer")) && /contested/i.test(S("synthesizer"))],
    ["3b · synthesizer keeps both conflicting values with sources", () => /(both|each)[^.\n]{0,80}(value|figure)/i.test(S("synthesizer")) && /(never|don't|do not)[^.\n]{0,40}(pick|choose|average|drop)/i.test(S("synthesizer"))],
    ["3b · synthesizer uses publication dates (time ≠ contradiction)", () => /date/i.test(S("synthesizer")) && /(over time|temporal|not (necessarily )?a contradiction|not a conflict)/i.test(S("synthesizer"))],
    ["3b · synthesizer carries coverage gaps with their reason", () => /gap/i.test(S("synthesizer")) && /(unavailable|no matching|reason|why)/i.test(S("synthesizer"))],
    ["3b · synthesizer renders by content type (figures as a table)", () => /table/i.test(S("synthesizer")) && /prose/i.test(S("synthesizer"))],
    ["3c · coordinator re-delegates a failure with an alternative, once", () => /(re-?delegat|retry|re-?run|try again)/i.test(P) && /alternative/i.test(P) && /once|one (more|retry|time)/i.test(P)],
    ["3c · coordinator proceeds with partial results (never aborts the run)", () => /partial/i.test(P) && /(never|don't|do not)[^.\n]{0,40}(abort|terminate|stop|fail) the (whole|entire)/i.test(P)],
    ["3c · coordinator doesn't treat 'no matching sources' as a failure", () => /(no match|no findings|empty)/i.test(P) && /(not (a )?failure|not an error|don't retry|do not retry)/i.test(P)],
    ["3c · final answer annotates coverage gaps", () => /(coverage|gap)/i.test(P.replace(/Coverage section/g, "")) && /final answer/i.test(P)],
  ]],
];

for (const [title, checks] of groups) {
  console.log(`\n${title}`);
  for (const [name, fn] of checks) {
    total++;
    let ok = false, err = "";
    try { ok = await fn(); } catch (e) { err = ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
    if (ok) pass++;
    console.log(ok ? green(`  ✓ ${name}`) : red(`  ✗ ${name}${err}`));
  }
}
console.log((pass === total ? green : red)(`\n══ L5 check: ${pass}/${total}${pass === total ? " · all green" : ""}`));
