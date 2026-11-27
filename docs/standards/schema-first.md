---
type: Standard
title: Schema first
description: Data is an Effect Schema that decodes into canonical Effect values, normalises and defaults at the boundary, models every finite variant as a tagged union, annotates keys as keys, and generates only valid values.
tags: [schema, effect, engineering]
status: draft
---

The schema is the truth about the data. What a value is, what it becomes when it crosses a boundary, what it starts
as, what it is when the input leaves it out, and which cases it can be, are all said once, in the schema, and the code
around it reads as intent. These rules apply to every new package and to code as it moves into one; the app's existing
code is measured against them, not yet rewritten.

Every name below was checked in effect 4.1.6's source (`node_modules/effect/src`), and every example compiled and ran
under the repository's full type-check profile. The sources these rules come from are beep-effect's
`standards/schema-first-development-prompt.md` and its `schema-first-development`, `effect-first-development`,
`crispen` and `jsdoc-annotation-specialist` skills, and Effect's `SCHEMA.md` and `ARBITRARY.md`.

In the examples, `S` is `effect/Schema` and `$I` is the module's identity composer
(`$CsvId.create("CsvTable")` and the like, from `@beep/identity`).

## SF-1. A key, an element or a member is annotated as a key

A struct field, a tuple element, the element of an array or record and a union member are described with
`S.annotateKey` (or `$I.annoteKey`, which calls it), never `.annotate`. `.annotate` is for the schema as a whole: a
non-class schema ends with `.pipe($I.annoteSchema("Name", { description }))`, a class takes `$I.annote(...)` (or an
annotations object) as its last argument. Put the key annotation first in a field's pipe: after
`S.OptionFromOptionalKey` or a decoding default it is dropped from the generated JSON Schema.

```ts
export class Supplier extends S.Opaque<Supplier, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.NonEmptyString.pipe($I.annoteKey("Supplier.name", { description: "Name on the supplier's invoices" })),
    codes: S.Array(S.NonEmptyString.annotateKey({ description: "One supplier code" })).pipe(
      S.annotateKey({ description: "Codes the supplier uses" })
    )
  }).pipe($I.annoteSchema("Supplier", { description: "A company items are bought from" }))
) {}
// S.resolveAnnotationsKey(Supplier.fields.name)?.description === "Name on the supplier's invoices"
```

Check: `rg -n '^\s*\w+\??:\s.*\.annotate\(' <package>/src` finds none. `SCHEMA.md` documents key annotations for
struct keys and tuple elements ("Key Annotations", "Element Annotations", "Key-level Annotations"). For array, record
and union members the call is accepted, but 4.1.4's JSON Schema output does not show it (tried: a described array
element and union member produce bare `items` and `anyOf` entries), so there it is documentation for the reader of
the code. Tried as well: a field described before `S.OptionFromOptionalKey` keeps its description in
`S.toJsonSchemaDocument`, one described after it loses it.

## SF-2. A boundary decodes into Effect's own values

At a boundary (a file, a payload, a row, a setting) a value is decoded into the Effect type that means it, with the
schema `effect/Schema` ships, never kept as the string or number it arrived as.

| The value is | Decode with |
| --- | --- |
| a time (ISO string, millis, `Date`, HTTP date) | `S.DateTimeUtcFromString`, `S.DateTimeUtcFromMillis`, `S.DateTimeUtcFromDate`, `S.DateTimeUtcFromHttpDate`, `S.DateTimeZonedFromString` |
| a duration | `S.DurationFromMillis`, `S.DurationFromNanos`, `S.DurationFromString`, `S.DurationFromIsoString` |
| a size in bytes | `S.ByteSizeFromNumber`, `S.ByteSizeFromBigInt`, `S.ByteSizeFromString` |
| a decimal amount | `S.BigDecimalFromString` |
| bytes in text | `S.Uint8ArrayFromBase64`, `S.Uint8ArrayFromBase64Url`, `S.Uint8ArrayFromHex`; text in text: `S.StringFromBase64`, `S.StringFromBase64Url`, `S.StringFromHex`, `S.StringFromUriComponent` |
| a secret | `S.Redacted`, `S.RedactedFromValue` (settings: `Config.redacted`) |
| a URL, query parameters | `S.URLFromString`, `S.URL`, `S.UrlParams`, `S.URLSearchParams` |
| JSON | `S.fromJsonString(schema)`, `S.Json`, `S.JsonObject`, `S.JsonArray` |
| a version | `S.SemVerFromString`, `S.SemVerRangeFromString` |
| a map or set | `S.HashMap`, `S.HashSet` |
| HTTP headers, cookies, DNS records, a graph | `S.Headers`, `S.Cookie`, `S.Cookies`, `S.DnsRecord` and its members, `S.Graph` |

