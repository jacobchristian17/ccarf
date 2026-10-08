# Lesson 10 lab: an extraction pipeline for Tally Billing's accounts-payable inbox

`docs/` holds 10 supplier documents in deliberately varied shapes: a markdown table, a chatty email, a French
invoice with `07.09.2026` and `1.250,00 €`, an invoice whose printed total disagrees with its lines, a $6,480 invoice
whose PO is "per attached purchase order" (not attached), a credit memo, a quotation, a till receipt, a law-firm
invoice with "payment as agreed", and an invoice with sales tax. Ground truth: `fixture/truth.json` (including which
fields each source does NOT contain, so fabrications can be counted).

The pipeline (`run.ts`, provided): document → model calls one of two tools → **Zod** checks the shape → **your
semantic checks** → retry with the specific errors, or the human queue → scored against truth.

You edit `extract/`:

    schema.ts        TODO 1  Zod schemas for extract_invoice / extract_credit_note: required + nullable, enums with
                             unclear / other + detail, integer cents, stated vs calculated total, conflict_detected
    tool-choice.ts   TODO 2  tool_choice when the document type is unknown and there are two schemas
    validate.ts      TODO 3  semantic validation; each issue says whether a retry can fix it
    retry.ts         TODO 4  when to retry, and the follow-up: document + failed extraction + specific errors
    prompt.md        TODO 5  normalization rules + 2–4 few-shot examples of varied document structure
    dismissals.ts    TODO 6  dismissal rate by detected_pattern over Lesson 9's review log

    npm run l10:check                  grader, 41 checks, ~1 s, no model
    npm run l10:ask -- extract         one attempt per document: fields right, fabrications, issues (~1 min)
    npm run l10:ask -- retry           the full validate-retry loop (~1.5 min)
    npm run l10:ask -- choice          tool_choice auto vs yours on d02, d06, d07, d08
    npm run l10:ask -- dismissals      your report over fixture/dismissals.json (no model)
    $env:SOLUTION="1"                  use solution/extract
    $env:EXAMPLES="0"                  strip the ## Examples section from prompt.md
    $env:PROMPT="bare"                 a one-line prompt, to see what your schema does on its own
    $env:RETRY_ALL="1"                 also retry issues marked not retryable (watch d05's po_number)
    $env:DOCS="d05,d07"                run a subset
    $env:BACKEND="mock"                offline: replays truth.json with planted faults (not a model)

The model calls go through `createClient()` (`BACKEND` in `lab/.env`), so `claude-cli` runs on your Claude Code
login. That backend emulates `tool_choice` in the prompt and does not enforce the tool's JSON schema (like
non-strict tool use), which is why Zod sits in the loop. Default model: `claude-haiku-4-5` (`L10_MODEL`).
Runs are saved to `.work/` (gitignored).
