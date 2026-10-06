# The Lesson 5 lab is still at the starter (9/44); Lesson 6 shows that a resume with no notice is confidently wrong, and that a manifest gives handoff and crash recovery together

2026-10-05. The user asked for "lesson 6". Before building it, `npm run l5:check` on the user's `lab/05-provenance/` scored **9/44**, the starter baseline. The commit "lesson 5 start" contains only the scaffold. No Lesson 5 quiz score or run numbers were reported. Following the "momentum" note, Lesson 6 was built anyway, and the L5 lab is carried forward as open work.

Lab evidence for Lesson 6 (`lab/06-sessions/`, Haiku 4.5 agents, SDK v0.3.289, CLI 2.1.289):
- **Stale resume, no change notice:** 0 files re-read, and the answer confidently described the old `postCredit` as "NOT idempotent". Both were wrong after `change small`. The same happened after `change big` with FORCE=resume, which also missed the event-driven rewrite. With a question that said "as the code is NOW", the model *did* re-read. The lab question is now worded neutrally so the notice has to do that work.
- **Reference notice (small change):** re-read exactly the 2 changed files and gave a correct answer in 12 s. **Big change → FRESH:** a 5.2k-char summary with 17 of 19 findings tagged STALE, and a correct answer that found the new `refund-worker.ts`.
- **Fork:** both forks re-read 0 files, with distinct ids. The resumed original said "We haven't chosen one yet".
- **SDK `title` works as the session name:** `claude -p "…" -r refund-analysis --fork-session` found the SDK-created session and answered from context with no tools. (On Windows, `--tools ""` placed before the prompt swallowed it. Put the prompt first.)
- **Explore with CRASH_AFTER=2:** the starter reran everything (165 s, 38 reads). The reference skipped 2 agents, and the planner read 2 files while naming 6 of 6 specific functions (105 s, 12 reads).
- **Not ideal (good material for teaching):** the planner cited `SCRATCHPAD.md:NN` instead of source files. It passed the "cite files you read" rule, but provenance is now one hop away. The scratchpad reached 92 lines in one run, so append-only notes bloat.
- **Review chain:** on 8 small files, the single pass missed the settlement↔ledger dependency and the chain caught it. The contrast is weak at this size (be honest about this in mock-exam explanations). The integration pass cited line numbers it never saw.

**Implications**
- Lesson 7 opens with retrieval on resume vs fresh vs fork, and on the five 5.4 techniques. Also ask for the L5 + L6 lab scores. If the L5 lab is still untouched, offer a 15-minute catch-up on TODO 1 (report contract), since Lesson 10 builds on it.
- Exam-vs-reality list: add `fork_session` → `forkSession` / `--fork-session` / `/branch`, and `--resume <name>` ↔ `-n` / SDK `title`.
- The scratchpad-provenance finding links 5.4 to 5.6. It's worth a mock-exam item.
