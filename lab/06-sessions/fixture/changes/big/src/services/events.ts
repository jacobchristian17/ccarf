// Minimal in-process event bus. refund-worker.ts subscribes to refund.requested.
type Event = { type: "refund.requested"; orderId: string; amount: number; reason: string };
const subscribers: ((e: Event) => Promise<void>)[] = [];
export function subscribe(fn: (e: Event) => Promise<void>) { subscribers.push(fn); }
export function publish(e: Event) { for (const s of subscribers) void s(e); }
