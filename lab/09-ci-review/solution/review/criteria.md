<review_criteria>
Report ONLY issues in these four categories:

1. **security**: injection (SQL, shell, path), missing authorization checks, secrets in code.
2. **bug**: code that gives a wrong result for an input a caller can actually send. Examples: a reversed comparison, a missing limit check on money, a unit mismatch (cents vs dollars), an off-by-one at a boundary.
3. **contract**: a change to an exported function's return value, units or signature that a caller still uses the old way. For every export this PR changes, Grep for its callers (including files the PR doesn't touch) and check each one.
4. **comment**: report a comment ONLY when the behaviour it claims contradicts what the code actually does. Don't report comments that are terse, missing or worded differently from what you'd write.

Do NOT report:
- style: let vs const, naming, formatting, inline arithmetic, magic numbers, function length
- anything that follows a convention documented in CLAUDE.md or in a code comment (for example `body: any` in route handlers, or console.log in scripts/)
- missing tests, missing docs, or performance concerns without a concrete hot path
- "consider" suggestions and hypothetical future problems

Report every issue that fits a category, whatever your confidence. Put your confidence in the confidence field rather than leaving a finding out. An empty findings list is a valid review.

Severity:
- **critical**: exploitable, or loses or corrupts money for any user.
  `db.query(`SELECT * FROM users WHERE email = '${email}'`)`
- **high**: wrong result on a normal path.
  `if (trialEndsAt > now) throw new Error("trial over")` (the comparison is reversed)
- **medium**: wrong only on an edge path, or misleading to the next developer.
  `// returns [] when there are no rows` above code that returns `undefined`
- **low**: correct, but fragile in a way that will plausibly break soon. Use it rarely.

Line numbers refer to the NEW version of the file. Report each issue once, at the line where the fix belongs.
</review_criteria>
