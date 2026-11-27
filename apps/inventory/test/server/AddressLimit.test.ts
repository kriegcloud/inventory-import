import { describe, expect, it, layer } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { TooManyRequests } from "@inventory/kernel/AccessError"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { openApiPath } from "../../src/api/v1/Api.ts"
import { AddressLimit, addressLimit, counted, CounterFailed, windowSeconds } from "../../src/server/AddressLimit.ts"
import { inMemoryAppLimited, noNetwork, send, TestFetch, testSettings } from "./support/app.ts"

// The coarse limit in front of sign-in, sign-up and the model's endpoints (src/server/AddressLimit.ts), through the
// Worker's own fetch on in-memory storage. The counter here is a stand-in that lets two requests of a key through
// and refuses the third: what Cloudflare's binding does at 30 is the binding's, and is not counted to 30 here.
// Sign-in's own routes are not in the in-memory app: AddressLimit.slow.test.ts holds the limit in front of them.

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "admin",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const seen = MutableHashMap.empty<string, number>()

/** Two of a key go on, the third is refused. */
const TwoThenRefused = Layer.succeed(
  AddressLimit,
  AddressLimit.of({
    take: Effect.fn("test.take")((key: string) =>
      Effect.sync(() => {
        const before = O.match(MutableHashMap.get(seen, key), { onNone: () => 0, onSome: (count) => count })
        MutableHashMap.set(seen, key, before + 1)
        return before < 2
      })
    )
  })
)

const App = TestFetch.layer(
  inMemoryAppLimited({
    docs: false,
    http: noNetwork,
    settings: testSettings,
    member: dana,
    ai: OpenRouterTest.off("noKey", ModelId.make("test/model")),
    limit: TwoThenRefused
  })
)

const view = {
  prompt: "show the name",
  table: "Items",
  columns: [{ id: "name", label: "Name", type: "text", sortable: true, hideable: false, operators: [], values: [] }],
  searchable: false
}

const ask = (address: O.Option<string>) =>
  send({
    method: "POST",
    path: "/api/v1/assistant/view",
    actingAs: O.some("mem_dana"),
    body: O.some(view),
    headers: R.getSomes({ "cf-connecting-ip": address })
  })

const Document = S.Struct({ paths: S.Record(S.String, S.Record(S.String, S.Unknown)) })

describe("which requests count", () => {
  it("sign-in, sign-up and the three endpoints that ask a model, as a POST", () => {
    const posts = [
      "/api/auth/sign-in/email",
      "/api/auth/sign-up/email",
      "/api/v1/imports/imp_1/suggest",
      "/api/v1/assistant/view",
      "/api/v1/system/ai-check"
    ]
    expect(A.map(posts, (path) => counted({ method: "POST", path }))).toEqual([true, true, true, true, true])
    expect(A.map(posts, (path) => counted({ method: "GET", path }))).toEqual([false, false, false, false, false])
  })

  it("no other write, and no read", () => {
    const others = [
      "/api/auth/sign-out",
      "/api/auth/get-session",
      "/api/v1/imports/imp_1/commit",
      "/api/v1/imports/uploads",
      "/api/v1/assistant/view/more",
      "/api/v1/items/page"
    ]
    expect(A.filter(others, (path) => counted({ method: "POST", path }))).toEqual([])
  })

  it("the numbers the binding is declared with", () => {
    expect([addressLimit, windowSeconds]).toEqual([30, 60])
  })
})

layer(App)("the limit through the Worker's own fetch", (it) => {
  it.effect("names endpoints the API has", () =>
    Effect.gen(function* () {
      const answer = yield* send({
        method: "GET",
        path: openApiPath,
        actingAs: O.none(),
        body: O.none(),
        headers: {}
      })
      const document = yield* S.decodeUnknownEffect(Document)(answer.json)
      const posted = (path: string) => O.isSome(O.flatMap(R.get(document.paths, path), R.get("post")))
      assertTrue(posted("/api/v1/imports/{id}/suggest"), "imports.suggest is a POST of the API")
      assertTrue(posted("/api/v1/assistant/view"), "assistant.view is a POST of the API")
      assertTrue(posted("/api/v1/system/ai-check"), "system.checkAi is a POST of the API")
    })
  )

  it.effect("lets an address through, then refuses it with the app's own 429, and another address goes on", () =>
    Effect.gen(function* () {
      const first = yield* ask(O.some("10.0.0.9"))
      const second = yield* ask(O.some("10.0.0.9"))
      const third = yield* ask(O.some("10.0.0.9"))
      expect([first.status, second.status, third.status]).toEqual([200, 200, 429])
      // The typed refusal: it decodes as one, or the test stops here.
      const refusal = yield* S.decodeUnknownEffect(TooManyRequests)(third.json)
      expect(refusal.reason).toBe("Too many attempts from this address. Wait a minute, then try again.")
      expect(third.headers.get("retry-after")).toBe("60")
      // Every answer carries the security headers, the refusal too.
      expect(third.headers.get("x-content-type-options")).toBe("nosniff")
      const other = yield* ask(O.some("10.0.0.10"))
      expect(other.status).toBe(200)
      // Counted under the host the request names (none in a test: "localhost") and the address.
      expect(A.fromIterable(MutableHashMap.keys(seen))).toEqual(["localhost 10.0.0.9", "localhost 10.0.0.10"])
    })
  )

  it.effect("does not count a read, a write that asks no model, or a request with no visitor address", () =>
    Effect.gen(function* () {
      const before = MutableHashMap.size(seen)
      const read = yield* send({
        method: "GET",
        path: "/api/v1/items/facets",
        actingAs: O.some("mem_dana"),
        body: O.none(),
        headers: { "cf-connecting-ip": "10.0.0.9" }
      })
      expect(read.status).toBe(200)
      const statuses = yield* Effect.forEach(A.range(1, 4), () => ask(O.none()), { concurrency: 1 })
      expect(A.map(statuses, (answer) => answer.status)).toEqual([200, 200, 200, 200])
      expect(MutableHashMap.size(seen)).toBe(before)
    })
  )
})

const taken = Effect.gen(function* () {
  const limit = yield* AddressLimit
  return yield* limit.take("localhost 10.0.0.9")
})

layer(AddressLimit.counting(() => Effect.succeed(true)))("a count within the limit", (it) => {
  it.effect("lets the request on", () => Effect.map(taken, (within) => expect(within).toBe(true)))
})

layer(AddressLimit.counting(() => Effect.succeed(false)))("a count over the limit", (it) => {
  it.effect("refuses the request", () => Effect.map(taken, (within) => expect(within).toBe(false)))
})

layer(AddressLimit.counting(() => Effect.fail(CounterFailed.make({ cause: "the binding is down" }))))(
  "a count that fails",
  (it) => {
    it.effect("lets the request on", () => Effect.map(taken, (within) => expect(within).toBe(true)))
  }
)
