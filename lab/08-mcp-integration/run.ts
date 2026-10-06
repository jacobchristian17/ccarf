// Lesson 8: MCP integration, built-in tools and plan mode, live through the Agent SDK on your Claude Code login.
// Each run copies the L7 tally fixture + fixture-extra/ + the L7 reference config into a fresh temp repo, adds YOUR
// team/.mcp.json, and starts a project-scope session there (settingSources: ["project"]: what a teammate's clone gets).
// Your team/personal/claude.json stands in for ~/.claude.json: its servers are passed in as the user-level layer.
// The two MCP servers are bundled to a temp folder OUTSIDE the repo (TALLY_TOOLS_DIR), standing in for an npx package.
// Run:  npm run l8:ask -- <command>
//   servers               which MCP servers connected, from which scope, with which tools
//   refs [symbol]         "who calls toCents?": MCP find_references vs Grep, and how many of the 5 caller files it found
//   schema                "where is the VAT rate stored?": exploratory tool calls vs reading the tally://schema resource
//   edit                  change roundHalfEven only, in a file where the anchor text appears twice (Edit needs a unique match)
//   task <bugfix|migration|feature>   one task in MODE=plan or MODE=direct: tool calls, files changed, the plan
// Env:  SOLUTION=1 (solution/) · NOTOKEN=1 (TALLY_INDEX_TOKEN unset) · MODE=plan|direct · MODEL=haiku|sonnet
import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { buildSync } from "esbuild";
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, process.env.SOLUTION ? "solution" : ".");
const MODEL = process.env.MODEL ?? "haiku";
const MODE = process.env.MODE === "plan" ? "plan" : "direct";
const [cmd = "servers", ...rest] = process.argv.slice(2);
const arg = rest.join(" ");
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5) + "s";

// ── The MCP servers, bundled outside the repo so the model can't just read their source ──
const TOOLS = join(tmpdir(), "ccarf-l8-tools");
mkdirSync(TOOLS, { recursive: true });
for (const [name, file] of [["tally-index", join(SRC, "servers/tally-index.ts")], ["scratchpad", join(HERE, "servers/scratchpad.ts")]])
  buildSync({ entryPoints: [file], bundle: true, platform: "node", format: "esm", outfile: join(TOOLS, `${name}.mjs`), logLevel: "error",
    banner: { js: "import{createRequire}from'module';const require=createRequire(import.meta.url);" } });

// ── A fresh repo per run: L7 fixture + L8 extras + the L7 reference config + your .mcp.json ──
const REPO = mkdtempSync(join(tmpdir(), "tally8-"));
cpSync(join(HERE, "../07-team-config/fixture/tally"), REPO, { recursive: true });
cpSync(join(HERE, "fixture-extra"), REPO, { recursive: true });
cpSync(join(HERE, "../07-team-config/solution/team"), REPO, { recursive: true, filter: s => !s.includes("personal") });
const TEAM = join(SRC, "team");
if (existsSync(join(TEAM, ".mcp.json"))) cpSync(join(TEAM, ".mcp.json"), join(REPO, ".mcp.json"));
execSync("git init -q && git -c core.autocrlf=false add -A && git -c user.email=l8@lab -c user.name=lab commit -qm fixture", { cwd: REPO });
const rel = (p?: string) => (p ? relative(REPO, p).split("\\").join("/") : "");

// The developer's shell: the token exists here, not in the repo. NOTOKEN=1 simulates a teammate who never set it.
const env: Record<string, string | undefined> = { ...process.env, TALLY_TOOLS_DIR: TOOLS, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" };
if (process.env.NOTOKEN) delete env.TALLY_INDEX_TOKEN; else env.TALLY_INDEX_TOKEN ??= "tk_dev_from_your_shell";

// personal/claude.json = your ~/.claude.json. Claude Code expands ${VAR} there; we do the same for the stand-in.
const expand = (s: string) => s.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_, v, d) => env[v] ?? d ?? `\${${v}}`);
function personalServers(): Options["mcpServers"] {
  const p = join(TEAM, "personal/claude.json");
  if (!existsSync(p)) return {};
  const cfg = JSON.parse(readFileSync(p, "utf8")).mcpServers ?? {};
  const walk = (v: unknown): unknown => typeof v === "string" ? expand(v) : Array.isArray(v) ? v.map(walk)
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  return walk(cfg) as Options["mcpServers"];
}

