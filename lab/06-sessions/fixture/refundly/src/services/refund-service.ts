// Orchestrates a refund: policy → fraud → gateway → ledger.
import { findOrder } from "../repos/order-repo.js";
import { isWithinWindow, AUTO_REFUND_LIMIT } from "./policy.js";
import { scoreRefund, FRAUD_THRESHOLD } from "./fraud-check.js";
import { refundCharge } from "../adapters/payment-gateway.js";
import { postCredit } from "./ledger.js";

export type RefundResult =
  | { kind: "refunded"; ledgerEntryId: string }
  | { kind: "queued_for_review"; reason: string }
  | { kind: "rejected"; reason: string };

export async function requestRefund(orderId: string, amount: number, reason: string): Promise<RefundResult> {
  const order = findOrder(orderId);
  if (!order) return { kind: "rejected", reason: "unknown order" };
  if (amount > order.total) return { kind: "rejected", reason: "amount exceeds order total" };
  if (!isWithinWindow(order.placedAt)) return { kind: "rejected", reason: "outside refund window" };
  if (scoreRefund(order, amount, reason) >= FRAUD_THRESHOLD) return { kind: "queued_for_review", reason: "fraud score" };
  if (amount > AUTO_REFUND_LIMIT) return { kind: "queued_for_review", reason: "above auto-refund limit" };
  await refundCharge(order.chargeId, amount);
  const entryId = postCredit(order.id, amount);
  return { kind: "refunded", ledgerEntryId: entryId };
}
