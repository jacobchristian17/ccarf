// Scenario 1 data store with typed failures.
// Lesson 1's backend.ts reads the same data; Lesson 2's MCP server maps these
// error classes to structured MCP errors; Lesson 3 adds hooks on top.

export type Customer = { id: string; name: string; email: string; tier: "standard" | "gold" };
export type Order = {
  id: string; customerId: string; status: "shipped" | "delivered" | "processing";
  total: number; placedAt: string; items: string[];
};

export const customers: Customer[] = [
  { id: "C-001", name: "Jane Rivera", email: "jane@example.com", tier: "gold" },
  { id: "C-002", name: "Jane Rivera", email: "jrivera@work.example", tier: "standard" },
  { id: "C-003", name: "Omar Haddad", email: "omar@example.com", tier: "standard" },
];

export const orders: Order[] = [
  { id: "12345", customerId: "C-001", status: "delivered", total: 89.5, placedAt: "2026-09-12", items: ["Desk lamp"] },
  { id: "12346", customerId: "C-001", status: "shipped", total: 240.0, placedAt: "2026-09-25", items: ["Office chair"] },
  { id: "12347", customerId: "C-001", status: "delivered", total: 899.0, placedAt: "2026-09-20", items: ["Standing desk"] },
  { id: "11800", customerId: "C-001", status: "delivered", total: 45.0, placedAt: "2026-07-01", items: ["Mouse pad"] },
  { id: "22001", customerId: "C-003", status: "processing", total: 15.99, placedAt: "2026-09-30", items: ["USB cable"] },
];

/** Fixed "today" so refund-window results are the same whenever you run the lab. */
export const TODAY = "2026-10-02";
export const REFUND_WINDOW_DAYS = 30;
export const AUTO_REFUND_LIMIT = 500;

// ── Typed failures. The store says WHAT went wrong; the tool layer decides how to tell the agent.
/** The orders/payments service did not answer in time. Nothing about the request is wrong. */
export class UpstreamTimeoutError extends Error {}
/** The caller sent something malformed or impossible (e.g. refund more than the order total). */
export class InvalidInputError extends Error {}
/** The order exists but belongs to a different customer. */
export class NotOwnerError extends Error {}
/** A business rule forbids the action. `rule` says which one. */
export class PolicyError extends Error {
  constructor(public rule: "REFUND_LIMIT" | "NOT_DELIVERED" | "OUTSIDE_WINDOW", message: string) { super(message); }
}

export function findCustomers(q: { email?: string; name?: string }): Customer[] {
  if (q.email) return customers.filter(c => c.email.toLowerCase() === q.email!.toLowerCase());
  if (q.name) return customers.filter(c => c.name.toLowerCase() === q.name!.toLowerCase());
  return [];
}

/** Returns null when no such order exists. Throws UpstreamTimeoutError for order 99999. */
export function getOrder(orderId: string): Order | null {
  if (orderId === "99999") throw new UpstreamTimeoutError("orders-db timed out after 5000ms (HTTP 504)");
  return orders.find(o => o.id === orderId) ?? null;
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** Issues a refund, or throws one of the typed errors above. */
export function refund(customerId: string, orderId: string, amount: number) {
  const order = getOrder(orderId);
  if (!order) throw new InvalidInputError(`No order ${orderId}`);
  if (order.customerId !== customerId) throw new NotOwnerError(`Order ${orderId} does not belong to ${customerId}`);
  if (amount <= 0 || amount > order.total) throw new InvalidInputError(`Amount ${amount} must be > 0 and <= order total ${order.total}`);
  if (order.status !== "delivered") throw new PolicyError("NOT_DELIVERED", `Order is ${order.status}; only delivered orders can be refunded`);
  const age = daysBetween(order.placedAt, TODAY);
  if (age > REFUND_WINDOW_DAYS) throw new PolicyError("OUTSIDE_WINDOW", `Order is ${age} days old; window is ${REFUND_WINDOW_DAYS} days`);
  if (amount > AUTO_REFUND_LIMIT) throw new PolicyError("REFUND_LIMIT", `Refunds over $${AUTO_REFUND_LIMIT} need human approval`);
  return { refundId: `R-${orderId}-${Math.round(amount * 100)}`, orderId, amount, status: "issued" as const };
}
