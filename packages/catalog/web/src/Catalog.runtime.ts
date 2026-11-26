// The catalog screens' way to the API: the client for the imports, items and assistant groups, as a tag the app's
// runtime provides, and the calls bound to it. A screen here can reach these three groups and nothing else. The app
// binds them once, at start (`configureCatalog`), because an upload and a prefetch run outside any component.
import type { AssistantApi, ImportsApi, ItemsApi } from "@inventory/catalog-contract/Catalog"
import type { Api, Call, Fork } from "@inventory/client/ApiRuntime"
import { makeApiAtoms } from "@inventory/client/Api"
import type { SameOrigin } from "@inventory/kernel/SameOrigin"
import * as Context from "effect/Context"
import * as O from "effect/Option"
import { identity } from "effect/Function"
import type * as Effect from "effect/Effect"
import type * as Exit from "effect/Exit"
import type * as ManagedRuntime from "effect/ManagedRuntime"
import type * as HttpApiClient from "effect/http-api/HttpApiClient"
import type * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"

/**
 * What the whole API can answer on any endpoint, whatever its group: the errors of the two middlewares the app puts
 * on its assembled `Api` (a cross-site refusal, a problem document).
 */
type AnyEndpointError = HttpApiMiddleware.Error<HttpApiMiddleware.ProblemDetails | SameOrigin>

/** The typed client for the catalog's three groups. */
export type CatalogApiClient = HttpApiClient.Client<
  typeof ImportsApi | typeof ItemsApi | typeof AssistantApi,
  AnyEndpointError
>
/** The name the screens that moved here call the client by. */
export type Client = CatalogApiClient

/** The catalog client, as the app's runtime provides it (from its one client for the whole API). */
export class CatalogClient extends Context.Service<CatalogClient, CatalogApiClient>()(
  "@inventory/catalog-web/Catalog.runtime/CatalogClient"
) {}

/** What the app hands over at start: the three calls bound to its runtime, the runtime, and where the API is. */
export type CatalogBinding = Api<CatalogApiClient> & {
  /** The app's one runtime: reading a chosen file and restoring saved progress run on it, so Cancel reaches them. */
  readonly runtime: ManagedRuntime.ManagedRuntime<never, never>
  /** The path every endpoint is under ("/api/v1"), for the one request sent as the page closes. */
  readonly apiPrefix: string
}

let bound: O.Option<CatalogBinding> = O.none()

/** Binds the catalog screens to the app's runtime. The app calls it once, before it mounts a screen. */
export const configureCatalog = (binding: CatalogBinding): void => {
  bound = O.some(binding)
}

const binding = (): CatalogBinding =>
  O.match(bound, {
    onNone: () => {
      throw new Error("configureCatalog was not called before a catalog screen ran")
    },
    onSome: identity
  })

/**
 * Runs one write as a Promise, for a write that is not an atom's (the review's draft sends its saves itself). A
 * failure that may pass is sent again, twice at most; a refusal is not. A write names what it acts on, so a retry
 * after a lost answer adds nothing.
 */
export const callWrite: Call<CatalogApiClient> = (use) => binding().callWrite(use)

/**
 * Runs one request as a Promise, sent once whatever its answer: the confirm of an import, whose outcome only the
 * server knows, so a lost answer is asked about and never sent again.
 */
export const call: Call<CatalogApiClient> = (use) => binding().call(use)

/** Runs a longer program against the API in the background; interrupting its fiber aborts its requests. */
export const fork: Fork<CatalogApiClient> = (use) => binding().fork(use)

/** Reads, writes and the write retries against the catalog groups, as atoms on the app's one runtime. */
export const catalogApi = makeApiAtoms(CatalogClient)

/** Runs an Effect on the app's runtime, as a Promise of its exit. */
export const runExit = <A, E>(effect: Effect.Effect<A, E>): Promise<Exit.Exit<A, E>> =>
  binding().runtime.runPromiseExit(effect)

/** The app's runtime, for work that is not an API call: reading a chosen file, restoring saved progress. */
export const catalogRuntime = (): ManagedRuntime.ManagedRuntime<never, never> => binding().runtime

/** The path every endpoint is under, as the app bound it. */
export const apiPrefixOf = (): string => binding().apiPrefix
