import { retriedReporters } from "./vitest.retries.ts"

// What every package's vitest.config.ts shares, so a test's limit is one decision and not one per file.
//
// A limit here is a guard against a test that hangs, not a measure of speed: it has to hold on the slowest machine
// that runs the check, which is GitHub's runner (four cores, each about half as fast as a workstation's, and busy
// with the rest of the check). Vitest's own defaults, 5 s for a test and 10 s for a hook, were sized for neither: a
// property test of 150 workbooks that takes 0.4 s on a workstation took over 5 s there, and CI failed on code that
// had not changed.
//
// Sized from the check run as CI runs it on two pinned cores, which stands in for the runner's four slower ones:
// the slowest test under the fast limit took 4.4 s, and the slowest `*.slow.test.ts` (a confirm of 50,000 rows)
// 31 s. The limits are about seven and four times those. A test that needs longer still says so itself
// (`{ timeout }`) and writes beside it what was measured; one that needs less takes the shared limit. Every
// package uses these, the vendored kit's too (vendor sync writes them into its configs) and the scratchpad.

/** The limits of a fast test and of a hook. */
export const limits = { testTimeout: 30_000, hookTimeout: 60_000 } as const

/** The limits of a slow test (`*.slow.test.ts`: a real database, sign-in, or 50,000 rows). */
export const slowLimits = { testTimeout: 120_000, hookTimeout: 120_000 } as const

/**
 * For a package whose tests wait in real time (`Effect.sleep("20 millis")`, then look): a wait that runs long on a
 * busy machine lets the next timer of the code under test fire first, and the test fails on code that is right.
 * Measured with the check pinned to four cores, two runs of three failed that way, each on another test. So such a
 * test is tried again, three times at most, half a second apart, by Benjamin's decision of 2026-11-22: "Retry for
 * now, said aloud; remove after TestClock". Said aloud: the reporter in vitest.retries.ts names every test that passed
 * on a later try, in the output and as a GitHub warning on its line, and counts them at the end. Removed in the same
 * change that moves the last of these tests onto `TestClock`.
 *
 * Never tried again: a property that was falsified (another try draws other values and would hide a counterexample
 * that is real), and a test or hook that ran out of time (a hang tried again would eat the job's time four times
 * over). Both fail at once.
 */
export const realTime = {
  retry: { count: 3, delay: 500, condition: /^(?![\s\S]*(?:Property falsified|(?:Test|Hook) timed out in \d+ms))/ }
}

/**
 * What a package that uses `realTime` adds at the top of its test settings (not in a project): the retries said aloud,
 * each at its line (`includeTaskLocation`, which vitest leaves off by default).
 */
export const saidAloud = { reporters: retriedReporters, includeTaskLocation: true }
