// Lesson 9: Claude Code in CI. Every model call here is a real `claude -p --output-format json [--json-schema …]`
// subprocess, exactly what a CI job runs, on your Claude Code login. Each run builds a fresh git repo in %TEMP%:
// fixture/base (+ your review/CLAUDE.md as the committed CLAUDE.md), then the PR commit(s) from fixture/pr1, pr2.
// Findings are scored against fixture/truth.json: 5 planted defects (T1–T5) and 4 noise traps (N1–N4).
// Run:  npm run l9:ask -- <command>
//   review       one review pass over PR 1 with your criteria.md + examples.md + finding.schema.json
//   rereview     PR 1 + a follow-up commit (fixes T1, T3; adds T6) reviewed with your rereview.md and the prior findings
//   multipass    per-file passes (no tools) + one cross-file integration pass (Read/Grep/Glob), merged and scored
//   self         a generator session writes src/checkout.ts from a spec; the SAME session reviews it (--resume)
//                vs a fresh, independent session; both scored against hidden acceptance tests
//   testgen      propose tests for src/discount.ts: CONTEXT=none (bare) vs CONTEXT=full (your CLAUDE.md + existing tests)
// Env:  SOLUTION=1 (solution/review) · PROMPT=vague (the starter's vague criteria, no examples, reference schema)
//       NOPRIOR=1 (rereview without prior findings) · CONTEXT=none|full · MODEL=haiku|sonnet
import { spawn, execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { green, red } from "../shared/colors.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, process.env.SOLUTION ? "solution/review" : "review");
const REF = join(HERE, "solution/review");
const FIX = join(HERE, "fixture");
const MODEL = process.env.MODEL ?? "haiku";
const VAGUE = process.env.PROMPT === "vague";
const [cmd = "review"] = process.argv.slice(2);
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5) + "s";
const read = (p: string) => readFileSync(p, "utf8");
const strip = (s: string) => s.replace(/<!--[\s\S]*?-->\s*/g, "").trim(); // TODO comments don't reach the model
const WORK = join(HERE, ".work");
mkdirSync(WORK, { recursive: true });

// ── The repo a CI runner would check out ──────────────────────────────────────
function makeRepo(stages: string[], claudeMd = join(SRC, "CLAUDE.md")) {
  const dir = mkdtempSync(join(tmpdir(), "tally9-"));
  const git = (c: string) => execSync(`git -c core.autocrlf=false -c user.email=l9@lab -c user.name=lab ${c}`, { cwd: dir, encoding: "utf8" });
  cpSync(join(FIX, "base"), dir, { recursive: true });
  if (existsSync(claudeMd)) writeFileSync(join(dir, "CLAUDE.md"), strip(read(claudeMd)) + "\n");
  git("init -q"); git("add -A"); git("commit -qm base"); git("tag base");
  for (const s of stages) { cpSync(join(FIX, s), dir, { recursive: true }); git("add -A"); git(`commit -qm ${s}`); }
  return { dir, diff: (range: string) => git(`diff -U5 ${range}`), changed: (range: string) => git(`diff --name-only ${range}`).trim().split("\n") };
}

// ── claude -p, the way CI calls it ────────────────────────────────────────────
type Envelope = { type: string; subtype: string; is_error: boolean; result?: string; session_id: string; num_turns: number;
  total_cost_usd?: number; structured_output?: Record<string, unknown>; permission_denials?: unknown[] };
type Opts = { cwd: string; schema?: object; tools?: string[]; resume?: string; maxTurns?: number; label?: string };
function claudeP(prompt: string, o: Opts): Promise<{ env: Envelope; raw: string; ms: number }> {
  const tools = o.tools ?? [];
  // The prompt goes in on stdin (no positional arg), and the variadic --tools/--allowedTools go LAST, so they can't swallow anything.
  const args = ["-p", "--output-format", "json", "--model", MODEL, "--max-turns", String(o.maxTurns ?? 20),
    "--setting-sources", "project", "--strict-mcp-config"];
  if (o.schema) args.push("--json-schema", JSON.stringify(o.schema));
  if (o.resume) args.push("--resume", o.resume);
  args.push("--tools", tools.length ? tools.join(",") : "");
  if (tools.length) args.push("--allowedTools", tools.join(","));
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: o.cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (err += d));
    child.on("error", reject);
    child.on("close", code => {
      try { resolve({ env: JSON.parse(out), raw: out, ms: Date.now() - start }); }
      catch { reject(new Error(`claude -p exited ${code}: ${(err || out).slice(0, 400)}`)); }
    });
    child.stdin.end(prompt);
  });
}
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

