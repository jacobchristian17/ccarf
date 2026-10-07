// Lesson 9 grader: your review/ folder. No model, ~1 s. It parses the schema, the prompts and the CI workflow,
// and unit-tests your post.ts against canned `claude -p --output-format json` result envelopes.
// Run:  npm run l9:check            (review/)
//       npm run l9:check:solution   (solution/review/)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { green, red } from "../shared/colors.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, process.argv[2] === "solution" ? "solution/review" : "review");
const read = (p: string) => (existsSync(join(SRC, p)) ? readFileSync(join(SRC, p), "utf8") : "");
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->/g, "");

// ── TODO 1: schema + workflow ─────────────────────────────────────────────────
type Prop = { type?: string; enum?: string[]; minimum?: number; maximum?: number; items?: Obj };
type Obj = { type?: string; properties?: Record<string, Prop>; required?: string[] };
let schema: Obj = {};
try { schema = JSON.parse(read("finding.schema.json")); } catch { schema = {}; }
const items = schema.properties?.findings?.items ?? {};
const P = items.properties ?? {};
const req = items.required ?? [];
const yml = read(".github/workflows/claude-review.yml").split("\n").filter(l => !l.trim().startsWith("#")).join("\n");
const claudeLine = yml.match(/claude\s[\s\S]*?(?:\n\s*\n|\n\s*- |$)/)?.[0] ?? "";
const allowed = claudeLine.match(/--allowed-?[tT]ools\s+"([^"]*)"/)?.[1] ?? "";

