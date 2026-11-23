import * as Clock from "effect/Clock"
import * as Context from "effect/Context"
import * as Deferred from "effect/Deferred"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as Scope from "effect/Scope"
import * as Tracer from "effect/Tracer"
import * as DevTools from "effect/devtools/DevTools"
import { devToolsSettings } from "./Settings.ts"

// SPANS OUT OF THE WORKER, ONE REQUEST AT A TIME. The Workers runtime refuses to let one request's I/O be awaited from
// another: a client built once for the isolate keeps a connection, a batching fiber and timers that belong to the
// first request, and after that request has answered they never run again. So each request gets its own: its
// handler runs with their tracer (the context handed to the router's web handler, App.ts `toServe`), and once it has
// answered and its last span has ended, `done` closes their scope under `waitUntil`, inside the same request, which
// sends what they hold.
//
// Measured on local workerd (`bun run dev`), 2026-11-17, with a stand-in DevTools server counting what arrived:
// - one Effect DevTools client for the isolate: connected during the first request, then delivered nothing
//   (0 spans of 8 requests and of 6 in two runs; in a third it stopped after 4 of 7);
// - one client per request, as here: 8 requests of 8 each delivered every span (12 or 16 span messages, a start and
//   an end for each, then a metrics snapshot), answering in 0.03 to 0.06 s after a first one of 0.15 s. With nothing
//   listening the client's build waits up to a second for the connection (the first request took 1.08 s), so one
//   such miss turns it off for thirty seconds (`devToolsMissedAt`): the next requests took 0.03 to 0.07 s.
//
// Off, the default, nothing here runs: no client is built, no request waits.

/** One request's tracing: the context its handler runs in, and what to run once it has answered. */
export type RequestScope = {
  readonly context: Context.Context<never>
  readonly done: Effect.Effect<void>
}

/** What a per-request exporter gives its request: the tracer spans go to, and services the handler runs with. */
export type RequestExports = {
  readonly tracer: Tracer.Tracer
  readonly context: Context.Context<never>
}

/**
 * Exporters to a collector, built into one request's scope (closing that scope sends what they hold). None by
 * default; a telemetry module provides them. Effect DevTools, when on, sees every span they see.
 */
export const Collector = Context.Reference<O.Option<(scope: Scope.Scope) => Effect.Effect<RequestExports>>>(
  "@inventory/app/server/RequestTelemetry/Collector",
  { defaultValue: () => O.none() }
)

const off: RequestScope = { context: Context.empty(), done: Effect.void }

/**
 * A tracer that hands every span to `tracer` and counts the ones still open, so the flush waits for the request's
 * last span (the HTTP server span ends a moment after the answer is sent) instead of guessing with a delay.
 */
const countingOpenSpans = (tracer: Tracer.Tracer) => {
  let open = 0
  let started = false
  const allEnded = Deferred.makeUnsafe<void>()
  const counting = Tracer.make({
    span(options) {
      const span = tracer.span(options)
      open += 1
      started = true
      const end = span.end
      span.end = function (endTime, exit) {
        // A span ended once is not counted again: told by its status's case.
        Match.valueTags(span.status, {
          Ended: () => undefined,
          Started: () => {
            end.call(this, endTime, exit)
            open -= 1
            if (open === 0) Deferred.doneUnsafe(allEnded, Exit.void)
          }
        })
      }
      return span
    },
    context: tracer.context
  })
  return {
    tracer: counting,
    settled: Effect.suspend(() => (started && open > 0 ? Deferred.await(allEnded) : Effect.void))
  }
}

/**
 * When the DevTools client last found nothing listening, in milliseconds. A number, not a connection: nothing here
 * crosses from one request's I/O to another's.
 */
let devToolsMissedAt = Number.NEGATIVE_INFINITY

/** Per-request tracing for the Worker: `begin` builds it for one request, and the `done` it returns flushes it. */
export class RequestTelemetry extends Context.Service<
  RequestTelemetry,
  { readonly begin: Effect.Effect<RequestScope> }
>()("@inventory/app/server/RequestTelemetry") {
  /**
   * From the settings: an Effect DevTools client per request when EFFECT_DEVTOOLS_URL is set (development builds
   * only), the `Collector`'s exporters when one is provided, nothing at all when neither is.
   */
  static readonly layer = Layer.effect(
    RequestTelemetry,
    Effect.gen(function* () {
      // `import.meta.env.DEV` first, here and where the client is built below: a production build folds both to
      // false and leaves the DevTools client out of the Worker (checked 2026-11-17: no `DevToolsClient` in `dist/`).
      const devTools = import.meta.env.DEV ? yield* devToolsSettings : O.none<URL>()
      const collector = yield* Collector
      if (O.isNone(devTools) && O.isNone(collector)) return RequestTelemetry.of({ begin: Effect.succeed(off) })
      return RequestTelemetry.of({
        begin: Effect.gen(function* () {
          const scope = yield* Scope.make()
          const exports = O.isSome(collector)
            ? yield* collector.value(scope)
            : { tracer: Tracer.nativeTracer, context: Context.empty() }
          const now = yield* Clock.currentTimeMillis
          // DevTools wraps the collector's tracer, so it sees every span the collector does.
          const traced =
            import.meta.env.DEV && O.isSome(devTools) && Number(now) - devToolsMissedAt > 30_000
              ? yield* Effect.map(
                  Effect.timed(
                    Layer.buildWithScope(
                      DevTools.layer(devTools.value.href).pipe(
                        Layer.provide(Layer.succeed(Tracer.Tracer, exports.tracer))
                      ),
                      scope
                    )
                  ),
                  ([took, context]) => {
                    // The build gives up waiting after a second: nothing answered.
                    if (Duration.toMillis(took) >= 950) devToolsMissedAt = Number(now)
                    return Context.get(context, Tracer.Tracer)
                  }
                )
              : exports.tracer
          const counting = countingOpenSpans(traced)
          return {
            context: Context.add(exports.context, Tracer.Tracer, counting.tracer),
            // Closing the scope is the flush: each exporter sends what it holds as it closes, and the DevTools client
            // drains its queue. Bounded, so a collector that does not answer holds the request's `waitUntil` a few
            // seconds at most, and never the answer itself.
            done: Effect.gen(function* () {
              yield* counting.settled.pipe(Effect.timeoutOption("2 seconds"))
              yield* Scope.close(scope, Exit.void).pipe(Effect.timeoutOption("4 seconds"))
            })
          }
        })
      })
    })
  )
}
