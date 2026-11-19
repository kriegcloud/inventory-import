// The access screens' way to the API: the client for the identity, people and activity groups, as a tag the app's
// runtime provides, and the read and write atoms made against it. A screen here can reach these three groups and
// nothing else.
import type { ActivityApi, IdentityApi, PeopleApi } from "@inventory/access-contract/Access"
import { makeApiAtoms } from "@inventory/client/Api"
import type { SameOrigin } from "@inventory/kernel/SameOrigin"
import * as Context from "effect/Context"
import type * as HttpApiClient from "effect/http-api/HttpApiClient"
import type * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
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

/** Reads, writes and the write retries against the access groups, as atoms on the app's one runtime. */
export const accessApi = makeApiAtoms(AccessClient)
