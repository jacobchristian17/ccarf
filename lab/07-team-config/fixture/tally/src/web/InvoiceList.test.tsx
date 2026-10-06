import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { InvoiceList } from "./InvoiceList.js";

test("shows the formatted total", () => {
  render(<InvoiceList invoices={[{ id: "inv_1", customerId: "c", totalCents: 1999, status: "sent" }]} />);
  expect(screen.getByText(/\$19\.99/)).toBeTruthy();
});
