// Lesson 2 lab: the Scenario 1 support tools as an MCP server (stdio).
// Grade it:   npm run l2:check        (17 checks; aim for all green)
// Use it:     claude -p --mcp-config 02-mcp-tools/mcp.json --strict-mcp-config ...  (see the lesson)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import {
  findCustomers, getOrder, refund, AUTO_REFUND_LIMIT, REFUND_WINDOW_DAYS,
  UpstreamTimeoutError, InvalidInputError, NotOwnerError, PolicyError,
} from "../shared/store.js";

// The error contract from the exam guide (2.2). Every failure the agent sees has this shape.
type ErrorCategory = "transient" | "validation" | "business" | "permission";
type ToolError = {
  errorCategory: ErrorCategory;
  isRetryable: boolean;
  message: string;          // for the agent: what went wrong and what to do next
  customerMessage?: string; // for the end user: safe to repeat verbatim
};

const ok = (data: unknown): CallToolResult => ({ content: [{ type: "text", text: JSON.stringify(data) }] });

// TODO 1 — Return an MCP tool-execution error: isError: true, with the ToolError as JSON text content.
//          (Protocol errors such as "unknown tool" are a different mechanism; you don't produce those.)
function fail(err: ToolError): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(err) }]
  }
}

// TODO 2 — Map each store error class to the contract. Decide category and retryability yourself:
//          UpstreamTimeoutError, InvalidInputError, NotOwnerError, PolicyError (see e.rule).
//          Business and permission errors need a customerMessage. The permission one must not
//          reveal whose order it is. Unknown errors: don't claim they're retryable.
function toToolError(e: unknown): ToolError {
  // throw e; // ← replace. Right now, the SDK catches this and sends a bare message with no metadata.

  if (e instanceof UpstreamTimeoutError)
    return {
      errorCategory: "transient",
      message: `${e.message}. Retry once; if it fails again, tell the customer the system is temporarily unavailable.`,
      isRetryable: true,
    }
  if (e instanceof InvalidInputError)
    return {
      errorCategory: "validation",
      message: "The input doesnt match with the schema. Check the format and retry; if it fails ask the customer to provide the correct fields for the tool",
      isRetryable: false,
    }
  if (e instanceof PolicyError)
    return {
      errorCategory: "business",
      message: "The action violates business policy rules. Inform the customer in a warm, friendly tone that this request is not allowed by policy",
      isRetryable: false,
      customerMessage: "This request is not allowed. Kindly check with the management"
    }
  if (e instanceof NotOwnerError)
    return {
      errorCategory: "permission",
      message: "Invalid authentication, requesting entity doesn't have access to the resource",
      isRetryable: false,
      customerMessage: "The customer requested this refund is not the owner. Please check your order number and try again"
    }
  return {
    errorCategory: "permission",
    isRetryable: false,
    message: "Unhandled error",
  }
}

const server = new McpServer({ name: "support", version: "1.0.0" });

// ── Worked example: a 2.1-grade description. Note what it says, when to use it, its
//    boundaries, what it returns, and what an empty result means.
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

// TODO 3 — lookup_order. The description below is the exam's "minimal description" (sample Q2).
//          Rewrite it to the get_customer standard. Then fix the handler:
//            '#12345' must work · 'abc' → validation error · no such order → SUCCESS with order: null
//            DB timeout (order 99999) → transient, retryable
server.registerTool("lookup_order", {
  description:
    "Search for orders using the provided order_id. Returns the matching order object" +
    "{order: Order | null}. If nothing is found, return null instead.  " +
    "Use this after get_customer to fetch for the order details. " +
    "The input order_id can accept '#' and 0-9 characters only, and parse it to get the order number (e.g. #123, 123)." +
    "If the order_id contains other characters than accepted, return a validation error (e.g. abc, #12a3" +
    "If the DB call times out, return a transient error and retry once",
  inputSchema: {
    order_id: z.string(),
  },
}, async ({ order_id }) => {
  const id = order_id.replace(/^#/, "").trim();
  if (!/^\d+$/.test(id)) return fail({ errorCategory: "validation", isRetryable: false, message: "Clarify with the user about the exact order_id they are looking for" });
  try {
    const order = getOrder(id);
    return ok({ order });
  } catch (error) {
    return fail(toToolError(error))
  }
});

// TODO 4 — Register process_refund(customer_id, order_id, amount) from scratch.
//          Call refund() from the store and map its failures with toToolError().
//          Its description must put the business rules (AUTO_REFUND_LIMIT, REFUND_WINDOW_DAYS)
//          in front of the agent BEFORE it calls.
server.registerTool("process_refund", {
  description:
    "Refunds an order owned by the provided customer. The amount limit is $500, and must not exceed 30 days from the day of the order. Do not use it to simply look up for customer or order info",
  inputSchema: {
    customer_id: z.string().describe("Exact customer_id"),
    order_id: z.string().describe("Exact order_id"),
    amount: z.number().positive().describe("Exact amount")
  },
}, async ({customer_id, order_id, amount}) => {
  const id = order_id.replace(/^#/, "").trim();
  if (!/^\d+$/.test(id)) return fail({ errorCategory: "validation", isRetryable: false, message: "Clarify with the user about the exact order_id they are looking for" });
  try {
    const refundProcessed = refund(customer_id, order_id, amount)
    return ok({refund: refundProcessed})
  } catch (error) {
    return fail(toToolError(error))
  }
})



await server.connect(new StdioServerTransport());
