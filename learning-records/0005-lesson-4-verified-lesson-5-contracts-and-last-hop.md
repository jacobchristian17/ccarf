# Lesson 4 verified 31/31; Lesson 5 shows that report contracts need code and that provenance can be lost at the last hop

2026-10-05. `npm run l4:check` on the user's own `lab/04-subagents/`: **31/31** (commit "lesson 4 cleared"). As in earlier lessons, no quiz score or run numbers were reported (parallel vs sequential, LOSSY source counts). The user went straight to "lesson 5".

Code seen in the user's Lesson 4 work:
- The coordinator prompt and hooks are strong. `requireCompleteBrief` is close to the reference, and its deny reason says *why*.
- The doc-analyst prompt is thin ("document analist … site the claim"). It has no output format, so the grader's regexes pass while the real output is unspecified. Lesson 5 gives the doc-analyst a shared `REPORT_FORMAT`, so this no longer matters for the lab, but it's worth noting that the user writes minimal prompts when a grader only pattern-matches.

Lab evidence for Lesson 5 (SDK v0.3.289, Sonnet 5.5 coordinator, Haiku subagents):
- **SubagentStop `decision: "block"` + reason works.** The subagent fixes its report and stops again. In two reference runs there were 7 and 8 retries. The most common faults: `partial` with no error object, and a timeout logged with `attempts: 1` (no local retry). A few reports were still malformed after one retry, and those were stored as `failed · unavailable` rather than dropped.
- **PreToolUse `updatedInput` on the Agent tool works.** The synthesizer received the code-built brief (about 10–11k chars, 11–12 source ids).
- **Haiku labels a valid empty result as an access failure.** Several sectors were marked `partial · unavailable` because their lawsuit queries returned nothing. The schema can't catch this (the label is valid, just wrong). The Sonnet coordinator re-interpreted it correctly in the final note.
- **The starter's empty `SubagentError` schema stripped every error field**, so the coordinator got `error {}`. That is the generic-status anti-pattern produced by the contract, not by the model.
- **Last-hop provenance loss.** The coordinator rewrote the synthesizer's brief and changed URLs into "(Publisher, date)". The final answer cited 0–1 source ids, against 11–12 in the brief. This makes a good exam-style point: every handoff is a summarization step.
- **Conflict handling:** Sonnet kept 31% and 25% and said they "measure different things", which preserves the methodological context (5.6).

**Implications**
- Lesson 6 opens with retrieval on: the four failure-reporting patterns (sample Q8), valid empty vs access failure, and where attribution gets lost.
- The SubagentStop validate-and-retry pattern is a preview of Lesson 10 (4.4 validation-retry). Refer back to it there.
- Next lesson: 1.6, 1.7, 5.4. Manifests and scratchpads follow on naturally from "state exported to a known location".
- 5.1's customer-side skills (case-facts block, multi-issue state) are still untaught. They are scheduled for Lesson 11.
