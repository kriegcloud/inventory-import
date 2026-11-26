/**
 * What a valid session cookie says, the one request detail a span carries, and how the signing secret is chosen.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as SchemaGetter from "effect/SchemaGetter"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import type { BetterAuthSettings } from "./BetterAuth.config.ts"
import { BetterAuthConfigError } from "./BetterAuth.errors.ts"
import { $BetterAuthId } from "./internal/identity.ts"

const $I = $BetterAuthId.create("BetterAuthSession")

/** The text of an id Better Auth stores: 1 to 64 letters, digits, `_` or `-`. */
const IdText = S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,64}$/))

/**
 * Better Auth's account id: who signed in. A host decodes it into its own id type.
 *
 * @category ids
 */
export const AuthUserId = IdText.pipe(
  S.brand("AuthUserId"),
  $I.annoteSchema("AuthUserId", { description: "Better Auth's account id: who signed in" })
)

/**
 * The decoded value of `AuthUserId`.
 *
 * @category ids
 */
export type AuthUserId = typeof AuthUserId.Type

/**
 * Better Auth's organization id: the organization a session last chose.
 *
 * @category ids
 */
export const AuthOrganizationId = IdText.pipe(
  S.brand("AuthOrganizationId"),
  $I.annoteSchema("AuthOrganizationId", { description: "Better Auth's organization id" })
)

/**
 * The decoded value of `AuthOrganizationId`.
 *
 * @category ids
 */
export type AuthOrganizationId = typeof AuthOrganizationId.Type

/**
 * The email an account signs in with.
 *
 * @category schemas
 */
export const AuthEmail = S.String.check(S.isMaxLength(254), S.isPattern(/^[^\s@]+@[^\s@]+$/)).pipe(
  $I.annoteSchema("AuthEmail", { description: "The email an account signs in with" })
)

/**
 * What a valid session cookie says: whose it is, and which organization they are working in.
 *
 * @category schemas
 */
export class AuthSession extends S.Opaque<AuthSession, { readonly brand: unique symbol }>()(
  S.Struct({
    userId: AuthUserId.pipe(S.annotateKey({ description: "Who signed in" })),
    email: AuthEmail.pipe(S.annotateKey({ description: "The email the person signed in with, for the account menu" })),
    activeOrganizationId: AuthOrganizationId.pipe(
      S.annotateKey({ description: "The organization the person last chose. None until they belong to one" }),
      S.OptionFromOptionalNullOr
    )
  }).pipe(
    $I.annoteSchema("AuthSession", {
      description: "What a valid session cookie says: whose it is, and where they work"
    })
  )
) {}

/**
 * The part of Better Auth's `getSession` answer this driver reads: nobody, or a session and its user. Anything else in
 * it is ignored.
 *
 * @category schemas
 */
export const AuthSessionAnswer = S.OptionFromNullOr(
  S.Struct({
    session: S.Struct({
      userId: AuthUserId,
      activeOrganizationId: AuthOrganizationId.pipe(S.OptionFromOptionalNullOr)
    }),
    user: S.Struct({ email: AuthEmail })
  })
).pipe($I.annoteSchema("AuthSessionAnswer", { description: "Better Auth's getSession answer, as far as it is read" }))

/**
 * The endpoint a Better Auth request is for, relative to its base path (`/sign-in/email`): the one request detail a
 * span carries. Never its query or body.
 *
 * @category schemas
 */
export const AuthEndpoint = S.String.check(S.isMinLength(1), S.isMaxLength(200)).pipe(
  $I.annoteSchema("AuthEndpoint", { description: "The Better Auth endpoint a request is for, under the base path" })
)

/**
 * The endpoint `url` names under `basePath`, cut to the schema's bound.
 *
 * **Example** (A sign-in)
 *
 * ```ts
 * import { authEndpointOf } from "@beep/better-auth/BetterAuthSession"
 *
 * authEndpointOf({ url: "https://app.example/api/auth/sign-in/email?x=1", basePath: "/api/auth" }) // "/sign-in/email"
 * ```
 *
 * @category behaviour
 */
export const authEndpointOf = (request: { readonly url: string; readonly basePath: string }): string => {
  const basePath = request.basePath
  const path = new URL(request.url).pathname
  const endpoint = Str.startsWith(basePath)(path) ? Str.slice(basePath.length)(path) : path
  return endpoint === "" ? "/" : Str.slice(0, 200)(endpoint)
}

/** The shortest secret accepted: Better Auth's own warning threshold. */
const minimumSecretLength = 32

/** A secret long enough to sign sessions with: 32 characters or more. */
const SigningSecret = S.String.check(S.isMinLength(minimumSecretLength)).annotate({
  description: "A secret of 32 characters or more"
})

class ConfiguredSecret extends S.Opaque<ConfiguredSecret, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("configured"),
    secret: S.Redacted(SigningSecret).pipe(
      S.annotateKey({ description: "The configured secret, 32 characters or more" })
    )
  }).pipe($I.annoteSchema("ConfiguredSecret", { description: "Sessions are signed with the configured secret" }))
) {}

class EphemeralSecret extends S.Opaque<EphemeralSecret, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("ephemeral") }).pipe(
    $I.annoteSchema("EphemeralSecret", {
      description: "Development only: a random secret for this process, so sessions end when it restarts"
    })
  )
) {}

/**
 * How sessions are signed: with the configured secret, or, in development only, with a random one made for this
 * process.
 *
 * @category schemas
 */
export const AuthSecret = LiteralKit(["configured", "ephemeral"])
  .mapMembers(() => Tuple.make(ConfiguredSecret, EphemeralSecret))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("AuthSecret", { description: "How sessions are signed" }))

/**
 * The decoded value of `AuthSecret`.
 *
 * @category models
 */
export type AuthSecret = typeof AuthSecret.Type

/**
 * The secret policy: a configured secret of 32 characters or more is used; none, or a shorter one, fails in
 * production and is `ephemeral` in development.
 *
 * @category behaviour
 */
export const resolveAuthSecret = (
  settings: Pick<BetterAuthSettings, "secret" | "production">
): Result.Result<AuthSecret, BetterAuthConfigError> => {
  const configured = O.flatMap(settings.secret, (secret) => ConfiguredSecret.makeOption({ kind: "configured", secret }))
  if (O.isSome(configured)) return Result.succeed(configured.value)
  if (settings.production) {
    return Result.fail(
      BetterAuthConfigError.make({ problem: O.isNone(settings.secret) ? "missingSecret" : "shortSecret" })
    )
  }
  return Result.succeed(EphemeralSecret.make({ kind: "ephemeral" }))
}

/** The library's resolved options read by this driver.
 * @category schemas
 */
export const AuthDriverOptions = S.Struct({
  basePath: S.NullishOr(S.String).pipe(
    S.annotateKey({ description: "The path under which Better Auth serves its endpoints" }),
    S.decodeTo(S.String, {
      decode: SchemaGetter.transformOptional<string, string | null | undefined>(O.flatMap(O.fromNullishOr)).pipe(
        SchemaGetter.compose(SchemaGetter.withDefault(Effect.succeed("/api/auth")))
      ),
      encode: SchemaGetter.passthrough()
    }),
    S.withDecodingDefaultType(Effect.succeed("/api/auth"))
  )
}).pipe($I.annoteSchema("AuthDriverOptions", { description: "Better Auth options read by the driver" }))

/** The decoded driver options.
 * @category models
 */
export type AuthDriverOptions = typeof AuthDriverOptions.Type
