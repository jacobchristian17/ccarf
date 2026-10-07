import { describe, expect, it } from "vitest";
import { applyDiscount, type DiscountCode } from "../src/discount.js";
import { fixedClock } from "./fixtures/index.js";

const codes: DiscountCode[] = [{ code: "WELCOME10", percentOff: 10, expiresAt: "2026-12-31T23:59:59Z", uses: 0, maxUses: 100 }];

describe("applyDiscount", () => {
  it("applies a valid percentage code", () => expect(applyDiscount(10000, "WELCOME10", codes, fixedClock())).toBe(9000));
  it("matches codes case-insensitively", () => expect(applyDiscount(10000, " welcome10 ", codes, fixedClock())).toBe(9000));
  it("rejects an unknown code", () => expect(() => applyDiscount(10000, "NOPE", codes, fixedClock())).toThrow("unknown"));
});
