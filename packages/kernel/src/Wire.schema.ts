/**
 * A value that may be absent, as the contract writes it: `null` on the wire and in a stored row, an `Option` in code,
 * with the key's sentence on both sides.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import * as SchemaTransformation from "effect/SchemaTransformation"

/**
 * `S.OptionFromNullOr` for a struct field, with the field's description, last in the field's pipe. Use it where a field is described:
 * a key annotation put on `S.OptionFromNullOr` itself reaches the decoder (a missing key is said in its words) but
 * not the generated OpenAPI document, whose property is the wire side; this puts the same words on both.
 *
 * **Example** (A person's email, absent for a member with no account)
 *
 * ```ts
 * import { nullAsNone } from "@inventory/kernel/Wire"
 * import * as S from "effect/Schema"
 * const Person = S.Struct({
 *   email: S.String.pipe(nullAsNone({ description: "The email of the person's account; null for none" }))
 * })
 * ```
 *
 * @category combinators
 */
export const nullAsNone =
  (key: { readonly description: string; readonly messageMissingKey?: string }) =>
  <Value extends S.Top>(schema: Value) => {
    const decoded = schema.pipe(S.toType, S.Option)
    return S.NullOr(schema)
      .annotateKey({ description: key.description })
      .pipe(S.decodeTo(decoded, SchemaTransformation.optionFromNullOr()), S.annotateKey(key))
  }

/**
 * `S.OptionFromOptionalKey` for a struct field, with the field's description, last in the field's pipe: a key the
 * wire leaves out is `None` in code. As with `nullAsNone`, the sentence is put on both sides, so the OpenAPI document
 * says it.
 *
 * **Example** (Which of a row's items this is, left out for a row that is one item)
 *
 * ```ts
 * import { absentAsNone } from "@inventory/kernel/Wire"
 * import * as S from "effect/Schema"
 * const Row = S.Struct({ part: S.Int.pipe(absentAsNone({ description: "Which of its row's items this is" })) })
 * ```
 *
 * @category combinators
 */
export const absentAsNone =
  (key: { readonly description: string }) =>
  <Value extends S.Top>(schema: Value) => {
    const decoded = schema.pipe(S.toType, S.Option)
    return S.optionalKey(schema)
      .annotateKey({ description: key.description })
      .pipe(S.decodeTo(decoded, SchemaTransformation.optionFromOptionalKey()), S.annotateKey(key))
  }

/** A schema a key that may be left out can carry: no default of its own, and no service to decode or encode it. */
type LeftOutField = S.Top &
  S.WithoutConstructorDefault & { readonly DecodingServices: never; readonly EncodingServices: never }

/** The schema `emptyWhenLeftOut` makes of a key's schema. */
type LeftOut<Value extends LeftOutField> = S.withConstructorDefault<S.decodeTo<S.toType<Value>, S.optionalKey<Value>>>

/** What a key left out stands for, and how to tell that value when encoding. */
type Emptiness<Decoded> = { readonly empty: Decoded; readonly isEmpty: (value: Decoded) => boolean }

/**
 * A key the wire and the store leave out while it holds its empty value, and that code always has: decoding a missing
 * key gives `empty`, `make` starts there, and encoding leaves the key out again when the value `isEmpty`, so a
 * record written before the key was always there still reads, and one written now looks the same. Use it where
 * "left out" and "empty" mean one thing (no field accepted, no value typed); never where absence says something of
 * its own, which is an `Option` (`absentAsNone`).
 *
 * **Example** (The fields a person accepted, left out of a stored decision while there are none)
 *
 * ```ts
 * import { emptyWhenLeftOut } from "@inventory/kernel/Wire"
 * import * as A from "effect/Array"
 * import * as S from "effect/Schema"
 * const Flags = S.Struct({
 *   accepted: emptyWhenLeftOut(S.Array(S.String), { empty: [], isEmpty: A.isReadonlyArrayEmpty })
 * })
 * // decoding {} gives { accepted: [] }; encoding { accepted: [] } gives {}
 * ```
 *
 * @category combinators
 */
export const emptyWhenLeftOut: {
  <Value extends LeftOutField>(options: Emptiness<Value["Type"]>): (schema: Value) => LeftOut<Value>
  <Value extends LeftOutField>(schema: Value, options: Emptiness<Value["Type"]>): LeftOut<Value>
} = dual(2, <Value extends LeftOutField>(schema: Value, options: Emptiness<Value["Type"]>): LeftOut<Value> => {
  const decoded = S.optionalKey(schema).pipe(
    S.decodeTo(S.toType(schema), {
      decode: SchemaGetter.withDefault(Effect.succeed(options.empty)),
      encode: SchemaGetter.transformOptional(O.filter((value: Value["Type"]) => !options.isEmpty(value)))
    })
  )
  return S.withConstructorDefault<typeof decoded>(Effect.succeed(options.empty))(decoded)
})
