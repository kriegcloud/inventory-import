// @effect-diagnostics globalFetch:off
import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Layer, Predicate, String as Str } from "effect"
import { afterAll, beforeAll, vi } from "vitest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Ai } from "../../src/server/Ai.ts"
import { toTracedFetch } from "../../src/server/App.ts"
import { RequestTelemetry } from "../../src/server/RequestTelemetry.ts"
import { collector } from "../../src/server/Telemetry.ts"
import { inMemoryApp, settingsLayer, testOrigin, testSettings } from "./support/app.ts"

// Telemetry to a collector (src/server/Telemetry.ts). On: every request's traces, logs and metrics are sent once it
// has answered, and the browser's batches are forwarded from the app's own pages only. A stopped collector costs the
// page nothing. Off: nothing is sent and there is no forwarding route. The collector is a stand-in at
// http://collector.test, answered by a spy on `fetch`.

const tom = Member.make({
  id: MemberId.make("mem_tom"),
  name: "Tom Becker",
  role: "editor",
  organizationId: OrganizationId.make("org_northline"),
  organizationName: "Sample Supply Co. (test)"
})

const endpoint = "http://collector.test"

/**
 * The stand-in collector: a spy on `fetch` for the whole file, installed before any app is built (an HTTP client keeps
 * the `fetch` it first found), answering with `answer` and keeping every path sent to it. Anything else goes out as
 * usual. Each test starts it afresh with `collectorSeen.reset()`.
 */
const collectorSeen = {
  sent: [] as Array<string>,
  bodies: [] as Array<string>,
  answer: (): Promise<Response> =>
    Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } })),
  reset() {
    this.sent = []
    this.bodies = []
    this.answer = () =>
      Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }))
  }
}
const real = globalThis.fetch
const spy = vi.spyOn(globalThis, "fetch")
beforeAll(() => {
  spy.mockImplementation((input, init) => {
    const url = String(input instanceof Request ? input.url : input)
    if (!Str.startsWith(endpoint)(url)) return real(input, init)
    collectorSeen.sent.push(Str.slice(endpoint.length)(url))
    const body = init?.body
    collectorSeen.bodies.push(
      Predicate.isString(body) ? body : body instanceof Uint8Array ? new TextDecoder().decode(body) : ""
    )
    return collectorSeen.answer()
  })
})
afterAll(() => spy.mockRestore())

/** The Worker's `fetch` on the in-memory app with these settings, and what it handed to `waitUntil`. */
const serving = (settings: Record<string, string>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const pending: Array<Promise<unknown>> = []
      const app = inMemoryApp({ member: tom, ai: Ai.layerFor({ routes: [], model: "test/model" }), settings })
      const served = toTracedFetch({
        app,
        telemetry: RequestTelemetry.layer.pipe(
          Layer.provide(collector({ production: false })),
          Layer.provide(settingsLayer(settings))
        ),
        waitUntil: (promise) => pending.push(promise)
      })
      return { ...served, pending }
    }),
    (served) => Effect.promise(() => served.dispose())
  )

const page = (path: string, init: RequestInit = {}) => new Request(`${testOrigin}${path}`, init)

it.effect("on: each request sends its traces, logs and metrics after it has answered", () =>
  Effect.scoped(
    Effect.gen(function* () {
      collectorSeen.reset()
      const served = yield* serving({ ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })
      for (const path of ["/api/v1/identity/me", "/api/v1/activity", "/api/v1/system/status"]) {
        const answer = yield* Effect.promise(() => served.fetch(page(path)))
        expect(answer.status).toBe(200)
      }
      yield* Effect.promise(() => Promise.all(served.pending))
      const count = (signal: string) => Arr.filter(collectorSeen.sent, (path) => path === `/v1/${signal}`).length
      expect([count("traces"), count("metrics")]).toEqual([3, 3])
      expect(count("logs")).toBeLessThanOrEqual(3)
    })
  )
)

it.effect("on: every batch names this isolate as one instance, so its counters are one series", () =>
  Effect.scoped(
    Effect.gen(function* () {
      collectorSeen.reset()
      const served = yield* serving({ ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })
      for (const path of ["/api/v1/identity/me", "/api/v1/activity"])
        yield* Effect.promise(() => served.fetch(page(path)))
      yield* Effect.promise(() => Promise.all(served.pending))
      const instances = Arr.dedupe(
        Arr.flatMap(collectorSeen.bodies, (body) =>
          Arr.flatMap(
            Arr.fromIterable(Str.matchAll(/"key":"service\.instance\.id","value":\{"stringValue":"([^"]+)"/g)(body)),
            (m) => (m[1] === undefined ? [] : [m[1]])
          )
        )
      )
      expect(collectorSeen.bodies.length).toBeGreaterThanOrEqual(4)
      expect(instances.length).toBe(1)
    })
  )
)

it.effect(
  "on: the browser's batches are forwarded from the app's own pages only, and a stopped collector costs nothing",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        collectorSeen.reset()
        const served = yield* serving({ ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })
        const status = yield* Effect.promise(() =>
          served.fetch(page("/api/otlp/status")).then((answer) => answer.json())
        )
        expect(status).toEqual({ on: true })
        const batch = (site: string) =>
          page("/api/otlp/v1/traces", {
            method: "POST",
            headers: { "content-type": "application/json", "sec-fetch-site": site, origin: testOrigin },
            body: '{"resourceSpans":[]}'
          })
        const forwarded = yield* Effect.promise(() => served.fetch(batch("same-origin")))
        expect([forwarded.status, collectorSeen.sent]).toEqual([200, expect.arrayContaining(["/v1/traces"])])
        // From another site: refused, and the collector is answered nothing (it sees only the batch above).
        collectorSeen.answer = () => Promise.reject(new Error("a refused batch must not be forwarded"))
        const refused = yield* Effect.promise(() => served.fetch(batch("cross-site")))
        expect(refused.status).toBe(403)
        // The stack is stopped: the batch is dropped quietly, with no failed request in the page's console.
        collectorSeen.answer = () => Promise.reject(new TypeError("fetch failed"))
        const stopped = yield* Effect.promise(() => served.fetch(batch("same-origin")))
        expect(stopped.status).toBe(204)
        yield* Effect.promise(() => Promise.all(served.pending))
      })
    )
)

it.effect("off, the default: nothing is sent, and the page is told so without a failed request", () =>
  Effect.scoped(
    Effect.gen(function* () {
      collectorSeen.reset()
      const served = yield* serving(testSettings)
      const me = yield* Effect.promise(() => served.fetch(page("/api/v1/identity/me")))
      const status = yield* Effect.promise(() => served.fetch(page("/api/otlp/status")).then((answer) => answer.json()))
      const forward = yield* Effect.promise(() =>
        served.fetch(page("/api/otlp/v1/traces", { method: "POST", body: "{}" }))
      )
      yield* Effect.promise(() => Promise.all(served.pending))
      expect({ me: me.status, status, forward: forward.status }).toEqual({
        me: 200,
        status: { on: false },
        forward: 404
      })
      expect(collectorSeen.sent).toEqual([])
    })
  )
)
