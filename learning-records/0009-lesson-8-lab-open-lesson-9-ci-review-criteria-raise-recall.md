# L8 lab still at the starter; Lesson 9 finds that explicit review criteria mainly raise recall, and that the self-review blind spot didn't reproduce on Haiku

2026-10-06. The user ran `/teach lesson 9`. Before building it, `l8:check` on the user's tree gave **8/26**, the starter. Labs 5–8 are all at the starter. No Lesson 8 quiz score or run numbers were reported. Following the momentum note, Lesson 9 was built anyway (3.6, 4.1, 4.2, 4.6).

Docs checked the same day (CLI 2.1.290):
- Headless: the `--json-schema` result is in `structured_output` (verified live: `{"subtype":"success","num_turns":2,"structured_output":{…}}`). `--bare` is recommended for scripts and "will become the default for `-p`". It skips CLAUDE.md, hooks, skills and `.mcp.json`, and needs `ANTHROPIC_API_KEY`. In `-p`, unapproved calls are denied, not left waiting.
- GitHub Actions: `claude-code-action@v1` (`prompt`, `claude_args`). "Define project standards in CLAUDE.md … review criteria".
- Best practices: Writer/Reviewer ("A fresh context improves code review since Claude won't be biased toward code it just wrote"), and "a reviewer prompted to find gaps will usually report some".
- Prompting best practices: "Include 3–5 examples". The exam says 2–4.

Lab evidence (`lab/09-ci-review/`, Haiku 4.5; truth = 5 planted defects + 4 noise traps):
- **Vague vs explicit criteria:** vague found 3, 3, 3 of 5; explicit + 3 examples found 4, 5, 5. **No noise trap was flagged in any run, under either prompt.** The difference was recall on the categories the criteria name (the comment contradiction T5, the refund cap T2). The remaining false positives were one arguable category ("route doesn't catch the domain errors"), which is a criteria gap.
- **Multipass:** per-file passes found nothing in `receipt.ts` or `invoices.ts`. Only the integration pass found the cents/dollars contract break. 5/5, about 175 s, $0.33, vs a single pass at about 50 s, $0.07, which also found 5/5 in 2 of 3 runs. The PR is too small to show attention dilution.
- **Re-review:** without prior findings, 4 new comments (3 duplicates). With prior findings and `status` optional, 3 duplicates in one run and 0 in the other. With `status` required, 2 new comments (T6, plus T7, a type error in the existing test that the model found and we hadn't planted).
- **Self-review vs independent:** without the misleading note, the generator passed all 14 hidden tests twice, and the self-review raised 2 and 1 false alarms (independent: 0 and 0). With the note, the generator broke R3 and R5, and **both** reviewers caught both, twice. The exam's anchoring effect wasn't observable at this scale.
- **Testgen:** no context gave 4 of 11 duplicates and 0 fixture use. Full context (CLAUDE.md Testing + the existing test file) gave 0 of 9 duplicates, 4 using fixtures and 6 boundary tests.

**Implications**
- Exam-vs-reality: add `--bare` (no CLAUDE.md), the 3–5 vs 2–4 example counts, and the observed absence of a self-review effect on short sessions. The exam answers are unchanged.
- Teaching point worth reusing in mock exams: a criteria list with a gap produces false positives in exactly that gap. And "optional field = sometimes omitted" is a 4.3 schema-design lesson (required vs optional), which links forward to Lesson 10.
- Lesson 10 (extraction, validate-retry, 4.3/4.4) should open with retrieval on `-p` + `--json-schema`/`structured_output`, explicit criteria, and few-shot. It can reuse `detected_pattern` (built here) for the 4.4 dismissal-analysis skill.
- Labs 5–9 are at the starter, and the exam is about 2026-10-14. Before Lesson 12, ask the user whether to spend one session on the graders or rely on the quizzes.
