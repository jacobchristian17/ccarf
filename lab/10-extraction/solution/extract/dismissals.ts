// Reference solution, TODO 6: dismissal analysis by detected_pattern (4.4).
// Lesson 9's findings carried detected_pattern. When developers dismiss findings, grouping by pattern shows
// WHICH construct the reviewer misjudges, so you fix that criterion (or add a "no finding" example) instead of
// tuning the whole prompt down.
export type LoggedFinding = { finding_id: string; pr: number; detected_pattern: string; category: string; outcome: "accepted" | "dismissed" };
export type PatternRow = { pattern: string; posted: number; dismissed: number; rate: number };

export function dismissalReport(log: LoggedFinding[]): PatternRow[] {
  const by = new Map<string, PatternRow>();
  for (const f of log) {
    const row = by.get(f.detected_pattern) ?? { pattern: f.detected_pattern, posted: 0, dismissed: 0, rate: 0 };
    row.posted++;
    if (f.outcome === "dismissed") row.dismissed++;
    by.set(f.detected_pattern, row);
  }
  return [...by.values()]
    .map(r => ({ ...r, rate: r.dismissed / r.posted }))
    .sort((a, b) => b.rate - a.rate || b.posted - a.posted);
}

/** Patterns to switch off while their criteria are rewritten. Small samples are not evidence yet. */
export function patternsToSuppress(rows: PatternRow[], opts = { minPosted: 5, maxRate: 0.5 }): string[] {
  return rows.filter(r => r.posted >= opts.minPosted && r.rate > opts.maxRate).map(r => r.pattern);
}
