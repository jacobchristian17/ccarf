// Lesson 2 reference solution: Scenario 1 support tools as an MCP server (stdio).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  findCustomers, getOrder, refund, AUTO_REFUND_LIMIT, REFUND_WINDOW_DAYS,
  UpstreamTimeoutError, InvalidInputError, NotOwnerError, PolicyError,
} from "../../shared/store.js";

type ErrorCategory = "transient" | "validation" | "business" | "permission";
type ToolError = {
  errorCategory: ErrorCategory;
  isRetryable: boolean;
  message: string;          // for the agent: what went wrong and what to do next
  customerMessage?: string; // for the end user: safe to repeat verbatim
};

const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data) }] });
const fail = (err: ToolError): CallToolResult => ({ isError: true, content: [{ type: "text", text: JSON.stringify(err) }] });

/** One place that maps store failures to the error contract. Unknown errors are NOT guessed as retryable. */
function toToolError(e: unknown): ToolError {
  if (e instanceof UpstreamTimeoutError)
    return { errorCategory: "transient", isRetryable: true,
      message: `${e.message}. Retry once; if it fails again, tell the customer the system is temporarily unavailable.`,
      customerMessage: "Our order system is slow to respond right now. Please try again in a few minutes." };
  if (e instanceof InvalidInputError)
    return { errorCategory: "validation", isRetryable: false,
      message: `${e.message}. Fix the input before calling again; do not retry unchanged.` };
  if (e instanceof NotOwnerError)
    return { errorCategory: "permission", isRetryable: false,
      message: `${e.message}. Do not reveal anything about this order. Re-verify the customer's identity.`,
      customerMessage: "I can't find that order on your account. Could you double-check the order number?" };
  if (e instanceof PolicyError) {
    const customerMessage = {
      REFUND_LIMIT: `Refunds over $${AUTO_REFUND_LIMIT} need a quick review by our team. I've flagged this for a specialist.`,
      NOT_DELIVERED: "This order hasn't been delivered yet, so it can't be refunded. I can help you cancel it instead.",
      OUTSIDE_WINDOW: `This order is outside our ${REFUND_WINDOW_DAYS}-day refund window.`,
    }[e.rule];
    return { errorCategory: "business", isRetryable: false,
      message: `${e.rule}: ${e.message}. Retrying will not help.${e.rule === "REFUND_LIMIT" ? " Escalate to a human." : ""}`,
      customerMessage };
  }
  return { errorCategory: "transient", isRetryable: false, message: `Unexpected error: ${String(e)}. Escalate to a human.` };
}

const server = new McpServer({ name: "support", version: "1.0.0" });

server.registerTool("get_customer", {
  description:
    "Look up customer accounts by email address or full name. Returns ALL matching accounts as " +
    "{ matches: Customer[] }, because one name can match several people. Use this to identify who " +
    "the customer is before any order or refund action. Prefer email: it is unique. If a name matches " +
    "more than one account, ask the customer for their email instead of guessing. " +
    "An empty matches array is a successful lookup that found nobody, not an error. Does not return orders.",
  inputSchema: {
    email: z.string().email().optional().describe("Exact email address, e.g. jane@example.com"),
    name: z.string().optional().describe("Full name, e.g. 'Jane Rivera'. Use only when no email is given."),
  },
}, async ({ email, name }) => {
  if (!email && !name)
    return fail({ errorCategory: "validation", isRetryable: false, message: "Provide email or name. Ask the customer for their email." });
  return ok({ matches: findCustomers({ email, name }) });
});

server.registerTool("lookup_order", {
  description:
    "Fetch ONE order by its order number and return { order } with status, total, placed date and items. " +
    "Use when the customer mentions a specific order number such as '#12345' or 'order 12345'; strip the '#'. " +
    "Do not use this to find a customer, list a customer's orders, or search by email or name: use " +
    "get_customer for identity. If no order has that number, returns { order: null } (a successful lookup, not an error). " +
    "Errors come back as JSON with errorCategory and isRetryable; retry only when isRetryable is true.",
  inputSchema: {
    order_id: z.string().describe("Order number, digits only, e.g. '12345'. Strip any leading '#'."),
  },
}, async ({ order_id }) => {
  const id = order_id.replace(/^#/, "").trim();
  if (!/^\d+$/.test(id))
    return fail({ errorCategory: "validation", isRetryable: false,
      message: `order_id must be digits only (got '${order_id}'). Ask the customer for the order number shown in their confirmation email.` });
  try {
    const order = getOrder(id);
    return ok(order ? { order } : { order: null, note: `No order numbered ${id}. Ask the customer to check the number.` });
  } catch (e) {
    return fail(toToolError(e));
  }
});

server.registerTool("process_refund", {
  description:
    "Issue a refund on a delivered order. Requires the verified customer_id from get_customer AND the order_id; " +
    "never call it before identity is confirmed. Amount is in USD and must not exceed the order total. " +
    `Business rules: only delivered orders, within ${REFUND_WINDOW_DAYS} days of purchase, and at most $${AUTO_REFUND_LIMIT} ` +
    "without human approval. Rule violations come back as errorCategory 'business' with isRetryable false and a " +
    "customerMessage you can relay; do not retry them. Do not use this to cancel undelivered orders.",
  inputSchema: {
    customer_id: z.string().describe("Customer id from get_customer, e.g. 'C-001'"),
    order_id: z.string().describe("Order number, digits only"),
    amount: z.number().describe("Refund amount in USD, e.g. 89.5"),
  },
}, async ({ customer_id, order_id, amount }) => {
  try {
    return ok(refund(customer_id, order_id.replace(/^#/, ""), amount));
  } catch (e) {
    return fail(toToolError(e));
  }
});

await server.connect(new StdioServerTransport());
