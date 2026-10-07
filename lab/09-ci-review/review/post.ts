// TODO 5 (3.6): turn the stdout of `claude -p --output-format json --json-schema ...` into GitHub inline
// review comments. The CLI prints ONE JSON object (the "result envelope"); your schema's output is in
// its `structured_output` field. See the lesson, section 2, for the envelope fields.
//
// Rules the grader checks:
//   - throw if the run failed (is_error true, or subtype other than "success"), or if structured_output.findings is missing
//   - one comment per finding: { path: file, line, side: "RIGHT", body }
//   - body contains the severity, the issue and the suggested fix, plus a hidden marker
//     <!-- detected_pattern: ... --> so dismissed comments can be analysed later (4.4)
//   - findings with status "still_open" are NOT posted again (they already have a comment on the PR)

export type Finding = {
  file: string; line: number; severity: string; category: string; issue: string;
  suggested_fix: string; detected_pattern: string; confidence: number; status?: "new" | "still_open";
};
export type ReviewComment = { path: string; line: number; side: "RIGHT"; body: string };

export function toInlineComments(stdout: string): ReviewComment[] {
  throw new Error("TODO 5: parse the result envelope");
}
