import { expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as HttpBody from "effect/http/HttpBody"
import type * as HttpClientError from "effect/http/HttpClientError"
import type * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as Layer from "effect/Layer"
import * as P from "effect/Predicate"
import * as Str from "effect/String"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { toTracedServe } from "../../src/server/App.ts"
import { RequestTelemetry } from "../../src/server/RequestTelemetry.ts"
import { collector } from "../../src/server/Telemetry.ts"
import {
  afterAnswerInto,
  inMemoryApp,
  jsonOf,
  settingsLayer,
  settled,
  standInHttp,
  testOrigin,
  testSettings,
  unreachable
} from "./support/app.ts"

// Telemetry to a collector (src/server/Telemetry.ts). On: every request's traces, logs and metrics are sent once it
// has answered, and the browser's batches are forwarded from the app's own pages only. A stopped collector costs the
// page nothing. Off: nothing is sent and there is no forwarding route. The collector is a stand-in at
// http://collector.test: the app's HTTP client, answered in Effect. Each test runs on the real clock, as the Worker
// does: the exporter waits between its tries, and a test clock would hold that wait forever.

const tom = Member.make({
  id: MemberId.make("mem_tom"),
  name: "Tom Becker",
  role: "editor",
  organizationId: OrganizationId.make("org_northline"),
  organizationName: "Sample Supply Co. (test)"
})

const endpoint = "http://collector.test"

type Answer = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>

/** The collector's answer to a batch it takes. */
const accepted: Answer = (request) =>
  Effect.succeed(
    HttpClientResponse.fromWeb(
      request,
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    )
  )

/** A batch as the collector receives it: JSON text, as the exporters and the browser's forwarded batches send it. */
const bodyOf = (body: HttpBody.HttpBody): string =>
  body instanceof HttpBody.Uint8Array
    ? new TextDecoder().decode(body.body)
    : body instanceof HttpBody.Raw && P.isString(body.body)
      ? body.body
      : ""

/**
 * The stand-in collector: what the app sends to it, answered with `answer` and every path and body kept. Each test
 * starts it afresh with `collectorSeen.reset()`.
 */
const collectorSeen = {
  sent: A.empty<string>(),
  bodies: A.empty<string>(),
  answer: accepted,
  reset() {
    this.sent = []
    this.bodies = []
    this.answer = accepted
  }
}

/** The app's HTTP client: every request goes to the stand-in collector, and anything else is unreachable. */
const network = standInHttp((request) =>
  Effect.suspend(() => {
    if (!Str.startsWith(endpoint)(request.url)) return unreachable(request)
    collectorSeen.sent.push(Str.slice(endpoint.length)(request.url))
    collectorSeen.bodies.push(bodyOf(request.body))
    return collectorSeen.answer(request)
  })
)

/** The Worker's `fetch` on the in-memory app with these settings, and what it handed to `waitUntil`. */
const serving = (settings: Record<string, string>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const pending: Array<Fiber.Fiber<void>> = []
      const app = inMemoryApp({
        member: tom,
        ai: OpenRouterTest.off("noKey", ModelId.make("test/model")),
        http: network,
        settings
      })
      const served = toTracedServe({
        app,
        telemetry: RequestTelemetry.layer.pipe(
          Layer.provide(collector({ production: false })),
          Layer.provide(network),
          Layer.provide(settingsLayer(settings))
        ),
        afterAnswer: afterAnswerInto(pending)
      })
      return { ...served, pending }
    }),
    (served) => served.dispose
  )

const page = (path: string, init: RequestInit = {}) => new Request(`${testOrigin}${path}`, init)

it.live("on: each request sends its traces, logs and metrics after it has answered", () =>
  Effect.scoped(
    Effect.gen(function* () {
      collectorSeen.reset()
      const served = yield* serving({ ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })
      for (const path of ["/api/v1/identity/me", "/api/v1/activity", "/api/v1/system/status"]) {
        const answer = yield* served.serve(page(path))
        expect(answer.status).toBe(200)
      }
      yield* settled(served.pending)
      const count = (signal: string) => A.filter(collectorSeen.sent, (path) => path === `/v1/${signal}`).length
      expect([count("traces"), count("metrics")]).toEqual([3, 3])
      expect(count("logs")).toBeLessThanOrEqual(3)
    })
  )
)

it.live("on: every batch names this isolate as one instance, so its counters are one series", () =>
  Effect.scoped(
    Effect.gen(function* () {
      collectorSeen.reset()
      const served = yield* serving({ ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })
      for (const path of ["/api/v1/identity/me", "/api/v1/activity"]) yield* served.serve(page(path))
      yield* settled(served.pending)
      const instances = A.dedupe(
        A.flatMap(collectorSeen.bodies, (body) =>
          A.flatMap(
            A.fromIterable(Str.matchAll(/"key":"service\.instance\.id","value":\{"stringValue":"([^"]+)"/g)(body)),
            (m) => (m[1] === undefined ? [] : [m[1]])
          )
        )
      )
      expect(collectorSeen.bodies.length).toBeGreaterThanOrEqual(4)
      expect(instances.length).toBe(1)
    })
  )
)

it.live(
  "on: the browser's batches are forwarded from the app's own pages only, and a stopped collector costs nothing",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        collectorSeen.reset()
        const served = yield* serving({ ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint })
        const status = yield* Effect.flatMap(served.serve(page("/api/otlp/status")), jsonOf)
        expect(status).toEqual({ on: true })
        const batch = (site: string) =>
          page("/api/otlp/v1/traces", {
            method: "POST",
            headers: { "content-type": "application/json", "sec-fetch-site": site, origin: testOrigin },
            body: '{"resourceSpans":[]}'
          })
        const forwarded = yield* served.serve(batch("same-origin"))
        expect([forwarded.status, collectorSeen.sent]).toEqual([200, expect.arrayContaining(["/v1/traces"])])
        // From another site: refused, and the collector is answered nothing (it sees only the batch above).
        collectorSeen.answer = () => Effect.die("a refused batch must not be forwarded")
        const refused = yield* served.serve(batch("cross-site"))
        expect(refused.status).toBe(403)
        // The stack is stopped: the batch is dropped quietly, with no failed request in the page's console.
        collectorSeen.answer = unreachable
        const stopped = yield* served.serve(batch("same-origin"))
        expect(stopped.status).toBe(204)
        yield* settled(served.pending)
      })
    )
)

it.live("off, the default: nothing is sent, and the page is told so without a failed request", () =>
  Effect.scoped(
    Effect.gen(function* () {
      collectorSeen.reset()
      const served = yield* serving(testSettings)
      const me = yield* served.serve(page("/api/v1/identity/me"))
      const status = yield* Effect.flatMap(served.serve(page("/api/otlp/status")), jsonOf)
      const forward = yield* served.serve(page("/api/otlp/v1/traces", { method: "POST", body: "{}" }))
      yield* settled(served.pending)
      expect({ me: me.status, status, forward: forward.status }).toEqual({
        me: 200,
        status: { on: false },
        forward: 404
      })
      expect(collectorSeen.sent).toEqual([])
    })
  )
)
