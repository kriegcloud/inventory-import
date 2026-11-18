import { Array as Arr, Effect, Layer, Option, String as Str } from "effect"
import { HttpServerRequest } from "effect/http"
import { CrossSiteRequest, SameOrigin } from "../api/v1/Security.ts"

// CROSS-SITE WRITES. A browser sends a request to this API whichever page asked for it. Without a check, a page on
// another site could make a visitor's browser write here as them, since the session cookie travels with it. This
// middleware is the lock, on the server, ahead of identity, so it holds whichever identity is in place.
//
// The one thing not to break: a write is taken only when the browser says it comes from this app's own pages. Do
// not add "same-site" to the list (a sibling subdomain is another origin), and do not move the check after identity.

/** What the rule reads from one request. */
export type RequestSource = {
  readonly method: string
  /** `Sec-Fetch-Site`: the browser's own statement of where the request came from. A page cannot set it. */
  readonly fetchSite: string | undefined
  /** `Origin`: the address of the page that made the request. */
  readonly origin: string | undefined
  /** The app's own origins: the address this request was sent to. */
  readonly own: ReadonlyArray<string>
}

const readingMethods = ["GET", "HEAD", "OPTIONS"]

/**
 * Whether a request may act. Reading is always allowed: a page on another site cannot see the answer, because no
 * cross-origin access is granted anywhere (no `Access-Control-Allow-Origin`). A write is allowed when the browser says
 * it comes from this app (`Sec-Fetch-Site: same-origin`, or `none` for a request the person made themselves), or,
 * from a browser too old to say, when `Origin` is one of the app's own. A request with neither header is not from a
 * browser page (a script, a test, curl): it has no visitor's browser to borrow, so the rule does not apply to it.
 *
 * @example
 * allowsRequest({ method: "POST", fetchSite: "cross-site", origin: "https://elsewhere.example", own: ["https://app.example"] }) // false
 * allowsRequest({ method: "POST", fetchSite: undefined, origin: "https://app.example", own: ["https://app.example"] }) // true
 */
export const allowsRequest = (source: RequestSource): boolean => {
  const method = Str.toUpperCase(source.method)
  if (Arr.some(readingMethods, (reading) => reading === method)) return true
  if (source.fetchSite !== undefined) return source.fetchSite === "same-origin" || source.fetchSite === "none"
  if (source.origin !== undefined) {
    const origin = Str.toLowerCase(source.origin)
    return Arr.some(source.own, (own) => Str.toLowerCase(own) === origin)
  }
  return true
}

/** The `SameOrigin` middleware: refuses a cross-site write with `CrossSiteRequest` (403) before identity is read. */
export const SameOriginLive = Layer.succeed(
  SameOrigin,
  SameOrigin.of(
    Effect.fn("SameOrigin")(function* (httpEffect) {
      const request = yield* HttpServerRequest.HttpServerRequest
      const source = {
        method: request.method,
        fetchSite: request.headers["sec-fetch-site"],
        origin: request.headers["origin"],
        // The address the request was sent to, from the URL the runtime received and from its Host header.
        own: Arr.dedupe(
          Arr.map(
            Arr.getSomes([
              Option.liftThrowable(() => new URL(request.originalUrl))(),
              HttpServerRequest.toURL(request)
            ]),
            (url) => url.origin
          )
        )
      }
      if (!allowsRequest(source)) {
        yield* Effect.logWarning("Refused a write from another site").pipe(
          Effect.annotateLogs({ "http.origin": source.origin ?? "", "http.sec_fetch_site": source.fetchSite ?? "" })
        )
        return yield* CrossSiteRequest.make({
          reason: "This request came from another site, so it was refused. Open the app itself and try again there."
        })
      }
      return yield* httpEffect
    })
  )
)
