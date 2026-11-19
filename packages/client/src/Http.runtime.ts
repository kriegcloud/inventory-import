import { Cause, Effect, Exit, ManagedRuntime, Option } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"

const runtime = ManagedRuntime.make(FetchHttpClient.layer)

/** Browser HTTP at Promise boundaries, retaining native response bodies and fetch options. */
export const request: typeof globalThis.fetch = (input, init) => {
  const native = new Request(typeof input === "string" ? new URL(input, globalThis.location.href) : input, init)
  return runtime
    .runPromiseExit(
      HttpClient.execute(HttpClientRequest.fromWeb(native)).pipe(
        Effect.map((response) => Option.getOrThrow(HttpClientResponse.toWeb(response))),
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
