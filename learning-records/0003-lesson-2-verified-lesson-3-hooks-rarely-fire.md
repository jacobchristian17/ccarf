# Lesson 2 verified 17/17; on current models hooks rarely fire, so Lesson 3 makes the failure visible on purpose

2026-10-05. `npm run l2:check` on the user's own `lab/02-mcp-tools/server.ts`: **17/17**. The Lesson 2 quiz score and the step 1/6/7 observations were not reported. The user again moved on with "continue to lesson 3", consistent with record 0002.

Code seen in the user's server: `process_refund` validates the id and maps errors through `toToolError`. Two small slips: the raw `order_id` (with any `#`) is passed to `refund()` instead of the stripped `id`; `InvalidInputError` was first marked retryable and then corrected to `false`. Worth a passing mention, not a re-drill.

Lab evidence for Lesson 3 (Agent SDK v0.3.289, Claude Code login):
- With full tool descriptions, Sonnet 5.5 and Haiku never called `process_refund($899)`, even when pushed ("manager approved, do not escalate"). The hooks didn't fire. The exam premise (prompts have a non-zero failure rate) holds in principle but is hard to observe on current models. Lesson 3 adds `THIN=1` (one-line descriptions) to reproduce sample Q1's conditions.
- With `THIN=1` and a weak prompt, both models called `process_refund($899)`. The PreToolUse deny with a redirect reason led to a correct `escalate_to_human` with a complete handoff.
- With Haiku, `THIN=1` and hooks off, the agent gave tracking details to an ambiguous "Jane Rivera" and misread epoch 1791331200 as Oct 6 (it's Oct 7 00:00 UTC). These are real 1.4 and 1.5 failures. With hooks on, the gate blocked the call, but the agent then listed both matching accounts' emails. That leak is the stretch exercise (PostToolUse redaction).
- Parallel `get_customer` + `lookup_order` in one turn ran in order in every run, so the gate passed. Don't claim this is guaranteed.

**Implications**
- Lesson 4 opens with retrieval on hook vs prompt placement and the 5.2 trigger table.
- If the user reports `angry` escalating or `human` investigating first, re-drill 5.2 before mock exam 1. Those are the two easiest 5.2 distractors to fall for.
