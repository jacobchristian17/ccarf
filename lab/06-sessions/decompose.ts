// Lesson 6 · TODO 3: decomposition (task statement 1.6) and the explorer prompt (5.4).
//
// 3a · reviewChain(files) → Step[]: a prompt chain for a predictable multi-file review (`l6:ask -- review` runs it)
//   • one "per-file" step per file: files = [that file only], input "source", dependsOn [], a prompt that keeps the
//     review local to that file
//   • then exactly ONE final "integration" step: files = all files, input "findings" (it gets the per-file findings,
//     NOT the raw source again), dependsOn = every per-file id, and a prompt about cross-file issues (data flow,
//     contracts between modules)
//   Why: one pass over many files dilutes attention, so the review goes shallow and inconsistent.
// 3b · EXPLORER_PROMPT: the system prompt for the four phase agents in `l6:ask -- explore`
//   • read SCRATCHPAD (the constant below) first, and don't re-derive what it already records
//   • map the structure before reading deeply
//   • adapt: when you discover a dependency, add it to the plan and follow it
//   • prioritise high-impact areas (money path, untested)
//   • name the specific functions and files, never "typical patterns"
//   • append key findings to the scratchpad, one line each with file:line. Append, don't rewrite
//   • only cite files you actually Read
// `npm run l6:check` grades this.

export type Step = {
  id: string;
  kind: "per-file" | "integration";
  files: string[];
  input: "source" | "findings";
  dependsOn: string[];
  prompt: string;
};

export function reviewChain(files: string[]): Step[] {
  // Starter: one pass over everything.
  return [{ id: "all", kind: "per-file", files, input: "source", dependsOn: [], prompt: "Review these files for bugs." }];
}

export const SCRATCHPAD = "SCRATCHPAD.md";
export const EXPLORER_PROMPT = `You explore a TypeScript codebase in the current directory and answer the question you are given.`;
