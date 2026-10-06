// HTTP entry point for refund requests.
import { requestRefund } from "../services/refund-service.js";

export async function handleRefundRequest(body: { orderId: string; amount: number; reason: string }) {
  if (!body.orderId || !(body.amount > 0)) return { status: 400, error: "orderId and a positive amount are required" };
  const result = await requestRefund(body.orderId, body.amount, body.reason);
  return { status: result.kind === "rejected" ? 422 : 200, result };
}
