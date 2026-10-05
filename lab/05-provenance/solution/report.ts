// Lesson 5 · reference solution for TODO 1: the subagent report contract.
import { z } from "zod";

export const Source = z.object({
  id: z.string().min(1),
  publisher: z.string().min(1),
  published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "published must be an ISO date, YYYY-MM-DD"),
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
  failureType: z.enum(["timeout", "unavailable", "permission"]),
  attemptedQuery: z.string().min(1),
  message: z.string().min(1),
  alternatives: z.array(z.string().min(1)).min(1),
});

export const SubagentReport = z.object({
  subtopic: z.string().min(1),
  status: z.enum(["complete", "partial", "failed"]),
  findings: z.array(Finding),
  queries: z.array(QueryAttempt).min(1),
  error: SubagentError.nullable(),
}).superRefine((r, ctx) => {
  const issue = (message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });
  // R1 · complete means nothing went wrong
  if (r.status === "complete" && r.error) issue("status 'complete' must have error: null", ["error"]);
  // R2 · partial or failed must say what went wrong
  if (r.status !== "complete" && !r.error) issue(`status '${r.status}' needs an error object (failureType, attemptedQuery, message, alternatives)`, ["error"]);
  // R3 · failed = no partial results; partial = some
  if (r.status === "failed" && r.findings.length) issue("status 'failed' has findings: use 'partial' and keep them", ["status"]);
  if (r.status === "partial" && !r.findings.length) issue("status 'partial' needs at least one finding (the partial results)", ["findings"]);
  // R4 · no matches is not an access failure
  if (r.status === "failed" && !r.queries.some(q => q.outcome === "timeout" || q.outcome === "error"))
    issue("status 'failed' needs a query that timed out or errored. Queries with no matches are a valid empty result: status 'complete'", ["status"]);
  // R5 · local recovery before propagating
  r.queries.forEach((q, i) => {
    if (q.outcome === "timeout" && q.attempts < 2) issue(`query '${q.query}' timed out after 1 attempt: retry a transient failure once before reporting it`, ["queries", i, "attempts"]);
  });
});

export type SubagentReport = z.infer<typeof SubagentReport>;
export type Finding = z.infer<typeof Finding>;
