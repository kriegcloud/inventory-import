// Costs in tests: written as digits, compared as digits.
import * as BigDecimal from "effect/BigDecimal"
import { costDigits, type UnitCost } from "@inventory/catalog-contract/Item"
/** The cost the digits say. */
export const cost = (digits: string): UnitCost => BigDecimal.fromStringUnsafe(digits)

/** A cost as its digits, or undefined for none: what an expectation compares. */
export const digits = (value: UnitCost | undefined): string | undefined =>
  value === undefined ? undefined : costDigits(value)
