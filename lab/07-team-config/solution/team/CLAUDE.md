# tally

Invoicing app: `src/api` (HTTP handlers), `src/web` (React), `src/lib` (shared), `packages/billing` (tax), `terraform/` (infra).

## Standards for every change
- pnpm only (`pnpm test`, `pnpm lint`). Never npm or yarn.
- TypeScript strict mode. No `any`; use `unknown` and narrow.
- ESM: relative imports end in `.js`, even from `.ts` files.
- Money is integer cents everywhere. See `docs/standards/money.md`.
- Run `pnpm test` before you say a change is done, and report the result.

Topic rules live in `.claude/rules/` and load only for the files they cover.
