export type LineItem = { description: string; unitCents: number; quantity: number };
export type Invoice = {
  id: string;
  customerId: string;
  lines: LineItem[];
  paidCents: number;
  refundedCents: number;
  status: "draft" | "open" | "paid" | "void";
};

// Invoice total in dollars, for display.
export function getInvoiceTotal(inv: Invoice): number {
  const cents = inv.lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
  return cents / 100;
}
