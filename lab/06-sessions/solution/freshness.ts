// Lesson 6 · TODO 2 (reference): resume with a change notice, or start fresh with a summary (task statement 1.7).
import type { Finding } from "./state.js";

export type FileRef = { path: string; hash: string };
export type PriorSession = { sessionId: string; name: string; summary: string; findings: Finding[]; filesRead: FileRef[] };
export type SessionPlan =
  | { mode: "resume"; sessionId: string; prompt: string; changed: string[]; deleted: string[] }
  | { mode: "fresh"; prompt: string; changed: string[]; deleted: string[] };

export const STALE_LIMIT = 0.5;

export function diffFiles(prior: FileRef[], current: Record<string, string>) {
  const changed = prior.filter(f => f.path in current && current[f.path] !== f.hash).map(f => f.path);
  const deleted = prior.filter(f => !(f.path in current)).map(f => f.path);
  return { changed, deleted };
}

export function planSession(prior: PriorSession, current: Record<string, string>): SessionPlan {
  const { changed, deleted } = diffFiles(prior.filesRead, current);
  const staleShare = prior.filesRead.length ? (changed.length + deleted.length) / prior.filesRead.length : 1;

  if (staleShare <= STALE_LIMIT) {
    const prompt = changed.length + deleted.length === 0
      ? "No files have changed since your last analysis. Your earlier findings still hold."
      : ["Since your last analysis these files changed:",
         ...changed.map(p => `- ${p} (modified)`), ...deleted.map(p => `- ${p} (deleted)`),
         "Re-read only these files before answering. Your analysis of every other file is still valid, so don't re-explore the codebase."].join("\n");
    return { mode: "resume", sessionId: prior.sessionId, prompt, changed, deleted };
  }

  const stale = new Set([...changed, ...deleted]);
  const prompt = [
    `## Summary of an earlier analysis ("${prior.name}")`,
    prior.summary,
    "",
    "### Findings",
    ...prior.findings.map(f => `- ${f.fact} (${f.file}${f.line ? `:${f.line}` : ""})${stale.has(f.file) ? ` [STALE: ${f.file} has changed since, re-verify]` : ""}`),
    "",
    "### Files changed since that analysis",
    ...changed.map(p => `- ${p} (modified)`), ...deleted.map(p => `- ${p} (deleted)`),
    "",
    "Treat the stale findings as leads, not facts. Read the current code before relying on them.",
  ].join("\n");
  return { mode: "fresh", prompt, changed, deleted };
}
