import { amountToCents } from "./amounts.js";
import { getInvoice } from "./invoices.js";

export function refundCents(invoiceId: string, requested: string): number {
  const inv = getInvoice(invoiceId);
  const cents = amountToCents(requested);
  if (cents > inv.totalCents) throw new Error("refund exceeds invoice total");
  return cents;
}
