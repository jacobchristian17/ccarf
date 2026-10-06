import { toCents } from "../lib/money.js";

export type Invoice = { id: string; customerId: string; totalCents: number; status: "draft" | "sent" | "paid" };

const invoices = new Map<string, Invoice>();

export function createInvoice(id: string, customerId: string, total: string): Invoice {
  const inv: Invoice = { id, customerId, totalCents: toCents(total), status: "draft" };
  invoices.set(id, inv);
  return inv;
}

export function getInvoice(id: string): Invoice {
  const inv = invoices.get(id);
  if (!inv) throw new Error("not found");
  return inv;
}
