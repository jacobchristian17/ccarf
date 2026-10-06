// Refund policy constants and the refund-window rule.
export const REFUND_WINDOW_DAYS = 30;
export const AUTO_REFUND_LIMIT = 500;
export const TODAY = "2026-10-02";

export function isWithinWindow(placedAt: string, today = TODAY): boolean {
  const days = (Date.parse(today) - Date.parse(placedAt)) / 86_400_000;
  return days <= REFUND_WINDOW_DAYS;
}
