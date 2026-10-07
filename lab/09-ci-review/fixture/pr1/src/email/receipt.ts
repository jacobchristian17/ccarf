import { getInvoiceTotal, type Invoice } from "../invoices.js";
import { formatDollars } from "../money.js";

export function receiptEmail(inv: Invoice, customerName: string): string {
  const total = getInvoiceTotal(inv);
  return [
    `Hello ${customerName},`,
    ``,
    `Thank you for your payment. Invoice ${inv.id} total: ${formatDollars(total)}.`,
    ``,
    `— The tally billing team`,
  ].join("\n");
}
