// All money is integer cents. Never use floats for amounts.
export function toCents(amount: string): number {
  const [whole, frac = ""] = amount.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2));
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
