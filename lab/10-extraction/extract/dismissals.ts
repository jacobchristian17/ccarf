// TODO 6 (4.4): dismissal analysis. Lesson 9's findings carried detected_pattern. fixture/dismissals.json is
// three months of that reviewer's findings, each marked accepted or dismissed by the developer.
// dismissalReport: one row per detected_pattern with posted, dismissed and rate (dismissed / posted),
//   sorted by rate, highest first (ties: more posted first).
// patternsToSuppress: the patterns to switch off while you rewrite their criteria: rate > maxRate, and only
//   when posted >= minPosted (3 findings are not evidence yet).
export type LoggedFinding = { finding_id: string; pr: number; detected_pattern: string; category: string; outcome: "accepted" | "dismissed" };
export type PatternRow = { pattern: string; posted: number; dismissed: number; rate: number };

export function dismissalReport(_log: LoggedFinding[]): PatternRow[] {
  return [];
}

export function patternsToSuppress(_rows: PatternRow[], _opts = { minPosted: 5, maxRate: 0.5 }): string[] {
  return [];
}
