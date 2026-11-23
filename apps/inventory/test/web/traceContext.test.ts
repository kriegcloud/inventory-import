import { expect, it } from "@effect/vitest"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import { sendTraceContext, traceContextGate } from "../../src/web/lib/traceContext.ts"

// The page's trace context (src/web/lib/traceContext.ts). A request sends `traceparent` only once the exporters are
// plugged in: before that its span is never sent, and the Worker's spans would name a parent no collector receives.
// The client here is built apart from the runtime, as the API client is (src/web/lib/api.ts): the gate must reach it.
// Requests go to a stand-in at http://app.test, an HTTP client answered in Effect that keeps whether each carried one.

const seen: Array<boolean> = []

class Client extends Context.Service<Client, HttpClient.HttpClient>()(
  "@inventory/app/test/web/traceContext.test/Client"
) {
  static readonly layer = Layer.succeed(
    Client,
    HttpClient.make((request) =>
      Effect.sync(() => {
        seen.push(Headers.has(request.headers, "traceparent"))
        return HttpClientResponse.fromWeb(
          request,
          new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
        )
      })
    )
  )
}

const runtime = ManagedRuntime.make(Layer.mergeAll(Client.layer, traceContextGate))
/** A press on the page: one request from the client, in the runtime's context, as the page's own requests run. */
const press = Effect.flatMap(runtime.contextEffect, (context) =>
  Effect.flatMap(Client, (client) => client.get("http://app.test/api/v1/activity")).pipe(
    Effect.withSpan("press"),
    Effect.asVoid,
    Effect.orDie,
    Effect.provideContext(context)
  )
)

it.effect("sends no trace context until the exporters are plugged in, and sends it from then on", () =>
  Effect.gen(function* () {
    yield* press
    sendTraceContext()
    yield* press
    expect(seen).toEqual([false, true])
  })
)
