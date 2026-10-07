<!-- TODO 4 (3.6): the prompt for re-running the review after new commits are pushed to the PR.
     run.ts fills in {{DIFF}} (the whole PR, base..head), {{NEW_COMMITS}} (only the commits since the last review)
     and {{PRIOR_FINDINGS}} (the comments already posted, as JSON). The starter ignores the prior review,
     so every open issue gets posted again. Tell Claude to report only new issues and issues that are still
     unaddressed, to mark each one with status "new" or "still_open", and not to report issues the new commits fixed. -->
{{DIFF}}

Review this pull request.
