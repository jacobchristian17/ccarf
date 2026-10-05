# Lesson 3 verified 28/28; Lesson 4 adds three more exam-vs-SDK gaps around subagents

2026-10-05. `npm run l3:check` on the user's own `lab/03-hooks/`: **28/28**. As with Lessons 1–2, no quiz score or step observations were reported. The user went straight to "lesson 4".

Code seen in the user's hooks.ts. All of it passes the grader, but it's worth a quick mention:
- `enforceRefundLimit` returns `deny("Tool not allowed")` for any non-refund tool, and denies when `amount` is falsy. The matcher already scopes it, so a hook should return `{}` for anything it isn't about. Otherwise a broader matcher would block unrelated tools (fail-closed by accident).
- `normalizeShipment` returns the raw parsed object (not a HookJSONOutput) when `shipment` is null. It should `return {}`.
- The multi-match note says "More than two customers": that's an off-by-one in the wording.
- The prompt.ts rewrite is strong: it has triggers, non-triggers, error-category handling and 4 examples.

Lab evidence for Lesson 4 (Agent SDK v0.3.289, Sonnet 5.5 coordinator, Haiku subagents, fictional corpus):
- **Task → Agent:** `tool_use` blocks say `Agent`, the `system:init` list says `Task`, and `"Task"` in `tools` still works. The coordinator spawned with `allowedTools: []`, which means allowedTools only auto-approves. The exam's "allowedTools must include Task" is the exam answer.
- Subagents default to **background**, and they **can nest** (default depth 3). Every MCP tool is visible to the coordinator even with top-level `disallowedTools`. A subagent with no `tools` list used `load_document` (tool inheritance).
- With the starter "one at a time" procedural prompt, Sonnet **still spawned 3 searchers in parallel**. It decomposed by theme, so games was never covered. The parallelism premise is weaker on current models, but the coverage premise (sample Q7) held.
- Solution: 6 parallel spawns, 5/5 coverage, 98 s. Forced sequential: 195 s (research phase ~46 s → ~121 s). `simple` used 1 searcher and no synthesizer. `since2026` carried the constraint into every prompt.
- With `LOSSY=1` and hooks on, the context-passing hook denied the synthesizer (11 sources missing), and the re-issued call cited 11. With hooks off, it cited 0. Without the fault injection, the hook never fired. Same pattern as Lesson 3.

**Implications**
- Lesson 5 opens with retrieval on context isolation (what a subagent receives) and the three 2.3 tool patterns.
- The exam-vs-reality list now has three Lesson 4 entries (Task/allowedTools, background default, nesting). Mock exam 1 should include a Task/allowedTools item to check the user picks the exam answer.
- Lesson 5 builds on `lab/04-subagents` (Exercise 4b): structured error propagation from a timed-out searcher, and the 31% vs 25% conflict in the corpus.
