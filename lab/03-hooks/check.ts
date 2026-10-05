// Lesson 3 grader: calls your hook callbacks directly with synthetic SDK inputs. No model, no network.
// Run:  npm run l3:check            (your hooks.ts + prompt.ts)
//       npm run l3:check:solution   (reference)
const dir = process.argv[2] === "solution" ? "./solution/" : "./";
const H = await import(`${dir}hooks.ts`);
const { SYSTEM_PROMPT } = await import(`${dir}prompt.ts`);

const ctx = { signal: new AbortController().signal };
const base = { session_id: "s", transcript_path: "", cwd: "." };
const pre = (tool: string, tool_input: object) =>
  ({ ...base, hook_event_name: "PreToolUse", tool_name: `mcp__support__${tool}`, tool_input, tool_use_id: "t" });
const post = (tool: string, tool_input: object, data: unknown) =>
  ({ ...base, hook_event_name: "PostToolUse", tool_name: `mcp__support__${tool}`, tool_input, tool_use_id: "t",
     tool_response: [{ type: "text", text: JSON.stringify(data) }] });

const decision = (out: any) => out?.hookSpecificOutput?.permissionDecision ?? "allow";
const reason = (out: any): string => out?.hookSpecificOutput?.permissionDecisionReason ?? "";
const replaced = (out: any) => {
  const o = out?.hookSpecificOutput?.updatedToolOutput ?? out?.hookSpecificOutput?.updatedMCPToolOutput;
  if (!o) return null;
  const text = Array.isArray(o) ? o.find((b: any) => b.type === "text")?.text : typeof o === "string" ? o : JSON.stringify(o);
  try { return JSON.parse(text); } catch { return null; }
};

const JANE = { id: "C-001", name: "Jane Rivera", email: "jane@example.com", tier: "gold" };
const JANE2 = { id: "C-002", name: "Jane Rivera", email: "jrivera@work.example", tier: "standard" };

/** Fresh session, optionally after a get_customer call that returned `matches`. */
async function session(matches?: object[]) {
  const state = H.newState();
  let postOut: any;
  if (matches) postOut = await H.recordVerification(state)(post("get_customer", { email: "x" }, { matches }), "t", ctx);
  return { state, postOut, gate: (tool: string, input: object) => H.requireVerifiedCustomer(state)(pre(tool, input), "t", ctx) };
}

