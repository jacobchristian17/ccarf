# Teaching Notes

## User preferences (2026-10-01)
- Goal: builds real systems; exam in under 2 weeks (target ~2026-10-14)
- Experience: Claude Code daily, Claude API, Agent SDK. No custom MCP servers built yet, so teach MCP server authoring from scratch
- Sessions: 60+ min, build-heavy
- Language: **TypeScript** (@anthropic-ai/sdk, @anthropic-ai/claude-agent-sdk, @modelcontextprotocol/sdk, Zod)
- Build workspace: `./lab/` (one folder per exercise)

## Teaching conventions
- Every lesson: knowledge → build → exam-style scenario quiz (4 options, equal length) → spaced review questions from earlier lessons
- **Review-drill rule (user request, 2026-10-05):** every lesson quiz ends with **3 review questions from each of the 2 lessons immediately before it** (Lesson N gets 3 from N−1 and 3 from N−2, so 6 in total; Lesson 2 gets 3 from Lesson 1). Tag them `data-ts="<ts> · review"`, write new scenarios rather than reusing the earlier lesson's stems, spread them across that lesson's task statements, and link the earlier lesson's reference sheet in the explanation.
- **Exam answer vs current reality** callouts. The guide (v1.0, July 2026) is authoritative for the exam. Known drift:
  - Forced `tool_choice` (`any` / `{type:"tool"}`) returns a 400 on Opus 5.5 / Sonnet 5.5 / Fable 5.1. The exam still tests it. For labs that exercise it, use `claude-opus-5` (supports forced tool choice), and note the substitution.
  - Other drift (Task→Agent tool rename, commands→skills, etc.): see the research fact sheet in learning records / RESOURCES.md
- Exam heuristics to keep reinforcing: deterministic enforcement > prompt when stakes are financial or compliance; fix the root cause with the proportionate *first step*; don't over-engineer (classifiers, routing layers) before prompts/descriptions are fixed

## Syllabus (13 sessions, all 30 task statements)
| # | Lesson | Task statements | Build |
|---|---|---|---|
| 1 | The agentic loop and tool_choice | 1.1, 2.3 (tool_choice), 4.3 (tool_choice) | Raw TS loop over the Messages API |
| 2 | Tool descriptions and structured MCP errors | 2.1, 2.2 | MCP server: get_customer, lookup_order, process_refund |
| 3 | Hooks, prerequisites and escalation | 1.4, 1.5, 5.2 | Agent SDK support agent + PreToolUse/PostToolUse hooks (Exercise 1) |
| 4 | Coordinator and subagents | 1.2, 1.3, 2.3 | Research coordinator with parallel subagents (Exercise 4a) |
| 5 | Error propagation and provenance | 5.3, 5.6, 5.1 | Structured errors, claim-source mapping (Exercise 4b) |
| 6 | Decomposition, sessions and long exploration | 1.6, 1.7, 5.4 | Resume/fork, scratchpads, manifests |
| 7 | CLAUDE.md, rules, commands and skills | 3.1, 3.2, 3.3 | Team config (Exercise 2a) |
| 8 | MCP integration, built-in tools and plan mode | 2.4, 2.5, 3.4, 3.5 | .mcp.json + env expansion, resources (Exercise 2b) |
| 9 | Claude Code in CI, review prompts | 3.6, 4.1, 4.2, 4.6 | `claude -p --output-format json --json-schema` PR reviewer |
| 10 | Structured extraction and validation-retry | 4.3, 4.4 | Zod extraction pipeline (Exercise 3a) |
| 11 | Batches and human review | 4.5, 5.5, 5.1 | Message Batches + confidence routing (Exercise 3b) |
| 12 | Mock exam 1 (60 Q, 4 scenarios, timed) | all | — |
| 13 | Weak-area drill + mock exam 2 | weakest | — |

## Progress
- [x] 1  - [x] 2  - [x] 3  - [x] 4  - [~] 5 (lesson read; lab 9/44 on 2026-10-05)  - [ ] 6 (in progress)  - [ ] 7  - [ ] 8  - [ ] 9  - [ ] 10  - [ ] 11  - [ ] 12  - [ ] 13

## Working notes
- 2026-10-02: the user declared Lesson 1 done without reporting steps 5–8 or the quiz score. They prefer momentum; carry retrieval forward instead of gating on it.
- Labs run on the Claude Code login: Lesson 2+ uses `claude -p --mcp-config … --strict-mcp-config --tools ""` (see `lab/02-mcp-tools/ask.ts`). On Windows, spawn `claude` without `shell: true`, or the prompt gets split on spaces.
- Every lab has a deterministic grader (`npm run lN:check`) for a tight feedback loop, plus `lN:ask` for real-model observation.
- Lesson 4 lab (`lab/04-subagents/`) runs the coordinator on the Agent SDK with `strictMcpConfig: true` (otherwise claude.ai connectors leak into the tool list), `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` and `background: false` per agent (subagents default to background). The coordinator sees every MCP tool regardless of `disallowedTools`, so the provided `hubOnly` hook denies its own research calls. Fault-injection switches follow the `THIN=1` pattern: `LOSSY=1`, `SEQUENTIAL=1`.
- Lesson 5 lab (`lab/05-provenance/`) reuses the L4 corpus with a fault-injecting `tools.ts` (`OUTAGE=<subtopic>`, `FLAKY=1`). Hooks are done for the learner: SubagentStop validates the report with the learner's Zod contract (`decision: "block"` + issues, one retry), PostToolUse stores parsed reports, PreToolUse on the synthesizer swaps in `buildSynthesisBrief` output via `updatedInput`. Both mechanisms verified live on SDK v0.3.289.
- Lesson 6 lab (`lab/06-sessions/`): fixture repo `fixture/refundly` plus change overlays (`changes/small|big`), copied into `.work/` (gitignored). `run.ts` subcommands: explore (code coordinator, 4 Haiku phase agents, manifest handoff, `CRASH_AFTER=n`, `RESET=1`), review, session (SDK `title: "refund-analysis"`), change small|big, followup (`FORCE=resume|fresh`), fork. `npm run l6:ask` doesn't load `.env` (its MODEL=claude-opus-5-5 is for L1), so it defaults to Haiku. The SDK `title` is resumable by name via `claude -r <title>`. On Windows, put the prompt before `--tools ""`.
- Live quiz variants (user request, 2026-10-06): `npm run quiz` (lab/quiz/server.ts) serves the course on http://localhost:4317. On a missed item, quiz.js offers "Try a new question on this topic". The server runs `claude -p --json-schema` (default sonnet, QUIZ_MODEL to override) grounded in the task-statement text from md/CCAR-F/sections, aims at the picked distractor, checks option length and correct count in code (one retry with the issues), and shuffles option order. Variants don't count toward the main score: the summary line adds "new questions x/y". Every generation is appended to assets/variants/<quiz>.json, which is worth reviewing for wrong items. ~7–10 s per item. Lessons opened as file:// show no button.