// ── TODO 2–4, 6: prompts ──────────────────────────────────────────────────────
const crit = strip(read("criteria.md"));
const ex = strip(read("examples.md"));
const exBlocks = ex.match(/<example>[\s\S]*?<\/example>/g) ?? [];
const rr = strip(read("rereview.md"));
const md = strip(read("CLAUDE.md"));
const testing = md.split(/^## /m).find(s => /^Testing/i.test(s)) ?? "";
const sevSection = crit.slice(crit.search(/severity/i));

// ── TODO 5: post.ts against canned envelopes ──────────────────────────────────
const F = (o: object = {}) => ({ file: "src/a.ts", line: 7, severity: "high", category: "bug", issue: "Refund can exceed the paid amount",
  suggested_fix: "Check amountCents <= paidCents - refundedCents", detected_pattern: "missing-money-cap", confidence: 0.8, ...o });
const ENV = (o: object) => JSON.stringify({ type: "result", subtype: "success", is_error: false, session_id: "s", num_turns: 3, result: "", ...o });
let toInline: ((s: string) => { path: string; line: number; side: string; body: string }[]) | undefined;
let importErr = "";
try { toInline = (await import(pathToFileURL(join(SRC, "post.ts")).href)).toInlineComments; } catch (e) { importErr = String(e); }
const call = (s: string) => { try { return { out: toInline!(s), err: "" }; } catch (e) { return { out: null, err: String(e) }; } };
const ok1 = () => call(ENV({ structured_output: { findings: [F(), F({ file: "src/b.ts", line: 3, status: "new" })] } }));

type Check = [string, () => unknown];
const groups: [string, Check[]][] = [
  ["3.6 · TODO 1: a findings schema CI can post from (finding.schema.json)", [
    ["valid JSON with a findings array of objects", () => schema.properties?.findings?.type === "array" && items.type === "object"],
    ["each finding has file and an integer line (where the inline comment goes)", () => P.file?.type === "string" && P.line?.type === "integer"],
    ["severity is an enum (critical/high/medium/low)", () => ["critical", "high", "medium", "low"].every(s => P.severity?.enum?.includes(s))],
    ["category is an enum that includes security and bug", () => ["security", "bug"].every(s => P.category?.enum?.includes(s))],
    ["issue + suggested_fix strings", () => P.issue?.type === "string" && P.suggested_fix?.type === "string"],
    ["detected_pattern string, for dismissal analysis (4.4)", () => P.detected_pattern?.type === "string"],
    ["confidence is a number from 0 to 1 (calibrated routing, 4.6)", () => P.confidence?.type === "number" && P.confidence.minimum === 0 && P.confidence.maximum === 1],
    ["file, line, severity, issue, suggested_fix are required", () => ["file", "line", "severity", "issue", "suggested_fix"].every(r => req.includes(r))],
    ["optional status enum new | still_open (for re-reviews)", () => ["new", "still_open"].every(s => P.status?.enum?.includes(s)) && !req.includes("status")],
  ]],
  ["3.6 · TODO 1b: the CI job (.github/workflows/claude-review.yml)", [
    ["runs claude with -p / --print (no interactive hang)", () => /claude\s+(-p|--print)\b/.test(yml) || /claude\b[^\n]*\s(-p|--print)\b/.test(claudeLine)],
    ["--output-format json", () => /--output-format[ =]json\b/.test(claudeLine)],
    ["--json-schema from review/finding.schema.json", () => /--json-schema/.test(claudeLine) && /finding\.schema\.json/.test(claudeLine)],
    ["--allowedTools is read-only (Read/Grep/Glob, no Bash/Edit/Write)", () => allowed && !/Bash|Edit|Write/.test(allowed) && /Read/.test(allowed)],
    ["runs again when commits are pushed (pull_request: synchronize)", () => /synchronize/.test(yml)],
    ["fetches prior comments for re-reviews", () => /prior|comments/i.test(yml.replace(/pull-requests: write/, ""))],
  ]],
  ["4.1 · TODO 2: explicit criteria (criteria.md)", [
    ["no vague confidence filtering (\"be conservative\", \"high-confidence\")", () => crit.trim() && !/be conservative|high[- ]confidence|only report .*confident/i.test(crit)],
    ["no catch-all \"anything that could be improved\"", () => crit.trim() && !/anything that could be improved/i.test(crit)],
    ["names what to REPORT: security and bugs", () => /report/i.test(crit) && /security/i.test(crit) && /\bbugs?\b/i.test(crit)],
    ["names what to SKIP: style and local conventions", () => /(do not|don't|skip|never) report/i.test(crit) && /style/i.test(crit) && /convention/i.test(crit)],
    ["comment criterion: only when the claim contradicts the code", () => /comment/i.test(crit) && /contradict/i.test(crit)],
    ["cross-file callers of changed exports are in scope", () => /caller/i.test(crit)],
    ["at least 3 severity levels, each with a code example", () => ["critical", "high", "medium"].every(s => new RegExp(s, "i").test(sevSection)) && (sevSection.match(/`[^`\n]{8,}/g) ?? []).length >= 3],
  ]],
  ["4.2 · TODO 3: few-shot examples (examples.md)", [
    ["2–4 <example> blocks", () => exBlocks.length >= 2 && exBlocks.length <= 4],
    ["every example explains its reasoning", () => exBlocks.length >= 2 && exBlocks.every(b => /reason|because|rather than|instead of|why/i.test(b))],
    ["at least one acceptable pattern with NO finding", () => exBlocks.some(b => /no finding|not a finding|\(none\)|"findings":\s*\[\]/i.test(b))],
    ["reported examples show the output fields (file, line, severity, suggested_fix, detected_pattern)", () => exBlocks.filter(b => /suggested_fix/.test(b)).length >= 1 && exBlocks.filter(b => /suggested_fix/.test(b)).every(b => ["\"file\"", "\"line\"", "\"severity\"", "detected_pattern"].every(k => b.includes(k)))],
    ["examples don't reuse this PR's code (refunds/discount/receipt)", () => exBlocks.length >= 2 && !/issueRefund|applyDiscount|receiptEmail|searchInvoices/.test(ex)],
  ]],
  ["3.6 · TODO 4: re-review prompt (rereview.md)", [
    ["includes {{PRIOR_FINDINGS}}", () => rr.includes("{{PRIOR_FINDINGS}}")],
    ["includes {{DIFF}} and {{NEW_COMMITS}}", () => rr.includes("{{DIFF}}") && rr.includes("{{NEW_COMMITS}}")],
    ["reports only new or still-unaddressed issues", () => /(only|just)[^.]*\bnew\b/i.test(rr) || (/still[_ ]open|still present|unaddressed/i.test(rr) && /\bnew\b/i.test(rr))],
    ["fixed issues are not reported again", () => /fixed|resolved|addressed/i.test(rr) && /(do not|don't|never|not) (report|repeat|restate)/i.test(rr)],
    ["asks for status new / still_open", () => /still_open/.test(rr) && /"?new"?/.test(rr)],
  ]],
  ["3.6 · TODO 5: post.ts turns the CLI envelope into inline comments", [
    ["imports and exports toInlineComments", () => !importErr && typeof toInline === "function"],
    ["2 findings → 2 comments with path, line, side RIGHT", () => { const r = ok1().out; return r?.length === 2 && r[0].path === "src/a.ts" && r[0].line === 7 && r[0].side === "RIGHT" && r[1].path === "src/b.ts"; }],
    ["body has severity, issue and suggested fix", () => { const b = ok1().out?.[0]?.body ?? ""; return /high/.test(b) && /exceed the paid/.test(b) && /amountCents <= paidCents/.test(b); }],
    ["body hides <!-- detected_pattern: … --> for dismissal analysis", () => /<!--\s*detected_pattern:\s*missing-money-cap\s*-->/.test(ok1().out?.[0]?.body ?? "")],
    ["still_open findings are not posted again", () => call(ENV({ structured_output: { findings: [F({ status: "still_open" }), F({ status: "new" })] } })).out?.length === 1],
    ["throws when is_error is true", () => !!call(ENV({ is_error: true, subtype: "success", result: "Not logged in" })).err],
    ["throws on subtype error_max_turns", () => !!call(ENV({ subtype: "error_max_turns" })).err],
    ["throws when structured_output is missing (no --json-schema)", () => !!call(ENV({ result: "Looks good to me!" })).err],
  ]],
  ["3.6 · TODO 6: CLAUDE.md gives CI its testing context", [
    ["has a ## Testing section", () => testing.length > 0],
    ["says what a valuable test is (boundaries, edge cases, error branches)", () => /boundar|edge|branch/i.test(testing)],
    ["names the fixtures: makeInvoice and fixedClock", () => /makeInvoice/.test(testing) && /fixedClock/.test(testing)],
    ["says to read existing tests and not duplicate their scenarios", () => /existing/i.test(testing) && /duplicat|already cover/i.test(testing)],
  ]],
];

let pass = 0, total = 0;
console.log(`Grading ${relative(HERE, SRC).split("\\").join("/")}/`);
if (importErr) console.log(red(`  (post.ts failed to import: ${importErr.slice(0, 160)})`));
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
console.log((pass === total ? green : red)(`\n══ L9 check: ${pass}/${total}`));
process.exit(0);
