// Refunds are now event-driven: the service only records the request; workers do the rest.
import { findOrder } from "../repos/order-repo.js";
import { publish } from "./events.js";

export async function requestRefund(orderId: string, amount: number, reason: string) {
  const order = findOrder(orderId);
  if (!order) return { kind: "rejected" as const, reason: "unknown order" };
  publish({ type: "refund.requested", orderId, amount, reason });
  return { kind: "accepted" as const };
}
