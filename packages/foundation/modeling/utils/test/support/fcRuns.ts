// Stands in for beep-effect's @beep/fc-runs in the vendored tests: a fixed property-test run count.
import type * as Arbitrary from "effect/Arbitrary"

export const DEFAULT_FC_NUM_RUNS = 100

export const fcRuns = (inline?: number): Arbitrary.CheckOptions & { readonly runs: number } => ({
  runs: inline ?? DEFAULT_FC_NUM_RUNS
})
