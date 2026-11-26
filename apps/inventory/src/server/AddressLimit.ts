import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Headers from "effect/http/Headers"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { TooManyRequests } from "@inventory/kernel/AccessError"

// THE COARSE LIMIT. One counter for each visitor address over sign-in, sign-up and the model's endpoints: 30 in 60
// seconds (the binding's own numbers, in the stack and in wrangler.jsonc), then a 429 before Better Auth or the model
// is reached. It is the outer fence only. The exact limits stay behind it: Better Auth's 10 sign-ins and 5 sign-ups a
// minute, kept in D1, and the organization's 40 model calls a day. Cloudflare counts per location and approximately,
// so "30" is "about 30", and never a number shown to a person.
//
// The one thing not to break: when the counter itself fails, the request goes on (decision of 2026-11-26). A broken
// binding must never lock everyone out of signing in.

/** How many counted requests one address may send in `windowSeconds`. The binding holds the same two numbers. */
export const addressLimit = 30
/** The window the binding counts over, in seconds. */
export const windowSeconds = 60

/** The counter failed: the binding threw. Caught where the count is taken, and never reaches a caller of `take`. */
export class CounterFailed extends S.TaggedError<CounterFailed, { readonly brand: unique symbol }>()("CounterFailed", {
  cause: S.Defect()
}) {}

/** The coarse limit's counter: whether one more request from `key` is within the minute's limit. */
export class AddressLimit extends Context.Service<
  AddressLimit,
  { readonly take: (key: string) => Effect.Effect<boolean> }
>()("@inventory/app/server/AddressLimit") {
  /**
   * On a count that can fail (the Worker's rate-limit binding, which worker.ts hands in): a failure lets the request
   * on, and is logged.
   */
  static readonly counting = (count: (key: string) => Effect.Effect<boolean, CounterFailed>) =>
    Layer.succeed(
      AddressLimit,
      AddressLimit.of({
        take: Effect.fn("AddressLimit.take")(
          count,
          Effect.catch((failed) =>
            Effect.logWarning("The address limit could not be counted; the request went on", failed.cause).pipe(
              Effect.as(true)
            )
          )
        )
      })
    )

  /** No limit: every request goes on. For the tests that are not about the limit. */
  static readonly open = AddressLimit.counting(() => Effect.succeed(true))
}

const countedPaths = [
  /^\/api\/auth\/sign-in\//,
  /^\/api\/auth\/sign-up\//,
  /^\/api\/v1\/imports\/[^/]+\/suggest$/,
  /^\/api\/v1\/assistant\/view$/,
  /^\/api\/v1\/system\/ai-check$/
]

/**
 * Whether a request counts towards the limit: a POST to sign-in, sign-up or one of the three endpoints that ask a
 * model. Reads, and every other write, never do. A test holds each path against the API's own document, so a
 * renamed endpoint fails there.
 *
 * @example
 * counted({ method: "POST", path: "/api/auth/sign-in/email" }) // true
 * counted({ method: "POST", path: "/api/v1/imports/imp_1/commit" }) // false
 */
export const counted = (request: { readonly method: string; readonly path: string }): boolean =>
  request.method === "POST" && A.some(countedPaths, (pattern) => pattern.test(request.path))

/** The 429 the limit answers with, encoded by the error's own schema as the app's other refusals are. */
const refused = HttpServerResponse.schemaJson(TooManyRequests)(
  TooManyRequests.make({ reason: "Too many attempts from this address. Wait a minute, then try again." }),
  { status: 429, headers: { "retry-after": `${windowSeconds}` } }
).pipe(Effect.orDie)

/**
 * The limit in front of every route, Better Auth's included. A counted request with a visitor address
 * (`cf-connecting-ip`, which Cloudflare sets and a visitor cannot) is counted under this app's own host and that
 * address, so two stages in one account do not share a count. A request with no such header did not come through
 * Cloudflare (a test, a local script): it is not counted.
 */
export const LimitedByAddress = HttpRouter.middleware(
  Effect.gen(function* () {
    const limit = yield* AddressLimit
    return (httpEffect) =>
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const url = HttpServerRequest.toURL(request)
        const address = Headers.get(request.headers, "cf-connecting-ip")
        const key = O.all({ url, address }).pipe(
          O.filter(({ url }) => counted({ method: request.method, path: url.pathname })),
          O.map(({ url, address }) => `${url.host} ${address}`)
        )
        if (O.isNone(key)) return yield* httpEffect
        const within = yield* limit.take(key.value)
        if (within) return yield* httpEffect
        yield* Effect.logWarning("Refused: too many counted requests from one address")
        return yield* refused
      })
  }),
  { global: true }
)
