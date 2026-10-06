// Heuristic fraud score in [0, 1]. Anything at or above FRAUD_THRESHOLD goes to manual review.
import type { Order } from "../repos/order-repo.js";

export const FRAUD_THRESHOLD = 0.8;

export function scoreRefund(order: Order, amount: number, reason: string): number {
  let score = 0;
  if (amount === order.total) score += 0.3;
  if (order.priorRefunds >= 2) score += 0.4;
  if (/not received/i.test(reason) && order.status === "delivered") score += 0.3;
  return Math.min(score, 1);
}
