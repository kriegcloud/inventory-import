import * as A from "effect/Array"
import * as Digest from "effect/crypto/Digest"
import * as Effect from "effect/Effect"
import * as Base64 from "effect/encoding/Base64"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
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
  A.join(
    [
      "default-src 'none'",
      `script-src ${A.join(
        A.map(scriptHashes, (hash) => `'sha256-${hash}'`),
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

const encoder = new TextEncoder()

/** A script's SHA-256 hash in base64, as a content security policy names it. */
const sha256Base64 = Effect.fnUntraced(function* (text: string) {
  const digest = yield* Digest.Digest
  const bytes = yield* digest.digest(Digest.sha256, encoder.encode(text))
  return Base64.encode(bytes)
})

const inlineScripts = /<script>([\s\S]*?)<\/script>/g

/** The API reference page could not be read to hash its scripts: its body failed as it was read. */
export class UnreadablePage extends S.TaggedError<UnreadablePage, { readonly brand: unique symbol }>()(
  "UnreadablePage",
  { cause: S.Defect() }
) {}

/**
 * The API response with the headers above set, replacing any the handler chose. The API reference page, which only a
 * development build serves, gets its own content security policy instead of the API's, from the hashes of its inline
 * scripts (`Digest`). Data-first (`withSecurityHeaders(response, request)`) or piped
 * (`Effect.flatMap(withSecurityHeaders(request))`).
 */
export const withSecurityHeaders: {
  (request: Request): (response: Response) => Effect.Effect<Response, UnreadablePage, Digest.Digest>
  (response: Response, request: Request): Effect.Effect<Response, UnreadablePage, Digest.Digest>
} = dual(
  2,
  Effect.fnUntraced(function* (response: Response, request: Request) {
    const secured = new Response(response.body, response)
    for (const [name, value] of headers) secured.headers.set(name, value)
    if (!import.meta.env.DEV || new URL(request.url).pathname !== docsPath || response.status !== 200) return secured
    const html = yield* Effect.tryPromise({
      try: () => secured.text(),
      catch: (cause) => UnreadablePage.make({ cause })
    })
    const hashes = yield* Effect.forEach(
      A.fromIterable(Str.matchAll(inlineScripts)(html)),
      (match) => sha256Base64(match[1] ?? ""),
      { concurrency: "unbounded" }
    )
    const page = new Response(html, secured)
    page.headers.set("Content-Security-Policy", docsPolicy(hashes))
    return page
  })
)

/**
 * The answer when a response could not be given its headers: a bare 500 that carries them, so nothing leaves the
 * Worker without the API's policies.
 */
export const unsecuredAnswer = (): Response => {
  const refused = new Response(null, { status: 500 })
  for (const [name, value] of headers) refused.headers.set(name, value)
  return refused
}

/**
 * A place to send a person back to, if it is a path on this site; otherwise none. Use it for any `return to` or
 * `next` value before redirecting, so a link cannot send people to another site (an open redirect).
 *
 * @example
 * safeRedirectPath("/imports/42?tab=review") // O.some("/imports/42?tab=review")
 * safeRedirectPath("https://elsewhere.example/") // O.none()
 * safeRedirectPath("//elsewhere.example/") // O.none(): a scheme-relative address is another site
 */
export const safeRedirectPath = (target: string): O.Option<string> => {
  if (!Str.startsWith("/")(target) || Str.startsWith("//")(target) || Str.startsWith("/\\")(target)) {
    return O.none()
  }
  const base = "https://this.invalid"
  return O.liftThrowable(() => new URL(target, base))().pipe(
    O.filter((url) => url.origin === base),
    O.map((url) => `${url.pathname}${url.search}${url.hash}`)
  )
}
