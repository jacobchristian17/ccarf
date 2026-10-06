# L7 lab still at the starter; Lesson 8 finds that a better MCP tool description doesn't help while the tool is deferred, and that plan mode refuses MCP tools not marked read-only

2026-10-06. The user ran `/teach lesson 8`. Before building it, `l7:check` on the user's tree gave **7/42**, the starter. L5 (9/44) and L6 (13/57) are also still at the starter. No Lesson 7 quiz score or run numbers were reported. Following the momentum note, Lesson 8 was built anyway. Its live runs use the L7 *reference* config, so it doesn't depend on L7 being done.

Docs checked the same day: the MCP page and the SDK type docs (CLI 2.1.290, SDK v0.3.289):
- There are three MCP scopes: local and user both live in `~/.claude.json`, and project in `.mcp.json`. Precedence is local > project > user. Interactive sessions ask before using `.mcp.json` servers. `-p` and the SDK don't ask.
- An unset `${VAR}` with no default: "the config still loads … uses the unexpanded `${VAR}` text as-is".
- Tool search is on by default. `ENABLE_TOOL_SEARCH=false` turns it off. Setting `alwaysLoad: true` on a server keeps its tools out of deferral.
- The MCP page has no documentation of resource @-mentions or server instructions, so the lesson doesn't claim the @-mention syntax.

Lab evidence (`lab/08-mcp-integration/`, Haiku 4.5):
- **"Who calls toCents?"** Starter description: 23 calls (Grep/Read/Glob), MCP tool never used. Reference description: 10 calls, MCP tool still never used. Adding server `instructions`: 2 calls (ToolSearch → `find_references`), 2 runs out of 2. With `ENABLE_TOOL_SEARCH=false`, even "Find references." was used in 1 call. **The exam's lever (the description) isn't the binding constraint today. Whether the tool is loaded is.**
- **Unset token:** the server reported "connected" and received the literal `${TALLY_INDEX_TOKEN}`. A naive non-empty check accepts it. The lab server now detects it and names the cause.
- **Resource:** 3 server calls without it, 1 resource read with it (4 tables, so the saving grows with catalog size).
- **Non-unique Edit:** Haiku widened the anchor and succeeded first time, so it never needed the Read+Write fallback.
- **Plan vs direct:** bugfix direct took 2 calls; in plan mode it took 8 calls and produced a plan for a one-liner. Migration direct: 57 calls and 7 files rewritten with no checkpoint. Migration in plan mode: 18 calls, 0 files changed, a plan with design decisions and an open question. The feature task in plan mode ended with questions for the user (the interview pattern, unprompted).
- **Plan mode refused unannotated MCP tools** ("Cannot call … while in plan mode"). With `readOnlyHint: true`, they ran. Plan mode writes the plan file to `~/.claude/plans/` by default: 3 stray files were created and then deleted, and the runner now sets `plansDirectory`. `ExitPlanMode` is disabled when there's no interactive approver.
- When the server bundle was inside the repo, Haiku grepped the server's source to answer a schema question. So the bundles now live outside the repo.

**Implications**
- Exam-vs-reality list: add MCP tool deferral (exam: description; today: also instructions or `alwaysLoad`), the local scope, the unset-var literal, and plan mode + `readOnlyHint`.
- Lesson 9 (CI, `claude -p --json-schema`) should open with retrieval on MCP scope and secrets, and on plan vs direct. Ask for the L8 numbers: `refs` call counts across description / instructions / no tool search, and migration files changed, plan vs direct.
- Mock-exam material: "teammate's MCP tool fails with a permission error although the server shows connected" (the env var is unset); "agent ignores a well-described MCP tool" (the exam answer is the description, so watch the wording); "plan mode for a one-line fix" (overhead, so the answer is direct execution).
- Labs 5–8 are all at the starter. Before the mock exams (Lessons 12–13), consider one catch-up session focused on the graders, or confirm with the user that the quizzes alone are enough.
