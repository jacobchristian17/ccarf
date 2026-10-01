# Mission: Claude Certified Architect – Foundations (CCAR-F)

## Why
I build production systems on Claude and want rigorous, complete coverage of the architecture judgment the certification tests, so the systems I build hold up in production. Passing CCAR-F (scaled 720/1000) within two weeks proves that coverage.

## Success looks like
- Pass CCAR-F on the first attempt, by about 2026-10-14
- Answer any scenario question by naming the root cause and the *proportionate* fix (deterministic enforcement vs prompt, first step vs over-engineering)
- Have built working versions of all 4 guide exercises: a support agent with hooks and escalation, a team Claude Code config, an extraction pipeline with validate-retry and batching, and a multi-agent research pipeline with provenance
- Cover all 30 task statements across the 5 domains, each practised with retrieval questions at least twice (spaced)

## Constraints
- Under 2 weeks to exam day
- 60+ min sessions, build-heavy
- Already uses Claude Code daily, the Claude API and the Agent SDK, so skip basics and go straight to exam-grade tradeoffs
- The exam guide (v1.0, July 2026) is authoritative for answers; where current docs differ, learn both ("exam answer" vs "current reality")

## Out of scope
- Everything the guide lists as out of scope: fine-tuning, auth/billing, MCP hosting, computer use, vision, streaming, rate limits, prompt-caching internals, tokenization
