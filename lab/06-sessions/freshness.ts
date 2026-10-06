// Lesson 6 · TODO 2: resume the session, or start fresh with a summary (task statement 1.7).
//
// `l6:ask -- session` runs a baseline analysis session and saves { sessionId, name, summary, findings, filesRead[path+hash] }.
// `l6:ask -- change small|big` edits the codebase. `l6:ask -- followup` then calls YOUR planSession() and either
//   resumes the old session (query({ options: { resume: sessionId } })) with plan.prompt as a change notice, or
//   starts a NEW session whose prompt begins with plan.prompt as an injected summary.
//
// Rules:
//   • changed = files in prior.filesRead whose hash differs in `current`; deleted = files missing from `current`
//   • staleShare = (changed + deleted) / filesRead.length. If filesRead is empty, treat it as fully stale (1)
//   • staleShare <= STALE_LIMIT → mode "resume" (the prior context is mostly valid)
//       prompt, nothing changed: say so ("No files have changed …")
//       prompt, some changed: name EACH changed file "(modified)" and each deleted file "(deleted)", tell the agent to
//       re-read only those, and say its analysis of the other files still holds (targeted re-analysis, not full re-exploration)
//   • staleShare > STALE_LIMIT → mode "fresh" (resuming would bring back stale tool results)
//       prompt: a structured summary: "## Summary of an earlier analysis", the prior summary, every finding as
//       "- <fact> (<file>:<line>)", findings in changed/deleted files tagged "[STALE: <file> …re-verify]", and the list
//       of changed/deleted files. Nothing else: no raw tool output
// `npm run l6:check` grades this; `npm run l6:ask -- followup` shows it.
import type { Finding } from "./state.js";

export type FileRef = { path: string; hash: string };
export type PriorSession = { sessionId: string; name: string; summary: string; findings: Finding[]; filesRead: FileRef[] };
export type SessionPlan =
  | { mode: "resume"; sessionId: string; prompt: string; changed: string[]; deleted: string[] }
  | { mode: "fresh"; prompt: string; changed: string[]; deleted: string[] };

export const STALE_LIMIT = 0.5;

export function planSession(prior: PriorSession, _current: Record<string, string>): SessionPlan {
  // Starter: always resume, and say nothing about what changed.
  return { mode: "resume", sessionId: prior.sessionId, prompt: "", changed: [], deleted: [] };
}
