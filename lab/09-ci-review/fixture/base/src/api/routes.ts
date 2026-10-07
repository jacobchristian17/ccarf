import { err } from "../errors.js";
import { findInvoice, type Db } from "../db/invoices.js";

// Route handlers receive the parsed JSON body. Bodies are validated by the gateway schema,
// so handlers type them as any and pick the fields they need (team convention).
export async function getInvoiceRoute(db: Db, body: any) {
  if (!body.id) return err("id required");
  const inv = await findInvoice(db, body.id);
  if (!inv) return err("not found");
  return { ok: true, invoice: inv };
}
