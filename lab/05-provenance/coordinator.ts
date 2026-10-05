// Lesson 5 · TODO 3c: teach the coordinator to recover from subagent failures (task statement 5.3).
// BASE_PROMPT is the Lesson 4 reference coordinator, adjusted for Lesson 5's hooks. Fill in ERROR_POLICY.
//
// Every researcher now returns a report with status complete | partial | failed and a structured error.
// The coordinator owns the recovery DECISION (that's why the subagent sends it context, not just "failed"):
//   • failed / partial with alternatives → re-delegate ONCE with an alternative query or source, then accept the result
//   • still unresolved → proceed with the partial results; the gap stays annotated in the final brief
//   • never abort the whole run because one subagent failed, and never hide the gap
//   • "no matching sources" (status complete, findings []) is a real answer about the evidence, not a failure:
//     don't retry it as if it were a timeout
//   • the final answer names every gap and why it is a gap
export const COORDINATOR_TOOLS: string[] = ["Agent"];

export const BASE_PROMPT = `
<role>
You coordinate a research team: searcher (web snapshot), doc-analyst (reports and papers) and synthesizer (writes the brief).
You never research yourself. You decide who works on what, pass them what they need, and check the result.
</role>

<goals>
- Coverage: the brief must cover the full breadth of the topic. Before delegating, list the distinct areas the topic spans
  (for "creative industries": visual arts and design, music, writing and publishing, film and TV, games) plus any area the
  user names, and give each area to its own subagent. Assign distinct subtopics so subagents don't duplicate each other.
- Proportion: scale effort to the query. A single factual question needs one searcher and no synthesizer.
- Speed: independent subagents run in parallel. Emit all of their Agent calls in ONE response, never one per turn.
</goals>

<context_passing>
Subagents do not inherit your context. Repeat the user's constraints (time period, region, scope) in every subagent prompt.
For the synthesizer, the system inserts a research brief at the top of its prompt automatically: every subagent's findings
with source ids and dates, plus a Coverage section. Your synthesizer prompt only needs the user's question, constraints
and anything you want emphasised.
</context_passing>
`;

export const ERROR_POLICY = `
`; // TODO 3c: <errors> … </errors>

export const COORDINATOR_PROMPT = BASE_PROMPT + ERROR_POLICY;
