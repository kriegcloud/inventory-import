import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as Str from "effect/String"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientError from "effect/http/HttpClientError"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import { Api } from "../../api/v1/Api.ts"
import { devToolsLayer } from "./devtools.ts"
import { takeEarly } from "@inventory/client/Early"
import { AccessClient } from "@inventory/access-web/Access"
import { CatalogClient, configureCatalog } from "@inventory/catalog-web/Catalog"
import { apiPrefix } from "../../api/v1/Version.ts"
import { makeApi } from "@inventory/client/ApiRuntime"
import { ofThisPage } from "./ofThisPage.ts"
import { browserTelemetry } from "./telemetry.ts"
import { UsageClientLive } from "./models.ts"

/** A client derived from the API contract. Methods, payloads and errors are all typed from src/api/v1/Api.ts. */
export type Client = HttpApiClient.ForApi<typeof Api>

/** Reuses each early GET once; all other calls keep the API runtime's HTTP client and tracing. */
const withEarly = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
  HttpClient.transform(
    client,
    Effect.fnUntraced(function* (response, request) {
      if (request.method !== "GET") return yield* response
      const answer = takeEarly(Str.replace(/^https?:\/\/[^/]+/, "")(request.url))
      return yield* O.match(answer, {
        onNone: () => response,
        onSome: (answer) =>
          Effect.tryPromise({
            try: () => answer,
            catch: (cause) =>
              new HttpClientError.HttpClientError({ reason: new HttpClientError.TransportError({ request, cause }) })
          }).pipe(Effect.map((native) => HttpClientResponse.fromWeb(request, native)))
      })
    })
  )

class ApiClient extends Context.Service<ApiClient, Client>()("@inventory/app/web/lib/api/ApiClient") {
  static readonly layer = Layer.effect(
    ApiClient,
    // Same origin: the browser sends the session cookie with every call, so nothing names the actor here.
    HttpApiClient.make(Api, { transformClient: (client) => client.pipe(withEarly, ofThisPage) })
  ).pipe(Layer.provide(FetchHttpClient.layer))
}

/**
 * The browser's one runtime: the API client, each model's member client and, in development when `VITE_EFFECT_DEVTOOLS=true`, Effect DevTools
 * (`./devtools.ts`). Reading a file and restoring saved progress run here too (`browserRuntime` in `./runtime.ts`),
 * so DevTools has one connection and a Cancel anywhere interrupts the fiber it started.
 */
export const appRuntime = ManagedRuntime.make(
  Layer.mergeAll(
    // The access and the catalog screens' clients are this one client, each seen through the groups it may call.
    Layer.mergeAll(
      Layer.effect(AccessClient, Effect.service(ApiClient)),
      Layer.effect(CatalogClient, Effect.service(ApiClient))
    ).pipe(Layer.provideMerge(ApiClient.layer)),
    // Each model's member client over its WebSocket protocol (./models.ts), the usage model's first (web-02).
    UsageClientLive,
    devToolsLayer
  ).pipe(Layer.provideMerge(browserTelemetry))
)

/**
 * The same runtime's services as a layer, for the atom registry (`provideApi` from `@inventory/client/Api`): the atoms
 * call the API through this one client, so there is one connection to DevTools and one set of traces.
 */
export const appLayer = Layer.effectContext(appRuntime.contextEffect)

// The catalog screens start uploads and prefetch outside any component, so they are bound to this runtime here, once,
// before anything of theirs runs.
configureCatalog({ ...makeApi(appRuntime, CatalogClient), runtime: appRuntime, apiPrefix })
