// Append-only ledger of money movements. The settlement job reads these entries every night.
export type LedgerEntry = { id: string; orderId: string; amountCents: number; kind: "credit" | "debit"; at: string };
export const entries: LedgerEntry[] = [];

// NOTE: not idempotent. Calling it twice for the same refund posts two credits.
export function postCredit(orderId: string, amount: number): string {
  const entry: LedgerEntry = { id: `L-${entries.length + 1}`, orderId, amountCents: Math.round(amount * 100), kind: "credit", at: new Date().toISOString() };
  entries.push(entry);
  return entry.id;
}
