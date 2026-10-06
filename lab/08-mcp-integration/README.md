# Lesson 8 lab: MCP for `tally`, built-in tools and plan mode

This lab reuses the Lesson 7 `tally` fixture, plus `fixture-extra/`: a re-export alias (`parseAmount`), a wrapper
(`amountToCents`), their callers, and `rounding.ts` with a duplicated line. Live runs also lay the L7 **reference**
config on top, so the CLAUDE.md is the clean one whatever state your L7 lab is in.

You edit three things:

    team/.mcp.json              the team's project-scoped MCP config (committed)
    team/personal/claude.json   stands in for your ~/.claude.json (user scope, never committed)
    servers/tally-index.ts      TODO 3 (description + server instructions) and TODO 4 (schema resource)

`servers/core.ts` (the schema, the alias-aware reference finder, auth) and `servers/scratchpad.ts` are provided.
Live runs bundle both servers into `%TEMP%\ccarf-l8-tools\`, *outside* the repo. `${TALLY_TOOLS_DIR}` points there.
It stands in for `npx -y @tally/index-mcp`. Keeping the bundles out of the repo stops the model from grepping the server's source.

    npm run l8:check                  grader, ~3 s, no model (it talks to your server over stdio)
    npm run l8:ask -- servers         which servers connected, from which scope; is a token committed?
    npm run l8:ask -- refs            "who calls toCents?": find_references vs Grep, caller files found
    npm run l8:ask -- schema          VAT-rate question: exploratory tool calls vs the tally://schema resource
    npm run l8:ask -- edit            change one of two identical lines (Edit needs a unique anchor)
    npm run l8:ask -- task bugfix     MODE=plan or MODE=direct; also: migration, feature
    $env:SOLUTION="1"                 use solution/ (config + server)
    $env:NOTOKEN="1"                  TALLY_INDEX_TOKEN unset: what reaches the server?
    $env:ENABLE_TOOL_SEARCH="false"   load every MCP tool definition up front (no deferral)
