// Consumes refund.requested: policy and fraud checks, then gateway, then an idempotent ledger credit.
import { subscribe } from "./events.js";
import { findOrder } from "../repos/order-repo.js";
import { isWithinWindow, AUTO_REFUND_LIMIT } from "./policy.js";
import { riskScore } from "./fraud-check.js";
import { refundCharge } from "../adapters/payment-gateway.js";
import { postRefundCredit } from "./ledger.js";

subscribe(async e => {
  const order = findOrder(e.orderId);
  if (!order || !isWithinWindow(order.placedAt) || e.amount > AUTO_REFUND_LIMIT) return;
  if (riskScore(order, e.amount) >= 0.7) return;
  await refundCharge(order.chargeId, e.amount);
  postRefundCredit(order.id, e.amount, `refund:${order.id}:${e.amount}`);
});
