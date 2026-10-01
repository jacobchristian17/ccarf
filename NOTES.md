# Teaching Notes

## User preferences (2026-10-01)
- Goal: builds real systems; exam in under 2 weeks (target ~2026-10-14)
- Experience: Claude Code daily, Claude API, Agent SDK. No custom MCP servers built yet, so teach MCP server authoring from scratch
- Sessions: 60+ min, build-heavy
- Language: **TypeScript** (@anthropic-ai/sdk, @anthropic-ai/claude-agent-sdk, @modelcontextprotocol/sdk, Zod)
- Build workspace: `./lab/` (one folder per exercise)

## Teaching conventions
- Every lesson: knowledge → build → exam-style scenario quiz (4 options, equal length) → spaced review questions from earlier lessons
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
- [ ] 1  - [ ] 2  - [ ] 3  - [ ] 4  - [ ] 5  - [ ] 6  - [ ] 7  - [ ] 8  - [ ] 9  - [ ] 10  - [ ] 11  - [ ] 12  - [ ] 13
