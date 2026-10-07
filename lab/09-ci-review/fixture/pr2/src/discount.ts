import { ValidationError } from "./errors.js";

export type DiscountCode = {
  code: string;
  percentOff: number;
  expiresAt: string;
  uses: number;
  maxUses: number;
  minSubtotal: number; // minimum order, in dollars (as entered in the admin UI)
};

// Applies a percentage discount code to a subtotal in cents. Codes are case-insensitive.
export function applyDiscount(subtotalCents: number, input: string, codes: DiscountCode[], now = new Date()): number {
  const code = codes.find(c => c.code.toLowerCase() === input.trim().toLowerCase());
  if (!code) throw new ValidationError("unknown discount code");
  if (new Date(code.expiresAt) < now) throw new ValidationError("discount code has expired");
  if (code.uses >= code.maxUses) throw new ValidationError("discount code has been used up");
  if (subtotalCents < code.minSubtotal) throw new ValidationError("order is below the code's minimum");
  return Math.round(subtotalCents * (1 - code.percentOff / 100));
}
