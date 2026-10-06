// Risk score in [0, 1]. Review threshold lowered to 0.7.
import type { Order } from "../repos/order-repo.js";
export function riskScore(order: Order, amount: number): number {
  return Math.min((amount / order.total) * 0.5 + order.priorRefunds * 0.25, 1);
}
