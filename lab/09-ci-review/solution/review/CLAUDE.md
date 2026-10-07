# tally-billing

Invoicing service. TypeScript, ESM. Money is integer cents everywhere inside the service; dollars appear only at the edges (form input, emails).

- Errors: return `err("...")` from route handlers; throw typed errors (`NotFoundError`, `ValidationError`) from domain code.
- SQL: always use parameterized queries via `db.query(sql, params)`.

## Testing
- Vitest. One behaviour per `it`, named for the behaviour ("rejects an expired code"), not for the function.
- Valuable tests here check behaviour at boundaries: exact limits (`uses === maxUses`), expiry instants (the second before and after), .5-cent rounding, and every error branch. Also money invariants (a refund never exceeds what was paid).
- Low-value tests to avoid: that a function is exported or is a function, that a return value is an object, re-asserting TypeScript types, mocking our own pure functions.
- Before proposing tests, read the module's existing test file (`tests/<module>.test.ts`). Don't propose a scenario it already covers. Extend it instead.
- Fixtures live in `tests/fixtures/index.ts`: `makeInvoice(overrides)` builds a paid invoice, and `fixedClock()` returns 2026-03-15T12:00:00Z. Use them. Never call `new Date()` with no arguments in a test.

## Review (CI)
- CI runs `claude -p` with `review/criteria.md` and `review/examples.md`. Those files are the review criteria, so change them there rather than here.
