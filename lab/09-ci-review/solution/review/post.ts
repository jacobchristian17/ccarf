// Reference solution for TODO 5: CLI result envelope → GitHub inline review comments.

export type Finding = {
  file: string; line: number; severity: string; category: string; issue: string;
  suggested_fix: string; detected_pattern: string; confidence: number; status?: "new" | "still_open";
};
export type ReviewComment = { path: string; line: number; side: "RIGHT"; body: string };

export function toInlineComments(stdout: string): ReviewComment[] {
  const env = JSON.parse(stdout) as { is_error?: boolean; subtype?: string; result?: string; structured_output?: { findings?: Finding[] } };
  if (env.is_error || env.subtype !== "success") throw new Error(`claude -p failed (${env.subtype ?? "unknown"}): ${env.result ?? ""}`.trim());
  const findings = env.structured_output?.findings;
  if (!Array.isArray(findings)) throw new Error("no structured_output.findings: was --json-schema passed?");
  return findings
    .filter(f => f.status !== "still_open") // already has a comment on the PR; don't post a duplicate
    .map(f => ({
      path: f.file.replace(/^\.?\//, ""),
      line: f.line,
      side: "RIGHT" as const,
      body: `**${f.severity}** · ${f.category}: ${f.issue}\n\n**Suggested fix:** ${f.suggested_fix}\n\n<!-- detected_pattern: ${f.detected_pattern} -->`,
    }));
}
