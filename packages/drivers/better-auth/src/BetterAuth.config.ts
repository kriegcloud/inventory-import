/**
 * What the driver needs from the host's settings: the secret, the public address, and whether this is a production
 * build. The host reads them through its own settings door and passes the value in.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { $BetterAuthId } from "./internal/identity.ts"

const $I = $BetterAuthId.create("BetterAuthConfig")

/**
 * The settings Better Auth is built from.
 *
 * @category schemas
 */
export class BetterAuthSettings extends S.Opaque<BetterAuthSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    secret: S.Redacted(S.String).pipe(
      S.annotateKey({ description: "BETTER_AUTH_SECRET: signs the session cookies; at least 32 characters" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    publicUrl: S.URL.pipe(
      S.annotateKey({
        description: "BETTER_AUTH_URL: the address people open the app at. None: each request's origin"
      }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    production: S.Boolean.pipe(
      S.annotateKey({ description: "A production build: a missing or short secret stops the service" })
    )
  }).pipe($I.annoteSchema("BetterAuthSettings", { description: "The settings Better Auth is built from" }))
) {}
