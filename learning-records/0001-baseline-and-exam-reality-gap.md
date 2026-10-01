# Baseline: practitioner with Claude Code, API and Agent SDK; TypeScript; 2-week runway

The user says they use Claude Code daily and have built with the Claude API and the Agent SDK, but have not authored MCP servers. Depth is self-reported and not yet tested. Lesson 1's quiz gives the first evidence. They want build-heavy 60+ min sessions in TypeScript, with the exam about 2026-10-14.

**Implications**
- Skip API and Claude Code basics; teach exam-grade tradeoffs and the guide's exact wording (e.g. "cap as *primary* stop").
- Teach MCP server authoring from scratch in Lesson 2.
- The exam guide (v1.0, July 2026) lags current models in places: forced `tool_choice` returns a 400 on Opus 5.5 / Sonnet 5.5 / Fable 5.1, the Task tool was renamed Agent, and commands merged into skills. Practitioners who know current behaviour risk choosing the "current reality" answer over the exam answer. Every lesson carries an exam-vs-reality callout, and quiz explanations call the gap out.
