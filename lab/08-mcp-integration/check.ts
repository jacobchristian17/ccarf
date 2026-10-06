// Lesson 8 grader: your MCP config (team/.mcp.json + team/personal/claude.json) and your tally-index server.
// No model. It parses the config files, expands ${VAR} the way Claude Code does, then starts your server over
// stdio with a real MCP client and inspects its tools, descriptions, resource and auth behaviour. ~3 s.
// Run:  npm run l8:check            (team/ + servers/)
//       npm run l8:check:solution   (solution/)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { green, red } from "../shared/colors.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, process.argv[2] === "solution" ? "solution" : ".");
const TEAM = join(SRC, "team");
const SERVER = join(SRC, "servers/tally-index.ts");

// ── Config ────────────────────────────────────────────────────────────────────
type Server = { command?: string; args?: string[]; env?: Record<string, string>; url?: string; headers?: Record<string, string> };
const json = (p: string): { mcpServers?: Record<string, Server> } | null => {
  try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; }
};
const project = json(join(TEAM, ".mcp.json"));
const personal = json(join(TEAM, "personal/claude.json"));
const P = project?.mcpServers ?? {};
const U = personal?.mcpServers ?? {};
const ti = P["tally-index"];
const TOKEN = /tk_\w{6,}/;
const walk = (d: string): string[] => !existsSync(d) ? [] : readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const committed = walk(TEAM).filter(p => !relative(TEAM, p).startsWith("personal"));
// Claude Code's expansion: ${VAR} and ${VAR:-default}; an unset var with no default stays as the literal text.
const expand = (s: string, env: Record<string, string>) => s.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (m, v, d) => env[v] ?? d ?? m);
const tokenRef = () => ti?.env?.TALLY_INDEX_TOKEN ?? "";

// ── Live server ───────────────────────────────────────────────────────────────
// Merge the fixture the way run.ts does, so find_references runs over the real tree.
const ROOT = mkdtempSync(join(tmpdir(), "tally8-check-"));
cpSync(join(HERE, "../07-team-config/fixture/tally"), ROOT, { recursive: true });
cpSync(join(HERE, "fixture-extra"), ROOT, { recursive: true });
async function connect(token?: string) {
  const env: Record<string, string> = { ...(process.env as Record<string, string>), TALLY_ROOT: ROOT };
  delete env.TALLY_INDEX_TOKEN;
  if (token !== undefined) env.TALLY_INDEX_TOKEN = token;
  const client = new Client({ name: "l8-check", version: "1" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: ["--import", "tsx", SERVER], env, cwd: join(HERE, ".."), stderr: "ignore" }));
  return client;
}
type Tool = { name: string; description?: string; annotations?: { readOnlyHint?: boolean } };
let tools: Tool[] = [], resources: { uri: string; description?: string; mimeType?: string }[] = [];
let schemaText = "", refsText = "", instructions = "", noTokenErr = "", literalErr = "", connectErr = "";
try {
  const c = await connect("tk_check_123456");
  tools = (await c.listTools()).tools;
  instructions = c.getInstructions() ?? "";
  try { resources = (await c.listResources()).resources; } catch { resources = []; }
  const sr = resources.find(r => r.uri === "tally://schema");
  if (sr) schemaText = ((await c.readResource({ uri: sr.uri })).contents[0] as { text?: string })?.text ?? "";
  const fr = await c.callTool({ name: "find_references", arguments: { symbol: "toCents" } });
  refsText = (fr.content as { text: string }[]).map(x => x.text).join("\n");
  await c.close();
  for (const [tok, set] of [[undefined, (s: string) => (noTokenErr = s)], ["${TALLY_INDEX_TOKEN}", (s: string) => (literalErr = s)]] as const) {
    const c2 = await connect(tok);
    const r = await c2.callTool({ name: "list_tables", arguments: {} });
    set(r.isError ? (r.content as { text: string }[])[0].text : "");
    await c2.close();
  }
} catch (e) { connectErr = String(e).slice(0, 200); }
const desc = (n: string) => tools.find(t => t.name === n)?.description ?? "";
const fr = () => desc("find_references");

