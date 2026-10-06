// Lesson 7 grader: reads your team config (team/) as Claude Code would, with no model and no network.
// It parses CLAUDE.md files, @imports, .claude/rules/ frontmatter globs, skills and commands, and matches
// your globs against the fixture's real files plus a few paths that don't exist yet.
// Run:  npm run l7:check            (team/)
//       npm run l7:check:solution   (solution/team/)
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, matchesGlob, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { green, red } from "../shared/colors.js";

process.removeAllListeners("warning"); // path.matchesGlob is "experimental" on Node 22
const HERE = dirname(fileURLToPath(import.meta.url));
const TEAM = join(HERE, process.argv[2] === "solution" ? "solution/team" : "team");
const FIX = join(HERE, "fixture/tally");

// ── Reading the config ────────────────────────────────────────────────────────
const slash = (p: string) => p.split("\\").join("/");
function walk(d: string): string[] {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
}
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").replace(/\r\n/g, "\n") : "");
const teamFiles = walk(TEAM).map(p => slash(relative(TEAM, p)));
// Project files = everything a teammate gets from git. personal/ stands in for ~/.claude and isn't committed.
const projectFiles = teamFiles.filter(f => !f.startsWith("personal/"));
const fixtureFiles = walk(FIX).map(p => slash(relative(FIX, p)));

