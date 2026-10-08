// Lesson 10: the extraction pipeline. Each document goes through your tools (schema.ts), tool_choice
// (tool-choice.ts) and system prompt (prompt.md); Zod checks the shape, validate.ts checks the meaning, and
// retry.ts decides whether to ask again and builds the follow-up. Results are scored against fixture/truth.json.
// Run:  npm run l10:ask -- <command>
//   extract      one attempt per document, no retry: field accuracy, fabrications, validation issues
//   retry        the full validate-retry loop: what retries fixed, what went to the human queue
//   choice       tool_choice auto vs yours on the 4 most ambiguous documents: who answered in prose?
//   dismissals   your dismissal report over fixture/dismissals.json (no model)
// Env:  SOLUTION=1 (solution/extract) · EXAMPLES=0 (strip the <example> blocks) · PROMPT=bare (one-line prompt) · RETRY_ALL=1 (also retry
//       non-retryable issues) · DOCS=d01,d05 (subset) · L10_MODEL=claude-haiku-4-5 · BACKEND=mock|claude-cli|api
import type Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "../shared/client.js";
import { green, red } from "../shared/colors.js";
import { createMockClient } from "./mock.js";
import { toTools, type ToolSpec } from "./tools.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, process.env.SOLUTION ? "solution/extract" : "extract");
const MODEL = process.env.L10_MODEL ?? "claude-haiku-4-5";
const [cmd = "extract"] = process.argv.slice(2);
const load = async (f: string) => import(pathToFileURL(join(SRC, f)).href);

const { InvoiceSchema, CreditNoteSchema, EXTRACTION_TOOLS } = await load("schema.ts");
const { toolChoice } = await load("tool-choice.ts");
const { validateInvoice, validateCreditNote } = await load("validate.ts");
const { shouldRetry, buildRetryMessages } = await load("retry.ts");
const TRUTH = JSON.parse(readFileSync(join(HERE, "fixture/truth.json"), "utf8"));

const backend = process.env.BACKEND ?? (process.env.ANTHROPIC_API_KEY ? "api" : "mock");
const client: Anthropic = backend === "mock" ? createMockClient() : createClient();
if (backend === "mock") console.log("[backend] mock: scripted replay of truth.json with planted faults, not a real model.");

