# tally-billing

Invoicing service. TypeScript, ESM. Money is integer cents everywhere inside the service; dollars appear only at the edges (form input, emails).

- Errors: return `err("...")` from route handlers; throw typed errors (`NotFoundError`, `ValidationError`) from domain code.
- SQL: always use parameterized queries via `db.query(sql, params)`.
