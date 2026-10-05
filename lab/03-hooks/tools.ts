// Lesson 3: the Scenario 1 support tools as an IN-PROCESS MCP server for the Agent SDK.
// Same store and error contract as Lesson 2's reference server, plus two tools:
//   track_shipment     a "carrier API" that returns Unix timestamps and numeric status codes
//   escalate_to_human  takes a structured handoff (the human never sees the transcript)
// You don't edit this file. Your work is in hooks.ts.
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  findCustomers, getOrder, refund, AUTO_REFUND_LIMIT, REFUND_WINDOW_DAYS,
  UpstreamTimeoutError, InvalidInputError, NotOwnerError, PolicyError,
} from "../shared/store.js";

type ToolError = { errorCategory: "transient" | "validation" | "business" | "permission"; isRetryable: boolean; message: string; customerMessage?: string };
const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data) }] });
const fail = (err: ToolError): CallToolResult => ({ isError: true, content: [{ type: "text", text: JSON.stringify(err) }] });

function toToolError(e: unknown): ToolError {
  if (e instanceof UpstreamTimeoutError)
    return { errorCategory: "transient", isRetryable: true, message: `${e.message}. Retry once.`, customerMessage: "Our order system is slow right now. Please try again shortly." };
  if (e instanceof InvalidInputError)
    return { errorCategory: "validation", isRetryable: false, message: `${e.message}. Fix the input; do not retry unchanged.` };
  if (e instanceof NotOwnerError)
    return { errorCategory: "permission", isRetryable: false, message: `${e.message}. Reveal nothing; re-verify identity.`, customerMessage: "I can't find that order on your account." };
  if (e instanceof PolicyError)
    return { errorCategory: "business", isRetryable: false, message: `${e.rule}: ${e.message}. Retrying will not help.` };
  return { errorCategory: "transient", isRetryable: false, message: "Unexpected error. Escalate to a human." };
}

// ── Carrier data. Deliberately a different shape from our own store: epoch seconds and numeric codes.
// Status codes (carrier docs): 1 label created · 2 picked up · 3 in transit · 4 out for delivery · 5 delivered · 9 exception
export const shipments: Record<string, { tracking_no: string; status: number; eta: number; last_scan: number }> = {
  "12346": { tracking_no: "1Z999AA10123456784", status: 3, eta: 1791331200, last_scan: 1790864520 },
  "12345": { tracking_no: "1Z999AA10123456700", status: 5, eta: 1789516800, last_scan: 1789497000 },
};

/** Every handoff the agent creates lands here (a stand-in for your ticketing queue). */
export const handoffs: unknown[] = [];

/** THIN=1 swaps in one-line descriptions (Lesson 2's "before"), so the model knows no rules and the hooks get exercised. */
const thin = process.env.THIN === "1";
const d = (full: string, short: string) => (thin ? short : full);

export const supportServer = createSdkMcpServer({
  name: "support",
  version: "3.0.0",
  tools: [
    tool("get_customer",
      d("Look up customer accounts by email address or full name. Returns ALL matching accounts as { matches: Customer[] }, " +
      "because one name can match several people. Use this to identify the customer before any order, shipment or refund action. " +
      "Prefer email: it is unique. If more than one account matches, ask the customer for their email instead of guessing. " +
      "An empty matches array is a successful lookup that found nobody, not an error.",
        "Retrieves customer information."),
      {
        email: z.string().email().optional().describe("Exact email address, e.g. jane@example.com"),
        name: z.string().optional().describe("Full name, e.g. 'Jane Rivera'. Use only when no email is given."),
      },
      async ({ email, name }) => {
        if (!email && !name) return fail({ errorCategory: "validation", isRetryable: false, message: "Provide email or name." });
        return ok({ matches: findCustomers({ email, name }) });
      }),

    tool("lookup_order",
      d("Fetch ONE order by its order number and return { order } with status, total, placedAt (ISO date) and items. " +
      "Use when the customer mentions an order number such as '#12345'; strip the '#'. Do not use it to identify a customer. " +
      "Returns { order: null } when no order has that number (a successful lookup, not an error).",
        "Retrieves order details."),
      { order_id: z.string().describe("Order number, digits only, e.g. '12345'") },
      async ({ order_id }) => {
        const id = order_id.replace(/^#/, "").trim();
        if (!/^\d+$/.test(id)) return fail({ errorCategory: "validation", isRetryable: false, message: `order_id must be digits (got '${order_id}').` });
        try { return ok({ order: getOrder(id) }); } catch (e) { return fail(toToolError(e)); }
      }),

    tool("track_shipment",
      d("Get carrier tracking for a shipped order: tracking number, delivery status, estimated delivery and last scan time. " +
      "Use when the customer asks where a package is or when it will arrive. Do not use it for order totals or refunds: use lookup_order. " +
      "Returns { shipment: null } when the carrier has no record for the order (for example, it has not shipped yet).",
        "Retrieves shipment tracking."),
      { order_id: z.string().describe("Order number, digits only, e.g. '12346'") },
      async ({ order_id }) => ok({ shipment: shipments[order_id.replace(/^#/, "").trim()] ?? null })),

    tool("process_refund",
      d("Issue a refund on a delivered order. Requires the verified customer_id from get_customer AND the order_id. " +
      `Business rules: only delivered orders, within ${REFUND_WINDOW_DAYS} days of purchase, at most $${AUTO_REFUND_LIMIT} without human approval. ` +
      "Rule violations come back as errorCategory 'business' with isRetryable false; do not retry them.",
        "Processes a refund."),
      {
        customer_id: z.string().describe("Customer id from get_customer, e.g. 'C-001'"),
        order_id: z.string().describe("Order number, digits only"),
        amount: z.number().describe("Refund amount in USD, e.g. 89.5"),
      },
      async ({ customer_id, order_id, amount }) => {
        try { return ok(refund(customer_id, order_id.replace(/^#/, ""), amount)); } catch (e) { return fail(toToolError(e)); }
      }),

    tool("escalate_to_human",
      d("Hand the case to a human agent. The human CANNOT see this conversation, so the handoff must stand on its own. " +
      "Use when the customer asks for a human, when policy is ambiguous or silent on their request, when an action needs " +
      "human approval (e.g. a refund over the limit), or when you cannot make progress. After calling it, tell the customer " +
      "a specialist will follow up; do not promise an outcome.",
        "Escalates to a human agent."),
      {
        customer_id: z.string().nullable().describe("Verified customer id, or null if identity was never confirmed"),
        issue_summary: z.string().describe("What the customer wants, in one or two sentences"),
        root_cause: z.string().describe("Why this needs a human: the rule, gap or failure that blocked you"),
        order_ids: z.array(z.string()).describe("Orders involved, digits only"),
        refund_amount: z.number().nullable().describe("Refund amount in USD under consideration, or null"),
        actions_taken: z.array(z.string()).describe("What you already checked or did, e.g. 'verified identity via email'"),
        recommended_action: z.string().describe("What you recommend the human do next"),
      },
      async (handoff) => {
        handoffs.push(handoff);
        return ok({ ticket: `H-${1000 + handoffs.length}`, status: "queued" });
      }),
  ],
});
