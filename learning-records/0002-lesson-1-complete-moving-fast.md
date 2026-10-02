# Lesson 1 complete (self-reported); learner moves fast, so retrieval is deferred into Lesson 2

2026-10-02. Verified in the lab: TODOs 1–4 of `lab/01-agentic-loop/loop.ts` are correct (branches on stop_reason, pushes the assistant turn verbatim, returns one tool_result per tool_use with is_error on throw, all results in one user message). Ran on BACKEND=mock: the default prompt and the 99999/504 case both behaved correctly. Steps 5–8 (protocol 400s, the forced tool_choice loop fix, the reality-check 400, the two-Janes ambiguity) and the Lesson 1 quiz score were **not** verified. The user said "I'm done with lesson one" and asked to move on.

Code habits seen: casts instead of type guards (`as TextBlockParam` on a response block), `String(error)` instead of `error.message`.

**Implications**
- Lesson 2 opens with Lesson 1 retrieval questions (tool_result ordering, forced-choice loop) and ends with two Lesson 1 review quiz items. If the user misses them, re-drill 1.1 and 2.3 before mock exam 1.
- Ask for the quiz summary line at the end of each lesson, but don't block progress on it.
- Lab observations used in Lesson 2 (2026-10-02, Sonnet 5.5 via `claude -p`): a bare SDK error leaked `HTTP 504`, `orders-db` and the internal customer ID to the customer; the structured error produced a customer-safe reply. A refund rule written in the description made the agent decline $899 *without calling* process_refund. A keyword-sensitive system prompt ("order" → lookup_order) did NOT misroute Sonnet 5.5, so the exam premise is weaker on current models.
