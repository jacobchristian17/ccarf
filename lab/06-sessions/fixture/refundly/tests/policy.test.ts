// The only test file. Covers the refund window; nothing tests refund-service, ledger or settlement.
import { isWithinWindow } from "../src/services/policy.js";

export const cases = [
  { name: "inside window", ok: isWithinWindow("2026-09-20") === true },
  { name: "outside window", ok: isWithinWindow("2026-07-01") === false },
];
