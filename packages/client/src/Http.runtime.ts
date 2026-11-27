import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as O from "effect/Option"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import { serverAnswered } from "@inventory/client/ConnectionAtoms"

const runtime = ManagedRuntime.make(FetchHttpClient.layer)

/**
 * The browser's HTTP client for a model's protocol (`@alchemy.run/domain`'s `protocolWebSocket` or `protocolHttp`),
 * which the app gives the client layer of every model it mounts. The library sends a call's request with no check of
 * its status (node_modules/effect/src/rpc/RpcClient.ts, `makeHttpExchange`: `client.post("", { body })`), and its
 * server answers every call it handles with 200; so an answer with another status is the edge's or a proxy's (a
 * deploy's 503, a 502, a rate limit's 429), and here it fails as that status. Without this it fails as "Received
 * empty HTTP response from RPC server", which `isTransient` cannot ask again and `sayError` says as an unreadable
 * answer.
 */
export const modelHttpClient: Layer.Layer<HttpClient.HttpClient> = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(Effect.service(HttpClient.HttpClient), HttpClient.filterStatusOk)
).pipe(Layer.provide(FetchHttpClient.layer))

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
