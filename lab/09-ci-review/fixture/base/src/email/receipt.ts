import { getInvoiceTotal, type Invoice } from "../invoices.js";
import { formatDollars } from "../money.js";

export function receiptEmail(inv: Invoice, customerName: string): string {
  const total = getInvoiceTotal(inv);
  return [
    `Hi ${customerName},`,
    ``,
    `Thanks for your payment. Invoice ${inv.id} total: ${formatDollars(total)}.`,
    ``,
    `— The tally team`,
  ].join("\n");
}
