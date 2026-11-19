import { Context, Effect, type Exit, Layer, ManagedRuntime } from "effect"
import { FetchHttpClient, HttpClient, HttpClientError, HttpClientResponse } from "effect/http"
import { HttpApiClient } from "effect/http-api"
import { Api } from "../../api/v1/Api.ts"
import { devToolsLayer } from "./devtools.ts"
import { takeEarly } from "@inventory/client/Early"
import { AccessClient } from "@inventory/access-web/Access"
import { makeApi } from "@inventory/client/ApiRuntime"
import { makeOptimisticWrite } from "@inventory/client/Optimistic"
import { browserTelemetry } from "./telemetry.ts"

/** A client derived from the API contract. Methods, payloads and errors are all typed from src/api/v1/Api.ts. */
export type Client = HttpApiClient.ForApi<typeof Api>

/** Reuses each early GET once; all other calls keep the API runtime's HTTP client and tracing. */
const withEarly = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
  HttpClient.transform(
    client,
    Effect.fnUntraced(function* (response, request) {
      if (request.method !== "GET") return yield* response
      const answer = takeEarly(request.url.replace(/^https?:\/\/[^/]+/, ""))
      if (answer === undefined) return yield* response
      const native = yield* Effect.tryPromise({
        try: () => answer,
        catch: (cause) =>
          new HttpClientError.HttpClientError({
            reason: new HttpClientError.TransportError({ request, cause })
          })
      })
      return HttpClientResponse.fromWeb(request, native)
    })
  )

class ApiClient extends Context.Service<ApiClient, Client>()("@inventory/app/web/lib/api/ApiClient") {
  static readonly layer = Layer.effect(
    ApiClient,
    // Same origin: the browser sends the session cookie with every call, so nothing names the actor here.
    HttpApiClient.make(Api, { transformClient: withEarly })
  ).pipe(Layer.provide(FetchHttpClient.layer))
}

/**
 * The browser's one runtime: the API client and, in development when `VITE_EFFECT_DEVTOOLS=true`, Effect DevTools
 * (`./devtools.ts`). Reading a file and restoring saved progress run here too (`browserRuntime` in `./runtime.ts`),
 * so DevTools has one connection and a Cancel anywhere interrupts the fiber it started.
 */
export const appRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    // The access screens' client is this one client, seen through the three groups they may call.
    Layer.effect(AccessClient, Effect.service(ApiClient)).pipe(Layer.provideMerge(ApiClient.layer)),
    devToolsLayer
  ).pipe(Layer.provideMerge(browserTelemetry))
)

const api = makeApi(appRuntime, ApiClient)

/**
 * Run one API call as a Promise, for TanStack Query.
 * A typed API error (for example `AiUnavailable`) rejects with that error object, so the UI can switch on `_tag`.
 */
export const call = api.call

/**
 * Runs one write as a Promise, for a mutation. A failure that may pass (the network, a server error, "too many
 * requests") is sent again, twice at most, waiting longer each time; a refusal is not. A write names what it acts on
 * (an upload's key, an edit's revision, an import that is still open), so a retry after a lost answer adds nothing.
 */
export const callWrite = api.callWrite

/**
 * Runs a longer program against the API in the background and returns its fiber. Interrupting the fiber aborts every
 * request it has in flight (the fetch is cancelled) and runs its finalizers: all a Cancel button needs.
 */
export const fork = api.fork

/** One optimistic write against this app's API (`@inventory/client/Optimistic` says the rule it keeps). */
export const useOptimisticWrite = makeOptimisticWrite(callWrite)

/** Runs an Effect on the API's runtime, as a Promise of its exit. */
export const runExit = <A, E>(effect: Effect.Effect<A, E>): Promise<Exit.Exit<A, E>> =>
  appRuntime.runPromiseExit(effect)
