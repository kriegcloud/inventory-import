import { expect, it } from "@effect/vitest"
import { Array as Arr, Context, Effect, Layer, Option, Scope, Tracer } from "effect"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { toTracedFetch } from "../../src/server/App.ts"
import { Collector, RequestTelemetry } from "../../src/server/RequestTelemetry.ts"
import { inMemoryApp, settingsLayer, testOrigin, testSettings } from "./support/app.ts"

// Tracing that leaves the Worker is built per request (src/server/RequestTelemetry.ts): each request gets its own
// exporters, its handler's spans go to them, and they are closed (which sends what they hold) only after the answer,
// once the request's last span has ended, by what the Worker hands to `waitUntil`. Here a recording exporter stands
// in for the collector or the DevTools client, which run the same way.

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "admin",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const app = inMemoryApp({ member: dana, ai: OpenRouterTest.off("noKey", ModelId.make("test/model")) })

/** One recording exporter per request: the spans it was handed, and whether its scope has been closed. */
type Exported = { spans: Array<string>; ended: number; closed: boolean }

/** A `fetch` built as the Worker's, with `collector` per request, and what it handed to `waitUntil`. */
const serving = (collector: Option.Option<(scope: Scope.Scope) => Effect.Effect<Tracer.Tracer>>) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const pending: Array<Promise<unknown>> = []
      const served = toTracedFetch({
        app,
        telemetry: RequestTelemetry.layer.pipe(
          Layer.provide(
            Layer.succeed(
              Collector,
              Option.map(
                collector,
                (make) => (scope: Scope.Scope) =>
                  Effect.map(make(scope), (tracer) => ({ tracer, context: Context.empty() }))
              )
            )
          ),
          Layer.provide(settingsLayer(testSettings))
        ),
        waitUntil: (promise) => pending.push(promise)
      })
      return { ...served, pending }
    }),
    (served) => Effect.promise(() => served.dispose())
  )

it.effect("gives each request its own exporters, and closes them after the answer, once its spans have ended", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const exports: Array<Exported> = []
      const served = yield* serving(
        Option.some((scope) =>
          Effect.gen(function* () {
            const mine: Exported = { spans: [], ended: 0, closed: false }
            exports.push(mine)
            yield* Scope.addFinalizer(
              scope,
              Effect.sync(() => {
                mine.closed = true
              })
            )
            return Tracer.make({
              span: (options) => {
                const span = new Tracer.NativeSpan(options)
                mine.spans.push(options.name)
                const end = span.end.bind(span)
                span.end = (endTime, exit) => {
                  mine.ended += 1
                  end(endTime, exit)
                }
                return span
              }
            })
          })
        )
      )
      for (const path of ["/api/v1/identity/me", "/api/v1/activity", "/api/v1/system/status"]) {
        const answer = yield* Effect.promise(() => served.fetch(new Request(`${testOrigin}${path}`)))
        expect(answer.status).toBe(200)
      }
      // Three requests, three exporters, each with its own request's spans and nobody else's.
      expect(exports.length).toBe(3)
      // The first span of each is its request's own server span ("GET"), then the middleware and the handler.
      expect(Arr.map(exports, (one) => Arr.take(one.spans, 3))).toEqual([
        ["GET", "SameOrigin", "Identity"],
        ["GET", "SameOrigin", "Identity"],
        ["GET", "SameOrigin", "Identity"]
      ])
      expect(exports[0]?.spans).toContain("identity.me")
      expect(exports[1]?.spans).toContain("Activities.recent")
      expect(exports[1]?.spans).not.toContain("identity.me")
      // What was handed to `waitUntil` closes each one, and only after every span it was given has ended.
      expect(served.pending.length).toBe(3)
      yield* Effect.promise(() => Promise.all(served.pending))
      for (const one of exports) {
        expect(one.closed).toBe(true)
        expect(one.ended).toBe(one.spans.length)
      }
    })
  )
)

it.effect("off, the default: nothing is built, and the request answers as before", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const served = yield* serving(Option.none())
      const answer = yield* Effect.promise(() => served.fetch(new Request(`${testOrigin}/api/v1/identity/me`)))
      expect(answer.status).toBe(200)
      expect(answer.headers.get("cache-control")).toBe("no-store")
      yield* Effect.promise(() => Promise.all(served.pending))
    })
  )
)
