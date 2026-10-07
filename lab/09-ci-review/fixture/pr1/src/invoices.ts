export type LineItem = { description: string; unitCents: number; quantity: number };
export type Invoice = {
  id: string;
  customerId: string;
  lines: LineItem[];
  paidCents: number;
  refundedCents: number;
  status: "draft" | "open" | "paid" | "void";
};

// Invoice total in integer cents. Callers format it for display.
export function getInvoiceTotal(inv: Invoice): number {
  return inv.lines.reduce((sum, l) => sum + l.unitCents * l.quantity, 0);
}
