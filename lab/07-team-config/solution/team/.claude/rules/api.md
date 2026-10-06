---
paths:
  - "src/api/**/*"
---

# API handlers
- Throw `ApiError(code, status, message)` from `src/api/errors.ts`, never a bare `Error`.
- `code` is stable SCREAMING_SNAKE, e.g. `INVOICE_NOT_FOUND`. 4xx for caller mistakes, 5xx only for our faults.
- Validate request bodies with Zod at the handler edge.
