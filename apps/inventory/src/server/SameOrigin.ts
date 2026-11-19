import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import { CrossSiteRequest } from "@inventory/kernel/AccessError"
import { RequestSource, SameOrigin } from "@inventory/kernel/SameOrigin"

// CROSS-SITE WRITES. A browser sends a request to this API whichever page asked for it. Without a check, a page on
// another site could make a visitor's browser write here as them, since the session cookie travels with it. This
// middleware is the lock, on the server, ahead of identity, so it holds whichever identity is in place.
//
// The one thing not to break: a write is taken only when the browser says it comes from this app's own pages. Do
// not add "same-site" to the list (a sibling subdomain is another origin), and do not move the check after identity.

/** The `SameOrigin` middleware: refuses a cross-site write with `CrossSiteRequest` (403) before identity is read. */
export const SameOriginLive = Layer.succeed(
  SameOrigin,
  SameOrigin.of(
    Effect.fn("SameOrigin")(function* (httpEffect) {
      const request = yield* HttpServerRequest.HttpServerRequest
      const source = RequestSource.make({
        method: request.method,
        fetchSite: O.fromUndefinedOr(request.headers["sec-fetch-site"]),
        origin: O.fromUndefinedOr(request.headers["origin"]),
        // The address the request was sent to, from the URL the runtime received and from its Host header.
        own: A.dedupe(
          A.map(
            A.getSomes([O.liftThrowable(() => new URL(request.originalUrl))(), HttpServerRequest.toURL(request)]),
            (url) => url.origin
          )
        )
      })
      if (!RequestSource.allows(source)) {
        yield* Effect.logWarning("Refused a write from another site").pipe(
          Effect.annotateLogs({
            "http.origin": O.getOrElse(source.origin, () => ""),
            "http.sec_fetch_site": O.getOrElse(source.fetchSite, () => "")
          })
        )
        return yield* CrossSiteRequest.make({
          reason: "This request came from another site, so it was refused. Open the app itself and try again there."
        })
      }
      return yield* httpEffect
    })
  )
)
