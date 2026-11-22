// Vendored from beep-effect c5cebd5c9de7:packages/foundation/modeling/utils/src/Utils.ts (MIT, see LICENSE). Patched on purpose: the patch and its reason are in vendor.json (patches) and in the patches bun run beep vendor sync applies (sourcePatches). Do not edit: bun run beep vendor check compares the rest of this file with its recorded hash.
/**
 * Miscellaneous runtime utilities and structural comparison hooks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Result from "effect/Result";
import * as GlobalValue from "./GlobalValue.ts";

/**
 * Shared mutable state used while structural comparison hooks are active.
 *
 * **Details**
 *
 * This is an experimental hook for custom test matchers. User code should prefer
 * the public comparison APIs instead of mutating this state directly.
 *
 * **Example** (Read the current structural region flag)
 *
 * ```ts
 * import { structuralRegionState } from "@beep/utils/Utils"
 *
 * const enabled = structuralRegionState.enabled
 * console.log(enabled)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const structuralRegionState = GlobalValue.globalValue(
  "effect/Utils/isStructuralRegion",
  (): { enabled: boolean; tester: ((a: unknown, b: unknown) => boolean) | undefined } => ({
    enabled: false,
    tester: undefined,
  })
);

/**
 * Runs `body` with structural comparison hooks temporarily enabled.
 *
 * **Details**
 *
 * The previous enabled state and tester are restored in a `finally` block, so
 * nested or throwing bodies do not leak the temporary structural region.
 *
 * `body` and the optional `tester` travel in a single options struct: both are
 * functions, so a two-argument form could never be dispatched at runtime
 * between data-first and data-last calls.
 *
 * **Example** (Run a body inside a structural region)
 *
 * ```ts
 * import { structuralRegion, structuralRegionState } from "@beep/utils/Utils"
 *
 * const before = structuralRegionState.enabled
 * const inside = structuralRegion({ body: () => structuralRegionState.enabled })
 * const after = structuralRegionState.enabled
 *
 * console.log([before, inside, after])
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const structuralRegion = <A>({
  body,
  tester,
}: {
  readonly body: () => A;
  readonly tester?: ((a: unknown, b: unknown) => boolean) | undefined;
}): A => {
  const current = structuralRegionState.enabled;
  const currentTester = structuralRegionState.tester;
  structuralRegionState.enabled = true;
  if (tester !== undefined) {
    structuralRegionState.tester = tester;
  }
  // The region ends whether `body` returns or throws; what it threw is thrown on unchanged.
  const outcome = Result.try({ try: body, catch: (thrown) => ({ thrown }) });
  structuralRegionState.enabled = current;
  structuralRegionState.tester = currentTester;
  return Result.getOrThrowWith(outcome, ({ thrown }) => thrown);
};

/**
 * Re-export of all helpers from `effect/Utils`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Utils";