type Run = { text: string; calls: { name: string; input: string; sub: boolean }[]; turns: number; denied: string[]; servers: { name: string; status: string; source?: string }[]; tools: string[] };
async function run(prompt: string, o: { tools: string[]; allowed: string[]; mode?: Options["permissionMode"]; maxTurns?: number; quiet?: boolean }): Promise<Run> {
  const r: Run = { text: "", calls: [], turns: 0, denied: [], servers: [], tools: [] };
  const q = query({
    prompt,
    options: {
      cwd: REPO, settingSources: ["project"], model: MODEL, maxTurns: o.maxTurns ?? 20,
      tools: o.tools, allowedTools: o.allowed, permissionMode: o.mode ?? "default",
      mcpServers: personalServers(), env,
      settings: { plansDirectory: ".plans" }, // plan files stay in the temp repo, not in your ~/.claude/plans/
    },
  });
  for await (const m of q) {
    const parent = (m as { parent_tool_use_id?: string | null }).parent_tool_use_id;
    if (m.type === "system" && m.subtype === "init") {
      const i = m as unknown as { mcp_servers: Run["servers"]; tools: string[] };
      r.servers = i.mcp_servers.filter(s => s.source !== "claudeai");
      r.tools = i.tools;
    }
    if (m.type === "system" && (m as { subtype: string }).subtype === "permission_denied")
      r.denied.push((m as unknown as { tool_name: string }).tool_name);
    if (m.type === "assistant") for (const b of m.message.content) {
      if (b.type !== "tool_use") continue;
      const i = b.input as Record<string, unknown>;
      const what = typeof i.file_path === "string" ? rel(i.file_path) : JSON.stringify(i).slice(0, 80);
      r.calls.push({ name: b.name, input: what, sub: !!parent });
      if (!o.quiet) console.log(`${secs()}   ${parent ? "  subagent" : "main"} → ${b.name.replace(/^mcp__/, "mcp:")}(${what})`);
    }
    if (m.type === "user" && !parent && !o.quiet) for (const b of (m.message.content ?? []) as { type?: string; content?: unknown; is_error?: boolean }[])
      if (b?.type === "tool_result" && b.is_error) console.log(`${secs()}   main ← ERROR ${(typeof b.content === "string" ? b.content : JSON.stringify(b.content)).slice(0, 110)}`);
    if (m.type === "result") { r.text = m.subtype === "success" ? m.result : `(${m.subtype})`; r.turns = m.num_turns; }
  }
  return r;
}

const tally = (r: Run) => Object.entries(r.calls.reduce<Record<string, number>>((a, c) => ({ ...a, [c.name.replace(/^mcp__/, "mcp:")]: (a[c.name.replace(/^mcp__/, "mcp:")] ?? 0) + 1 }), {}))
  .map(([n, k]) => `${n}×${k}`).join(" ") || "none";
const show = (r: Run) => console.log(`\n${secs()}   ${r.turns} turns · ${r.calls.length} tool calls: ${tally(r)}${r.denied.length ? ` · DENIED: ${r.denied.join(", ")}` : ""}\n\n${r.text}\n`);
const changed = () => execSync("git -c core.autocrlf=false status --porcelain", { cwd: REPO, encoding: "utf8" }).trim().split("\n").filter(l => l && !l.includes(".plans"));
const READ = ["Read", "Grep", "Glob"];
// Built-ins every session keeps: the MCP resource tools, and ToolSearch (MCP tool definitions may be deferred behind it).
const BASE = [...READ, "ListMcpResourcesTool", "ReadMcpResourceTool", "ToolSearch"];
const MCP = ["mcp__tally-index__*", "mcp__scratchpad__*", "ListMcpResourcesTool", "ReadMcpResourceTool", "ToolSearch"];

console.log(`L8 · ${cmd}${cmd === "task" ? ` · MODE=${MODE}` : ""} · ${process.env.SOLUTION ? "solution/" : "your"} config + server · token ${env.TALLY_INDEX_TOKEN ? "set" : "UNSET"} · model ${MODEL} · repo ${REPO}\n`);

