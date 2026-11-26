import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as O from "effect/Option"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import { serverAnswered } from "@inventory/client/ConnectionAtoms"

const runtime = ManagedRuntime.make(FetchHttpClient.layer)

/** Browser HTTP at Promise boundaries, retaining native response bodies and fetch options. */
export const request: typeof globalThis.fetch = (input, init) => {
  const native = new Request(typeof input === "string" ? new URL(input, globalThis.location.href) : input, init)
  const sent = HttpClient.execute(HttpClientRequest.fromWeb(native)).pipe(
    Effect.tap((response) => Effect.sync(() => serverAnswered(response.status))),
    Effect.flatMap((response) =>
      O.match(HttpClientResponse.toWeb(response), {
        onNone: () => Effect.die("The fetch client returned a response without its native body"),
        onSome: Effect.succeed
      })
    ),
    Effect.provideService(HttpClient.TracerDisabledWhen, () => true)
  )
  return runtime
    .runPromiseExit(
      O.match(O.fromUndefinedOr(init), {
        onNone: () => sent,
        onSome: (init) => sent.pipe(Effect.provideService(FetchHttpClient.RequestInit, init))
      }),
      { signal: native.signal }
    )
    .then((exit) => {
      if (Exit.isSuccess(exit)) return exit.value
      throw Cause.squash(exit.cause)
    })
}
