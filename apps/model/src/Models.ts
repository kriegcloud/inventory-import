/**
 * The model's Worker as it is put together, apart from the platform it runs on: every model it hosts, the Worker's
 * own session in front of each, and the Worker's answer built from them. The Worker gives it Cloudflare's Durable
 * Objects (`ModelWorker.ts`), and its test gives it `Domain.InMemory`, so the test calls the Worker's own composition
 * and not one put together beside it. The one thing not to break: every model of the Worker is provided the one
 * platform it is given, so they share one platform and one workflow engine (`@alchemy.run/domain/src/Cloudflare/
 * index.ts`, `layerDurableObjects`), and the session in front of them is the Worker's (`Session.ts`), never one a
 * caller chooses.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { SessionNotYetRead } from "./Session.ts"
import { UsageHosted, usageWorker } from "./UsageHost.ts"

/**
 * Every model of the Worker on `platform`, with the Worker's session in front of each: the usage model now, the
 * catalog's at move 3 and the access model's at move 6, each on this same platform.
 */
export const modelsOn = <A, E, R>(platform: Layer.Layer<A, E, R>) =>
  Layer.mergeAll(SessionNotYetRead, UsageHosted).pipe(Layer.provide(platform))

/**
 * The Worker's answer on `platform`: what `Effect.provide(modelsOn(platform))` does, the library's own form
 * (`DomainCloudflare.layerDurableObjects`'s example), written out: the models built in a scope of the Worker's start,
 * and its `fetch` given their services. The type-check reserves `Effect.provide` with a Layer for an entry point it
 * cannot tell this is.
 */
export const workerOn = <A, E, R>(platform: Layer.Layer<A, E, R>) =>
  platform.pipe(
    modelsOn,
    Layer.build,
    Effect.flatMap((services) => Effect.provideContext(usageWorker, services)),
    Effect.scoped
  )
