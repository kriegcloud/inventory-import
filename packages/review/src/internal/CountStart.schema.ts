import * as S from "effect/Schema"
import * as Effect from "effect/Effect"
import { $ReviewId } from "./identity.ts"
const $I = $ReviewId.create("internal/CountStart")

/** A count starts at zero before its first member is counted. */
export class CountStart extends S.Opaque<CountStart, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(0)), S.withDecodingDefaultTypeKey(Effect.succeed(0)))
  }).pipe($I.annoteSchema("CountStart", { description: "A count before any member" }))
) {}

/** One newly encountered facet spelling group, before rows have been counted or spellings recorded. */
export class FacetStart extends S.Opaque<FacetStart, { readonly brand: unique symbol }>()(
  S.Struct({
    n: S.Natural.pipe(S.withConstructorDefault(Effect.succeed(0)), S.withDecodingDefaultTypeKey(Effect.succeed(0))),
    spellings: S.Record(S.String, S.Finite.pipe(S.mutableKey)).pipe(
      S.withConstructorDefault(Effect.sync(() => ({}))),
      S.withDecodingDefaultTypeKey(Effect.sync(() => ({})))
    )
  }).pipe($I.annoteSchema("FacetStart", { description: "A new facet group's count and spellings" }))
) {}
