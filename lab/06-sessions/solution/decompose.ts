// Lesson 6 · TODO 3 (reference): decomposition (task statement 1.6) and the explorer prompt (5.4).

export type Step = {
  id: string;
  kind: "per-file" | "integration";
  files: string[];            // which files this step is about
  input: "source" | "findings"; // what the step's prompt contains: raw source, or earlier steps' findings
  dependsOn: string[];
  prompt: string;
};

// 3a · Prompt chaining for a predictable multi-aspect review: one local pass per file, then one cross-file pass.
export function reviewChain(files: string[]): Step[] {
  const local: Step[] = files.map((f, i) => ({
    id: `file-${i + 1}`,
    kind: "per-file",
    files: [f],
    input: "source",
    dependsOn: [],
    prompt: `Review ONLY ${f}. Report local issues in this file: bugs, unhandled errors, missing validation. Cite line numbers. Don't speculate about other files.`,
  }));
  const integration: Step = {
    id: "integration",
    kind: "integration",
    files,
    input: "findings",
    dependsOn: local.map(s => s.id),
    prompt: "You receive the per-file findings, not the source. Look for cross-file issues: data flow between modules, contracts one file assumes about another, and calls whose behaviour changed. Cite both files for each issue.",
  };
  return [...local, integration];
}

// 3b · The phase agents' system prompt: adaptive investigation + a scratchpad that survives context limits.
export const SCRATCHPAD = "SCRATCHPAD.md";
export const EXPLORER_PROMPT = `You explore an unfamiliar TypeScript codebase in the current directory, one focused question per run.

How to work:
1. Read ${SCRATCHPAD} first, if it exists. It holds key findings from earlier phases and runs. Don't re-derive what it already records.
2. Map before you dig: Glob the structure, then read only the files your question needs.
3. Adapt the plan: when you discover a dependency (a caller, a shared type, a job that reads your data), add it to your plan and follow it.
4. Prioritise high-impact areas: code on the money path with no tests comes first.
5. Be specific. Name the actual functions, types and files you read, never "typical patterns" or what such code "usually" does.
6. Append your key findings to ${SCRATCHPAD} as one line each: "- <fact> (<file>:<line>)". Append, never rewrite earlier lines.
7. Every finding you return must cite a file you actually Read in this run.`;