// ── Your review files (or the vague baseline) ─────────────────────────────────
const VAGUE_CRITERIA = "Review this pull request. Check that the code is correct and that comments are accurate.\nFlag anything that could be improved. Be conservative: only report high-confidence findings.";
const schemaFile = () => JSON.parse(read(join(VAGUE ? REF : SRC, "finding.schema.json")));
const reviewSchema = () => { const s = schemaFile(); delete s.$comment; return s; };
const hasFindings = (s: { properties?: Record<string, { type?: string }> }) => s.properties?.findings?.type === "array";
const criteria = () => (VAGUE ? VAGUE_CRITERIA : strip(read(join(SRC, "criteria.md"))));
const examples = () => (VAGUE ? "" : strip(read(join(SRC, "examples.md"))));
const ASK = "Review the pull request above. The repository is checked out at the PR head in your working directory, so you can Read and Grep files the diff doesn't show. Return your findings as structured output.";
const reviewPrompt = (diff: string, extra = "") =>
  [`<pull_request_diff>\n${diff}\n</pull_request_diff>`, criteria(), examples(), extra, ASK].filter(Boolean).join("\n\n");

// ── Scoring against fixture/truth.json ────────────────────────────────────────
type Truth = { id: string; kind?: string; file: string; anchor: string; span: number; alsoFile?: string; alsoAnchor?: string; alsoSpan?: number; what: string; kw: string };
type Finding = { file?: string; line?: number; severity?: string; category?: string; issue?: string; suggested_fix?: string; status?: string; confidence?: number; detected_pattern?: string };
const TRUTH = JSON.parse(read(join(FIX, "truth.json")));
const KW: Record<string, string> = { T1: "inject|interpolat|parameteri|sanitiz", T2: "exceed|more than|over-?refund|refunded|paidCents|cap|limit", T3: "expir|revers|backward|invert",
  T4: "cent|dollar|100x|100 times|getInvoiceTotal", T5: "comment|null|throws|NotFoundError", T6: "minSubtotal|minimum|dollar|cent", T7: "minSubtotal|missing|required|type-?check|compile",
  N1: "\\bconst\\b|\\blet\\b|reassign", N2: "\\bany\\b|type safety|typed", N3: "console", N4: "magic|constant|millisecond|ms per day|24 \\* 60" };