type Front = { data: Record<string, string | string[]>; body: string; ok: boolean };
// Just enough YAML for Claude Code frontmatter: `key: value`, `key: [a, b]`, and `key:` + `  - item` lists.
function front(text: string): Front {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text, ok: false };
  const data: Record<string, string | string[]> = {};
  let list: string | null = null;
  for (const line of m[1].split("\n")) {
    const item = line.match(/^\s+-\s*(.+)$/);
    if (item && list) { (data[list] as string[]).push(unq(item[1])); continue; }
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === "") { data[k] = []; list = k; }
    else if (v.startsWith("[")) { data[k] = v.slice(1, -1).split(",").map(s => unq(s.trim())).filter(Boolean); list = null; }
    else { data[k] = unq(v); list = null; }
  }
  return { data, body: m[2], ok: true };
}
const unq = (s: string) => s.trim().replace(/^["']|["']$/g, "");
const asList = (v: string | string[] | undefined) =>
  v === undefined ? [] : Array.isArray(v) ? v : v.split(/[,\s]+/).map(unq).filter(Boolean);

// Root memory: ./CLAUDE.md or ./.claude/CLAUDE.md (both are project scope).
const rootPath = ["CLAUDE.md", ".claude/CLAUDE.md"].find(f => teamFiles.includes(f));
const root = rootPath ? read(join(TEAM, rootPath)) : "";
const lines = (t: string) => t.split("\n").filter(l => l.trim()).length;

// @imports outside code spans and fences, resolved against the importing file (max 4 hops, like Claude Code).
function imports(file: string, text: string): string[] {
  const prose = text.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
  return [...prose.matchAll(/(?:^|\s)@([^\s]+)/g)].map(m => slash(relative(TEAM, resolve(TEAM, dirname(file), m[1]))));
}
function expand(file: string, depth = 0): string[] {
  if (depth > 4) return [];
  const own = imports(file, readOverlay(file));
  return own.flatMap(f => [f, ...expand(f, depth + 1)]);
}
// A path in the overlaid repo: your team/ file wins over the fixture's.
const readOverlay = (f: string) => read(join(TEAM, f)) || read(join(FIX, f));
const existsOverlay = (f: string) => existsSync(join(TEAM, f)) || existsSync(join(FIX, f));

// Rules
const rules = projectFiles.filter(f => f.startsWith(".claude/rules/") && f.endsWith(".md"))
  .map(f => { const t = read(join(TEAM, f)); return { file: f, text: t, ...front(t), globs: asList(front(t).data.paths) }; });
const matches = (globs: string[], path: string) => globs.some(g => matchesGlob(path, g));
const ruleFor = (path: string) => rules.filter(r => r.globs.length && matches(r.globs, path));
const TESTS = fixtureFiles.filter(f => /\.test\.tsx?$/.test(f));
const NON_TESTS = fixtureFiles.filter(f => /\.(tsx?|tf)$/.test(f) && !TESTS.includes(f));
const testRule = () => rules.find(r => r.globs.length && TESTS.every(t => matches(r.globs, t)));
const ruleBy = (re: RegExp) => rules.find(r => re.test(r.text));

// Skill + commands
const SKILL = ".claude/skills/impact-scan/SKILL.md";
const skill = front(read(join(TEAM, SKILL)));
const commands = projectFiles.filter(f => f.startsWith(".claude/commands/") && f.endsWith(".md"))
  .map(f => ({ file: f, name: f.slice(".claude/commands/".length, -3).split("/").join(":"), ...front(read(join(TEAM, f))) }));
const skillNames = projectFiles.filter(f => /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(f)).map(f => f.split("/")[2]);

// Text that must live in exactly one place
const PERSONAL = /Jacob|terse|alias `?pnpm test`?|\bin my shell\b/i;
const allProject = projectFiles.filter(f => f.endsWith(".md")).map(f => ({ f, t: read(join(TEAM, f)) }));
const subdirMemory = projectFiles.filter(f => /(^|\/)CLAUDE(\.local)?\.md$/.test(f) && f !== rootPath && !f.startsWith(".claude/"));
const billingMd = "packages/billing/CLAUDE.md";
const billingImports = () => expand(billingMd);

// ── Checks ────────────────────────────────────────────────────────────────────
type Check = [string, () => unknown];
const groups: [string, Check[]][] = [
  ["3.1 · Project CLAUDE.md: universal standards only", [
    ["a project CLAUDE.md exists (./CLAUDE.md or ./.claude/CLAUDE.md)", () => rootPath],
    ["keeps pnpm, strict TS, the .js import suffix and integer cents", () => /pnpm/.test(root) && /strict/i.test(root) && /\.js/.test(root) && /cents/i.test(root)],
    ["keeps the 'run pnpm test before done' rule", () => /pnpm test[^\n]*(before|done)|before[^\n]*done[^\n]*pnpm test/i.test(root)],
    ["is short: at most 20 non-blank lines", () => root && lines(root) <= 20],
    ["has no Terraform rules (they load only for terraform/)", () => root && !/terraform (apply|plan)|common_tags/i.test(root)],
    ["has no API-handler rules (ApiError, Zod at the edge)", () => root && !/ApiError|Zod/i.test(root)],
    ["has no React or billing-only rules", () => root && !/formatCents|function components|regulation|Math\.round/i.test(root)],
    ["has no inline impact-scan procedure (that's an on-demand skill now)", () => root && !/impact scan|file:line — why/i.test(root)],
  ]],
  ["3.1 · Personal vs team scope", [
    ["no personal preferences in any committed file", () => allProject.every(({ t }) => !PERSONAL.test(t))],
    ["they live in personal/CLAUDE.md (your ~/.claude/CLAUDE.md)", () => /terse/i.test(read(join(TEAM, "personal/CLAUDE.md"))) && /alias/i.test(read(join(TEAM, "personal/CLAUDE.md")))],
  ]],
  ["3.1 · @import in packages/billing/CLAUDE.md", [
    ["packages/billing/CLAUDE.md exists", () => projectFiles.includes(billingMd)],
    ["it @imports docs/standards/money.md", () => billingImports().includes("docs/standards/money.md")],
    ["every @import resolves to a real file (relative to the importing file)", () => billingImports().length > 0 && billingImports().every(existsOverlay)],
    ["it imports selectively: not api-errors.md or frontend.md", () => billingImports().length > 0 && !billingImports().some(f => /api-errors|frontend/.test(f))],
    ["it doesn't copy the money standard inline (import, don't duplicate)", () => !/Round only once/i.test(read(join(TEAM, billingMd)))],
    ["the root CLAUDE.md doesn't import every standards file", () => !imports(rootPath ?? "CLAUDE.md", root).some(f => /api-errors|frontend/.test(f))],
  ]],
  ["3.3 · Path-scoped rules in .claude/rules/", [
    ["at least three rule files", () => rules.length >= 3],
    ["every rule file has frontmatter with a non-empty paths list", () => rules.length && rules.every(r => r.ok && r.globs.length > 0)],
    ["no rule matches everything (\"**/*\" or \"**\")", () => rules.length && rules.every(r => !r.globs.some(g => g === "**/*" || g === "**"))],
    ["a testing rule matches all 4 test files across src/ and packages/", () => testRule()],
    ["…and matches no non-test source file", () => { const r = testRule(); return r && NON_TESTS.every(f => !matches(r.globs, f)); }],
    ["…and matches a test file that doesn't exist yet: src/jobs/retry.test.ts", () => { const r = testRule(); return r && matches(r.globs, "src/jobs/retry.test.ts"); }],
    ["…and carries the test conventions (vitest, fake timers)", () => { const r = testRule(); return r && /vitest/i.test(r.text) && /useFakeTimers/.test(r.text); }],
    ["no test conventions in a subdirectory CLAUDE.md (they span directories)", () => subdirMemory.every(f => !/vitest|useFakeTimers/i.test(read(join(TEAM, f))))],
    ["an API rule loads for src/api/invoices.ts and src/api/v2/refunds.ts", () => { const r = ruleBy(/ApiError/); return r && matches(r.globs, "src/api/invoices.ts") && matches(r.globs, "src/api/v2/refunds.ts"); }],
    ["…but not for src/web/ or src/lib/", () => { const r = ruleBy(/ApiError/); return r && !matches(r.globs, "src/web/InvoiceList.tsx") && !matches(r.globs, "src/lib/money.ts"); }],
    ["a Terraform rule loads for terraform/main.tf and terraform/modules/rds/main.tf", () => { const r = ruleBy(/terraform apply/i); return r && matches(r.globs, "terraform/main.tf") && matches(r.globs, "terraform/modules/rds/main.tf"); }],
    ["…and for nothing outside terraform/", () => { const r = ruleBy(/terraform apply/i); return r && fixtureFiles.filter(f => !f.startsWith("terraform/")).every(f => !matches(r.globs, f)); }],
    ["a React rule loads for src/web/InvoiceList.tsx, not for src/api/", () => { const r = ruleBy(/formatCents/); return r && matches(r.globs, "src/web/InvoiceList.tsx") && !matches(r.globs, "src/api/invoices.ts"); }],
    ["editing src/lib/money.ts loads no topic rule (it has none)", () => rules.length >= 3 && ruleFor("src/lib/money.ts").length === 0],
  ]],
  ["3.2 · /impact-scan skill (.claude/skills/impact-scan/SKILL.md)", [
    ["has a description that says when to use it", () => /before|when|use (it )?(to|for|when)/i.test(String(skill.data.description ?? ""))],
    ["context: fork (runs in a subagent; only the summary comes back)", () => skill.data.context === "fork"],
    ["agent: picks a read-only built-in agent (Explore or Plan)", () => /^(Explore|Plan)$/.test(String(skill.data.agent ?? ""))],
    ["argument-hint tells the user what to pass", () => String(skill.data["argument-hint"] ?? "").length > 2],
    ["the body uses $ARGUMENTS (or $0)", () => /\$ARGUMENTS|\$0\b/.test(skill.body)],
    ["allowed-tools lists only read tools (exam: 'restricts tool access')", () => { const t = asList(skill.data["allowed-tools"]); return t.length > 0 && t.every(x => /^(Read|Grep|Glob)$/.test(x)); }],
    ["disallowed-tools removes Write, Edit and Bash (today: what actually restricts)", () => { const t = asList(skill.data["disallowed-tools"]); return ["Write", "Edit", "Bash"].every(x => t.includes(x)); }],
    ["asks for a bounded summary, not raw file contents", () => /at most \d+ lines|under \d+ lines|≤ ?\d+ lines|no more than \d+/i.test(skill.body) && /do not paste|don't paste|no file contents|not paste/i.test(skill.body)],
  ]],
  ["3.2 · A project command in .claude/commands/", [
    ["at least one .claude/commands/*.md (shared with the team through git)", () => commands.length > 0],
    ["each command has a description", () => commands.length && commands.every(c => String(c.data.description ?? "").length > 10)],
    ["each command has an argument-hint and uses its arguments", () => commands.length && commands.every(c => c.data["argument-hint"] && /\$ARGUMENTS|\$\d/.test(c.body))],
    ["no command shares a name with a skill (the skill would win)", () => commands.every(c => !skillNames.includes(c.name))],
  ]],
];

let pass = 0, total = 0;
console.log(`Grading ${slash(relative(join(HERE, ".."), TEAM))}/  (${projectFiles.length} committed files, ${rules.length} rules)`);
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
if (rules.length) {
  console.log("\nRule map (which rule files load when Claude reads or edits each fixture file):");
  for (const f of fixtureFiles.filter(f => /\.(tsx?|tf)$/.test(f))) console.log(`  ${f.padEnd(36)} ${ruleFor(f).map(r => r.file.slice(14)).join(", ") || "—"}`);
}
console.log((pass === total ? green : red)(`\n══ L7 check: ${pass}/${total}`));
