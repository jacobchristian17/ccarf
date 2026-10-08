// Lesson 10 grader: your extract/ folder. No model, ~1 s. It converts your Zod schemas to JSON Schema and
// inspects them, unit-tests validate.ts / retry.ts / dismissals.ts against the fixture, and reads prompt.md.
// Run:  npm run l10:check            (extract/)
//       npm run l10:check:solution   (solution/extract/)
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { z } from "zod";
import { green, red } from "../shared/colors.js";
import { validate as protocolCheck } from "../shared/mock-client.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, process.argv[2] === "solution" ? "solution/extract" : "extract");
const TRUTH = JSON.parse(readFileSync(join(HERE, "fixture/truth.json"), "utf8"));
const LOG = JSON.parse(readFileSync(join(HERE, "fixture/dismissals.json"), "utf8"));
const errs: string[] = [];
const load = async (f: string) => { try { return await import(pathToFileURL(join(SRC, f)).href); } catch (e) { errs.push(`${f}: ${String(e).slice(0, 160)}`); return {}; } };
const S = await load("schema.ts"), C = await load("tool-choice.ts"), V = await load("validate.ts"), R = await load("retry.ts"), D = await load("dismissals.ts");

// ── TODO 1: schemas ───────────────────────────────────────────────────────────
type J = { type?: string | string[]; enum?: (string | null)[]; properties?: Record<string, J>; required?: string[]; items?: J; anyOf?: J[] };
const js = (s: unknown): J => { try { return z.toJSONSchema(s as z.ZodType) as J; } catch { return {}; } };
const inv = js(S.InvoiceSchema), cn = js(S.CreditNoteSchema);
const P = inv.properties ?? {}, CP = cn.properties ?? {};
const line = P.line_items?.items ?? {}, LP = line.properties ?? {};
const types = (p?: J): string[] => !p ? [] : p.anyOf ? p.anyOf.flatMap(types) : Array.isArray(p.type) ? p.type : p.type ? [p.type] : p.enum ? [...new Set(p.enum.map(v => (v === null ? "null" : typeof v)))] : [];
const enums = (p?: J): (string | null)[] => !p ? [] : p.anyOf ? p.anyOf.flatMap(enums) : p.enum ?? [];
const nullable = (p?: J) => types(p).includes("null");
const allRequired = (o: J) => !!o.properties && Object.keys(o.properties).every(k => o.required?.includes(k));
const INV_FIELDS = ["document_type", "document_type_detail", "vendor_name", "invoice_number", "invoice_date", "due_date", "currency", "po_number",
  "payment_terms", "payment_terms_detail", "line_items", "tax_cents", "stated_total_cents", "calculated_total_cents", "conflict_detected", "conflict_detail"];
const CN_FIELDS = ["vendor_name", "credit_note_number", "credit_date", "original_invoice_number", "currency", "amount_cents", "reason", "reason_detail"];
const tools: { name: string; description: string }[] = S.EXTRACTION_TOOLS ?? [];
const parses = (schema: any, v: unknown) => { try { return schema.safeParse(v).success; } catch { return false; } };

// ── TODO 3–4: canned extractions ──────────────────────────────────────────────
const E = (id: string, o: Record<string, unknown> = {}) => ({ ...structuredClone(TRUTH[id].expect), ...o });
const run = (fn: string, x: unknown): { rule: string; field: string; message: string; retryable: boolean }[] | null => {
  try { const r = V[fn](x); return Array.isArray(r) ? r : null; } catch { return null; }
};
const vi = (x: unknown) => run("validateInvoice", x), vc = (x: unknown) => run("validateCreditNote", x);
const has = (r: ReturnType<typeof vi>, rule: string, retryable?: boolean) => !!r?.some(i => i.rule === rule && (retryable === undefined || i.retryable === retryable));
const d01lines = E("d01").line_items as any[];
const ISS = [{ rule: "sum", field: "calculated_total_cents", message: "calculated_total_cents is 58600 but lines plus tax make 63288", retryable: true },
  { rule: "date-format", field: "invoice_date", message: "invoice_date \"07.09.2026\" is not YYYY-MM-DD", retryable: true }];
