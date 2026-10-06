import type { Invoice } from "../api/invoices.js";
import { formatCents } from "../lib/money.js";

export function InvoiceList({ invoices }: { invoices: Invoice[] }) {
  return (
    <ul>
      {invoices.map(i => <li key={i.id}>{i.id}: {formatCents(i.totalCents)} ({i.status})</li>)}
    </ul>
  );
}
