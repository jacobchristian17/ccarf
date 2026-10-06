// Append-only ledger of money movements. The settlement job reads these entries every night.
export type LedgerEntry = { id: string; orderId: string; amountCents: number; kind: "credit" | "debit"; at: string; idempotencyKey: string };
export const entries: LedgerEntry[] = [];

// Idempotent: a second call with the same key returns the existing entry instead of posting again.
export function postRefundCredit(orderId: string, amount: number, idempotencyKey: string): string {
  const existing = entries.find(e => e.idempotencyKey === idempotencyKey);
  if (existing) return existing.id;
  const entry: LedgerEntry = { id: `L-${entries.length + 1}`, orderId, amountCents: Math.round(amount * 100), kind: "credit", at: new Date().toISOString(), idempotencyKey };
  entries.push(entry);
  return entry.id;
}
