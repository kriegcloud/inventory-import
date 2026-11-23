import { expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as Layer from "effect/Layer"
import * as MutableRef from "effect/MutableRef"
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
  settingsLayer,
  settled,
  standInHttp,
  testOrigin,
  testSettings,
  unreachable
} from "./support/app.ts"

// A collector that cannot be reached (src/server/Telemetry.ts): its exporters retry each batch for seconds under
// `waitUntil`. The first failed connection marks a miss, and for thirty seconds after it nothing is built for the
// collector, so later requests stop paying for it. The stand-in at http://collector.test refuses every connection: the
// app's HTTP client, answered in Effect. Slow: it waits for the first request's retries.

const endpoint = "http://collector.test"
/** Every connection the app tried, to the collector or anywhere else: each one refused. */
const attempts = MutableRef.make(0)
const network = standInHttp((request) =>
  Effect.flatMap(
    Effect.sync(() => MutableRef.increment(attempts)),
    () => unreachable(request)
  )
)

const tom = Member.make({
  id: MemberId.make("mem_tom"),
  name: "Tom Becker",
  role: "editor",
  organizationId: OrganizationId.make("org_northline"),
  organizationName: "Sample Supply Co. (test)"
})

it.live("after a refused connection, the next requests build nothing for the collector", () =>
  Effect.scoped(
    Effect.gen(function* () {
      const settings = { ...testSettings, OTEL_EXPORTER_OTLP_ENDPOINT: endpoint }
      const pending: Array<Fiber.Fiber<void>> = []
      const served = yield* Effect.acquireRelease(
        Effect.sync(() =>
          toTracedServe({
            app: inMemoryApp({
              member: tom,
              ai: OpenRouterTest.off("noKey", ModelId.make("test/model")),
              http: network,
              settings
            }),
            telemetry: RequestTelemetry.layer.pipe(
              Layer.provide(collector({ production: false })),
              Layer.provide(network),
              Layer.provide(settingsLayer(settings))
            ),
            afterAnswer: afterAnswerInto(pending)
          })
        ),
        (served) => served.dispose
      )
      const ask = () => served.serve(new Request(`${testOrigin}/api/v1/identity/me`))
      expect((yield* ask()).status).toBe(200)
      yield* settled(pending)
      const afterFirst = MutableRef.get(attempts)
      expect(afterFirst).toBeGreaterThan(0)
      // The miss is remembered: two more requests answer, and neither tries the collector.
      expect((yield* ask()).status).toBe(200)
      expect((yield* ask()).status).toBe(200)
      yield* settled(pending)
      expect(MutableRef.get(attempts)).toBe(afterFirst)
    })
  )
)
