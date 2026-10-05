// Lesson 5 · reference solution for TODO 2: the synthesizer's input, built by code from the parsed reports.
import type { SubagentReport } from "./report.js";

function coverageLine(r: SubagentReport): string {
  const n = r.findings.length;
  const tried = r.queries.map(q => `"${q.query}"`).join(", ");
  if (r.status === "complete" && n) return `- ${r.subtopic}: covered · ${n} finding${n > 1 ? "s" : ""}`;
  if (r.status === "complete") return `- ${r.subtopic}: GAP · searched, no matching sources (${tried})`;
  const e = r.error!;
  const why = `${e.failureType} on "${e.attemptedQuery}" (${e.message}) · alternatives: ${e.alternatives.join("; ")}`;
  return r.status === "partial"
    ? `- ${r.subtopic}: PARTIAL · ${n} finding${n > 1 ? "s" : ""} kept · ${why}`
    : `- ${r.subtopic}: GAP · source unavailable · ${why}`;
}

export function buildSynthesisBrief(question: string, reports: SubagentReport[]): string {
  const out = [
    `QUESTION: ${question}`,
    "",
    "## Coverage (read this first)",
    ...reports.map(coverageLine),
  ];
  for (const r of reports.filter(r => r.findings.length)) {
    out.push("", `## Findings: ${r.subtopic}${r.status === "partial" ? " (partial)" : ""}`);
    for (const f of r.findings) {
      const s = f.source;
      out.push(`- ${f.claim}`, `  evidence: "${f.evidence}"`,
        `  source: ${s.id} · ${s.publisher} · published ${s.published}${s.page != null ? ` · p.${s.page}` : ""}`);
    }
  }
  return out.join("\n");
}
