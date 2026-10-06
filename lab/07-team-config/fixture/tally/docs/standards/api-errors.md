# API error standard
- Throw `ApiError(code, status, message)` from `src/api/errors.ts`, never a bare `Error`.
- `code` is a stable SCREAMING_SNAKE string, e.g. `INVOICE_NOT_FOUND`.
- 4xx for caller mistakes, 5xx only for our faults.