// ── Checks ────────────────────────────────────────────────────────────────────
type Check = [string, () => unknown];
const groups: [string, Check[]][] = [
  ["2.4 · Scope: project .mcp.json vs user ~/.claude.json", [
    ["team/.mcp.json is valid JSON with an mcpServers object", () => project && typeof project.mcpServers === "object"],
    ["tally-index (the team's shared server) is in .mcp.json", () => ti],
    ["scratchpad (one developer's experiment) is NOT in .mcp.json", () => project && !P.scratchpad],
    ["scratchpad is in personal/claude.json (your ~/.claude.json)", () => U.scratchpad?.args?.some(a => /scratchpad\.mjs/.test(a))],
    ["tally-index is not duplicated in personal/claude.json", () => personal && !U["tally-index"]],
  ]],
  ["2.4 · Credentials: env var expansion, no committed secrets", [
    ["no literal tk_… token in any committed file under team/", () => committed.length && committed.every(p => !TOKEN.test(readFileSync(p, "utf8")))],
    ["tally-index passes TALLY_INDEX_TOKEN through env as ${TALLY_INDEX_TOKEN}", () => /^\$\{TALLY_INDEX_TOKEN\}$/.test(tokenRef())],
    ["…with no token hidden in a :-default fallback", () => tokenRef() && !TOKEN.test(tokenRef())],
    ["expanded with a developer's env, the server gets their token", () => expand(tokenRef(), { TALLY_INDEX_TOKEN: "tk_alice_42" }) === "tk_alice_42"],
    ["args still locate the server through ${TALLY_TOOLS_DIR}", () => ti?.args?.some(a => a.includes("${TALLY_TOOLS_DIR}"))],
  ]],
  ["2.4 · Your server answers over MCP (stdio handshake)", [
    ["servers/tally-index.ts starts and lists its tools", () => !connectErr && tools.length >= 3],
    ["find_references follows aliases and wrappers (5 caller files for toCents)", () => ["invoices.ts", "money.test.ts", "amounts.ts", "refunds.ts", "InvoiceForm.tsx"].every(f => refsText.includes(f))],
    ["with no token, tools return a permission error", () => /permission/.test(noTokenErr)],
    ["with an unset var (literal ${TALLY_INDEX_TOKEN}), the error says so", () => /literal/.test(literalErr)],
  ]],
  ["2.4 · TODO 3: a find_references description that beats Grep", [
    ["at least 200 characters", () => fr().length >= 200],
    ["says what Grep can't do: re-export aliases and wrapper functions", () => /alias|re-?export/i.test(fr()) && /wrapper/i.test(fr())],
    ["tells the model when to use it instead of Grep", () => /grep/i.test(fr()) && /(instead|rather than|prefer|over)/i.test(fr())],
    ["says what it returns (file:line call sites)", () => /file:?line|file and line/i.test(fr()) && /return/i.test(fr())],
    ["says what it does NOT cover (comments, strings, non-TS files)", () => /(not|n't)[^.]*(comment|string|non-?typescript)/i.test(fr())],
    ["reality lever: server instructions say when to use find_references", () => /find_references/.test(instructions)],
    ["reality lever: all 3 tools are annotated readOnlyHint (plan mode blocks the others)", () => tools.length >= 3 && tools.every(t => t.annotations?.readOnlyHint === true)],
  ]],
  ["2.4 · TODO 4: the schema as an MCP resource", [
    ["the server lists a resource tally://schema", () => resources.some(r => r.uri === "tally://schema")],
    ["…with a description of what's in it", () => (resources.find(r => r.uri === "tally://schema")?.description ?? "").length >= 30],
    ["…and mimeType text/markdown", () => resources.find(r => r.uri === "tally://schema")?.mimeType === "text/markdown"],
    ["reading it returns all 4 tables in one call", () => ["invoices", "line_items", "customers", "tax_rates"].every(t => schemaText.includes(t))],
    ["…with column detail (vat_rate_bp, basis points)", () => /vat_rate_bp/.test(schemaText) && /basis points/.test(schemaText)],
  ]],
];

let pass = 0, total = 0;
console.log(`Grading ${relative(join(HERE, ".."), SRC).split("\\").join("/") || "08-mcp-integration"}/team + servers/tally-index.ts`);
if (connectErr) console.log(red(`  (server failed to start: ${connectErr})`));
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
console.log((pass === total ? green : red)(`\n══ L8 check: ${pass}/${total}`));
process.exit(0);
