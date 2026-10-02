// Lesson 2 grader: connects to your MCP server as a real MCP client and checks
// the tool descriptions (2.1) and the structured error contract (2.2).
// Run:  npm run l2:check            (grades 02-mcp-tools/server.ts)
//       npm run l2:check:solution   (grades the reference solution)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, process.argv[2] ?? "server.ts");

const client = new Client({ name: "l2-check", version: "1.0.0" });
await client.connect(new StdioClientTransport({
  command: process.execPath,
  args: ["--import", "tsx", serverPath],
  cwd: path.resolve(here, ".."),
  stderr: "inherit",
}));

let passed = 0, total = 0;
function check(label: string, ok: boolean, hint: string) {
  total++;
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else console.log(`  ✗ ${label}\n      → ${hint}`);
}

type Payload = { errorCategory?: string; isRetryable?: unknown; message?: string; customerMessage?: string; [k: string]: unknown };
async function call(name: string, args: Record<string, unknown>) {
  let res: CallToolResult;
  try { res = (await client.callTool({ name, arguments: args })) as CallToolResult; }
  catch (e) { return { isError: true, raw: String(e), json: null as Payload | null }; }
  const raw = res.content?.[0]?.type === "text" ? res.content[0].text : "";
  let json: Payload | null = null;
  try { json = JSON.parse(raw); } catch { /* not JSON */ }
  return { isError: res.isError === true, raw, json };
}

/** Grades one error case against the guide's contract. */
async function expectError(label: string, name: string, args: Record<string, unknown>,
  category: string, retryable: boolean, needsCustomerMessage = false) {
  const r = await call(name, args);
  if (!r.isError) return check(label, false, `Expected isError: true, got a success result: ${r.raw.slice(0, 120)}`);
  if (/Tool \w+ not found/.test(r.raw)) return check(label, false, `${name} isn't registered yet.`);
  if (!r.json) return check(label, false,
    `isError is true but the content isn't JSON: "${r.raw.slice(0, 110)}". That's the uniform error the guide warns about. ` +
    `Catch it and return fail({ errorCategory, isRetryable, message }).`);
  const problems: string[] = [];
  if (r.json.errorCategory !== category) problems.push(`errorCategory should be "${category}" (got ${JSON.stringify(r.json.errorCategory)})`);
  if (r.json.isRetryable !== retryable) problems.push(`isRetryable should be ${retryable} (got ${JSON.stringify(r.json.isRetryable)})`);
  if (!r.json.message) problems.push("message is missing: tell the agent what happened and what to do next");
  if (needsCustomerMessage && !r.json.customerMessage) problems.push("customerMessage is missing: give the agent something safe to say to the customer");
  check(label, problems.length === 0, problems.join("; "));
  return r.json;
}

const sentences = (s = "") => s.split(/[.!?](\s|$)/).filter(x => x && x.trim().length > 3).length;

// ── 2.1 Tool descriptions ────────────────────────────────────────────────
console.log("\n2.1 · Tool descriptions");
const { tools } = await client.listTools();
const byName = Object.fromEntries(tools.map(t => [t.name, t]));
for (const name of ["get_customer", "lookup_order", "process_refund"]) {
  const t = byName[name];
  check(`${name}: exists and has a description of ≥3 sentences`,
    !!t && sentences(t.description) >= 3,
    t ? `Has ${sentences(t.description)} sentence(s). Say what it does, when to use it (and when not), the input format, and what it returns.`
      : "Tool not registered yet.");
}
const lo = byName.lookup_order?.description ?? "";
check("lookup_order: draws the boundary with get_customer", /get_customer/.test(lo),
  "Name the similar tool and say when to use it instead. That's how you stop get_customer ↔ lookup_order misrouting.");
check("lookup_order: states the input format", /#|digit|numer/i.test(lo),
  "Say what an order number looks like (digits, with or without a '#').");
check("lookup_order: says 'not found' is not an error", /null|not an error|empty|no order/i.test(lo),
  "Tell the agent what an empty result looks like, so it doesn't treat it as a failure.");
const pr = byName.process_refund?.description ?? "";
check("process_refund: states the business rules", /500/.test(pr) && /30/.test(pr),
  "Put the $500 limit and the 30-day window in the description, so the agent knows them before it calls.");

// ── 2.2 Structured errors ────────────────────────────────────────────────
console.log("\n2.2 · Structured errors");
await expectError("lookup_order 99999 (DB timeout) → transient, retryable", "lookup_order", { order_id: "99999" }, "transient", true);
await expectError("lookup_order 'abc' → validation, not retryable", "lookup_order", { order_id: "abc" }, "validation", false);

const empty = await call("lookup_order", { order_id: "55555" });
check("lookup_order 55555 (no such order) → success with order: null, NOT isError",
  !empty.isError && empty.json?.order === null,
  empty.isError ? "No match is a valid empty result. Return it as a success, or the agent will retry or apologise for an outage that never happened."
                : `Expected { order: null, … }, got ${empty.raw.slice(0, 100)}`);

const found = await call("lookup_order", { order_id: "#12345" });
check("lookup_order '#12345' → success (strips the #)", !found.isError && !!(found.json as any)?.order,
  `Expected a found order, got ${found.raw.slice(0, 100)}`);

const good = await call("process_refund", { customer_id: "C-001", order_id: "12345", amount: 89.5 });
check("process_refund C-001/12345/$89.50 → success", !good.isError, `Expected success, got ${good.raw.slice(0, 120)}`);

const perm = await expectError("process_refund on someone else's order → permission, not retryable",
  "process_refund", { customer_id: "C-003", order_id: "12345", amount: 10 }, "permission", false, true);
if (perm?.customerMessage)
  check("permission customerMessage doesn't leak the other account", !/C-001|Jane|lamp/i.test(perm.customerMessage),
    "Don't confirm whose order it is or what's in it.");

await expectError("process_refund $899 → business (REFUND_LIMIT), not retryable", "process_refund",
  { customer_id: "C-001", order_id: "12347", amount: 899 }, "business", false, true);
await expectError("process_refund 93-day-old order → business (OUTSIDE_WINDOW), not retryable", "process_refund",
  { customer_id: "C-001", order_id: "11800", amount: 45 }, "business", false, true);
await expectError("process_refund $1000 on an $89.50 order → validation, not retryable", "process_refund",
  { customer_id: "C-001", order_id: "12345", amount: 1000 }, "validation", false);

console.log(`\n══ L2 check: ${passed}/${total} ${passed === total ? "· all green" : ""}`);
await client.close();
process.exit(passed === total ? 0 : 1);
