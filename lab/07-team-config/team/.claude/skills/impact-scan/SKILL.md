---
name: impact-scan
description: Find everything that depends on a symbol or file before changing it.
---

Map the impact of changing the symbol the user names.

1. Find its definition and every reference (imports, calls, type uses, tests).
2. For each caller, note whether the change would break it.
