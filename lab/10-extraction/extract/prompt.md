<!-- TODO 5 (4.3, 4.2): the system prompt. HTML comments like this one never reach the model.
Add:
  1. A "## Normalization rules" section: dates → YYYY-MM-DD (European dd.mm.yyyy too), money → integer cents
     (including "1.250,00 €"), currency → ISO 4217, payment-terms wording → the enum values, and when to use
     unclear / other / null.
  2. Rules against filling gaps: absent → null; don't compute due_date from the terms; stated_total_cents is what
     is PRINTED, calculated_total_cents is your own sum; on a mismatch, set conflict_detected and change neither.
  3. A "## Examples" section with 2–4 <example> blocks from documents with VARIED structure (a table, a
     narrative letter, a non-invoice...). Each shows the document, a <reasoning> line and the tool call.
     Don't copy the lab's own documents or vendors. EXAMPLES=0 strips this section, for comparison runs.
-->
Extract the data from the document.
