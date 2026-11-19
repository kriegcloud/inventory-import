import * as Layer from "effect/Layer"
import * as HttpClient from "effect/http/HttpClient"
import { publicSettings } from "./settings.ts"

// THE PAGE'S TRACE CONTEXT. A request gets a span, and sends its trace context (`traceparent`), only once the
// exporters are plugged in (./telemetry.ts). The first requests of a page leave before they are: their spans would
// never be sent, and the Worker's spans for them would name a parent no collector receives. Measured on 2026-11-17,
// 38 of 96 traces in Tempo were such orphans. With DevTools on in development the page keeps its spans from the
// start, so DevTools sees every request; those first requests' Worker spans can then name a parent that is not sent.
//
// It is read from the runtime by every client the page runs there, the API client's own included, so no client needs
// to be built differently.

let sending = false

/** From now on the page's requests get spans and send their trace context. Called when exporters are plugged in. */
export const sendTraceContext = () => {
  sending = true
}

/** Until `sendTraceContext`, the page's requests make no span and send no trace context (unless DevTools is on). */
export const traceContextGate = Layer.succeed(
  HttpClient.TracerDisabledWhen,
  () => !sending && !(import.meta.env.DEV && publicSettings.effectDevTools)
)
