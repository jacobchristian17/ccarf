# Lesson 9 lab: a CI review job for `tally-billing`

`fixture/base` is a small invoicing service. `fixture/pr1` is a pull request touching 11 files, with 5 planted defects
(T1–T5: SQL injection, an uncapped refund, a reversed expiry check, a cross-file cents/dollars contract break, and a
comment that contradicts its code) and 4 noise traps (N1–N4: style and documented local conventions). `fixture/pr2` is a
follow-up commit that fixes T1 and T3 and introduces T6 and T7. Ground truth: `fixture/truth.json`.

Every model call is a real `claude -p --output-format json [--json-schema …]` subprocess, which is exactly what a CI job runs.

You edit `review/`:

    finding.schema.json               TODO 1   the --json-schema for findings CI can post inline
    .github/workflows/claude-review.yml TODO 1b the CI job (-p, json, schema, read-only tools, re-runs on push)
    criteria.md                       TODO 2   explicit review criteria (4.1)
    examples.md                       TODO 3   2–4 few-shot examples (4.2)
    rereview.md                       TODO 4   the re-review prompt with prior findings
    post.ts                           TODO 5   CLI result envelope → GitHub inline comments
    CLAUDE.md                         TODO 6   the repo's CLAUDE.md: testing standards and fixtures

    npm run l9:check                    grader, ~1 s, no model
    npm run l9:ask -- review            one pass over PR 1, scored against truth.json (~50 s)
    npm run l9:ask -- rereview          PR 1 + follow-up commit, with your rereview.md (~2 min)
    npm run l9:ask -- multipass         11 per-file passes + 1 integration pass (~3 min)
    npm run l9:ask -- self              generator, then self-review (--resume) vs independent review (~1.5 min)
    npm run l9:ask -- testgen           propose tests for src/discount.ts (~20 s)
    npm run l9:ask -- rescore yours     re-score a saved review run without calling the model
    $env:SOLUTION="1"                   use solution/review
    $env:PROMPT="vague"                 the starter's vague criteria, no examples, reference schema (baseline)
    $env:NOPRIOR="1"                    rereview with no prior findings (what a naive pipeline does on every push)
    $env:CONTEXT="none"                 testgen without your CLAUDE.md and without the existing test file
    $env:NOTE="0"                       self: leave out the misleading ticket note the generator otherwise gets

Runs use `--setting-sources project --strict-mcp-config`, so your own ~/.claude settings and connectors stay out.
Run artifacts go to `.work/` (gitignored).
