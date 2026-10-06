// HTTP entry point. Returns 202: the refund is processed asynchronously.
import { requestRefund } from "../services/refund-service.js";
export async function handleRefundRequest(body: { orderId: string; amount: number; reason: string }) {
  const result = await requestRefund(body.orderId, body.amount, body.reason);
  return { status: result.kind === "rejected" ? 422 : 202, result };
}
