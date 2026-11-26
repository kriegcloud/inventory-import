import * as S from "effect/Schema"
import * as Effect from "effect/Effect"

/** The tab handle reads empty until the browser has assigned this page its own identity. */
export class TabIdentity extends S.Opaque<TabIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    value: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefaultTypeKey(Effect.succeed("")))
  }).annotate({ identifier: "TabIdentity", description: "Pending tab handle text" })
) {}