Two things asked for have no schema in 4.1.4: a JSON patch is computed by the `effect/JsonPatch` module over
`S.Json` values, and XML is read by `effect/encoding/Xml`. A file's text encoding has no schema either; a format
package names its encodings with a `LiteralKit`.

```ts
export const Received = S.Struct({
  at: S.DateTimeUtcFromString.pipe(S.annotateKey({ description: "When the delivery arrived" })),
  wait: S.DurationFromMillis.pipe(S.annotateKey({ description: "How long it waited" })),
  size: S.ByteSizeFromNumber.pipe(S.annotateKey({ description: "File size" }))
})
```

Check: no field holding a time, duration, byte size, amount or secret is `S.String`, `S.Int` or `S.Finite`
(`rg -n '(At|[dD]ate|Bytes|Ms|Secret)\??:\s*S\.(String|Int|Finite)' <package>/src` finds none).

## SF-3. A value is normalised in its schema

Trimming, case, splitting and similar clean-ups are getters on the schema (`effect/SchemaGetter`: `trim`,
`toLowerCase`, `toUpperCase`, `capitalize`, `split`, `splitKeyValue`, `parseJson` and others) or transformations
(`effect/SchemaTransformation`: `trim`, `toLowerCase`, `transform`, `transformOptional`, `transformEffect`), composed
with `S.decodeTo`. `S.Trim` is the ready-made trimming string. Business code never calls `.trim()` on a decoded value.

```ts
export const Sku = S.String.pipe(
  S.decodeTo(S.Trimmed, SchemaTransformation.trim()),
  S.decodeTo(S.String, { decode: SchemaGetter.toUpperCase(), encode: SchemaGetter.passthrough() })
)
// "  bolt-m8 " decodes to "BOLT-M8"
```

Check: `rg -n '\.(trim|toLowerCase|toUpperCase)\(' <package>/src` finds nothing outside schema definitions.

## SF-4. Absence is `Option`, decoded in the schema

A field that may be missing is `Option` on the decoded side. Use the `S.OptionFrom*` schema that matches what the
input does: `S.OptionFromOptionalKey` (key left out), `S.OptionFromNullOr` (`null`), `S.OptionFromNullishOr` (`null`
or `undefined`). `S.OptionFromOptional`, `S.OptionFromUndefinedOr` and `S.OptionFromOptionalNullOr` also exist; they
admit an explicit `undefined`, which `exactOptionalPropertyTypes` and JSON never produce, so they are used only where
an encoded `undefined` is real. A struct of independent `S.optionalKey` fields standing for "one of these cases" is a
tagged union instead (SF-6).

Check: no decoded type has an optional property: `rg -n 'S\.optionalKey\(|S\.optional\(' <package>/src` finds only
encoded-side keys wrapped by an `OptionFrom*` or a decoding default.

A React component's own optional props stay `?:`, with defaults in destructuring. In `.tsx`, strict
`=== undefined` and `!== undefined` comparisons on its props (including destructured names) may distinguish
omission from explicit null. The defaults law still counts `??`, null comparisons and non-prop absence checks.

## SF-5. Starting values and missing-input values live on the schema

Ask of every field what it starts as and what it is when the input leaves it out. When one value answers both, put it
on the field: `S.withConstructorDefault(...)` for `make`, `S.withDecodingDefaultTypeKey(...)` (or
`S.withDecodingDefaultKey`) for decoding. An array starts empty, a flag starts at its usual value, an `Option` starts
as `Effect.succeedNone`, a tag is `S.tag("value")`. Never a default for an identity, an authority, provenance, money,
or a field whose empty value is the widest one. No `*Defaults` object, no `??` fallback in business code.

```ts
export class Line extends S.Opaque<Line, { readonly brand: unique symbol }>()(
  S.Struct({
    note: S.String.pipe(
      S.annotateKey({ description: "A remark, when the file has one" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    tags: S.Array(S.String).pipe(
      S.annotateKey({ description: "Labels" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    ),
    active: S.Boolean.pipe(
      S.annotateKey({ description: "Whether it is sold" }),
      S.withConstructorDefault(Effect.succeed(true)),
      S.withDecodingDefaultTypeKey(Effect.succeed(true))
    )
  }).pipe($I.annoteSchema("Line", { description: "One line" }))
) {}
// Line.make({}) has note None, tags [], active true; decoding {} gives active true
```

