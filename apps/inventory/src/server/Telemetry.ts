import * as A from "effect/Array"
import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as Metric from "effect/Metric"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as Tracer from "effect/Tracer"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpMiddleware from "effect/http/HttpMiddleware"
import * as HttpRouter from "effect/http/HttpRouter"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as OtlpExporter from "effect/observability/OtlpExporter"
import * as OtlpLogger from "effect/observability/OtlpLogger"
import * as OtlpMetrics from "effect/observability/OtlpMetrics"
import * as OtlpProxy from "effect/observability/OtlpProxy"
import * as OtlpSerialization from "effect/observability/OtlpSerialization"
import * as OtlpTracer from "effect/observability/OtlpTracer"
import { loggers } from "./Observability.ts"
import { Collector } from "./RequestTelemetry.ts"
import { RequestSource } from "@inventory/kernel/SameOrigin"
import { logSettings, telemetrySettings } from "./Settings.ts"

// TRACES, METRICS AND LOGS TO A COLLECTOR (the telemetry module), when OTEL_EXPORTER_OTLP_ENDPOINT names one
// (`bun run telemetry` starts Grafana's LGTM stack locally; `bun run dev` never does). Off, nothing here runs: no
// exporter is built, no request waits, the browser sends nothing.
//
// The Worker's exporters are built per request (RequestTelemetry.ts says why), and closing their scope after the
// answer, under `waitUntil`, is the flush. Measured: an OTLP exporter built once for the isolate made requests fail
// with a 500 against a local collector; built per request, every request's traces, logs and metrics arrived. Metrics
// are the isolate's (Effect's registry is shared), so each request sends the running totals.
//
// The browser sends its own telemetry to /api/otlp on this origin, and `OtlpProxyRoute` forwards it to the same
// collector, so the page needs no CORS, no second origin in its policy and no collector address. Like /api/auth, it is
// not versioned: OTLP's own paths carry their version (`/v1/traces`).

/** Where the browser posts its telemetry: `${otlpPrefix}/v1/traces`, `/v1/logs`, `/v1/metrics`. */
export const otlpPrefix = "/api/otlp"

/** API requests the Worker answered, by method, route group and status class (`2xx`). */
export const httpRequests = Metric.counter("http_requests", {
  description: "API requests answered, by method, route group and status class",
  incremental: true
})

/** How long the Worker took to answer an API request, in milliseconds. */
export const httpDuration = Metric.histogram("http_duration_ms", {
  description: "Time to answer an API request, in milliseconds",
  boundaries: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
})

/**
 * The part of a path that says which part of the API was asked, without ids: "/api/v1/activity/batches/42/take-back"
 * is "/api/v1/activity", "/api/auth/sign-in/email" is "/api/auth".
 *
 * @example
 * routeOf("/api/v1/activity/batches") // "/api/v1/activity"
 */
export const routeOf = (path: string): string => {
  const parts = Str.split(
    O.getOrElse(A.head(Str.split(path, "?")), () => ""),
    "/"
  )
  return A.join(A.take(parts, parts[2] === "v1" ? 4 : 3), "/")
}

/**
 * When the collector last could not be reached, in milliseconds. Its exporters retry a batch for about three seconds
 * under `waitUntil`, every request: measured on local workerd with the stack stopped, answers sent back to back
 * slowed from a median of 18 ms to 25 to 27 ms. So the first connection that fails marks a miss, and for thirty
 * seconds after it nothing is built for the collector. A number, not a connection: nothing here crosses from one
 * request's I/O to another's.
 */
let collectorMissedAt = Number.NEGATIVE_INFINITY

/** The exporters' HTTP client: `fetch`, marking a miss when the collector cannot be reached at all. */
const collectorClient = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(
    HttpClient.HttpClient,
    HttpClient.tapError((error) =>
      error.reason._tag === "TransportError"
        ? Effect.map(Clock.currentTimeMillis, (now) => {
            collectorMissedAt = Number(now)
          })
        : Effect.void
    )
  )
).pipe(Layer.provide(FetchHttpClient.layer))

/**
 * The collector's exporters for one request, from the settings: traces, metrics and the log lines (the console keeps
 * getting them too). None while OTEL_EXPORTER_OTLP_ENDPOINT is unset. Exported only when the request is done, never on
 * a timer that would outlive it.
 */