const norm = (f = "", dir = "") => f.split("\\").join("/").replace(dir.split("\\").join("/"), "").replace(/^\.?\/+/, "");
function lineOf(dir: string, file: string, anchor: string): number {
  if (!existsSync(join(dir, file))) return -1;
  const lines = read(join(dir, file)).split("\n");
  return lines.findIndex(l => new RegExp(anchor).test(l)) + 1;
}
function matchTruth(f: Finding, items: Truth[], dir: string): Truth | undefined {
  const file = norm(f.file, dir), text = `${f.issue ?? ""} ${f.suggested_fix ?? ""}`;
  // Several truth items share a file (refunds.ts has T2, T5, N1, N4), so score every candidate instead of taking the
  // first line-window hit: same category +2, issue text matches its keywords +2, line inside its span +1; ties → nearest line.
  const dist = (t: Truth) => Math.min(...[[t.file, t.anchor], [t.alsoFile, t.alsoAnchor]].filter(([fl, a]) => fl === file && a)
    .map(([fl, a]) => Math.abs(lineOf(dir, fl!, a!) - (f.line ?? -999))));
  const span = (t: Truth) => (file === t.file ? t.span : t.alsoSpan ?? 0) + 3;
  const rank = (t: Truth) => (f.category && f.category === t.kind ? 2 : 0) + (new RegExp(KW[t.id], "i").test(text) ? 2 : 0) + (dist(t) <= span(t) ? 1 : 0);
  return items.filter(t => t.file === file || t.alsoFile === file).filter(t => rank(t) >= 2 || dist(t) <= span(t))
    .sort((a, b) => rank(b) - rank(a) || dist(a) - dist(b))[0];
}
function score(findings: Finding[], defects: Truth[], dir: string, noise: Truth[] = TRUTH.noise) {
  const hit = new Map<string, Finding[]>(), fp: { f: Finding; noise?: string }[] = [];
  for (const f of findings) {
    const t = matchTruth(f, [...defects, ...noise], dir);
    if (t && defects.includes(t)) hit.set(t.id, [...(hit.get(t.id) ?? []), f]);
    else fp.push({ f, noise: t?.id });
  }
  return { hit, fp };
}
const fmt = (f: Finding) => `${norm(f.file)}:${f.line} [${f.severity ?? "?"}${f.category ? "/" + f.category : ""}${f.status ? "/" + f.status : ""}${f.confidence !== undefined ? " c=" + f.confidence : ""}] ${(f.issue ?? "").slice(0, 110)}`;
function report(findings: Finding[], defects: Truth[], dir: string) {
  const { hit, fp } = score(findings, defects, dir);
  for (const t of defects) {
    const h = hit.get(t.id);
    console.log((h ? green : red)(`  ${h ? "✓" : "✗"} ${t.id} ${t.kind?.padEnd(8)} ${t.what}`) + (h && h.length > 1 ? `  (reported ${h.length}×: duplicate)` : ""));
  }
  for (const { f, noise } of fp) console.log(red(`  ✗ FALSE POSITIVE${noise ? ` (noise trap ${noise})` : ""}: ${fmt(f)}`));
  const tp = [...hit.values()].reduce((a, h) => a + h.length, 0);
  console.log(`\n  defects found ${hit.size}/${defects.length} · findings ${findings.length} · false positives ${fp.length} · precision ${findings.length ? Math.round((100 * tp) / findings.length) : 0}%`);
  return { hit, fp };
}
const findingsOf = (env: Envelope): Finding[] | null => {
  const f = (env.structured_output as { findings?: Finding[] } | undefined)?.findings;
  return Array.isArray(f) ? f : null;
};
async function postPreview(raw: string) {
  try {
    const { toInlineComments } = await import(pathToFileURL(join(SRC, "post.ts")).href);
    const c = toInlineComments(raw) as { path: string; line: number }[];
    console.log(`  post.ts → ${c.length} inline comment(s) would be posted: ${c.map(x => `${x.path}:${x.line}`).join(", ") || "none"}`);
  } catch (e) { console.log(`  post.ts → ${String(e).slice(0, 140)}`); }
}
const header = (what: string) => console.log(`L9 · ${what} · ${VAGUE ? "VAGUE baseline prompt" : process.env.SOLUTION ? "solution/review" : "your review/"} · model ${MODEL}\n`);
const cost = (...e: Envelope[]) => `$${e.reduce((a, x) => a + (x.total_cost_usd ?? 0), 0).toFixed(3)}`;

