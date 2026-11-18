import { Context, Effect, Layer, Logger, Metric, Scope, Tracer } from "effect"
import { FetchHttpClient } from "effect/http"
import { OtlpExporter, OtlpLogger, OtlpMetrics, OtlpSerialization, OtlpTracer } from "effect/observability"
import { plugIn } from "./telemetry.ts"

// The browser's OTLP exporters, a chunk fetched only when the server says telemetry is on (./telemetry.ts). They post
// to /api/otlp on this origin, which the Worker forwards to the collector. A browser keeps a page alive, so unlike the
// Worker's these live as long as the page and send on a timer; what is waiting is sent when the page is hidden.

const baseUrl = "/api/otlp"
// Each page load is its own instance: its counters start at zero, so without an id of its own every page's
// `web_page_loads` would be one series stuck at 1, however many pages were opened.
const resource = {
  serviceName: "takehome-web",
  attributes: {
    "deployment.environment.name": import.meta.env.DEV ? "development" : "production",
    "service.instance.id": crypto.randomUUID()
  }
}

/** Pages opened with telemetry on, by path: the browser's own metric beside the spans of its API calls. */
const pageLoads = Metric.counter("web_page_loads", { description: "Pages opened with telemetry on", incremental: true })

const exporters = Layer.mergeAll(
  Layer.effect(Tracer.Tracer, OtlpTracer.make({ url: `${baseUrl}/v1/traces`, resource, exportInterval: "2 seconds" })),
  Layer.effectDiscard(OtlpMetrics.make({ url: `${baseUrl}/v1/metrics`, resource, exportInterval: "10 seconds" })),
  Logger.layer([OtlpLogger.make({ url: `${baseUrl}/v1/logs`, resource, exportInterval: "2 seconds" })])
).pipe(
  Layer.provideMerge(OtlpExporter.layerFlusher),
  Layer.provide(OtlpSerialization.layerJson),
  Layer.provide(FetchHttpClient.layer)
)

/** Builds the exporters for the life of the page, plugs them into the browser's runtime, and says so in one line. */
export const start = Effect.gen(function* () {
  const scope = yield* Scope.make()
  const context = yield* Layer.buildWithScope(exporters, scope)
  plugIn({ tracer: Context.get(context, Tracer.Tracer), loggers: [...Context.get(context, Logger.CurrentLoggers)] })
  const flusher = Context.get(context, OtlpExporter.Flusher)
  const services = yield* Effect.context<never>()
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void Effect.runPromiseWith(services)(flusher.flush)
  })
  const path = { "page.path": window.location.pathname }
  yield* Metric.update(Metric.withAttributes(pageLoads, path), 1)
  yield* Effect.logInfo("Browser telemetry started").pipe(Effect.annotateLogs(path))
})
