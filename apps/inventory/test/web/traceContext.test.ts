// @effect-diagnostics globalFetch:off
import { expect, it } from "@effect/vitest"
import { Array as Arr, Context, Effect, Layer, ManagedRuntime } from "effect"
import { FetchHttpClient, HttpClient } from "effect/http"
import { afterAll, vi } from "vitest"
import { sendTraceContext, traceContextGate } from "../../src/web/lib/traceContext.ts"

// The page's trace context (src/web/lib/traceContext.ts). A request sends `traceparent` only once the exporters are
// plugged in: before that its span is never sent, and the Worker's spans would name a parent no collector receives.
// The client here is built apart from the runtime, as the API client is (src/web/lib/api.ts): the gate must reach it.
// Requests go to a stand-in at http://app.test, answered by a spy on `fetch` that keeps their headers.

const seen: Array<Headers> = []
// Installed before any client is built: an HTTP client keeps the `fetch` it first found.
const spy = vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
  seen.push(new Headers(input instanceof Request ? input.headers : init?.headers))
  return Promise.resolve(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }))
})
afterAll(() => spy.mockRestore())

class Client extends Context.Service<Client, HttpClient.HttpClient>()("inventory/test/web/traceContext.test/Client") {
  static readonly layer = Layer.effect(Client, HttpClient.HttpClient).pipe(Layer.provide(FetchHttpClient.layer))
}

const runtime = ManagedRuntime.make(Layer.mergeAll(Client.layer, traceContextGate))
const press = () =>
  runtime.runPromise(
    Effect.flatMap(Client, (client) => client.get("http://app.test/api/v1/activity")).pipe(
      Effect.withSpan("press"),
      Effect.asVoid,
      Effect.orDie
    )
  )

it.effect("sends no trace context until the exporters are plugged in, and sends it from then on", () =>
  Effect.gen(function* () {
    yield* Effect.promise(press)
    sendTraceContext()
    yield* Effect.promise(press)
    expect(Arr.map(seen, (headers) => headers.has("traceparent"))).toEqual([false, true])
  })
)