switch (cmd) {
  case "review": {
    header("single-pass review of PR 1");
    const repo = makeRepo(["pr1"]);
    const schema = reviewSchema();
    console.log(`${secs()}   claude -p --output-format json --json-schema finding.schema.json --tools Read,Grep,Glob   (repo ${repo.dir})`);
    const r = await claudeP(reviewPrompt(repo.diff("base HEAD")), { cwd: repo.dir, schema, tools: ["Read", "Grep", "Glob"] });
    writeFileSync(join(WORK, `review-${VAGUE ? "vague" : process.env.SOLUTION ? "solution" : "yours"}.json`), r.raw);
    console.log(`${secs()}   ${r.env.subtype} · ${r.env.num_turns} turns · ${(r.ms / 1000).toFixed(0)} s · ${cost(r.env)}\n`);
    const f = findingsOf(r.env);
    if (!f) { console.log(red("  No findings array in structured_output, so CI has nothing to post as inline comments. That's TODO 1.\n")); console.log(JSON.stringify(r.env.structured_output ?? r.env.result, null, 2).slice(0, 1500)); break; }
    report(f, TRUTH.pr1, repo.dir);
    await postPreview(r.raw);
    break;
  }
  case "rereview": {
    header(`re-review after a follow-up commit (fixes T1, T3; adds T6)${process.env.NOPRIOR ? " · NOPRIOR: plain review, no prior findings" : ""}`);
    const repo = makeRepo(["pr1", "pr2"]);
    const schema = reviewSchema();
    if (!hasFindings(schema)) { console.log(red("finish TODO 1 (finding.schema.json) first, or set SOLUTION=1")); break; }
    // The comments the first review already posted (canned, so every run starts from the same PR state).
    const pr1 = makeRepo(["pr1"]);
    const prior = (TRUTH.pr1 as Truth[]).map(t => ({ file: t.file, line: lineOf(pr1.dir, t.file, t.anchor), issue: t.what }));
    const prompt = process.env.NOPRIOR ? reviewPrompt(repo.diff("base HEAD"))
      : [strip(read(join(SRC, "rereview.md"))).replace("{{DIFF}}", repo.diff("base HEAD")).replace("{{NEW_COMMITS}}", repo.diff("HEAD~1 HEAD"))
          .replace("{{PRIOR_FINDINGS}}", JSON.stringify(prior, null, 2)), criteria(), examples(), "Return your findings as structured output."].join("\n\n");
    // An optional field is a field the model may skip. On a re-review, CI can't dedupe without status, so require it.
    const items = (schema as { properties: { findings: { items: { properties: Record<string, unknown>; required?: string[] } } } }).properties.findings.items;
    if (items.properties.status && !process.env.NOPRIOR && !process.env.OPTIONAL_STATUS) items.required = [...new Set([...(items.required ?? []), "status"])];
    const r = await claudeP(prompt, { cwd: repo.dir, schema, tools: ["Read", "Grep", "Glob"] });
    writeFileSync(join(WORK, `rereview-${process.env.NOPRIOR ? "noprior" : "prior"}.json`), r.raw);
    console.log(`${secs()}   ${r.env.subtype} · ${r.env.num_turns} turns · ${cost(r.env)} · status ${items.required?.includes("status") ? "required" : "optional"}\n`);
    const f = findingsOf(r.env) ?? [];
    for (const x of f) console.log(`  ${fmt(x)}`);
    console.log("");
    const all = [...TRUTH.pr1, ...TRUTH.pr2.new] as Truth[];
    const fixed = all.filter(t => TRUTH.pr2.fixed.includes(t.id)), open = all.filter(t => TRUTH.pr2.open.includes(t.id)), fresh = TRUTH.pr2.new as Truth[];
    const { hit, fp } = score(f, all, repo.dir);
    for (const t of fixed) { const h = hit.get(t.id); console.log((h ? red : green)(`  ${h ? "✗" : "✓"} ${t.id} was fixed: ${h ? `re-reported ${h.length}× (stale comment)` : "not re-reported"}`)); }
    for (const t of open) {
      const h = hit.get(t.id) ?? [];
      const dup = h.filter(x => x.status !== "still_open").length;
      console.log((h.length && !dup ? green : red)(`  ${h.length && !dup ? "✓" : "✗"} ${t.id} still open: ${!h.length ? "not mentioned (lost track of it)" : dup ? `posted again as a NEW comment ${dup}× (duplicate)` : "marked still_open (no new comment)"}`));
    }
    for (const t of fresh) { const h = hit.get(t.id); console.log((h ? green : red)(`  ${h ? "✓" : "✗"} ${t.id} new in the follow-up commit: ${h ? "found" : "missed"}  (${t.what})`)); }
    for (const { f: x, noise } of fp) console.log(red(`  ✗ FALSE POSITIVE${noise ? ` (noise ${noise})` : ""}: ${fmt(x)}`));
    const posted = f.filter(x => x.status !== "still_open").length;
    console.log(`\n  new comments this push would post: ${posted} (ideal: ${fresh.length}, for ${fresh.map(t => t.id).join(" and ")})`);
    await postPreview(r.raw);
    break;
  }
  case "multipass": {
    header("multi-pass review of PR 1: per-file passes + an integration pass");
    const repo = makeRepo(["pr1"]);
    const schema = reviewSchema();
    if (!hasFindings(schema)) { console.log(red("finish TODO 1 (finding.schema.json) first, or set SOLUTION=1")); break; }
    const files = repo.changed("base HEAD");
    console.log(`${secs()}   ${files.length} per-file passes (4 at a time, no tools: only that file's diff and new contents)`);
    const per = await pool(files, 4, async file => {
      const p = [`<file_diff path="${file}">\n${repo.diff(`base HEAD -- ${file}`)}\n</file_diff>`, `<file path="${file}" version="new">\n${read(join(repo.dir, file))}\n</file>`,
        criteria(), examples(), "This is a PER-FILE pass. Report only issues you can see within this one file. A separate integration pass handles cross-file issues. Return your findings as structured output."].join("\n\n");
      const r = await claudeP(p, { cwd: repo.dir, schema, maxTurns: 4 });
      const f = (findingsOf(r.env) ?? []).map(x => ({ ...x, file: x.file ? norm(x.file, repo.dir) : file }));
      console.log(`${secs()}     ${file.padEnd(24)} ${f.length} finding(s)`);
      return { env: r.env, f };
    });
    const local = per.flatMap(p => p.f);
    console.log(`${secs()}   integration pass (Read/Grep/Glob), given the ${local.length} per-file findings`);
    const ip = reviewPrompt(repo.diff("base HEAD"), `<per_file_findings>\n${JSON.stringify(local, null, 1)}\n</per_file_findings>\n\nThis is the INTEGRATION pass. The per-file findings above are already reported, so don't repeat them. Look ONLY for cross-file issues: for each export whose behaviour, units or signature changed, Grep for its callers (including files the PR doesn't touch) and check each one.`);
    const ir = await claudeP(ip, { cwd: repo.dir, schema, tools: ["Read", "Grep", "Glob"] });
    const cross = findingsOf(ir.env) ?? [];
    console.log(`${secs()}   integration: ${cross.length} finding(s) · total ${cost(ir.env, ...per.map(p => p.env))}\n`);
    report([...local, ...cross], TRUTH.pr1, repo.dir);
    break;
  }
  case "self": {
    header("self-review vs independent review");
    const dir = mkdtempSync(join(tmpdir(), "checkout9-"));
    cpSync(join(FIX, "selfreview/spec.md"), join(dir, "spec.md"));
    console.log(`${secs()}   generator: implement src/checkout.ts from spec.md   (${dir})`);
    // The generator's session also carries a plausible but WRONG clarification (spec.md is authoritative, and the hidden
    // tests follow it). That's the "reasoning context" a same-session self-review inherits. NOTE=0 leaves it out.
    const NOTE = process.env.NOTE === "0" ? "" : "\n\nContext from the ticket thread (a product manager, yesterday): \"Heads up: finance wants tax charged on the pre-discount subtotal, because discounts come out of our margin, not the tax base. And SAVE10 should stop at 00:00 UTC on 30 June so it doesn't overlap the July promo. Where this conflicts with spec.md, follow this note; I'll update the spec later.\"";
    const gen = await claudeP(`Implement src/checkout.ts according to spec.md. Write the file. Then summarise your key design decisions in three bullets.${NOTE}`, { cwd: dir, tools: ["Read", "Write"] });
    console.log(`${secs()}   generator done (${gen.env.num_turns} turns, session ${gen.env.session_id.slice(0, 8)})\n${(gen.env.result ?? "").split("\n").map(l => "     " + l).join("\n")}\n`);
    const file = join(dir, "src/checkout.ts");
    if (!existsSync(file)) { console.log(red("generator didn't write src/checkout.ts; run again")); break; }
    const { TESTS } = await import(pathToFileURL(join(FIX, "selfreview/hidden-tests.ts")).href) as { TESTS: [string, string, (f: unknown) => boolean][] };
    let fn: unknown;
    try { fn = (await import(pathToFileURL(file).href)).priceOrder; } catch (e) { console.log(red(`import failed: ${e}`)); }
    const failing = new Set<string>();
    console.log("Hidden acceptance tests (neither the generator nor the reviewers see these):");
    for (const [req, name, t] of TESTS) {
      let ok = false; try { ok = typeof fn === "function" && t(fn); } catch { ok = false; }
      if (!ok) failing.add(req);
      console.log((ok ? green : red)(`  ${ok ? "✓" : "✗"} ${req} ${name}`));
    }
    console.log(`\nDefective requirements: ${[...failing].join(", ") || "none: the generator got everything right this time. Run again to get a defect to hunt."}\n`);
    const SCHEMA = { type: "object", additionalProperties: false, required: ["findings"], properties: { findings: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["requirement", "issue", "confidence"], properties: { requirement: { type: "string", enum: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "other"] }, issue: { type: "string" }, line: { type: "integer" }, confidence: { type: "number", minimum: 0, maximum: 1 } } } } } };
    const ASKR = "Review src/checkout.ts against spec.md before it goes to a pull request. Report every place where the code doesn't meet a requirement, naming the requirement. Don't report style. Return your findings as structured output.";
    console.log(`${secs()}   self-review (--resume the generator's session) and independent review (fresh session), in parallel`);
    const [self, indep] = await Promise.all([
      claudeP("Now review the code you just wrote. " + ASKR, { cwd: dir, schema: SCHEMA, tools: ["Read"], resume: gen.env.session_id }),
      claudeP(ASKR, { cwd: dir, schema: SCHEMA, tools: ["Read"] }),
    ]);
    for (const [name, r] of [["SELF-REVIEW (same session)", self], ["INDEPENDENT (fresh session)", indep]] as const) {
      const f = (findingsOf(r.env) ?? []) as { requirement: string; issue: string; confidence: number }[];
      const caught = [...failing].filter(q => f.some(x => x.requirement === q));
      const falseAlarms = f.filter(x => !failing.has(x.requirement));
      console.log(`\n${name}: caught ${caught.length}/${failing.size} defective requirement(s)${caught.length ? ` (${caught.join(", ")})` : ""} · false alarms ${falseAlarms.length}`);
      for (const x of f) console.log(`  ${failing.has(x.requirement) ? green("✓") : red("✗")} ${x.requirement} c=${x.confidence} ${x.issue.slice(0, 120)}`);
    }
    break;
  }
  case "testgen": {
    const full = process.env.CONTEXT !== "none";
    header(`test generation for src/discount.ts · CONTEXT=${full ? "full (your CLAUDE.md + tests/discount.test.ts)" : "none (base CLAUDE.md, no existing tests)"}`);
    const repo = makeRepo(["pr1"], full ? join(SRC, "CLAUDE.md") : join(FIX, "base/CLAUDE.md"));
    const parts = [`<module path="src/discount.ts">\n${read(join(repo.dir, "src/discount.ts"))}\n</module>`];
    if (full) parts.push(`<existing_tests path="tests/discount.test.ts">\n${read(join(repo.dir, "tests/discount.test.ts"))}\n</existing_tests>`);
    parts.push("Propose the unit tests this module should get next. For each one, give the test name, the scenario (inputs and the expected result), and any fixtures it uses. Return them as structured output.");
    const SCHEMA = { type: "object", additionalProperties: false, required: ["tests"], properties: { tests: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["name", "scenario"], properties: { name: { type: "string" }, scenario: { type: "string" }, fixtures: { type: "array", items: { type: "string" } } } } } } };
    const r = await claudeP(parts.join("\n\n"), { cwd: repo.dir, schema: SCHEMA, maxTurns: 4 });
    const tests = ((r.env.structured_output as { tests?: { name: string; scenario: string; fixtures?: string[] }[] })?.tests) ?? [];
    // Checked against the test NAME only, unknown first: "Throws ValidationError for unknown code" must not count as "valid code".
    const EXISTING: [string, RegExp][] = [["unknown code throws", /unknown|nonexist|non-exist|not found|does ?n.t exist|invalid code/i],
      ["case-insensitive / trims", /case|insensitiv|whitespace|trim/i], ["valid code applies 10%", /\b(valid|happy|basic)\b.*\b(code|discount)\b|applies (a |the )?(valid )?(percent|percentage|10%)/i]];
    const BOUNDARY = /(exact|boundary|at the|equal|===|just|second|millisecond|instant|one (more|less)|maxUses|uses (=|equal)|round|\.5|half)/i;
    const LOW = /(is a function|is exported|is defined|typeof|returns a number|returns an? (object|value)\b)/i;
    let dup = 0, bound = 0, low = 0, fx = 0;
    for (const t of tests) {
      const s = `${t.name} ${t.scenario}`;
      const d = EXISTING.find(([, re]) => re.test(t.name));
      if (d) dup++; if (BOUNDARY.test(s)) bound++; if (LOW.test(s)) low++; if (/fixedClock|makeInvoice/.test(s + (t.fixtures ?? []).join(" "))) fx++;
      console.log(`  ${d ? red("DUP ") : LOW.test(s) ? red("LOW ") : "    "}${t.name}${d ? `  ← already covered: ${d[0]}` : ""}`);
    }
    console.log(`\n  ${tests.length} tests · duplicates of existing tests ${dup} · boundary/edge tests ${bound} · low-value ${low} · use the fixtures ${fx} · ${cost(r.env)}`);
    console.log("  (the duplicate and boundary checks are keyword heuristics; read the names above)");
    break;
  }
  case "rescore": { // re-score a saved review envelope without calling the model: rescore yours|vague|solution
    const which = process.argv[3] ?? "yours", p = join(WORK, `review-${which}.json`);
    if (!existsSync(p)) { console.log(`no saved run at ${p}; run review first`); break; }
    const env = JSON.parse(read(p)) as Envelope, repo = makeRepo(["pr1"]);
    console.log(`L9 · rescore ${which}\n`);
    for (const f of findingsOf(env) ?? []) console.log(`  ${fmt(f)}`);
    console.log("");
    report(findingsOf(env) ?? [], TRUTH.pr1, repo.dir);
    break;
  }
  default:
    console.log("commands: review | rereview | multipass | self | testgen | rescore [yours|vague|solution]");
}
