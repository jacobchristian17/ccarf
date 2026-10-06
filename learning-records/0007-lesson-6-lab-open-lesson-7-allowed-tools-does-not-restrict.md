# The L5 and L6 labs are both still at the starter; Lesson 7 shows that allowed-tools doesn't restrict, path rules load on Read, and a forked skill keeps the main thread at 0 tool calls

2026-10-06. The user asked to "go for lesson 7". Before building it, the graders on the user's tree gave **`l5:check` 9/44** and **`l6:check` 13/57**. Both are the starter baselines. No Lesson 6 quiz score or run numbers were reported. Following the momentum note, Lesson 7 was built anyway. Both labs are carried forward, with L5 TODO 1 (report contract) first because Lesson 10 builds on it.

Docs re-verified the same day (memory, skills, commands, hooks pages; CLI 2.1.290):
- Commands are merged into skills. `.claude/commands/x.md` still works, and a skill wins a name clash.
- `allowed-tools` "does not restrict which tools are available". It pre-approves them for the turn, and `disallowed-tools` is what restricts.
- Path rules trigger on Read, Write or Edit.
- Skill precedence is enterprise > personal > project, so a same-name personal skill shadows the team's.
- `/memory` is a list and editor. `/context` shows what's in context, but not lazy loads.
- The `InstructionsLoaded` hook reports `load_reason`.

Lab evidence (`lab/07-team-config/`, Haiku 4.5, SDK v0.3.289, `settingSources: ["project"]` in a fresh temp repo):
- **`map`, starter:** 514 tokens of CLAUDE.md at startup. Test conventions in `src/api/CLAUDE.md` loaded only when Claude touched `src/api/`, so 3 of 4 test files never got them.
- **`map`, reference:** 185 tokens at startup. Each of 4 rules loaded on first match, and `packages/billing/CLAUDE.md` + its `@import` loaded on `tax.ts` (`nested_traversal`, then `include`).
- **A Read is enough:** reading `InvoiceList.test.tsx` loaded `testing.md` *and* `frontend.md`, because `src/web/**/*.tsx` matches test files too (overlapping globs stack).
- **The SDK hook never emitted `session_start`** for the root CLAUDE.md, although the model could quote it. `query.getContextUsage().memoryFiles` gives the startup list instead.
- **`context: fork`:** with the slash command at the start of the prompt, the CLI ran the forked skill directly. The main thread had 0 turns and 0 tool calls, and got a ~750-char summary back. Inline, there were 5–6 main-thread calls and 1.2–2.9k chars of raw tool output in the main context.
- **Fork gotcha:** text after `/impact-scan` becomes `$ARGUMENTS`. "…then save it to IMPACT.md" went to the read-only Explore agent and wasn't done. Also, in non-interactive runs the `Skill` tool needs permission. When it was denied, Haiku quietly did the scan by hand in the main thread.
- **`allowed-tools: Read, Grep, Glob` alone:** the skill wrote IMPACT.md. With `disallowed-tools: Write, Edit, Bash`, Write was denied, the model then tried Bash `cat >`, and that was denied too.
- **This repo's own path rule** (`.claude/rules/test-output.md`, `lab/**/check.ts`) loaded while the L7 grader was being written. That's a live example of 3.3, used in the lesson.

**Implications**
- Exam-vs-reality list: add `allowed-tools` (exam: restricts; today: pre-approves; `disallowed-tools` restricts), path rules on Read, commands→skills merge, and `/memory` vs `/context`. On the exam, answer in its terms.
- Lesson 8 opens with retrieval on who/when for each config location, and on fork vs inline. Ask for the L7 numbers: startup tokens, main-thread calls with and without fork, and whether `guard` wrote with `allowed-tools` alone. Lesson 8 also covers `.mcp.json` / `~/.claude.json`, which is the second half of Exercise 2, so reuse the `tally` fixture there.
- Mock-exam material: a deny-list item ("a skill denied Write still wrote the file via Bash"), and a forked-skill item ("text after the slash command went to the subagent").
