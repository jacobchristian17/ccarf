// Reference solution, TODO 1: the extraction schemas (4.3).
// Every field is REQUIRED, and a field the source may not contain is NULLABLE. That way the model must
// say "absent" out loud with null, instead of either omitting the key (Lesson 9: optional fields get
// dropped) or inventing a value to fill a required string.
import { z } from "zod";

const isoDate = z.string().describe("YYYY-MM-DD");
const cents = z.number().int().describe("Integer cents: $1,250.00 → 125000");

export const InvoiceSchema = z.object({
  document_type: z.enum(["invoice", "receipt", "other"])
    .describe("invoice = a request for payment; receipt = proof of a payment already made; other = anything else (fill document_type_detail)"),
  document_type_detail: z.string().nullable()
    .describe("Required when document_type is other, e.g. 'quotation', 'purchase order'. Otherwise null."),
  vendor_name: z.string().describe("The supplier's name exactly as printed"),
  invoice_number: z.string().nullable().describe("The document's own number. null if none is printed."),
  invoice_date: isoDate.nullable().describe("Issue date, YYYY-MM-DD. null if no date is printed."),
  due_date: isoDate.nullable()
    .describe("Only a due date PRINTED on the document, YYYY-MM-DD. Never compute it from the payment terms. null otherwise."),
  currency: z.string().nullable().describe("ISO 4217 code (USD, EUR, GBP). $ alone means USD, € means EUR."),
  po_number: z.string().nullable()
    .describe("Our purchase-order number as printed (e.g. PO-7781). null if the document only refers to a PO without giving its number."),
  payment_terms: z.enum(["net_15", "net_30", "net_60", "due_on_receipt", "unclear", "other"]).nullable()
    .describe("unclear = terms are mentioned but don't say when ('as agreed'); other = clear terms that fit no value (fill payment_terms_detail); null = no terms mentioned"),
  payment_terms_detail: z.string().nullable().describe("The printed wording when payment_terms is other or unclear. Otherwise null."),
  line_items: z.array(z.object({
    description: z.string(),
    quantity: z.number().nullable().describe("null when the line prints no quantity"),
    unit_price_cents: cents.nullable().describe("null when the line prints no unit price"),
    amount_cents: cents.describe("The line amount as printed"),
  })),
  tax_cents: cents.nullable().describe("Tax as its own printed amount. null if no tax amount is printed."),
  stated_total_cents: cents.nullable().describe("The total AS PRINTED on the document. null if none is printed."),
  calculated_total_cents: cents.describe("YOUR arithmetic: sum of line_items.amount_cents + (tax_cents or 0)"),
  conflict_detected: z.boolean().describe("true when stated_total_cents and calculated_total_cents differ"),
  conflict_detail: z.string().nullable().describe("What disagrees, when conflict_detected is true. Otherwise null."),
});

export const CreditNoteSchema = z.object({
  vendor_name: z.string(),
  credit_note_number: z.string().nullable(),
  credit_date: isoDate.nullable(),
  original_invoice_number: z.string().nullable().describe("The invoice this credit refers to, if printed"),
  currency: z.string().nullable().describe("ISO 4217 code"),
  amount_cents: cents.describe("The credit amount as a positive number of cents"),
  reason: z.enum(["damaged_goods", "returned_goods", "pricing_error", "unclear", "other"]),
  reason_detail: z.string().nullable().describe("Required when reason is other. Otherwise null."),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type CreditNote = z.infer<typeof CreditNoteSchema>;

export const EXTRACTION_TOOLS = [
  {
    name: "extract_invoice",
    description:
      "Record the fields of a supplier invoice, receipt, or any other priced document (quotation, purchase order) " +
      "that is NOT a credit. Use null for every field the document does not contain; never guess a value. " +
      "Use extract_credit_note instead when the document reduces what we owe (credit memo, credit note).",
    schema: InvoiceSchema,
  },
  {
    name: "extract_credit_note",
    description:
      "Record a supplier credit memo or credit note: a document that reduces what we owe, usually referring to an " +
      "earlier invoice. Use null for every field the document does not contain. For invoices, receipts and " +
      "quotations use extract_invoice.",
    schema: CreditNoteSchema,
  },
] as const;
