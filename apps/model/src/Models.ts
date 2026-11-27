/**
 * The model's Worker as it is put together, apart from the platform it runs on: every model it hosts, the Worker's
 * own session in front of each, and the Worker's answer built from them. The Worker gives it Cloudflare's Durable
 * Objects and the one session lookup over its D1 binding (`ModelWorker.ts`), and its test gives it `Domain.InMemory`
 * and the same lookup over stores in memory (`sessionsOver`, `SignIn.ts`), so the test calls the Worker's own
 * composition and not one put together beside it: only the platform and the stores differ, and what the Worker reads
 * from its bindings is the harness test's (`apps/inventory/test/stack`). The one thing not to break: every model of
 * the Worker is provided the one platform it is given, so they share one platform and one workflow engine
 * (`@alchemy.run/domain/src/Cloudflare/index.ts`, `layerDurableObjects`), and the session in front of them is the
 * Worker's (`Session.ts`), never one a caller chooses.
 *
 * @packageDocumentation
 */
import type { SessionLookup } from "@inventory/kernel/SessionLookup"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { UsageSession } from "./Session.ts"
import { UsageHosted, usageWorker } from "./UsageHost.ts"

/**
 * Every model of the Worker on `platform`, with the Worker's session in front of each, every session and every guarded
 * read judged by `sessions`, the one session lookup: the usage model now, the catalog's at move 3 and the access
 * model's at move 6, each on this same platform. This is what the Worker exports apart from its platform, so a test
 * builds it whole on the memory host.
 */
export const modelsOn = <A, E, R, E2, R2>(host: {
  readonly platform: Layer.Layer<A, E, R>
  readonly sessions: Layer.Layer<SessionLookup, E2, R2>
}) => Layer.mergeAll(UsageSession, UsageHosted).pipe(Layer.provide(Layer.merge(host.platform, host.sessions)))

/**
 * The Worker's answer on its host's `platform` and `sessions`: what `Effect.provide(modelsOn(host))` does, the
 * library's own form (`DomainCloudflare.layerDurableObjects`'s example), written out: the models built in a scope of
 * the Worker's start, and its `fetch` given their services. The type-check reserves `Effect.provide` with a Layer for
 * an entry point it cannot tell this is.
 */
export const workerOn = <A, E, R, E2, R2>(host: {
  readonly platform: Layer.Layer<A, E, R>
  readonly sessions: Layer.Layer<SessionLookup, E2, R2>
}) =>
  modelsOn(host).pipe(
    Layer.build,
    Effect.flatMap((services) => Effect.provideContext(usageWorker, services)),
    Effect.scoped
  )
