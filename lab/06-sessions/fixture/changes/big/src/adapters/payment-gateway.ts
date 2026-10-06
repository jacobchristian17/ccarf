// Card processor client. No retries here any more: the event worker is re-driven by the queue.
export async function refundCharge(chargeId: string, amount: number): Promise<void> {
  await fetch("https://processor.test/refunds", { method: "POST", body: JSON.stringify({ chargeId, amountCents: Math.round(amount * 100) }) });
}
