// Vendored from beep-effect c5cebd5c9de7:packages/foundation/modeling/utils/test/Number.test.ts (Apache-2.0, see LICENSE). Do not edit: scripts/vendor-check.mjs compares the rest of this file with its recorded hash.
import { it } from "@effect/vitest";
import { N } from "@beep/utils";
import { describe, expect } from "@effect/vitest";

describe("Number utilities", () => {
  it("refines positive numeric values", () => {
    expect(N.isPositive(0)).toBe(true);
    expect(N.isPositive(42)).toBe(true);
    expect(N.isPositive(-1)).toBe(false);
    expect(N.isPositive("42")).toBe(false);
  });

  it("refines integer numeric values", () => {
    expect(N.isInteger(42)).toBe(true);
    expect(N.isInteger(3.14)).toBe(false);
    expect(N.isInteger("42")).toBe(false);
  });
});
