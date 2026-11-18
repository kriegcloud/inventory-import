// Vendored from beep-effect c5cebd5c9de7:packages/foundation/primitive/types/src/TArray.types.ts (Apache-2.0, see LICENSE). Do not edit: scripts/vendor-check.mjs compares the rest of this file with its recorded hash.
/**
 * Array utility types for `@beep/types`.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

/**
 * Extracts the element type from a tuple or array type.
 *
 * **Example** (Extracting array element types)
 *
 * ```typescript
 * import type { TArray } from "@beep/types"
 *
 * type NumberElement = TArray.Elem<readonly [1, 2, 3]>
 * // 1 | 2 | 3
 *
 * type StringElement = TArray.Elem<string[]>
 * // string
 *
 * const elements: readonly [NumberElement, StringElement] = [1, "name"]
 * console.log(elements)
 * ```
 *
 * @typeParam T - The type from which the element type will be inferred.
 * @category utilities
 * @since 0.0.0
 */
export type Elem<T> = T extends readonly (infer U)[] ? U : never;
