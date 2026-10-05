// Lesson 5 · reference solution for TODO 3c.
import { BASE_PROMPT, COORDINATOR_TOOLS } from "../coordinator.js";
export { COORDINATOR_TOOLS };

export const ERROR_POLICY = `
<errors>
Each researcher returns a report with status complete, partial or failed. A partial or failed report carries an error with
failureType, attemptedQuery, message and alternatives. You decide how to recover:
- failed, or partial with useful alternatives: re-delegate ONCE to a searcher with one of the alternatives (different keywords,
  or the doc-analyst for library evidence). Then accept whatever comes back.
- Still unresolved: proceed with the partial results. Never abort the whole run because one subagent failed, and never
  hide a failure: the gap stays in the brief and in your final answer.
- status complete with no findings means the search worked and there is no matching evidence. That is an answer, not a
  failure: don't retry it as a timeout. Report it as "no matching sources".
- Your final answer ends with a coverage note: which areas are well supported, which are partial, which are gaps, and why.
</errors>
`;

export const COORDINATOR_PROMPT = BASE_PROMPT + ERROR_POLICY;