export const collector = (build: { readonly production: boolean }) =>
  Layer.effect(
    Collector,
    Effect.gen(function* () {
      const settings = yield* telemetrySettings
      const log = yield* logSettings({ format: build.production ? "json" : "pretty" })
      // This layer is built once per isolate, so the id names the isolate. Cloudflare runs many; without an id each
      // isolate's counters carry the same labels, and a collector sees one series that keeps starting over.
      const random = yield* SecureRandom.SecureRandom
      const instance = yield* random.uuidV4()
      return O.map(settings.endpoint, (endpoint) => {
        const base = Str.endsWith("/")(endpoint.href) ? endpoint.href : `${endpoint.href}/`
        const url = (signal: string) => new URL(`v1/${signal}`, base).href
        const resource = {
          serviceName: settings.serviceName,
          attributes: {
            "deployment.environment.name": build.production ? "production" : "development",
            "service.instance.id": instance
          }
        }
        const later = Duration.hours(1)
        const exporters = Layer.mergeAll(
          Layer.effect(Tracer.Tracer, OtlpTracer.make({ url: url("traces"), resource, exportInterval: later })),
          Layer.effectDiscard(OtlpMetrics.make({ url: url("metrics"), resource, exportInterval: later })),
          Logger.layer([loggers[log.format], OtlpLogger.make({ url: url("logs"), resource, exportInterval: later })])
        ).pipe(
          Layer.provideMerge(OtlpExporter.layerFlusher),
          Layer.provide(OtlpSerialization.layerJson),
          Layer.provide(collectorClient)
        )
        // `Tracer.Tracer` is a reference: read from a context that lacks it, it is the native tracer, which exports
        // nothing. So the tracer is taken from the context that built it. Within thirty seconds of a miss, nothing.
        return (scope) =>
          Effect.flatMap(Clock.currentTimeMillis, (now) =>
            Number(now) - collectorMissedAt <= 30_000
              ? Effect.succeed({ tracer: Tracer.nativeTracer, context: Context.empty() })
              : Effect.map(Layer.buildWithScope(exporters, scope), (context) => ({
                  context: Context.omit(OtlpExporter.Flusher)(context),
                  tracer: Context.get(context, Tracer.Tracer)
                }))
          ).pipe(Effect.orDie)
      })
    })
  ).pipe(Layer.provide(SecureRandom.layerWebCrypto))

/** Counts every answered request in `httpRequests` and `httpDuration`. */
export const RequestMetrics = HttpRouter.middleware(
  (httpEffect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const started = yield* Clock.currentTimeMillis
      const response = yield* httpEffect
      const finished = yield* Clock.currentTimeMillis
      const attributes = {
        "http.method": request.method,
        "http.route": routeOf(request.url),
        "http.status_class": `${Math.floor(response.status / 100)}xx`
      }
      yield* Metric.update(Metric.withAttributes(httpRequests, attributes), 1)
      yield* Metric.update(Metric.withAttributes(httpDuration, attributes), Number(finished - started))
      return response
    }),
  { global: true }
)

/**
 * How the HTTP layer traces requests: each server span is named by method and route ("GET /api/v1/activity"), never
 * by a full path whose ids would make every name unique; the browser's telemetry requests are not traced at all.
 */
export const HttpTracing = Layer.mergeAll(
  Layer.succeed(HttpMiddleware.TracerDisabledWhen, (request) => Str.startsWith(otlpPrefix)(request.url)),
  Layer.succeed(HttpMiddleware.SpanNameGenerator, (request) => `${request.method} ${routeOf(request.url)}`)
)

// Named so the linter does not read it as a React hook (pattern 6 in docs/patterns.md).
const withRouter = HttpRouter.use

/**
 * The browser's telemetry. `GET /api/otlp/status` says whether it is on (always answered, so the page asks once with
 * no failed request). When a collector is configured, `POST /api/otlp/v1/{traces,logs,metrics}` forwards a batch
 * unchanged to it: taken only from this app's own pages, at most 1 MiB. Not traced or logged itself.
 */
export const OtlpProxyRoute = withRouter(
  Effect.fn(function* (router) {
    const settings = yield* telemetrySettings
    yield* router.add(
      "GET",
      `${otlpPrefix}/status`,
      HttpServerResponse.json({ on: O.isSome(settings.endpoint) }).pipe(Effect.orDie)
    )
    if (O.isNone(settings.endpoint)) return
    const handlers = yield* OtlpProxy.make({ baseUrl: settings.endpoint.value.href, maxBodySize: "1 MiB" })
    for (const signal of ["traces", "logs", "metrics"] as const) {
      yield* router.add(
        "POST",
        `${otlpPrefix}/v1/${signal}`,
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest
          const own = O.toArray(O.map(HttpServerRequest.toURL(request), (url) => url.origin))
          const fromOurPage =
            request.headers["sec-fetch-site"] !== undefined || request.headers["origin"] !== undefined
              ? RequestSource.allows(
                  RequestSource.make({
                    method: request.method,
                    fetchSite: O.fromUndefinedOr(request.headers["sec-fetch-site"]),
                    origin: O.fromUndefinedOr(request.headers["origin"]),
                    own
                  })
                )
              : false
          if (!fromOurPage) return HttpServerResponse.empty({ status: 403 })
          const forwarded = yield* handlers[signal]
          // The collector is configured but not running (the stack is stopped): the page's batch is dropped quietly,
          // as an exporter drops what it cannot send, instead of a failed request in its console every few seconds.
          if (forwarded.status === 502 || forwarded.status === 504) {
            yield* Effect.logDebug("Telemetry: the collector did not answer; the browser's batch was dropped")
            return HttpServerResponse.empty({ status: 204 })
          }
          return forwarded
        }).pipe(HttpMiddleware.withLoggerDisabled, Effect.withTracerEnabled(false))
      )
    }
  })
).pipe(Layer.provide(FetchHttpClient.layer))
