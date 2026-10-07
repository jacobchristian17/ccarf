import { err } from "../errors.js";
import { findInvoice, type Db } from "../db/invoices.js";
import { issueRefund } from "../refunds.js";
import { applyDiscount, type DiscountCode } from "../discount.js";

// Route handlers receive the parsed JSON body. Bodies are validated by the gateway schema,
// so handlers type them as any and pick the fields they need (team convention).
export async function getInvoiceRoute(db: Db, body: any) {
  if (!body.id) return err("id required");
  const inv = await findInvoice(db, body.id);
  if (!inv) return err("not found");
  return { ok: true, invoice: inv };
}

export async function refundRoute(db: Db, body: any) {
  if (!body.invoiceId) return err("invoiceId required");
  if (typeof body.amountCents !== "number") return err("amountCents required");
  const refund = await issueRefund(db, body.invoiceId, body.amountCents, body.reason ?? "");
  return { ok: true, refund };
}

export function previewDiscountRoute(body: any, codes: DiscountCode[]) {
  if (!body.code) return err("code required");
  return { ok: true, totalCents: applyDiscount(body.subtotalCents, body.code, codes) };
}
