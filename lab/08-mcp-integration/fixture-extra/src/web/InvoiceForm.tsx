import { parseAmount, formatCents } from "../lib/index.js";

export function InvoiceForm({ onSubmit }: { onSubmit: (cents: number) => void }) {
  let value = "";
  return (
    <form onSubmit={() => onSubmit(parseAmount(value))}>
      <input onChange={e => (value = e.target.value)} placeholder={formatCents(0)} />
    </form>
  );
}