let pass = 0, total = 0;
const groups: [string, [string, () => Promise<boolean>][]][] = [
  ["1.4 · Prerequisite gate (TODO 1–2)", [
    ["lookup_order before get_customer → deny", async () => decision(await (await session()).gate("lookup_order", { order_id: "12346" })) === "deny"],
    ["track_shipment before get_customer → deny", async () => decision(await (await session()).gate("track_shipment", { order_id: "12346" })) === "deny"],
    ["deny reason tells the agent what to do (mentions get_customer)", async () => /get_customer/.test(reason(await (await session()).gate("lookup_order", { order_id: "1" })))],
    ["get_customer itself is never gated", async () => decision(await (await session()).gate("get_customer", { email: "jane@example.com" })) === "allow"],
    ["one match → state.verifiedCustomerId = C-001", async () => (await session([JANE])).state.verifiedCustomerId === "C-001"],
    ["one match → lookup_order allowed", async () => decision(await (await session([JANE])).gate("lookup_order", { order_id: "12346" })) === "allow"],
    ["zero matches → still blocked", async () => decision(await (await session([])).gate("lookup_order", { order_id: "12346" })) === "deny"],
    ["two 'Jane Rivera' matches → still blocked (no heuristic pick)", async () => decision(await (await session([JANE, JANE2])).gate("lookup_order", { order_id: "12346" })) === "deny"],
    ["two matches → additionalContext asks for another identifier", async () =>
      /email|identifier/i.test((await session([JANE, JANE2])).postOut?.hookSpecificOutput?.additionalContext ?? "")],
    ["process_refund with a different customer_id → deny", async () =>
      decision(await (await session([JANE])).gate("process_refund", { customer_id: "C-003", order_id: "22001", amount: 10 })) === "deny"],
    ["process_refund with the verified customer_id → allow", async () =>
      decision(await (await session([JANE])).gate("process_refund", { customer_id: "C-001", order_id: "12345", amount: 89.5 })) === "allow"],
    ["state is per session (a new session starts unverified)", async () => { await session([JANE]); return (await session()).state.verifiedCustomerId === null; }],
  ]],
  ["1.5 · Policy interception (TODO 3)", [
    ["process_refund $899 → deny", async () => decision(await H.enforceRefundLimit(pre("process_refund", { customer_id: "C-001", order_id: "12347", amount: 899 }), "t", ctx)) === "deny"],
    ["…and redirects to escalate_to_human", async () => /escalate_to_human/.test(reason(await H.enforceRefundLimit(pre("process_refund", { customer_id: "C-001", order_id: "12347", amount: 899 }), "t", ctx)))],
    ["process_refund exactly $500 → allow (the rule is 'over $500')", async () => decision(await H.enforceRefundLimit(pre("process_refund", { customer_id: "C-001", order_id: "12347", amount: 500 }), "t", ctx)) === "allow"],
    ["process_refund $89.50 → allow", async () => decision(await H.enforceRefundLimit(pre("process_refund", { customer_id: "C-001", order_id: "12345", amount: 89.5 }), "t", ctx)) === "allow"],
  ]],
  ["1.5 · Normalisation (TODO 4)", [
    ["track_shipment output is replaced (updatedToolOutput)", async () => replaced(await H.normalizeShipment(post("track_shipment", { order_id: "12346" },
      { shipment: { tracking_no: "1Z", status: 3, eta: 1791331200, last_scan: 1790864520 } }), "t", ctx)) !== null],
    ["status 3 → 'in_transit'", async () => replaced(await H.normalizeShipment(post("track_shipment", {}, { shipment: { tracking_no: "1Z", status: 3, eta: 1791331200, last_scan: 1790864520 } }), "t", ctx))?.shipment?.status === "in_transit"],
    ["eta epoch seconds → ISO 2026-10-07T00:00:00.000Z", async () => replaced(await H.normalizeShipment(post("track_shipment", {}, { shipment: { tracking_no: "1Z", status: 3, eta: 1791331200, last_scan: 1790864520 } }), "t", ctx))?.shipment?.eta === "2026-10-07T00:00:00.000Z"],
    ["last_scan → ISO 2026-10-01T14:22:00.000Z", async () => replaced(await H.normalizeShipment(post("track_shipment", {}, { shipment: { tracking_no: "1Z", status: 3, eta: 1791331200, last_scan: 1790864520 } }), "t", ctx))?.shipment?.last_scan === "2026-10-01T14:22:00.000Z"],
    ["unmapped status 7 → 'unknown' (no crash)", async () => replaced(await H.normalizeShipment(post("track_shipment", {}, { shipment: { tracking_no: "1Z", status: 7, eta: 1791331200, last_scan: 1790864520 } }), "t", ctx))?.shipment?.status === "unknown"],
    ["tracking_no is kept", async () => replaced(await H.normalizeShipment(post("track_shipment", {}, { shipment: { tracking_no: "1Z9", status: 5, eta: 1791331200, last_scan: 1790864520 } }), "t", ctx))?.shipment?.tracking_no === "1Z9"],
    ["{ shipment: null } passes through unchanged", async () => replaced(await H.normalizeShipment(post("track_shipment", {}, { shipment: null }), "t", ctx)) === null],
  ]],
  ["5.2 · Escalation prompt structure (TODO 5) · structure only, l3:ask shows behaviour", [
    ["explicit human request → escalate immediately", async () => /human/i.test(SYSTEM_PROMPT) && /immediately|at once|right away|straight away/i.test(SYSTEM_PROMPT)],
    ["policy ambiguous or silent → escalate", async () => /silent|ambiguous|not covered|doesn't cover|does not cover/i.test(SYSTEM_PROMPT)],
    ["frustration alone is NOT a trigger", async () => /frustrat|angry|upset|sentiment/i.test(SYSTEM_PROMPT) && /not|only if/i.test(SYSTEM_PROMPT)],
    ["multiple matches → ask for another identifier", async () => /(more than one|multiple|several)[^.]*(account|match)/i.test(SYSTEM_PROMPT)],
    ["≥2 few-shot examples in <example> tags", async () => (SYSTEM_PROMPT.match(/<example>/g) ?? []).length >= 2],
  ]],
];

for (const [title, checks] of groups) {
  console.log(`\n${title}`);
  for (const [name, fn] of checks) {
    total++;
    let ok = false, err = "";
    try { ok = await fn(); } catch (e) { err = ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
    if (ok) pass++;
    console.log(`  ${ok ? "✓" : "✗"} ${name}${err}`);
  }
}
console.log(`\n══ L3 check: ${pass}/${total}${pass === total ? " · all green" : ""}`);
