---
name: impact-scan
description: Find everything that depends on a symbol or file before changing it, and return a short impact summary. Use before renaming, changing a signature, or deleting code.
argument-hint: "<symbol or file path>"
context: fork
agent: Explore
allowed-tools: Read, Grep, Glob
disallowed-tools: Write, Edit, Bash
---

Map the impact of changing `$ARGUMENTS`.

1. Find its definition and every reference (imports, calls, type uses, tests).
2. For each caller, note whether the change would break it.

Return at most 12 lines: definition `file:line`, then one line per dependent `file:line — why it is affected`, then a one-line risk verdict. Do not paste file contents.