const first = { role: "user", content: '<document id="d10">\n# Stackwise Inc. ...\n</document>\n\nRecord this document with one extraction tool.' };
const failed = { type: "tool_use", id: "toolu_test_1", name: "extract_invoice", input: E("d10", { calculated_total_cents: 58600 }) };
let msgs: any[] | null = null;
try { msgs = R.buildRetryMessages(first, failed, ISS); } catch { msgs = null; }
const last = msgs?.at(-1), lastBlocks = Array.isArray(last?.content) ? last.content : [];
const resultText = (() => { const b = lastBlocks[0]; return !b ? "" : typeof b.content === "string" ? b.content : JSON.stringify(b.content ?? ""); })();
const sr = (iss: unknown[], a: number) => { try { return R.shouldRetry(iss, a); } catch { return undefined; } };

// ── TODO 5: prompt ────────────────────────────────────────────────────────────
const prompt = readFileSync(join(SRC, "prompt.md"), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const examples = prompt.match(/<example>[\s\S]*?<\/example>/g) ?? [];
const exJson = examples.map(b => { const s = b.indexOf("{"), e = b.lastIndexOf("}"); try { return JSON.parse(b.slice(s, e + 1)); } catch { return null; } });
const LAB_VENDORS = /Northwind|Brightside|Atelier Lumen|Ridge IT|Bluewater|Pixel Print|Coastline|Meridian|Stackwise/i;

// ── TODO 6: dismissals ────────────────────────────────────────────────────────
let rows: any[] = [], sup: string[] = [];
try { rows = D.dismissalReport(LOG); sup = D.patternsToSuppress(rows); } catch { /* graded as failures */ }

type Check = [string, () => unknown];
const groups: [string, Check[]][] = [
  ["4.3 · TODO 1: extraction schemas (schema.ts)", [
    ["InvoiceSchema has every expected field", () => INV_FIELDS.every(f => f in P)],
    ["every invoice field is REQUIRED (absent = null, not a missing key)", () => INV_FIELDS.every(f => f in P) && allRequired(inv) && allRequired(line)],
    ["fields the source may lack are nullable: invoice_number, invoice_date, due_date, currency, po_number, tax_cents, stated_total_cents", () =>
      ["invoice_number", "invoice_date", "due_date", "currency", "po_number", "tax_cents", "stated_total_cents"].every(f => nullable(P[f]))],
    ["vendor_name, calculated_total_cents and conflict_detected are NOT nullable", () => P.vendor_name && !nullable(P.vendor_name) && !nullable(P.calculated_total_cents) && types(P.conflict_detected).includes("boolean") && !nullable(P.conflict_detected)],
    ["document_type enum invoice | receipt | other, with a nullable document_type_detail", () => ["invoice", "receipt", "other"].every(v => enums(P.document_type).includes(v)) && nullable(P.document_type_detail)],
    ["payment_terms enum includes unclear and other, is nullable, with payment_terms_detail", () => ["net_30", "due_on_receipt", "unclear", "other"].every(v => enums(P.payment_terms).includes(v)) && nullable(P.payment_terms) && nullable(P.payment_terms_detail)],
    ["money is integer cents (line amount_cents, tax, stated and calculated totals)", () => ["tax_cents", "stated_total_cents", "calculated_total_cents"].every(f => types(P[f]).includes("integer")) && types(LP.amount_cents).includes("integer")],
    ["line items: nullable quantity and unit_price_cents", () => nullable(LP.quantity) && nullable(LP.unit_price_cents) && !nullable(LP.amount_cents)],
    ["CreditNoteSchema: every field required; reason enum with unclear + other; nullable reason_detail", () => CN_FIELDS.every(f => f in CP) && allRequired(cn) && ["unclear", "other"].every(v => enums(CP.reason).includes(v)) && nullable(CP.reason_detail) && types(CP.amount_cents).includes("integer")],
    ["every truth.json record parses under your schemas", () => Object.entries(TRUTH).filter(([k]) => k !== "_about").every(([, t]: any) => parses(t.tool === "extract_invoice" ? S.InvoiceSchema : S.CreditNoteSchema, t.expect))],
    ["each tool description says when to use it AND points to the other tool", () => tools.length === 2 && tools.every(t => t.description.length >= 80 && tools.some(o => o.name !== t.name && t.description.includes(o.name)))],
  ]],
  ["4.3 · TODO 2: tool_choice (tool-choice.ts)", [
    ["guarantees a tool call but lets the model pick the schema", () => C.toolChoice?.type === "any"],
  ]],
  ["4.4 · TODO 3: semantic validation (validate.ts)", [
    ["clean records give no issues (d01, d04 with its conflict flagged, d10 with tax)", () => vi(E("d01"))?.length === 0 && vi(E("d04"))?.length === 0 && vi(E("d10"))?.length === 0],
    ["sum: calculated total ≠ lines + tax, message names both numbers", () => { const r = vi(E("d10", { calculated_total_cents: 58600 })); return has(r, "sum", true) && /58600/.test(r!.find(i => i.rule === "sum")!.message) && /63288/.test(r!.find(i => i.rule === "sum")!.message); }],
    ["line-math: quantity × unit price ≠ amount", () => has(vi(E("d01", { line_items: [{ ...d01lines[0], amount_cents: 42000 }, d01lines[1]], calculated_total_cents: 59800 })), "line-math", true)],
    ["conflict-flag: totals differ but conflict_detected is false (and the reverse)", () => has(vi(E("d04", { conflict_detected: false, conflict_detail: null })), "conflict-flag", true) && has(vi(E("d01", { conflict_detected: true, conflict_detail: "x" })), "conflict-flag")],
    ["date-format and date-order", () => has(vi(E("d03", { invoice_date: "07.09.2026" })), "date-format", true) && has(vi(E("d01", { due_date: "2026-08-01" })), "date-order", true)],
    ["other-detail: \"other\" / \"unclear\" without a detail string", () => has(vi(E("d07", { document_type_detail: null })), "other-detail") && has(vi(E("d09", { payment_terms_detail: null })), "other-detail")],
    ["po-required on d05 ($6,480, no PO) and it is NOT retryable", () => { const r = vi(E("d05")); return r?.length === 1 && has(r, "po-required", false); }],
    ["po-required only applies to invoices of $5,000 or more", () => vi(E("d01", { po_number: null }))?.length === 0 && vi(E("d05", { document_type: "other", document_type_detail: "statement" }))?.length === 0],
    ["credit notes: clean d06 passes; negative amount and bare \"other\" reason fail", () => vc(E("d06"))?.length === 0 && has(vc(E("d06", { amount_cents: -8900 })), "credit-sign") && has(vc(E("d06", { reason: "other", reason_detail: null })), "other-detail")],
  ]],
  ["4.4 · TODO 4: retry with error feedback (retry.ts)", [
    ["shouldRetry: yes for retryable issues on attempt 1; no when clean or out of attempts", () => sr(ISS, 1) === true && sr([], 1) === false && sr(ISS, 2) === false],
    ["shouldRetry: no when any issue is not retryable (absent information)", () => sr([...ISS, { rule: "po-required", field: "po_number", message: "x", retryable: false }], 1) === false],
    ["follow-up = original document turn → failed tool_use → tool_result", () => msgs?.length === 3 && msgs[0] === first && msgs[1].role === "assistant" && JSON.stringify(msgs[1].content).includes("toolu_test_1") && lastBlocks[0]?.type === "tool_result"],
    ["tool_result answers the failed call, with is_error: true", () => lastBlocks[0]?.tool_use_id === "toolu_test_1" && lastBlocks[0]?.is_error === true],
    ["it lists every specific error (field and message)", () => ISS.every(i => resultText.includes(i.field) && resultText.includes(i.message))],
    ["it says to use null rather than invent a value", () => /null/i.test(resultText) && /(invent|guess|fabricat|make up)/i.test(resultText)],
    ["the history passes the Messages API tool_use/tool_result rules", () => { try { if (msgs?.length !== 3) return false; protocolCheck(msgs as any); return true; } catch { return false; } }],
  ]],
  ["4.3 / 4.2 · TODO 5: prompt.md", [
    ["normalization rules: YYYY-MM-DD, integer cents, ISO 4217, terms → enum values", () => /YYYY-MM-DD/.test(prompt) && /cents/i.test(prompt) && /ISO ?4217/i.test(prompt) && /net_30/.test(prompt)],
    ["handles European formats (dd.mm.yyyy dates, 1.250,00 amounts)", () => /\d{2}\.\d{2}\.\d{4}|dd\.mm/i.test(prompt) && /\d\.\d{3},\d{2}/.test(prompt)],
    ["absent → null; don't compute due_date from the terms", () => /\bnull\b/.test(prompt) && /due[_ ]date/i.test(prompt) && /(comput|calculat|deriv|infer)/i.test(prompt)],
    ["stated vs calculated total: flag a mismatch, change neither", () => /stated/i.test(prompt) && /calculated/i.test(prompt) && /conflict_detected/.test(prompt)],
    ["2–4 <example> blocks, each with reasoning", () => examples.length >= 2 && examples.length <= 4 && examples.every(b => /reason|because/i.test(b))],
    ["varied structure: one example is not an invoice (document_type other)", () => exJson.some(j => j?.document_type === "other")],
    ["one example shows a printed-total mismatch flagged with conflict_detected", () => exJson.some(j => j?.conflict_detected === true)],
    ["every example's JSON matches your InvoiceSchema", () => exJson.length >= 2 && exJson.every(j => j && (parses(S.InvoiceSchema, j) || parses(S.CreditNoteSchema, j)))],
    ["examples don't reuse the lab's documents", () => examples.length >= 2 && !examples.some(b => LAB_VENDORS.test(b))],
  ]],
  ["4.4 · TODO 6: dismissal analysis (dismissals.ts)", [
    ["one row per detected_pattern (7) with posted / dismissed / rate", () => rows.length === 7 && rows.every(r => typeof r.rate === "number")],
    ["any-type-in-handler first: 8 posted, 8 dismissed, rate 1", () => rows[0]?.pattern === "any-type-in-handler" && rows[0]?.posted === 8 && rows[0]?.rate === 1],
    ["sorted by rate, ties broken by more posted", () => rows.length > 1 && rows.every((r, i) => i === 0 || rows[i - 1].rate > r.rate || (rows[i - 1].rate === r.rate && rows[i - 1].posted >= r.posted))],
    ["suppress = any-type-in-handler, empty-catch, magic-number (3 findings aren't evidence)", () => JSON.stringify([...sup].sort()) === JSON.stringify(["any-type-in-handler", "empty-catch", "magic-number"])],
  ]],
];

let pass = 0, total = 0;
console.log(`Grading ${relative(HERE, SRC).split("\\").join("/")}/`);
for (const e of errs) console.log(red(`  (failed to import ${e})`));
for (const [title, checks] of groups) {
  console.log(`\n${title}`);
  for (const [name, fn] of checks) {
    total++;
    let ok = false;
    try { ok = !!fn(); } catch { ok = false; }
    if (ok) pass++;
    console.log((ok ? green : red)(`  ${ok ? "✓" : "✗"} ${name}`));
  }
}
console.log((pass === total ? green : red)(`\n══ L10 check: ${pass}/${total}`));
process.exit(0);
