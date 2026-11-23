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

/** Whether a URL is nothing but an origin on the web: http or https, no account, path, query or fragment. */
const isWebOrigin = (url: URL): boolean =>
  (url.protocol === "http:" || url.protocol === "https:") &&
  url.username === "" &&
  url.password === "" &&
  url.pathname === "/" &&
  url.search === "" &&
  url.hash === ""

/**
 * The address people open the app at, as an origin on the web (`https://app.example.com`). Better Auth trusts this
 * origin alone and makes cookies Secure exactly when it is `https:`, so anything past the origin would be dropped
 * without a word, and a `file:` or `data:` address has no origin at all ("null"): both are refused.
 *
 * A deployed stage's address is the Worker's (`BETTER_AUTH_URL`, from the stack's `Cloudflare.Worker.URL`), which
 * Alchemy writes as a bare origin: `https://` and the first custom domain, or `https://<name>.<subdomain>.workers.dev`,
 * with no path and no trailing slash. This schema reads it as it is.
 *
 * @category schemas
 */
export const PublicUrl = S.URL.check(
  S.makeFilter(isWebOrigin, {
    identifier: "PublicUrlOrigin",
    title: "An http or https origin",
    description: "An http or https address with no account, path, query or fragment, such as https://app.example.com",
    expected: "an http or https origin, such as https://app.example.com"
  })
).pipe($I.annoteSchema("PublicUrl", { description: "The address people open the app at, as an http(s) origin" }))

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
    publicUrl: PublicUrl.pipe(
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
