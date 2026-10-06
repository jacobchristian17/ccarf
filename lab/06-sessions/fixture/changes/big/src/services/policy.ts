// Refund policy. The window is now 14 days for all orders.
export const REFUND_WINDOW_DAYS = 14;
export const AUTO_REFUND_LIMIT = 250;
export const TODAY = "2026-10-02";

export function isWithinWindow(placedAt: string, today = TODAY): boolean {
  return (Date.parse(today) - Date.parse(placedAt)) / 86_400_000 <= REFUND_WINDOW_DAYS;
}
