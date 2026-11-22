import { neverTriedAgain, retriedReporters } from "./vitest.retries.ts"

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

/**
 * The limits of a fast test and of a hook, and where the package keeps vitest's module cache. Vitest keeps one cache
 * folder for the whole repository by default and empties it after a change to `bun.lock`; the first package's tests
 * to start then emptied it while other packages' tests were reading it, and those failed with ENOENT (seen here after
 * a merge, and in beep-effect, whose `vitest.shared.ts` gives each package its own folder for the same reason).
 * The path is relative, so vitest reads it from the package's own root however it was started.
 */
export const limits = {
  testTimeout: 30_000,
  hookTimeout: 60_000,
  fsModuleCachePath: "node_modules/.vitest-cache/fast"
} as const

/**
 * The limits of a slow test (`*.slow.test.ts`: a real database, sign-in, or 50,000 rows), and its own module cache:
 * turbo starts a package's fast and slow tests side by side, and each would empty the other's folder.
 */
export const slowLimits = {
  testTimeout: 120_000,
  hookTimeout: 120_000,
  fsModuleCachePath: "node_modules/.vitest-cache/slow"
} as const

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
 * over). Both fail at once when they are the last error of a try, which is the only error vitest shows a retry
 * condition. When a hook fails after one of them (an `afterEach` that looks at what a hung test never reached), vitest
 * does try the test again; the reporter reads every error of every try and fails the run for it, whatever a later
 * try did. So the rule holds for the run's result always, and for the time spent only without such a hook: no test of
 * the packages that use this has one today.
 */
export const realTime = {
  retry: { count: 3, delay: 500, condition: new RegExp(`^(?![\\s\\S]*(?:${neverTriedAgain.source}))`) }
}

/**
 * What a package that uses `realTime` adds at the top of its test settings (not in a project): the retries said aloud,
 * each at its line (`includeTaskLocation`, which vitest leaves off by default).
 */
export const saidAloud = { reporters: retriedReporters, includeTaskLocation: true }
