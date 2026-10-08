// TODO 1 (4.3): the extraction schemas. The runner turns them into the two tools the model can call.
// This starter "works", and that's the problem. Every field is a required, non-null string, so a document
// that has no PO number or no due date still has to produce one. Rewrite it so that:
//   - every field stays REQUIRED, and a field the source may not contain is NULLABLE (.nullable(), not .optional():
//     an optional key can silently go missing, as the status field did in Lesson 9)
//   - document_type and payment_terms are enums. document_type: invoice | receipt | other, plus a nullable
//     document_type_detail. payment_terms: net_15 | net_30 | net_60 | due_on_receipt | unclear | other, nullable,
//     plus a nullable payment_terms_detail. The credit note's reason: damaged_goods | returned_goods |
//     pricing_error | unclear | other, plus a nullable reason_detail.
//   - money is integer cents (z.number().int()): line amount_cents, nullable quantity and unit_price_cents,
//     nullable tax_cents, nullable stated_total_cents (as PRINTED), required calculated_total_cents (the model's
//     own sum), conflict_detected boolean, nullable conflict_detail.
//   - .describe() carries the per-field rules the model needs (format, when to use null).
//   - each tool's description says when to use it and when to use the other one.
// Keep the export names: InvoiceSchema, CreditNoteSchema, EXTRACTION_TOOLS, Invoice, CreditNote.
// The grader lists the exact field names it expects: npm run l10:check
import { z } from "zod";

export const InvoiceSchema = z.object({
  document_type: z.string(),
  vendor_name: z.string(),
  invoice_number: z.string(),
  invoice_date: z.string(),
  due_date: z.string(),
  currency: z.string(),
  po_number: z.string(),
  payment_terms: z.string(),
  line_items: z.array(z.object({ description: z.string(), amount: z.number() })),
  total: z.number(),
});

export const CreditNoteSchema = z.object({
  vendor_name: z.string(),
  credit_note_number: z.string(),
  amount: z.number(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type CreditNote = z.infer<typeof CreditNoteSchema>;

export const EXTRACTION_TOOLS = [
  { name: "extract_invoice", description: "Extract invoice data.", schema: InvoiceSchema },
  { name: "extract_credit_note", description: "Extract credit note data.", schema: CreditNoteSchema },
] as const;