Check: `rg -n ' \?\? |Defaults\b' <package>/src` finds nothing that a schema default could hold.

## SF-6. Every finite set of cases is a tagged union

States, results, modes, kinds and any case that carries its own data are a tagged union, never one struct with
optional parts or a string flag beside the data it governs. Name the discriminator domain with `LiteralKit`, make
each member a schema (`S.Opaque` over an `S.Struct` with `S.tag(...)`, `S.TaggedStruct`, `S.TaggedClass`,
`S.TaggedError`), and close it with `Kind.mapMembers(() => Tuple.make(A, B)).pipe(S.toTaggedUnion("kind"))`
(`S.TaggedUnion` only for canonical `_tag` unions). Nest unions where the domain nests (a fatal diagnostic of kind
quoting, say). Branch with the union's own `.match`, `.cases`, `.guards` and `.isAnyOf`, so adding a case is a
compile error at every match.

```ts
const DelimiterChoiceKind = LiteralKit(["detect", "fixed"])
class Detect extends S.Opaque<Detect, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("detect") }).pipe($I.annoteSchema("Detect", { description: "Find the delimiter" }))
) {}
class Fixed extends S.Opaque<Fixed, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("fixed"),
    delimiter: S.Literals([",", ";"]).pipe(S.annotateKey({ description: "The delimiter" }))
  }).pipe($I.annoteSchema("Fixed", { description: "Use this delimiter" }))
) {}
export const DelimiterChoice = DelimiterChoiceKind.mapMembers(() => Tuple.make(Detect, Fixed)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("DelimiterChoice", { description: "How the delimiter is chosen" })
)
export const describeChoice = DelimiterChoice.match({
  detect: () => "detected",
  fixed: ({ delimiter }) => `fixed ${delimiter}`
})
```

Check: `rg -n 'S\.Union\(' <package>/src` finds only unions closed by `S.toTaggedUnion` or unions of scalars; no
struct has two or more optional fields that are never present together.

## SF-7. A schema generates only valid values

Checks are strict enough that `Arbitrary.schema(X)` (`effect/Arbitrary`) produces only values the domain accepts:
counts are `S.Int` with `S.isBetween` or `S.isGreaterThanOrEqualTo` (`S.Natural` is the non-negative integer),
strings and arrays carry `S.isMinLength`/`S.isMaxLength` where the domain bounds them, patterns use `S.isPattern`.
Where a check cannot steer generation, a declaration supplies `toCodecArbitrary` (the 4.1.4 name of what is
sometimes called a "toArbitrary" annotation), or the test passes `Arbitrary.schema(X, { shrink })`. Every new named
schema has the property "generates only valid values".

```ts
export const Count = S.Int.check(S.isBetween({ minimum: 0, maximum: 1_000_000 }))

it.prop("Count generates only valid values", [Arbitrary.schema(Count)], ([n]) => {
  expect(S.is(Count)(n)).toBe(true)
})
```

Check: each new schema file has a `*.property.test.ts` with that property, and `Arbitrary.schema` does not throw.

## SF-8. Behaviour sits with the data it reads

Pure functions over a schema's values (a fold over a union, a derived position, a rendering) live in the schema's
file, as statics on its class or exports beside it, derived from the schema where Effect offers it (`S.is`,
`S.toEquivalence`, `.match`). No module-level wall of `decodeX`/`isX`/`toX` helpers; large algorithms go in their own
module and take the schema's types.

Check: a business module's first lines read as intent; `rg -n 'const (is|decode)\w+ = S\.(is|decodeUnknown)'` finds no
helper wall.

## SF-9. Which schema form

Plain data is `class X extends S.Opaque<X, { readonly brand: unique symbol }>()(S.Struct({...}).pipe($I.annoteSchema(...))) {}`,
built with `X.make(...)`. A schema with instance members, an `.extend` chain or a stored entity is `S.Class` or
`S.TaggedClass`; an error is `S.TaggedError`. Every class and Opaque carries the brand. A non-class schema exports a
same-name type: `export type X = typeof X.Type`.

Check: `rg -n 'S\.Opaque<\w+>\(\)|S\.Class<\w+>\(' <package>/src` finds none without the brand.
