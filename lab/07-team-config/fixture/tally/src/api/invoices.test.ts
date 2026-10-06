import { expect, test } from "vitest";
import { createInvoice, getInvoice } from "./invoices.js";

test("creates a draft invoice", () => {
  createInvoice("inv_1", "cus_1", "19.99");
  expect(getInvoice("inv_1").totalCents).toBe(1999);
});
