// Vendored from beep-effect c5cebd5c9de7:packages/foundation/modeling/utils/src/Data.ts (MIT, see LICENSE). Do not edit: bun run beep vendor check compares the rest of this file with its recorded hash.
/**
 * Defines helpers for small immutable data models.
 *
 * **Details**
 *
 * This module helps create plain classes, tagged classes, tagged unions, and
 * typed errors with readonly fields. Tagged values carry a `_tag` field, which
 * makes them easy to narrow with pattern matching or simple checks. These
 * helpers are commonly used for domain values and errors in Effect programs.
 *
 * @since 0.0.0
 */

/**
 * `effect/Data` constructors and tagged-value helpers.
 *
 * @category models
 * @since 0.0.0
 */
export * from "effect/Data";
