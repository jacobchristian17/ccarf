# Spec: `priceOrder` (src/checkout.ts)

Implement and export:

```ts
export type OrderInput = { items: { priceCents: number; qty: number }[]; code?: string; country: string };
export type Priced = { subtotalCents: number; discountCents: number; taxCents: number; totalCents: number };
export function priceOrder(order: OrderInput, now: Date): Priced;
```

All amounts are integer cents.

- **R1** `subtotalCents` is the sum of `priceCents * qty` over all items.
- **R2** Discount codes are case-insensitive, and surrounding whitespace is ignored. `SAVE10` takes 10% off the subtotal (rounded half-up to whole cents). `FIVE` takes 500 cents off.
- **R3** `SAVE10` is valid through 30 June 2026 **inclusive**, meaning until the end of that day in UTC. After that, the code is ignored (no discount, no error). An unknown code is also ignored.
- **R4** `FIVE` applies only when the subtotal is at least 2000 cents. No discount may ever exceed the subtotal.
- **R5** Tax is computed on the discounted amount (`subtotalCents - discountCents`). Rates are `DE` 19%, `FR` 20%, and 0% for every other country. Tax is rounded half-up to whole cents. For example, 1250 cents in DE has 237.5 cents of tax, which rounds to 238.
- **R6** `totalCents = subtotalCents - discountCents + taxCents`.
- **R7** An item with `qty` of 0 or less, or a `priceCents` that isn't a non-negative integer, makes `priceOrder` throw an `Error` whose message contains the word `invalid`.