switch (cmd) {
  case "servers": {
    const r = await run("Call mcp__tally-index__list_tables once, then reply with just the table names.", { tools: BASE, allowed: [...READ, ...MCP], maxTurns: 4 });
    console.log("Connected MCP servers (claude.ai connectors hidden):");
    for (const s of r.servers) console.log(`  ${s.name.padEnd(14)} ${s.status.padEnd(12)} scope: ${s.source === "project" ? "project (.mcp.json, from git)" : s.source === "dynamic" ? "user (personal/claude.json = your ~/.claude.json)" : s.source}`);
    console.log(`MCP tools the agent got: ${r.tools.filter(t => /^mcp__(tally-index|scratchpad)__/.test(t)).map(t => t.replace(/^mcp__/, "")).join(", ") || "none"}`);
    show(r);
    const leaked = existsSync(join(TEAM, ".mcp.json")) && /tk_\w{6,}/.test(readFileSync(join(TEAM, ".mcp.json"), "utf8"));
    if (leaked) console.log("⚠ team/.mcp.json contains a literal token. Every clone of the repo has it now, and so does git history.");
    break;
  }
  case "refs": {
    const sym = arg || "toCents";
    const r = await run(`I'm about to change the signature of ${sym}. List every file that calls it, directly or indirectly, as file:line. Be complete.`,
      { tools: BASE, allowed: [...READ, ...MCP] });
    show(r);
    const want = ["src/api/invoices.ts", "src/lib/money.test.ts", "src/api/amounts.ts", "src/api/refunds.ts", "src/web/InvoiceForm.tsx"];
    const found = want.filter(f => r.text.includes(f) || r.text.includes(f.split("/").pop()!));
    console.log(`Caller files named: ${found.length}/5 ${want.filter(f => !found.includes(f)).map(f => `(missed ${f})`).join(" ")}`);
    console.log(`find_references used: ${r.calls.some(c => c.name.endsWith("find_references")) ? "yes" : "NO"} · Grep calls: ${r.calls.filter(c => c.name === "Grep").length}`);
    break;
  }
  case "schema": {
    const r = await run("In the tally database, which table and column store the VAT rate actually applied to a line item, in what unit, and where do the per-country default rates live? Use the tally-index MCP server, not the source code.",
      { tools: BASE, allowed: [...READ, ...MCP] });
    show(r);
    console.log(`Calls to the tally-index server (tools + resources): ${r.calls.filter(c => /tally-index|McpResource/.test(c.name)).length}`);
    break;
  }
  case "edit": {
    const r = await run("In src/lib/rounding.ts, change roundHalfEven (and only roundHalfEven) to use banker's rounding: ties go to the nearest even integer. Leave roundHalfUp exactly as it is. Reply DONE.",
      { tools: [...READ, "Edit", "Write"], allowed: [...READ, "Edit", "Write"] });
    show(r);
    const now = readFileSync(join(REPO, "src/lib/rounding.ts"), "utf8");
    const up = now.match(/function roundHalfUp[\s\S]*?\n}/)?.[0] ?? "";
    console.log(`roundHalfUp untouched: ${/return Math\.round\(value\);/.test(up) ? "yes" : "NO"} · roundHalfEven changed: ${!/roundHalfEven[\s\S]*?\{\s*if[^\n]*\n\s*return Math\.round\(value\);\s*\n}/.test(now) ? "yes" : "NO"}`);
    break;
  }
  case "task": {
    const TASKS: Record<string, string> = {
      bugfix: "Bug: toCents(\"-1.50\") returns -50 but should return -150. The stack trace points at src/lib/money.ts. Fix it.",
      migration: "Migrate the codebase off toCents and its aliases/wrappers (parseAmount, amountToCents) onto a new Money.parse(raw: string): Money API in src/lib/money.ts, where Money wraps integer cents. Update every caller and test, then delete the old functions.",
      feature: "Add multi-currency support to invoices. Customers in the EU will be billed in EUR, others in USD.",
    };
    const task = TASKS[arg];
    if (!task) { console.log(`task: ${Object.keys(TASKS).join(" | ")}`); break; }
    // The L7 CLAUDE.md says to run pnpm test; this lab has no shell, so say so up front or the model goes hunting for one.
    const r = await run(task + " (This session has no shell, so don't try to run tests; say which tests you would run.)", { tools: [...BASE, "Edit", "Write", "Agent", "ExitPlanMode"], allowed: [...READ, ...MCP, "Edit", "Write", "Agent"],
      mode: MODE === "plan" ? "plan" : "acceptEdits", maxTurns: 30 });
    show(r);
    const files = changed();
    console.log(`Files changed on disk: ${files.length ? files.join(", ") : "none"}`);
    const plans = existsSync(join(REPO, ".plans")) ? readdirSync(join(REPO, ".plans")) : [];
    if (plans.length) console.log(`Plan file: ${join(REPO, ".plans", plans[0])}`);
    // Interactive Claude Code shows the plan for approval via ExitPlanMode. With no approver (SDK, -p) it is disabled.
    console.log(`ExitPlanMode attempted: ${r.calls.some(c => c.name === "ExitPlanMode") ? "yes (disabled here: no interactive approver)" : "no"} · subagent calls: ${r.calls.filter(c => c.sub).length}`);
    break;
  }
  default:
    console.log("commands: servers | refs [symbol] | schema | edit | task <bugfix|migration|feature>");
}
