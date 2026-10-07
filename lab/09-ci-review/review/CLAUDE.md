# tally-billing

Invoicing service. TypeScript, ESM. Money is integer cents everywhere inside the service; dollars appear only at the edges (form input, emails).

- Errors: return `err("...")` from route handlers; throw typed errors (`NotFoundError`, `ValidationError`) from domain code.
- SQL: always use parameterized queries via `db.query(sql, params)`.

<!-- TODO 6 (3.6): CI-invoked Claude Code reads this file like any session does. Add a "## Testing" section:
     what makes a test valuable here, the fixtures that exist (see tests/fixtures/index.ts in the fixture repo),
     and an instruction not to duplicate scenarios that the module's existing test file already covers. -->
