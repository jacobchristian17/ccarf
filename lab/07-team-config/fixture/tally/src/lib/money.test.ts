import { expect, test } from "vitest";
import { toCents } from "./money.js";

test("parses whole and fractional amounts", () => {
  expect(toCents("19.99")).toBe(1999);
  expect(toCents("5")).toBe(500);
});
