// The forwarding route (host-04) through the app's own `fetch`, its models a recording stand-in and its session
// lookup one that counts: a call (a POST) and a live read (a WebSocket upgrade) from another site are refused
// `CrossSiteRequest` (403) before any session is read and never reach the models; the app's own are handed to the
// member Api, and to nothing else; a live read whose address names somebody else than the session goes on with the
// page's member header naming the address's member, so the model's session refuses it. What it does not hold: a 101
// coming back with its socket (Node's `Response` takes no 101), which the harness test beside the stack test and the
// browser hold, and the model's own refusal, which `apps/model/test` holds.
import { expect, layer } from "@effect/vitest"
import { CrossSiteRequest } from "@inventory/kernel/AccessError"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup, SessionVerdict } from "@inventory/kernel/SessionLookup"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import { Models } from "../../src/server/Models.ts"
import { ModelRoute } from "../../src/server/ModelRoute.ts"
import { jsonOf, TestFetch, testOrigin } from "./support/app.ts"

const signedIn = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

/** What reached the models: each forwarded request's path and the page's member header the route set. */
const forwarded = MutableRef.make<ReadonlyArray<{ readonly path: string; readonly pageMember: O.Option<string> }>>([])
/** How many times the route read a session. */
const lookups = MutableRef.make(0)

const RecordingModels = Layer.succeed(
  Models,
  Models.of({
    usageServer: Effect.die("The route never reaches the server Api."),
    usageMember: Effect.fnUntraced(function* ({ request, pageMember }) {
      const path = O.match(HttpServerRequest.toURL(request), { onNone: () => "", onSome: (url) => url.pathname })
      MutableRef.update(forwarded, (all) => [...all, { path, pageMember }])
      return yield* Effect.succeed(HttpServerResponse.empty({ status: 204 }))
    })
  })
)

const CountingSessions = Layer.succeed(
  SessionLookup,
  SessionLookup.of({
    verdictOf: Effect.fn("SessionLookup.verdictOf")(function* () {
      MutableRef.update(lookups, (n) => n + 1)
      const at = yield* DateTime.now
      return SessionVerdict.judged({ member: signedIn, at, sessionEnds: O.none() })
    }),
    memberNow: Effect.fn("SessionLookup.memberNow")(function* () {
      return yield* Effect.succeedSome(signedIn)
    })
  })
)

const App = TestFetch.layer(ModelRoute.pipe(Layer.provide(Layer.merge(RecordingModels, CountingSessions))))

/** A request as a page of `from` sends it: `Sec-Fetch-Site` and `Origin` as a browser sets them. */
const from = (site: "own" | "other") =>
  site === "own"
    ? { "sec-fetch-site": "same-origin", origin: testOrigin }
    : { "sec-fetch-site": "cross-site", origin: "https://elsewhere.example" }

const upgrade = { upgrade: "websocket", connection: "Upgrade" }

const sent = Effect.fn("sent")(function* (path: string, method: "GET" | "POST", headers: Record<string, string>) {
  MutableRef.set(forwarded, [])
  MutableRef.set(lookups, 0)
  const { handle } = yield* TestFetch
  const response = yield* handle(new Request(`${testOrigin}${path}`, { method, headers }))
  return {
    status: response.status,
    body: response.status === 204 ? undefined : yield* jsonOf(response),
    forwarded: MutableRef.get(forwarded),
    lookups: MutableRef.get(lookups)
  }
})

layer(App)("the route a page reaches the models by", (it) => {
  it.effect("refuses a call and a live read from another site, before any session is read, and forwards neither", () =>
    Effect.gen(function* () {
      const call = yield* sent("/api/model/member", "POST", from("other"))
      const read = yield* sent("/api/model/member/mem_dana", "GET", { ...from("other"), ...upgrade })
      // A browser too old to send Sec-Fetch-Site: its Origin decides.
      const oldBrowser = yield* sent("/api/model/member/mem_dana", "GET", {
        origin: "https://elsewhere.example",
        ...upgrade
      })
      for (const refused of [call, read, oldBrowser]) {
        expect([refused.status, refused.forwarded, refused.lookups]).toEqual([403, [], 0])
        const refusal = yield* S.decodeUnknownEffect(CrossSiteRequest)(refused.body)
        expect(refusal).toEqual(
          CrossSiteRequest.make({
            reason: "This request came from another site, so it was refused. Open the app itself and try again there."
          })
        )
      }
    })
  )

  it.effect("forwards the app's own call and live read to the member Api, and nowhere else", () =>
    Effect.gen(function* () {
      const call = yield* sent("/api/model/member", "POST", from("own"))
      const read = yield* sent("/api/model/member/mem_dana", "GET", { ...from("own"), ...upgrade })
      expect([call.status, call.forwarded, call.lookups]).toEqual([
        204,
        [{ path: "/api/model/member", pageMember: O.none() }],
        0
      ])
      expect([read.status, read.forwarded, read.lookups]).toEqual([
        204,
        [{ path: "/api/model/member/mem_dana", pageMember: O.none() }],
        1
      ])
      // The server Api has no address here, and a plain GET is no call.
      const server = yield* sent("/api/model/server", "POST", from("own"))
      const plainGet = yield* sent("/api/model/member", "GET", from("own"))
      expect([server.status, server.forwarded]).toEqual([404, []])
      expect([plainGet.status, plainGet.forwarded]).toEqual([405, []])
    })
  )

  it.effect(
    "sends a live read for somebody else on with their name in the page's header, and one for nobody not at all",
    () =>
      Effect.gen(function* () {
        const elsewhere = yield* sent("/api/model/member/mem_marcus", "GET", { ...from("own"), ...upgrade })
        expect([elsewhere.status, elsewhere.forwarded]).toEqual([
          204,
          [{ path: "/api/model/member/mem_marcus", pageMember: O.some("mem_marcus") }]
        ])
        const nobody = yield* sent("/api/model/member", "GET", { ...from("own"), ...upgrade })
        expect([nobody.status, nobody.forwarded]).toEqual([404, []])
      })
  )
})
