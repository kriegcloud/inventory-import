/**
 * Cross-site writes. A browser sends a request to this API whichever page asked for it; without a check, a page on
 * another site could make a visitor's browser write here as them, since the session cookie travels with it.
 *
 * The one thing not to break: a write is taken only when the browser says it comes from this app's own pages. Do not
 * add "same-site" to the list (a sibling subdomain is another origin), and do not move the check after identity.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import { CrossSiteRequest } from "./AccessError.errors.ts"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("SameOrigin")

const readingMethods = ["GET", "HEAD", "OPTIONS"]

/**
 * What the cross-site rule reads from one request.
 *
 * **Example** (A write from another site)
 *
 * ```ts
 * import { RequestSource } from "@inventory/kernel/SameOrigin"
 * import * as O from "effect/Option"
 *
 * RequestSource.allows(
 *   RequestSource.make({ method: "POST", fetchSite: O.some("cross-site"), origin: O.none(), own: [] })
 * ) // false
 * ```
 *
 * @category schemas
 */
export class RequestSource extends S.Opaque<RequestSource, { readonly brand: unique symbol }>()(
  S.Struct({
    method: S.String.check(S.isMinLength(1), S.isMaxLength(16)).pipe(
      S.annotateKey({ description: "The request's method, in any case" })
    ),
    fetchSite: S.String.pipe(
      S.annotateKey({
        description: "Sec-Fetch-Site: the browser's own statement of where the request came from. A page cannot set it."
      }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    origin: S.String.pipe(
      S.annotateKey({ description: "Origin: the address of the page that made the request" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    own: S.Array(S.String.pipe(S.annotateKey({ description: "One of the app's own origins" }))).pipe(
      S.annotateKey({ description: "The app's own origins: the address this request was sent to" })
    )
  }).pipe($I.annoteSchema("RequestSource", { description: "What the cross-site rule reads from one request" }))
) {
  /**
   * Whether a request may act. Reading is always allowed: a page on another site cannot see the answer, because no
   * cross-origin access is granted anywhere. A write is allowed when the browser says it comes from this app
   * (`Sec-Fetch-Site: same-origin`, or `none` for a request the person made themselves), or, from a browser too old
   * to say, when `Origin` is one of the app's own. A request with neither header is not from a browser page (a
   * script, a test, curl): it has no visitor's browser to borrow, so the rule does not apply to it.
   */
  static readonly allows = (source: Pick<RequestSource, "method" | "fetchSite" | "origin" | "own">): boolean => {
    const method = Str.toUpperCase(source.method)
    if (A.some(readingMethods, (reading) => reading === method)) return true
    if (O.isSome(source.fetchSite)) return source.fetchSite.value === "same-origin" || source.fetchSite.value === "none"
    return O.match(source.origin, {
      onNone: () => true,
      onSome: (origin) => A.some(source.own, (own) => Str.toLowerCase(own) === Str.toLowerCase(origin))
    })
  }
}

/**
 * Takes a write only when the browser says it came from this app's own pages; refuses it with `CrossSiteRequest`
 * (403) before identity is read. Applied to the whole API.
 *
 * @category middleware
 */
export class SameOrigin extends HttpApiMiddleware.Service<SameOrigin>()($I`SameOrigin`, { error: CrossSiteRequest }) {}
