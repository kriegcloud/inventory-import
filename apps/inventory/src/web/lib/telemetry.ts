import { Effect, Layer, Logger, Tracer } from "effect"
import * as S from "effect/Schema"
import { FetchHttpClient, HttpClient, HttpClientResponse } from "effect/http"
import { sendTraceContext, traceContextGate } from "./traceContext.ts"

// THE BROWSER'S TRACES AND LOGS, to the collector when the server says telemetry is on (src/server/Telemetry.ts).
// The browser's one runtime (`appRuntime` in ./api.ts) runs with the tracer and logger below, which pass everything
// on to whatever is plugged in. At start the page asks the server once (`GET /api/otlp/status`); off, nothing more
// happens. On, the exporters (./otlp.ts, a chunk of its own) are fetched and plugged in: they post to /api/otlp on this
// origin, which the Worker forwards to the collector, so the page's policy (`connect-src 'self'`) needs nothing new.

let tracer: Tracer.Tracer = Tracer.nativeTracer
let loggers: ReadonlyArray<Logger.Logger<unknown, void>> = []

/** Sends the browser's spans and log lines to `next` from now on. */
export const plugIn = (next: {
  readonly tracer: Tracer.Tracer
  readonly loggers: ReadonlyArray<Logger.Logger<unknown, void>>
}) => {
  tracer = next.tracer
  loggers = next.loggers
  sendTraceContext()
}

const switchingTracer = Tracer.make({ span: (options) => tracer.span(options) })

const switchingLogger = Logger.make((options) => {
  for (const logger of loggers) logger.log(options)
})

/**
 * The tracer and logger the browser's runtime runs with: nothing is sent until `startTelemetry` plugs exporters in.
 * Effect's own console logger is kept beside it in development. The HTTP client is the one `startTelemetry` asks with.
 * A request gets a span and sends its trace context only once exporters are plugged in (./traceContext.ts).
 */
export const browserTelemetry = Layer.mergeAll(
  Layer.succeed(Tracer.Tracer, switchingTracer),
  Logger.layer([switchingLogger], { mergeWithExisting: import.meta.env.DEV }),
  FetchHttpClient.layer,
  traceContextGate
)

/** Whether the server forwards the browser's telemetry. False when it cannot say: the page then sends nothing. */
const telemetryIsOn = HttpClient.get("/api/otlp/status").pipe(
  Effect.flatMap(HttpClientResponse.schemaBodyJson(S.Struct({ on: S.Boolean }))),
  Effect.map((answer) => answer.on),
  Effect.orElseSucceed(() => false)
)

/** Asks the server once and, when telemetry is on, loads and plugs in the exporters. Called once, at start. */
export const startTelemetry = Effect.gen(function* () {
  if (!(yield* telemetryIsOn)) return
  const { start } = yield* Effect.promise(() => import("./otlp.ts"))
  yield* start
})
