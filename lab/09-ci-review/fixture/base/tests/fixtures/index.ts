import type { Invoice } from "../../src/invoices.js";

// Test fixtures. Use these instead of hand-building objects in each test.
export function makeInvoice(over: Partial<Invoice> = {}): Invoice {
  return { id: "inv_1", customerId: "cus_1", lines: [{ description: "Plan", unitCents: 1999, quantity: 1 }],
    paidCents: 1999, refundedCents: 0, status: "paid", ...over };
}

// A clock frozen at 2026-03-15T12:00:00Z. Pass it wherever code takes `now`.
export const fixedClock = () => new Date("2026-03-15T12:00:00Z");
