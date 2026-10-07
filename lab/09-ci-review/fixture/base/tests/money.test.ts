import { describe, expect, it } from "vitest";
import { toCents } from "../src/money.js";

describe("toCents", () => {
  it("converts dollars to cents", () => expect(toCents("19.99")).toBe(1999));
  it("rounds half-cents", () => expect(toCents("0.005")).toBe(1));
});
