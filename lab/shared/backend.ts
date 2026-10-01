// Mock backend for the Scenario 1 customer-support agent.
// Lessons 1–3 grow this same system: raw loop → MCP tools → Agent SDK + hooks.
import type Anthropic from "@anthropic-ai/sdk";

type Customer = { id: string; name: string; email: string; tier: "standard" | "gold" };
type Order = {
  id: string; customerId: string; status: "shipped" | "delivered" | "processing";
  total: number; placedAt: string; items: string[];
};

const customers: Customer[] = [
  { id: "C-001", name: "Jane Rivera", email: "jane@example.com", tier: "gold" },
  { id: "C-002", name: "Jane Rivera", email: "jrivera@work.example", tier: "standard" },
  { id: "C-003", name: "Omar Haddad", email: "omar@example.com", tier: "standard" },
];

const orders: Order[] = [
  { id: "12345", customerId: "C-001", status: "delivered", total: 89.5, placedAt: "2026-09-12", items: ["Desk lamp"] },
  { id: "12346", customerId: "C-001", status: "shipped", total: 240.0, placedAt: "2026-09-25", items: ["Office chair"] },
  { id: "22001", customerId: "C-003", status: "processing", total: 15.99, placedAt: "2026-09-30", items: ["USB cable"] },
];

export const tools: Anthropic.Tool[] = [
  {
    name: "get_customer",
    description:
      "Look up customer accounts by email address or full name. Returns ALL matching accounts " +
      "(a name can match several people). Use this to identify who the customer is before any " +
      "order or refund action. Does not return orders.",
    input_schema: {
      type: "object",
      properties: {
        email: { type: "string", description: "Exact email address, e.g. jane@example.com" },
        name: { type: "string", description: "Full name, used only when no email is given" },
      },
    },
  },
  {
    name: "lookup_order",
    description:
      "Fetch one order by its numeric order ID (e.g. '12345', with or without a leading #). " +
      "Returns status, total, placed date and items. Use when the customer references a " +
      "specific order. Does not search by customer; use get_customer for identity.",
    input_schema: {
      type: "object",
      properties: { order_id: { type: "string", description: "Order number, digits only" } },
      required: ["order_id"],
    },
  },
];

/** Executes a tool call. Throws on failure; the loop decides how to report it. */
export function executeTool(name: string, input: unknown): unknown {
  const args = (input ?? {}) as Record<string, string>;
  switch (name) {
    case "get_customer": {
      const matches = customers.filter(c =>
        args.email ? c.email === args.email : c.name.toLowerCase() === (args.name ?? "").toLowerCase());
      return { matches };
    }
    case "lookup_order": {
      const id = String(args.order_id ?? "").replace(/^#/, "");
      if (id === "99999") throw new Error("ConnectionError: orders-db timed out after 5000ms (HTTP 504)");
      const order = orders.find(o => o.id === id);
      return order ? { order } : { order: null, note: "No order with that ID" };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
