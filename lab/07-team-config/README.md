# Lesson 7 lab: team config for `tally`

`fixture/tally/` is a small invoicing repo. **You don't edit it.** Your config lives in `team/`, which is
overlaid on top of the fixture (same relative paths) for every live run. `solution/team/` is the reference.

`team/personal/CLAUDE.md` stands in for `~/.claude/CLAUDE.md`. The lab never touches your real home config.

    npm run l7:check              grader, ~1 s, no model
    npm run l7:ask -- map         which instruction files load for which file (one Haiku session)
    npm run l7:ask -- load <file> Read one file and show what loaded
    npm run l7:ask -- ask "<q>"   ask with no tools: what does the model know at startup?
    npm run l7:ask -- skill [arg] run /impact-scan (default arg toCents): main vs subagent calls
    npm run l7:ask -- guard       /impact-scan + "save it to IMPACT.md": does your skill stop the write?
    $env:SOLUTION="1"             use solution/team instead of team/
    $env:NOFORK="1"               strip context: fork / agent: from the skill for one run

Heads-up: `team/` and `solution/team/` contain real CLAUDE.md files. When Claude Code works in *this* repo and
touches a file under them, it loads them as nested instructions (`nested_traversal`), "Jacob's preferences"
included. That's harmless, and it's task 3.1 happening to you. `/context` or a `Loaded …` line in the terminal will show it.
