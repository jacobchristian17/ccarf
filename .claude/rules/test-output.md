---
paths:
  - "lab/**/check.ts"
  - "lab/**/*.test.ts"
---

# Test and grader output

- Print a passing check in **green** and a failing check in **red**, using `green` / `red` from `lab/shared/colors.ts`. Don't hand-write ANSI codes in each file.
- Colour the whole line, including the `✓` / `✗` marker and any hint on the failure.
- Colour the summary line (`══ LN check: x/y`) green only when every check passes, red otherwise.
- Keep the `✓` / `✗` markers. Colour is extra, not a replacement: `colors.ts` turns colour off when output is piped or `NO_COLOR` is set, and the result must still be readable.
