// Rounding helpers for tax lines. Both take a value in fractional cents.

export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) throw new Error("not a finite amount");
  return Math.round(value);
}

export function roundHalfEven(value: number): number {
  if (!Number.isFinite(value)) throw new Error("not a finite amount");
  return Math.round(value);
}
