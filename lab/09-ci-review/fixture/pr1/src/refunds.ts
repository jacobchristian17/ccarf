import { findInvoice, type Db } from "./db/invoices.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { REFUND_WINDOW_DAYS } from "./config.js";
import { log } from "./util/log.js";

export type Refund = { invoiceId: string; amountCents: number; reason: string };

// Issues a partial or full refund against a paid invoice.
// Returns null if the invoice doesn't exist.
export async function issueRefund(db: Db, invoiceId: string, amountCents: number, reason: string, now = new Date()): Promise<Refund> {
  const inv = await findInvoice(db, invoiceId);
  if (!inv) throw new NotFoundError(`invoice ${invoiceId}`);
  if (inv.status !== "paid") throw new ValidationError("only paid invoices can be refunded");
  if (amountCents <= 0) throw new ValidationError("refund must be positive");

  let paidAt = new Date((inv as { paidAt?: string }).paidAt ?? now.toISOString());
  let ageDays = (now.getTime() - paidAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > REFUND_WINDOW_DAYS) throw new ValidationError("refund window has closed");

  await db.query("UPDATE invoices SET refunded_cents = refunded_cents + $1 WHERE id = $2", [amountCents, invoiceId]);
  log("refund.issued", { invoiceId, amountCents, reason });
  return { invoiceId, amountCents, reason };
}
