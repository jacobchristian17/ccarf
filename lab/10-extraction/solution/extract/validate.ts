// Reference solution, TODO 3: semantic validation (4.4).
// Zod (and strict tool use) only prove the SHAPE. These checks catch values that are well-formed but wrong,
// and say for each issue whether a retry can fix it.
import type { CreditNote, Invoice } from "./schema.js";

export type Issue = {
  rule: string;          // short id, e.g. "sum" or "po-required"
  field: string;         // the field to fix, e.g. "calculated_total_cents"
  message: string;       // specific enough to act on: the values involved, the expected value
  retryable: boolean;    // false = the information is not in the source; a retry can only make it up
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PO_LIMIT_CENTS = 500_000; // business rule: invoices of $5,000 or more must quote our PO number

export function validateInvoice(x: Invoice): Issue[] {
  const issues: Issue[] = [];
  const lineSum = x.line_items.reduce((s, l) => s + l.amount_cents, 0);
  const expected = lineSum + (x.tax_cents ?? 0);

  if (x.calculated_total_cents !== expected)
    issues.push({ rule: "sum", field: "calculated_total_cents", retryable: true,
      message: `calculated_total_cents is ${x.calculated_total_cents}, but the line amounts (${lineSum}) plus tax_cents (${x.tax_cents ?? 0}) make ${expected}.` });

  x.line_items.forEach((l, i) => {
    if (l.quantity !== null && l.unit_price_cents !== null && Math.round(l.quantity * l.unit_price_cents) !== l.amount_cents)
      issues.push({ rule: "line-math", field: `line_items[${i}].amount_cents`, retryable: true,
        message: `line ${i + 1}: quantity ${l.quantity} × unit_price_cents ${l.unit_price_cents} = ${Math.round(l.quantity * l.unit_price_cents)}, but amount_cents is ${l.amount_cents}. Re-read the line.` });
  });

  if (x.stated_total_cents !== null) {
    const differs = x.stated_total_cents !== x.calculated_total_cents;
    if (differs && !x.conflict_detected)
      issues.push({ rule: "conflict-flag", field: "conflict_detected", retryable: true,
        message: `stated_total_cents ${x.stated_total_cents} differs from calculated_total_cents ${x.calculated_total_cents}, so conflict_detected must be true with a conflict_detail. Do not change the stated total to match.` });
    if (!differs && x.conflict_detected)
      issues.push({ rule: "conflict-flag", field: "conflict_detected", retryable: true,
        message: `conflict_detected is true, but stated and calculated totals are both ${x.stated_total_cents}.` });
  }

  for (const f of ["invoice_date", "due_date"] as const)
    if (x[f] !== null && !ISO.test(x[f]!))
      issues.push({ rule: "date-format", field: f, retryable: true, message: `${f} "${x[f]}" is not YYYY-MM-DD.` });
  if (x.invoice_date && x.due_date && ISO.test(x.invoice_date) && ISO.test(x.due_date) && x.due_date < x.invoice_date)
    issues.push({ rule: "date-order", field: "due_date", retryable: true,
      message: `due_date ${x.due_date} is before invoice_date ${x.invoice_date}. Check day/month order.` });

  if (x.currency !== null && !/^[A-Z]{3}$/.test(x.currency))
    issues.push({ rule: "currency-format", field: "currency", retryable: true, message: `currency "${x.currency}" is not an ISO 4217 code such as USD or EUR.` });

  if (x.document_type === "other" && !x.document_type_detail?.trim())
    issues.push({ rule: "other-detail", field: "document_type_detail", retryable: true, message: `document_type is "other", so document_type_detail must say what the document is.` });
  if ((x.payment_terms === "other" || x.payment_terms === "unclear") && !x.payment_terms_detail?.trim())
    issues.push({ rule: "other-detail", field: "payment_terms_detail", retryable: true, message: `payment_terms is "${x.payment_terms}", so payment_terms_detail must quote the printed terms.` });

  // Business rule. If the PO number is null, it is almost always because the document doesn't contain it
  // ("per attached purchase order"). Asking again can't produce it, only invent it: route to a human.
  if (x.document_type === "invoice" && (x.stated_total_cents ?? x.calculated_total_cents) >= PO_LIMIT_CENTS && x.po_number === null)
    issues.push({ rule: "po-required", field: "po_number", retryable: false,
      message: `Invoices of $5,000 or more need our PO number, and none was extracted. The source does not contain it: send to AP for the purchase order.` });

  return issues;
}

export function validateCreditNote(x: CreditNote): Issue[] {
  const issues: Issue[] = [];
  if (x.amount_cents <= 0)
    issues.push({ rule: "credit-sign", field: "amount_cents", retryable: true, message: `amount_cents must be the positive credit amount, got ${x.amount_cents}.` });
  if (x.credit_date !== null && !ISO.test(x.credit_date))
    issues.push({ rule: "date-format", field: "credit_date", retryable: true, message: `credit_date "${x.credit_date}" is not YYYY-MM-DD.` });
  if (x.reason === "other" && !x.reason_detail?.trim())
    issues.push({ rule: "other-detail", field: "reason_detail", retryable: true, message: `reason is "other", so reason_detail must say why.` });
  return issues;
}
