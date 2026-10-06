// Thin client for the card processor. Retries transient failures up to 2 times.
export class GatewayError extends Error { constructor(public transient: boolean, msg: string) { super(msg); } }

export async function refundCharge(chargeId: string, amount: number, attempt = 1): Promise<void> {
  try {
    await callProcessor({ op: "refund", chargeId, amountCents: Math.round(amount * 100) });
  } catch (e) {
    if (e instanceof GatewayError && e.transient && attempt < 3) return refundCharge(chargeId, amount, attempt + 1);
    throw e;
  }
}

async function callProcessor(_req: { op: string; chargeId: string; amountCents: number }): Promise<void> { /* network call */ }
