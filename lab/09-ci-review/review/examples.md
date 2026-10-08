<examples>
<example>
<code file="src/shipping.ts">
-export function shippingCost(order: Order): number { return order.weightKg * RATE_DOLLARS; }
+export function shippingCost(order: Order): number { return Math.round(order.weightKg * RATE_DOLLARS * 100); }
</code>
<code file="src/web/cart.tsx" note="not touched by the PR, found with Grep">
<span>Shipping: ${shippingCost(order).toFixed(2)}</span>
</code>
<reasoning>shippingCost now returns cents, but cart.tsx, which this PR doesn't touch, still renders the value as dollars. Each file looks fine on its own, and the defect only shows up when you follow the changed export to its callers. That makes it a contract finding, not a style note on shipping.ts.</reasoning>
<output>{"file":"src/web/cart.tsx","line":14,"severity":"high","category":"contract","issue":"shippingCost now returns cents (shipping.ts) but cart.tsx still formats it as dollars, so the cart shows 100x the shipping cost.","suggested_fix":"Format with formatCents(shippingCost(order)), or divide by 100 at the call site.","detected_pattern":"changed-units-stale-caller","confidence":0.9}</output>
</example>

<example>
<code file="src/api/handlers.ts">
+export async function cancelRoute(db: Db, body: any) {
+  if (!body.orderId) return err("orderId required");
</code>
<reasoning>`body: any` looks like a type-safety issue. But a comment in this file and CLAUDE.md both say that the gateway validates bodies and that handlers type them as any by convention. Following a documented local convention is not a finding. Reporting it would add noise that teaches developers to ignore the review.</reasoning>
<output>(no finding)</output>
</example>

<example>
<code file="src/coupons.ts">
+// Returns undefined when the coupon doesn't exist.
+export function findCoupon(code: string): Coupon {
+  const c = COUPONS.get(code);
+  if (!c) throw new NotFoundError(code);
</code>
<reasoning>A terse or slightly outdated comment wouldn't be worth reporting. This one claims behaviour (returning undefined) that contradicts the code (it throws). A caller who trusts the comment will write `if (!findCoupon(x))` and crash instead. So it's a comment finding, and medium, because it misleads rather than misbehaves.</reasoning>
<output>{"file":"src/coupons.ts","line":1,"severity":"medium","category":"comment","issue":"The comment says findCoupon returns undefined for a missing coupon, but the code throws NotFoundError.","suggested_fix":"Change the comment to 'Throws NotFoundError when the coupon doesn't exist', or return undefined and update the return type.","detected_pattern":"comment-contradicts-code","confidence":0.95}</output>
</example>
</examples>