let system = readFileSync(join(SRC, "prompt.md"), "utf8").replace(/<!--[\s\S]*?-->\s*/g, "").trim();
if (process.env.PROMPT === "bare") system = "Extract the data from the document."; // the starter's one-liner, with your schema
if (process.env.EXAMPLES === "0") system = system.replace(/#+\s*Examples[\s\S]*$/i, "").replace(/<example>[\s\S]*?<\/example>\s*/g, "").trim();
const tools = toTools(EXTRACTION_TOOLS as readonly ToolSpec[]);
const schemaFor: Record<string, any> = { extract_invoice: InvoiceSchema, extract_credit_note: CreditNoteSchema };
const semanticFor: Record<string, (x: any) => Issue[]> = { extract_invoice: validateInvoice, extract_credit_note: validateCreditNote };

type Issue = { rule: string; field: string; message: string; retryable: boolean };
const allDocs = readdirSync(join(HERE, "docs")).filter(f => f.endsWith(".txt")).map(f => f.replace(".txt", "")).sort();
const docs = process.env.DOCS ? process.env.DOCS.split(",") : allDocs;
const firstTurn = (id: string): Anthropic.MessageParam => ({ role: "user",
  content: `<document id="${id}">\n${readFileSync(join(HERE, "docs", id + ".txt"), "utf8").trim()}\n</document>\n\nRecord this document with one extraction tool.` });

async function call(messages: Anthropic.MessageParam[], choice: Anthropic.ToolChoice) {
  return client.messages.create({ model: MODEL, max_tokens: 2048, system, tools, tool_choice: choice, messages });
}

/** Zod first (shape), then your semantic checks (meaning). Zod errors are always worth one retry. */
function check(tu: Anthropic.ToolUseBlock): { issues: Issue[]; value: unknown } {
  const schema = schemaFor[tu.name];
  if (!schema) return { issues: [{ rule: "tool", field: "-", message: `unknown tool ${tu.name}`, retryable: true }], value: tu.input };
  const parsed = schema.safeParse(tu.input);
  if (!parsed.success)
    return { value: tu.input, issues: parsed.error.issues.map((i: any) => ({ rule: "schema", field: i.path.join(".") || "-", message: i.message, retryable: true })) };
  return { value: parsed.data, issues: semanticFor[tu.name]?.(parsed.data) ?? [] };
}

// ── Scoring against truth.json ────────────────────────────────────────────────
const SCORED: Record<string, string[]> = {
  extract_invoice: ["document_type", "invoice_number", "invoice_date", "due_date", "currency", "po_number", "payment_terms",
    "tax_cents", "stated_total_cents", "calculated_total_cents", "conflict_detected", "line_items"],
  extract_credit_note: ["credit_note_number", "credit_date", "original_invoice_number", "currency", "amount_cents", "reason"],
};
function score(id: string, tool: string | null, value: any) {
  const t = TRUTH[id];
  const fields = SCORED[t.tool];
  if (tool !== t.tool || !value || typeof value !== "object") return { right: 0, of: fields.length, wrong: fields, fabricated: [] as string[] };
  const wrong: string[] = [], fabricated: string[] = [];
  for (const f of fields) {
    const got = f === "line_items" ? (Array.isArray(value[f]) ? value[f].length : undefined) : value[f];
    const want = f === "line_items" ? t.expect[f].length : t.expect[f];
    const ok = [want, ...(t.accept?.[f] ?? [])].some(w => JSON.stringify(w) === JSON.stringify(got));
    if (!ok) wrong.push(f);
    if (t.absent.includes(f) && got !== null && got !== undefined && !(t.accept?.[f] ?? []).includes(got)) fabricated.push(`${f}=${JSON.stringify(got)}`);
  }
  return { right: fields.length - wrong.length, of: fields.length, wrong, fabricated };
}

type Result = { id: string; tool: string | null; attempts: number; outcome: string; issuesFirst: Issue[]; issuesLast: Issue[];
  score: ReturnType<typeof score>; value: unknown; ms: number; error?: string };

async function runDoc(id: string, mode: "extract" | "retry", choice: Anthropic.ToolChoice): Promise<Result> {
  const start = Date.now();
  const first = firstTurn(id);
  try {
    let res = await call([first], choice);
    let tu = res.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
    if (!tu) {
      const said = res.content.filter(b => b.type === "text").map(b => (b as Anthropic.TextBlock).text).join(" ");
      return { id, tool: null, attempts: 1, outcome: `prose reply: "${said.slice(0, 70)}"`, issuesFirst: [], issuesLast: [], score: score(id, null, null), value: null, ms: Date.now() - start };
    }
    let { issues, value } = check(tu);
    const issuesFirst = issues;
    let attempts = 1;
    const retryNow = (iss: Issue[]) => process.env.RETRY_ALL ? attempts < 2 && iss.length > 0 : shouldRetry(iss, attempts);
    while (mode === "retry" && retryNow(issues)) {
      res = await call(buildRetryMessages(first, tu, issues), choice);
      attempts++;
      const next = res.content.find(b => b.type === "tool_use") as Anthropic.ToolUseBlock | undefined;
      if (!next) break;
      tu = next;
      ({ issues, value } = check(tu));
    }
    const outcome = issues.length === 0 ? "accepted" : issues.some(i => !i.retryable) ? "human queue" : mode === "retry" ? "failed" : "has issues";
    return { id, tool: tu.name, attempts, outcome, issuesFirst, issuesLast: issues, score: score(id, tu.name, value), value, ms: Date.now() - start };
  } catch (e) {
    return { id, tool: null, attempts: 0, outcome: "error", issuesFirst: [], issuesLast: [], score: score(id, null, null), value: null, ms: Date.now() - start, error: String(e).slice(0, 200) };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

function report(results: Result[], mode: string) {
  let right = 0, of = 0, fab = 0;
  for (const r of results) {
    right += r.score.right; of += r.score.of; fab += r.score.fabricated.length;
    const color = r.outcome === "accepted" ? green : r.outcome === "human queue" ? (s: string) => s : red;
    console.log(`\n${r.id}  ${(r.tool ?? "-").padEnd(19)} ${r.score.right}/${r.score.of} fields  ${color(r.outcome)}` +
      (mode === "retry" ? `  (${r.attempts} call${r.attempts === 1 ? "" : "s"})` : "") + `  ${(r.ms / 1000).toFixed(1)}s`);
    if (r.error) console.log(red(`    error: ${r.error}`));
    if (r.score.wrong.length && r.tool) console.log(`    wrong: ${r.score.wrong.join(", ")}`);
    if (r.score.fabricated.length) console.log(red(`    FABRICATED: ${r.score.fabricated.join(", ")}`));
    const shown = mode === "retry" ? r.issuesFirst : r.issuesLast;
    for (const i of shown) console.log(`    ${i.retryable ? "issue" : "issue (not retryable)"} [${i.rule}] ${i.field}: ${i.message.slice(0, 140)}`);
    if (mode === "retry" && r.attempts > 1) console.log(`    after retry: ${r.issuesLast.length ? r.issuesLast.map(i => `[${i.rule}] ${i.field}`).join(", ") : "clean"}`);
  }
  const by = (o: string) => results.filter(r => r.outcome === o).length;
  console.log(`\n══ ${mode}: ${right}/${of} fields right · ${fab} fabricated · accepted ${by("accepted")} · human queue ${by("human queue")}` +
    ` · ${mode === "retry" ? `failed ${by("failed")} · model calls ${results.reduce((s, r) => s + r.attempts, 0)}` : `with issues ${by("has issues")}`}` +
    ` · prose replies ${results.filter(r => r.outcome.startsWith("prose")).length}`);
  mkdirSync(join(HERE, ".work"), { recursive: true });
  const file = join(HERE, ".work", `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify({ mode, model: MODEL, backend, src: SRC, examples: process.env.EXAMPLES !== "0", results }, null, 2));
  console.log(`   saved .work/${file.split(/[\\/]/).pop()}`);
}

console.log(`[l10] ${cmd} · ${backend} · ${MODEL} · ${SRC.endsWith("solution\\extract") || SRC.endsWith("solution/extract") ? "solution/extract" : "extract"}` +
  ` · tool_choice ${JSON.stringify(toolChoice)}${process.env.EXAMPLES === "0" ? " · no examples" : ""}${process.env.PROMPT === "bare" ? " · bare prompt" : ""}`);
if (cmd === "extract" || cmd === "retry") {
  report(await pool(docs, 4, id => runDoc(id, cmd, toolChoice)), cmd);
} else if (cmd === "choice") {
  const ids = process.env.DOCS ? docs : ["d02", "d06", "d07", "d08"];
  for (const choice of [{ type: "auto" } as Anthropic.ToolChoice, toolChoice]) {
    console.log(`\n── tool_choice ${JSON.stringify(choice)}`);
    const rs = await pool(ids, 4, id => runDoc(id, "extract", choice));
    for (const r of rs) console.log(`  ${r.id}  ${r.tool ?? red("no tool call")}  ${r.tool ? (r.tool === TRUTH[r.id].tool ? green("right schema") : red("wrong schema")) : r.outcome}`);
  }
} else if (cmd === "dismissals") {
  const { dismissalReport, patternsToSuppress } = await load("dismissals.ts");
  const rows = dismissalReport(JSON.parse(readFileSync(join(HERE, "fixture/dismissals.json"), "utf8")));
  console.log("\npattern                   posted  dismissed  rate");
  for (const r of rows) console.log(`${r.pattern.padEnd(26)}${String(r.posted).padStart(6)}${String(r.dismissed).padStart(11)}  ${(r.rate * 100).toFixed(0).padStart(3)}%`);
  console.log(`\nsuppress while you rewrite their criteria: ${patternsToSuppress(rows).join(", ") || "(none)"}`);
} else {
  console.log(red(`Unknown command "${cmd}". Use extract | retry | choice | dismissals.`));
}
