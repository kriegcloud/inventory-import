// The access screens' way to the API: the client for the identity, people and activity groups, as a tag the app's
// runtime provides, and the calls bound to it. A screen here can reach these three groups and nothing else.
import type { ActivityApi, IdentityApi, PeopleApi } from "@inventory/access-contract/Access"
import { type Api, useApi } from "@inventory/client/ApiRuntime"
import { type OptimisticWrite, useOptimisticWriteVia } from "@inventory/client/Optimistic"
import type { SameOrigin } from "@inventory/kernel/SameOrigin"
import { Context } from "effect"
import type { HttpApiClient, HttpApiMiddleware } from "effect/http-api"
import { $AccessWebId } from "./internal/identity.ts"

export { accessKeys } from "./Access.keys.ts"

const $I = $AccessWebId.create("Access")

/**
 * What the whole API can answer on any endpoint, whatever its group: the errors of the two middlewares the app puts
 * on its assembled `Api` (a cross-site refusal, a problem document).
 */
type AnyEndpointError = HttpApiMiddleware.Error<HttpApiMiddleware.ProblemDetails | SameOrigin>

/** The typed client for the access context's three groups. */
export type AccessApiClient = HttpApiClient.Client<
  typeof IdentityApi | typeof PeopleApi | typeof ActivityApi,
  AnyEndpointError
>

/** The access client, as the app's runtime provides it (from its one client for the whole API). */
export class AccessClient extends Context.Service<AccessClient, AccessApiClient>()($I`AccessClient`) {}

/** `call`, `callWrite` and `fork` against the access groups, over the app's runtime. */
export const useAccess = (): Api<AccessApiClient> => useApi(AccessClient)

/** One optimistic write against the access groups (`@inventory/client/Optimistic` says the rule it keeps). */
export const useAccessWrite = <Input, A, E>(spec: OptimisticWrite<AccessApiClient, Input, A, E>) => {
  const { callWrite } = useAccess()
  return useOptimisticWriteVia({ ...spec, callWrite })
}
