import type { Invoice } from "../invoices.js";

export type Db = { query<T>(sql: string, params?: unknown[]): Promise<T[]> };

export async function findInvoice(db: Db, id: string): Promise<Invoice | undefined> {
  const rows = await db.query<Invoice>("SELECT * FROM invoices WHERE id = $1", [id]);
  return rows[0];
}

export async function findInvoicesForCustomer(db: Db, customerId: string): Promise<Invoice[]> {
  return db.query<Invoice>("SELECT * FROM invoices WHERE customer_id = $1 ORDER BY created_at DESC", [customerId]);
}
