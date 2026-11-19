/**
 * Three kinds of value the contract has many of, each said once: a name for the screen, a sentence for the person,
 * and a moment the server recorded.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Text")

/**
 * A name people read: 1 to 200 characters with at least one that is not a space. Not unique and can change, so it
 * never decides a permission; people are told apart by id.
 *
 * @category schemas
 */
export const DisplayName = S.String.check(S.isMinLength(1), S.isMaxLength(200), S.isPattern(/\S/)).pipe(
  $I.annoteSchema("DisplayName", {
    description: "A name people read. Not unique and can change, so it never decides a permission",
    examples: ["Marcus Oyelaran"]
  })
)

/**
 * The decoded value of `DisplayName`.
 *
 * @category models
 */
export type DisplayName = typeof DisplayName.Type

/**
 * A sentence for the person: what happened and what to do. A screen can show it as it is; it never repeats what a
 * request sent.
 *
 * @category schemas
 */
export const Sentence = S.String.check(S.isMinLength(1), S.isMaxLength(1000), S.isPattern(/\S/)).pipe(
  $I.annoteSchema("Sentence", {
    description: "What happened and what to do, in words for the person. A screen can show it as it is"
  })
)

/**
 * The decoded value of `Sentence`.
 *
 * @category models
 */
export type Sentence = typeof Sentence.Type

/**
 * A moment the server recorded, an ISO 8601 instant on the wire and a `DateTime.Utc` in code. Contract fields move
 * onto it with their context (decision "rules reach").
 *
 * @category schemas
 */
export const Instant = S.DateTimeUtcFromString.pipe(
  $I.annoteSchema("Instant", { description: "A moment the server recorded, as an ISO 8601 instant in UTC" })
)

/**
 * The decoded value of `Instant`.
 *
 * @category models
 */
export type Instant = typeof Instant.Type
