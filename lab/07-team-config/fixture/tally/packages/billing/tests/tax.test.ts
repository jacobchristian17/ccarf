import { expect, test } from "vitest";
import { vatCents } from "../src/tax.js";

test("12% VAT rounds half up", () => {
  expect(vatCents(1999, 12)).toBe(240);
});
