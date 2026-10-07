// Hidden acceptance tests for the generated src/checkout.ts. The generator and the reviewers never see this file.
// Each test is tagged with the requirement it checks; run.ts reports which requirements the generated code fails.
type Priced = { subtotalCents: number; discountCents: number; taxCents: number; totalCents: number };
type Fn = (o: { items: { priceCents: number; qty: number }[]; code?: string; country: string }, now: Date) => Priced;
const JUNE = new Date("2026-06-15T12:00:00Z");
const it = (o: Parameters<Fn>[0], now = JUNE) => (f: Fn) => f(o, now);

export const TESTS: [string, string, (f: Fn) => boolean][] = [
  ["R1", "subtotal sums price × qty", f => it({ items: [{ priceCents: 1000, qty: 2 }, { priceCents: 250, qty: 3 }], country: "US" })(f).subtotalCents === 2750],
  ["R2", "SAVE10 is case-insensitive and trims", f => it({ items: [{ priceCents: 5000, qty: 1 }], code: "  save10 ", country: "US" })(f).discountCents === 500],
  ["R2", "SAVE10 rounds half-up (1005 → 101)", f => it({ items: [{ priceCents: 1005, qty: 1 }], code: "SAVE10", country: "US" })(f).discountCents === 101],
  ["R3", "SAVE10 still valid at 2026-06-30T23:30Z", f => it({ items: [{ priceCents: 5000, qty: 1 }], code: "SAVE10", country: "US" }, new Date("2026-06-30T23:30:00Z"))(f).discountCents === 500],
  ["R3", "SAVE10 ignored on 2026-07-01, no throw", f => it({ items: [{ priceCents: 5000, qty: 1 }], code: "SAVE10", country: "US" }, new Date("2026-07-01T00:00:01Z"))(f).discountCents === 0],
  ["R3", "unknown code ignored, no throw", f => it({ items: [{ priceCents: 5000, qty: 1 }], code: "BOGUS", country: "US" })(f).discountCents === 0],
  ["R4", "FIVE needs a subtotal of at least 2000", f => it({ items: [{ priceCents: 1999, qty: 1 }], code: "FIVE", country: "US" })(f).discountCents === 0],
  ["R4", "FIVE applies at exactly 2000", f => it({ items: [{ priceCents: 2000, qty: 1 }], code: "FIVE", country: "US" })(f).discountCents === 500],
  ["R5", "tax is on the discounted amount", f => it({ items: [{ priceCents: 10000, qty: 1 }], code: "SAVE10", country: "DE" })(f).taxCents === 1710],
  ["R5", "tax rounds half-up (1250 DE → 238)", f => it({ items: [{ priceCents: 1250, qty: 1 }], country: "DE" })(f).taxCents === 238],
  ["R5", "FR is 20%, others 0%", f => it({ items: [{ priceCents: 1000, qty: 1 }], country: "FR" })(f).taxCents === 200 && it({ items: [{ priceCents: 1000, qty: 1 }], country: "US" })(f).taxCents === 0],
  ["R6", "total = subtotal - discount + tax", f => { const p = it({ items: [{ priceCents: 3000, qty: 1 }], code: "FIVE", country: "FR" })(f); return p.totalCents === 3000 - 500 + 500; }],
  ["R7", "qty 0 throws 'invalid'", f => { try { it({ items: [{ priceCents: 100, qty: 0 }], country: "US" })(f); return false; } catch (e) { return /invalid/i.test(String(e)); } }],
  ["R7", "fractional priceCents throws 'invalid'", f => { try { it({ items: [{ priceCents: 10.5, qty: 1 }], country: "US" })(f); return false; } catch (e) { return /invalid/i.test(String(e)); } }],
];
