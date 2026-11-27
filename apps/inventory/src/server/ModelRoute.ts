// THE FORWARDING ROUTE (host-04). A member's page reaches the app's models on this origin, at `/api/model/member`:
// a call is a POST there (or at a live read's address), and a live read is a WebSocket upgrade at
// `/api/model/member/<member id>` (Benjamin, 2026-11-26: "Member id in the socket's address"; the library puts the
// read itself in the query, `?read=`). Each is handed to the usage model's member Api (`Models.usageMember`), and to
// nothing else: no path here reaches the server Api, which only the site's own code holds (`Models.usageServer`).
//
// The one thing not to break: the model's Api has no origin check of its own, so this route is the lock. Every
// request is judged as a write by the cross-site rule before anything is read or forwarded, an upgrade included,
// although it is a GET: a live read follows a person's data. And a live read carries no header, so the member its
// address names is checked here against the session before it is forwarded: when the session is somebody else's, the
// read goes on with the page's member header naming the address's member, which the model's session refuses with
// the lookup's own sentence ("This page was opened for somebody else ..."), typed, as a page reads any refusal.
import { CrossSiteRequest } from "@inventory/kernel/AccessError"
import { MemberId } from "@inventory/kernel/Ids"
import { RequestSource } from "@inventory/kernel/SameOrigin"
import { SessionLookup } from "@inventory/kernel/SessionLookup"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Headers from "effect/http/Headers"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { Models, modelRoutePrefix } from "./Models.ts"
import { crossSiteReason, logRefused, requestSourceOf } from "./SameOrigin.ts"

/** Where a page's calls go, and the start of every live read's address. */
export const memberRoute = `${modelRoutePrefix}/member`

/** True for a WebSocket upgrade: a live read. */
const isUpgrade = (request: HttpServerRequest.HttpServerRequest): boolean =>
  O.exists(Headers.get(request.headers, "upgrade"), (value) => /^websocket$/i.test(value))

const refusedAsCrossSite = HttpServerResponse.schemaJson(CrossSiteRequest)(
  CrossSiteRequest.make({ reason: crossSiteReason }),
  { status: 403 }
).pipe(Effect.orDie)

/**
 * The page's member header a live read is forwarded with: none when the session is the address's member's (or there
 * is no session, which the model refuses itself), and the address's member when the session is somebody else's, so
 * the model refuses it.
 */
const pageMemberFor = Effect.fnUntraced(function* (addressed: MemberId, headers: Headers.Headers) {
  const sessions = yield* SessionLookup
  const verdict = yield* sessions.verdictOf(headers).pipe(Effect.option)
  return O.flatMap(verdict, (judged) => (judged.member.id === addressed ? O.none() : O.some(addressed)))
})

/**
 * One request to the route, on the models and the session lookup the route was built with: judged, then forwarded or
 * refused. `addressed` is the member a live read's path names.
 */
const forward = (reach: { readonly models: Models["Service"]; readonly sessions: SessionLookup["Service"] }) =>
  Effect.fnUntraced(function* (addressed: O.Option<string>) {
    const request = yield* HttpServerRequest.HttpServerRequest
    const upgrade = isUpgrade(request)
    if (!upgrade && request.method !== "POST") return HttpServerResponse.empty({ status: 405 })
    const source = requestSourceOf({ request, asWrite: true })
    if (!RequestSource.allows(source)) {
      yield* logRefused(source)
      return yield* refusedAsCrossSite
    }
    if (!upgrade) return yield* reach.models.usageMember({ request, pageMember: O.none() })
    // A live read is one member's: its address must name them.
    const member = O.flatMap(addressed, S.decodeOption(MemberId))
    if (O.isNone(member)) return HttpServerResponse.empty({ status: 404 })
    const pageMember = yield* pageMemberFor(member.value, request.headers).pipe(
      Effect.provideService(SessionLookup, reach.sessions)
    )
    return yield* reach.models.usageMember({ request, pageMember })
  })

/**
 * The route on the app's router: `/api/model/member` for calls, `/api/model/member/:member` for a live read (and the
 * calls of the client a live read is opened on). Built on the models (`Models`) and the one session lookup.
 */
// Named so the linter does not read it as a React hook (pattern 6 in docs/patterns.md).
const withRouter = HttpRouter.use

export const ModelRoute = withRouter(
  Effect.fn(function* (router) {
    const answer = forward({ models: yield* Models, sessions: yield* SessionLookup })
    yield* router.add("*", memberRoute, answer(O.none()))
    yield* router.add(
      "*",
      `${memberRoute}/:member`,
      Effect.flatMap(HttpRouter.params, (params) => answer(O.fromUndefinedOr(params["member"])))
    )
  })
)
