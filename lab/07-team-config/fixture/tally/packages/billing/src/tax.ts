// VAT calculation for invoices. Amounts are integer cents.
export function vatCents(netCents: number, ratePercent: number): number {
  return Math.round((netCents * ratePercent) / 100);
}
