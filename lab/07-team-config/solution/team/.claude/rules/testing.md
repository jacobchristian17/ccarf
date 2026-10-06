---
paths:
  - "**/*.test.*"
---

# Tests
- Vitest. Import `test` and `expect` from `vitest` explicitly; no globals.
- One behaviour per `test()`, named as a sentence: "rejects a negative amount".
- Money assertions compare integer cents, never formatted strings.
- No network or real clock: use `vi.useFakeTimers()` and in-memory fakes.
