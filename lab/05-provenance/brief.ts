// Lesson 5 · TODO 2: build the synthesizer's input in CODE from the parsed reports (5.1, 5.3, 5.6).
// In Lesson 4 the coordinator LLM copied findings into the synthesizer's prompt and a hook checked it.
// Here a PreToolUse hook (hooks.ts, done for you) puts THIS function's output at the top of every synthesizer
// prompt, so provenance and coverage don't depend on the model copying them correctly.
//
// Required layout (the grader parses it):
//   QUESTION: <question>
//
//   ## Coverage (read this first)          ← BEFORE any finding: key facts first, against "lost in the middle"
//   - <subtopic>: <annotation>             ← exactly one line per report, starting "- <subtopic>:"
//
//   ## Findings: <subtopic>                ← one section per report that HAS findings, explicit headers
//   - <claim>
//     evidence: "<evidence>"
//     source: <id> · <publisher> · published <YYYY-MM-DD> · p.<page>     (omit " · p.<page>" when page is null)
//
// Coverage annotations (5.3: the coordinator and synthesizer must be able to tell these apart):
//   complete, findings > 0  → "covered · <n> findings"
//   complete, no findings   → "GAP · searched, no matching sources (<the queries tried>)"    never "timeout"/"unavailable"
//   partial                 → "PARTIAL · <n> findings kept · <failureType> on \"<attemptedQuery>\" · alternatives: …"
//   failed                  → "GAP · source unavailable · <failureType> on \"<attemptedQuery>\" · alternatives: …"
//
// Use only the fields the schema names. Don't JSON.stringify a report: that would carry the query log and any
// extra keys into the synthesizer's context (5.1: trim verbose output before it accumulates).
import type { SubagentReport } from "./report.js";

export function buildSynthesisBrief(question: string, reports: SubagentReport[]): string {
  // TODO 2
  return `QUESTION: ${question}\n\n${JSON.stringify(reports)}`;
}
