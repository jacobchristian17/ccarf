# tally

Invoicing app: `src/api` (HTTP handlers), `src/web` (React), `src/lib` (shared), `packages/billing` (tax), `terraform/` (infra).

## General
- pnpm only (`pnpm test`, `pnpm lint`). Never npm or yarn.
- TypeScript strict mode. No `any`; use `unknown` and narrow.
- ESM: relative imports end in `.js`, even from `.ts` files.
- Money is integer cents everywhere.
- Run `pnpm test` before you say a change is done, and report the result.

## Jacob's preferences
- Keep answers terse; skip summaries of what you changed.
- I alias `pnpm test` as `t` in my shell; you still run the full command.

## API handlers
- Throw `ApiError(code, status, message)` from `src/api/errors.ts`, never a bare `Error`.
- `code` is stable SCREAMING_SNAKE, e.g. `INVOICE_NOT_FOUND`. 4xx for caller mistakes, 5xx only for our faults.
- Validate request bodies with Zod at the handler edge.

## React components
- Function components with a typed props object.
- Format money only through `formatCents`; never divide by 100 inline.

## Terraform
- Never run `terraform apply`. Plans only: `terraform plan -out=tfplan`.
- Every resource gets `tags = local.common_tags`.
- State lives in the S3 backend; never add a local backend.

## Billing package (packages/billing)
- Owned by the billing team. Tax rules change by regulation, so cite the rule source in a comment.
- Amounts are integer cents (`number`), never floats. Name them `*Cents`.
- Round only once, at the last step, with `Math.round` (half up).
- Currency is PHP unless a field says otherwise.

## Impact scans
Before renaming or changing a signature, grep for every reference to the symbol,
read each caller, and list `file:line — why it is affected`. Keep it under 12 lines.
