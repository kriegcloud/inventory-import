// Costs in tests: written as digits, compared as digits.
import * as BigDecimal from "effect/BigDecimal"
import { costDigits, type UnitCost } from "@inventory/catalog-contract/Item"
/** The cost the digits say. */
export const cost = (digits: string): UnitCost => BigDecimal.fromStringUnsafe(digits)

/** A required cost as its digits: what an expectation compares. */
export const digits = (value: UnitCost): string => costDigits(value)
