import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as O from "effect/Option"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"

const runtime = ManagedRuntime.make(FetchHttpClient.layer)

/** Browser HTTP at Promise boundaries, retaining native response bodies and fetch options. */
export const request: typeof globalThis.fetch = (input, init) => {
  const native = new Request(typeof input === "string" ? new URL(input, globalThis.location.href) : input, init)
  return runtime
    .runPromiseExit(
      HttpClient.execute(HttpClientRequest.fromWeb(native)).pipe(
        Effect.map((response) => response.pipe(HttpClientResponse.toWeb, O.getOrThrow)),
        Effect.provideService(FetchHttpClient.RequestInit, init ?? {}),
        // These requests previously used plain fetch and did not send trace context.
        Effect.provideService(HttpClient.TracerDisabledWhen, () => true)
      ),
      { signal: native.signal }
    )
    .then((exit) => {
      if (Exit.isSuccess(exit)) return exit.value
      throw Cause.squash(exit.cause)
    })
}
