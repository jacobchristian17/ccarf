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
  throw new Error("TODO 1");
}

// TODO 2 — Map each store error class to the contract. Decide category and retryability yourself:
//          UpstreamTimeoutError, InvalidInputError, NotOwnerError, PolicyError (see e.rule).
//          Business and permission errors need a customerMessage. The permission one must not
//          reveal whose order it is. Unknown errors: don't claim they're retryable.
function toToolError(e: unknown): ToolError {
  throw e; // ← replace. Right now, the SDK catches this and sends a bare message with no metadata.
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
  description: "Retrieves order details.",
  inputSchema: {
    order_id: z.string(),
  },
}, async ({ order_id }) => {
  return ok({ order: getOrder(order_id) });
});

// TODO 4 — Register process_refund(customer_id, order_id, amount) from scratch.
//          Call refund() from the store and map its failures with toToolError().
//          Its description must put the business rules (AUTO_REFUND_LIMIT, REFUND_WINDOW_DAYS)
//          in front of the agent BEFORE it calls.

await server.connect(new StdioServerTransport());
