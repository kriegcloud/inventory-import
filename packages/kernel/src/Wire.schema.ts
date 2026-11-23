/**
 * A value that may be absent, as the contract writes it: `null` on the wire and in a stored row, an `Option` in code,
 * with the key's sentence on both sides.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"

/**
 * `S.OptionFromNullOr` for a struct field, with the field's description, last in the field's pipe. Use it where a field is described:
 * a key annotation put on `S.OptionFromNullOr` itself reaches the decoder (a missing key is said in its words) but
 * not the generated OpenAPI document, whose property is the wire side; this puts the same words on both.
 *
 * It takes a key's annotations, a description required: the whole object is put on the field, last, so a mark spread
 * into it (`...noTerm("deferred", "party")`) is where a reader of key annotations finds it; only the description is
 * copied to the wire side. `Key<never>` accepts any key annotation but `default` and `examples`, which would have to
 * be values of the field's decoded type.
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
  (key: S.Annotations.Key<never> & { readonly description: string }) =>
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
