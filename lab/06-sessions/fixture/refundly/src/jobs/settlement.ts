// Nightly job: sums ledger credits per order and reports them to finance.
// Depends on the LedgerEntry shape (amountCents, kind). A change to ledger.ts breaks this silently.
import { entries } from "../services/ledger.js";

export function settle(): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of entries) if (e.kind === "credit") totals[e.orderId] = (totals[e.orderId] ?? 0) + e.amountCents;
  return totals;
}
