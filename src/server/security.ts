import { Array as Arr, Option, String as Str } from "effect"
import { dual } from "effect/Function"
import { docsPath } from "../api/v1/Api.ts"

// SECURITY HEADERS for every response the Worker sends (/api/*). Static files get theirs from public/_headers, with
// the same cross-origin policies. What each one is for:
//
// - An API response is data, never a document, so its content security policy allows nothing at all.
// - CORS: no response carries `Access-Control-Allow-Origin`, so a page on another origin cannot read any answer.
//   Nothing here adds one; adding a CORS layer would only widen access (test/server/Security.test.ts holds this).
// - `Cache-Control: no-store`: answers are per person and per organization, and nothing shared may keep them.
// - Cross-origin isolation: COOP same-origin, COEP require-corp and CORP same-origin, so no other origin can embed,
//   open or read these responses.
// - HSTS is sent everywhere; browsers ignore it on http://localhost, so it only binds a deployed copy.
// - SRI: every script is served from this origin under `script-src 'self'`, so integrity attributes would add nothing
//   a same-origin attacker could not also rewrite. A script from another origin would need one, and the policy
//   refuses such scripts anyway.
// - Redirects: the API answers none. A route that must send a person back somewhere takes the target through
//   `safeRedirectPath`, so it can only be a path on this site. Plain HTTP to HTTPS is the platform's job on a
//   deployed copy (Cloudflare's "Always Use HTTPS"), not the Worker's.
const headers: ReadonlyArray<readonly [string, string]> = [
  ["Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"],
  ["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
  ["X-Content-Type-Options", "nosniff"],
  ["X-Frame-Options", "DENY"],
  ["Referrer-Policy", "no-referrer"],
  ["Cross-Origin-Resource-Policy", "same-origin"],
  ["Cross-Origin-Opener-Policy", "same-origin"],
  ["Cross-Origin-Embedder-Policy", "require-corp"],
  ["Cache-Control", "no-store"]
]

/**
 * The content security policy of the API reference page (development only). Scalar's page is one HTML document with
 * two inline scripts (Scalar itself and the call that boots it with this API's OpenAPI document) and the styles
 * Scalar injects. The policy allows exactly those two scripts by their SHA-256 hashes, its own styles, and requests
 * back to this origin for "Try it"; nothing else, and no other route gets it.
 *
 * One version, one page: `withSecurityHeaders` gives this policy to `docsPath` only. A second version of the API
 * with its own reference page (`/api/v2/docs`) must be added there, or that page is served under the API's
 * `default-src 'none'`, loads nothing and stays blank.
 */
const docsPolicy = (scriptHashes: ReadonlyArray<string>) =>
  Arr.join(
    [
      "default-src 'none'",
      `script-src ${Arr.join(
        Arr.map(scriptHashes, (hash) => `'sha256-${hash}'`),
        " "
      )}`,
      "style-src 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'"
    ],
    "; "
  )

const sha256Base64 = (text: string) =>
  crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((digest) =>
    btoa(
      Arr.join(
        Arr.map(Arr.fromIterable(new Uint8Array(digest)), (byte) => String.fromCharCode(byte)),
        ""
      )
    )
  )

const inlineScripts = /<script>([\s\S]*?)<\/script>/g

/**
 * The API response with the headers above set, replacing any the handler chose. The API reference page, which only a
 * development build serves, gets its own content security policy instead of the API's. Data-first
 * (`withSecurityHeaders(response, request)`) or for a promise chain (`.then(withSecurityHeaders(request))`).
 */
export const withSecurityHeaders: {
  (request: Request): (response: Response) => Promise<Response>
  (response: Response, request: Request): Promise<Response>
} = dual(2, (response: Response, request: Request): Promise<Response> => {
  const secured = new Response(response.body, response)
  for (const [name, value] of headers) secured.headers.set(name, value)
  if (!import.meta.env.DEV || new URL(request.url).pathname !== docsPath || response.status !== 200) {
    return Promise.resolve(secured)
  }
  return secured.text().then((html) =>
    Promise.all(
      Arr.map(Arr.fromIterable(Str.matchAll(inlineScripts)(html)), (match) => sha256Base64(match[1] ?? ""))
    ).then((hashes) => {
      const page = new Response(html, secured)
      page.headers.set("Content-Security-Policy", docsPolicy(hashes))
      return page
    })
  )
})

/**
 * A place to send a person back to, if it is a path on this site; otherwise none. Use it for any `return to` or
 * `next` value before redirecting, so a link cannot send people to another site (an open redirect).
 *
 * @example
 * safeRedirectPath("/imports/42?tab=review") // Option.some("/imports/42?tab=review")
 * safeRedirectPath("https://elsewhere.example/") // Option.none()
 * safeRedirectPath("//elsewhere.example/") // Option.none(): a scheme-relative address is another site
 */
export const safeRedirectPath = (target: string): Option.Option<string> => {
  if (!Str.startsWith("/")(target) || Str.startsWith("//")(target) || Str.startsWith("/\\")(target)) {
    return Option.none()
  }
  const base = "https://this.invalid"
  return Option.liftThrowable(() => new URL(target, base))().pipe(
    Option.filter((url) => url.origin === base),
    Option.map((url) => `${url.pathname}${url.search}${url.hash}`)
  )
}
