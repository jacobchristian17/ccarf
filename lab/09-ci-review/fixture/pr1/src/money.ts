// Money helpers. Inside the service, amounts are integer cents.

export function toCents(raw: string): number {
  return Math.round(parseFloat(raw) * 100);
}

export function formatDollars(dollars: number): string {
  return `$${dollars.toFixed(2)}`;
}

export function formatCents(cents: number): string {
  return formatDollars(cents / 100);
}
