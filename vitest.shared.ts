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
// (`{ timeout }`), as the draft machine's property tests do. The vendored kit's packages keep vitest's defaults:
// their files are not edited, and their slowest test took under 2.5 s.

/** The limits of a fast test and of a hook. */
export const limits = { testTimeout: 30_000, hookTimeout: 60_000 } as const

/** The limits of a slow test (`*.slow.test.ts`: a real database, sign-in, or 50,000 rows). */
export const slowLimits = { testTimeout: 120_000, hookTimeout: 120_000 } as const
