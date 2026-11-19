/**
 * The access context as the app composes it: its ports on D1, the gateway another context asks for a model call
 * through, the session answer, and the random source the handlers make ids with.
 *
 * @packageDocumentation
 */
import { ModelAllowanceGatewayLive } from "@inventory/access-model/AllowanceHandler"
import * as Layer from "effect/Layer"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { AccessAdaptersD1 } from "./Adapters.ts"
import { Sessions } from "./SessionIdentity.adapter.ts"

/**
 * The gateway and the session answer over whatever provides the ports: the D1 adapters in the Worker, the in-memory
 * twins in a fast test.
 *
 * @category layers
 */
export const accessServices = (build: { readonly production: boolean }) =>
  Layer.mergeAll(ModelAllowanceGatewayLive, Sessions.layer(build)).pipe(Layer.provideMerge(SecureRandom.layerWebCrypto))

/**
 * The access context on D1 and Better Auth, for a build. The `Identity` middleware is not in it: the app chooses
 * one (`SessionIdentityLive` in the Worker, the header identity in tests), so neither is pulled into a build by this
 * file.
 *
 * @category layers
 */
export const AccessLive = (build: { readonly production: boolean }) =>
  accessServices(build).pipe(Layer.provideMerge(AccessAdaptersD1))
