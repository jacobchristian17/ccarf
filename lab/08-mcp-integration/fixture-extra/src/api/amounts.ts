import { toCents } from "../lib/money.js";

// Request bodies arrive with stray whitespace ("  12.50 ").
export const amountToCents = (raw: string) => toCents(raw.trim());
