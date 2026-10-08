// TODO 3 (4.4): semantic validation. By the time these run, Zod has already proved the SHAPE. Your job is the
// MEANING, and for each problem, whether a retry can fix it.
// validateInvoice must catch, with a specific message (the values involved and what was expected):
//   rule "sum"            calculated_total_cents !== sum(line_items.amount_cents) + (tax_cents ?? 0)
//   rule "line-math"      quantity × unit_price_cents !== amount_cents (when both are non-null; round it)
//   rule "conflict-flag"  stated_total_cents differs from calculated_total_cents but conflict_detected is false
//                         (and the reverse: flagged without a difference)
//   rule "date-format"    invoice_date / due_date not YYYY-MM-DD
//   rule "date-order"     due_date before invoice_date
//   rule "other-detail"   document_type "other" without document_type_detail; payment_terms "other"/"unclear"
//                         without payment_terms_detail
//   rule "po-required"    document_type "invoice", total >= 500000 cents, po_number null. A business rule.
//                         Is it retryable? Think about WHY po_number would be null.
// validateCreditNote: amount_cents > 0 ("credit-sign"), credit_date format ("date-format"), reason "other"
// without reason_detail ("other-detail").
// The Invoice type comes from YOUR schema.ts, so finish TODO 1 first.
import type { CreditNote, Invoice } from "./schema.js";

export type Issue = {
  rule: string;          // e.g. "sum", "po-required"
  field: string;         // the field to fix, e.g. "calculated_total_cents"
  message: string;       // specific: the values involved and the expected value
  retryable: boolean;    // false = the information is not in the source
};

export function validateInvoice(_x: Invoice): Issue[] {
  return [];
}

export function validateCreditNote(_x: CreditNote): Issue[] {
  return [];
}
