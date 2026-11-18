import { Cause, Effect, ErrorReporter, Layer, Logger, References } from "effect"
import { type LogFormat, logSettings } from "./Settings.ts"

/**
 * Logging and error reporting for the API.
 *
 * Spans and log annotations come for free: every `Effect.fn("Name")` and every HTTP request is a span, and the
 * identity middleware stamps every span and log line inside a request with the actor and organization ids (never a
 * name). This layer decides the rest from two settings (src/server/Settings.ts):
 *
 * - `LOG_LEVEL`: All, Trace, Debug, Info, Warn, Error, Fatal or None. Default Info.
 * - `LOG_FORMAT`: pretty, json, logfmt or structured. Default pretty in development, json in production, which is
 *   what Cloudflare's Workers Logs indexes (`observability` is enabled in wrangler.jsonc).
 *
 * And it reports failures: Effect's HTTP layer hands every failed request to the configured error reporters, and
 * `logReporter` writes each as one log line with `Cause.pretty`.
 *
 * Teardown: a Worker isolate is evicted without a shutdown hook, so layer finalizers never run there. Nothing here
 * holds a resource that needs one: loggers write to the console synchronously, and request-scoped resources close
 * with their request. In Node (tests), `HttpRouter.toWebHandler`'s `dispose` closes the layer and runs finalizers.
 *
 * Not here: anything that sends spans out of the Worker. A client or exporter built once for the isolate keeps a
 * connection and a batching fiber that belong to the first request, and the Workers runtime will not let a later
 * request wake them (measured on 2026-11-17: Effect DevTools built here connected, then delivered nothing after the
 * first request). They are built per request instead and finished under `waitUntil` (RequestTelemetry.ts), which
 * delivered every span of 8 requests out of 8: Effect DevTools on the server in development, with
 * EFFECT_DEVTOOLS_URL. The browser has its own client (src/web/lib/devtools.ts, VITE_EFFECT_DEVTOOLS), and the Node
 * tests take one when EFFECT_DEVTOOLS_URL is set in the shell (test/server/support/app.ts).
 */
export const layer = (options: { readonly production: boolean }) =>
  Layer.unwrap(
    Effect.gen(function* () {
      const settings = yield* logSettings({ format: options.production ? "json" : "pretty" })
      return Layer.mergeAll(
        Logger.layer([loggers[settings.format]]),
        Layer.succeed(References.MinimumLogLevel, settings.level),
        ErrorReporter.layer([logReporter])
      )
    })
  )

/** The console logger for each `LOG_FORMAT`. */
export const loggers: Record<LogFormat, Logger.Logger<unknown, void>> = {
  pretty: Logger.consolePretty(),
  json: Logger.consoleJson,
  logfmt: Logger.consoleLogFmt,
  structured: Logger.consoleStructured
}

/**
 * Writes each failure Effect reports as one log line with `Cause.pretty`: a defect (a bug) at Error, with its stack;
 * a typed failure (a refused write, a missing member, a model that did not answer) at the level the error carries,
 * Info unless it sets `ErrorReporter.severity`. Interruptions are not reported.
 *
 * What it can print is safe by construction: a typed error's `reason` is not part of `Cause.pretty` (it prints the
 * tag and the stack), schema errors name the field and the rule but never the value, and a secret is a `Redacted`
 * that prints as "<redacted>". It never throws: logging runs as an Effect on the failing fiber's own services, and
 * its exit is dropped.
 */
export const logReporter: ErrorReporter.ErrorReporter = (() => {
  // One line per cause: Effect reports a cause once per reason, and the HTTP layer can report one cause twice. Weak,
  // so a cause already written is let go with it; Effect has no weak collection to use instead.
  const written = new WeakSet<Cause.Cause<unknown>>()
  return ErrorReporter.make(({ attributes, cause, fiber, severity }) => {
    if (written.has(cause)) return
    written.add(cause)
    const defect = Cause.hasDies(cause)
    const line = Effect.logWithLevel(defect ? "Error" : severity)(Cause.pretty(cause)).pipe(
      Effect.annotateLogs({ ...attributes, "error.kind": defect ? "defect" : "failure" })
    )
    Effect.runSyncExitWith(fiber.context)(line)
  })
})()
