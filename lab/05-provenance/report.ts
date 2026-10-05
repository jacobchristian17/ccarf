// Lesson 5 · TODO 1: the subagent report contract (task statements 5.3, 5.6, 5.1).
// Every searcher and doc-analyst must end with ONE JSON object that parses with SubagentReport.
// It is checked deterministically at two points (see hooks.ts, done for you):
//   • SubagentStop: if the report doesn't parse, the subagent is told the exact Zod issues and gets ONE retry
//   • PostToolUse on Agent: the coordinator's copy is parsed and stored, which also TRIMS it: Zod drops any
//     key the schema doesn't name (reasoning notes, raw tool output), so only structured data flows on (5.1)
//
// Shape:
//   { subtopic, status: "complete" | "partial" | "failed",
//     findings: [ { claim, evidence, source: { id, publisher, published, page } } ],    ← partial results live here
//     queries:  [ { query, outcome: "ok" | "no_matches" | "timeout" | "error", attempts } ],
//     error:    null | { failureType: "timeout" | "unavailable" | "permission", attemptedQuery, message, alternatives: [..] } }
//
// TODO 1a · Source.published must be an ISO date (YYYY-MM-DD): dates are what let synthesis tell a
//           temporal difference from a contradiction (5.6).
// TODO 1b · SubagentError: failureType (enum above), attemptedQuery, message (non-empty strings) and
//           alternatives (at least one), so the coordinator can decide how to recover (5.3).
// TODO 1c · SubagentReport rules, in .superRefine (use ctx.addIssue({ code: "custom", message, path })):
//   R1  status "complete"            → error must be null
//   R2  status "partial" | "failed"  → error must be present
//   R3  "failed" → no findings ("partial" if you kept some);  "partial" → at least one finding
//   R4  "failed" needs at least one query with outcome "timeout" or "error". Queries that only came back
//       "no_matches" are a VALID EMPTY result: status "complete", findings [], error null
//   R5  any query with outcome "timeout" must have attempts ≥ 2 (retry a transient failure locally first)
// Write messages that tell the subagent how to fix its report: they are what it reads on the retry.
// `npm run l5:check` grades it.
import { z } from "zod";

export const Source = z.object({
  id: z.string().min(1),
  publisher: z.string().min(1),
  published: z.string(), // TODO 1a
  page: z.number().int().positive().nullable(),
});

export const Finding = z.object({
  claim: z.string().min(1),
  evidence: z.string().min(1),
  source: Source,
});

export const QueryAttempt = z.object({
  query: z.string().min(1),
  outcome: z.enum(["ok", "no_matches", "timeout", "error"]),
  attempts: z.number().int().min(1),
});

export const SubagentError = z.object({
  // TODO 1b
});

export const SubagentReport = z.object({
  subtopic: z.string().min(1),
  status: z.enum(["complete", "partial", "failed"]),
  findings: z.array(Finding),
  queries: z.array(QueryAttempt).min(1),
  error: SubagentError.nullable(),
}); // TODO 1c: .superRefine((r, ctx) => { ... })

export type SubagentReport = z.infer<typeof SubagentReport>;
export type Finding = z.infer<typeof Finding>;
