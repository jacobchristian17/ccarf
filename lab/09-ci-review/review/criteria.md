<!-- TODO 2 (4.1): the review criteria. This is the prompt that decides what gets reported.
     The starter is the vague version the exam warns about. Rewrite it with:
       - explicit categories to REPORT (security, bug, cross-file contract, a comment that contradicts its code)
       - explicit things to SKIP (style, local conventions documented in CLAUDE.md, ...)
       - no "be conservative" or "only high-confidence" filtering
       - severity levels, each with a short code example
     run.ts puts this file after the diff, followed by examples.md. -->
<review_criteria>
There are categories to report and skip.

Categories to report:
 - **security**: Any code that can expose security issues or violate permissions
 - **bug**: Codes that can induce bugs, common anti-design patterns
 - **contract**: this is where violations to existing business logic, policies, that needs attention if changed
 - **comments**: Comments, inline documentations that doesn't support and/or fully contradicts the underlying code

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
