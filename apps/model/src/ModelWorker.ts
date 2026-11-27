/**
 * The model's Worker: a second, Effect-native Worker that hosts the app's models on Durable Objects, the usage model
 * first (Benjamin, 2026-11-26: "A second app, apps/model"). The stack declares it and binds it to the site's Worker
 * (`packages/infra/src/Inventory.stack.ts`), which is the only way in: it has no `workers.dev` address and no
 * domain (`Address.ts`), so neither of its Apis answers on a public address, past the site's cross-site check.
 * `bun run dev` does not run it ("Keep Vite; dev:alchemy beside it"): `bun run dev:alchemy` does, beside the site's
 * Worker, on a port of its own (`Address.ts`).
 *
 * Who a call acts as is read here (`Session.ts`, on the one session lookup over Better Auth on Alchemy's package,
 * `SignIn.ts`, and the member directory, both on the site's D1 database, which the stack binds: `Bindings.ts`). What
 * it does not do yet, each an item of its own: send its own spans (host-05), and state how long its dedupe rows are
 * kept (host-07: Benjamin chose "Receipts forever" on 2026-11-27; not passed yet, so the library's defaults still
 * stand). The one thing not to break: every model the Worker hosts is provided the same `layerDurableObjects(...)`
 * options, so they share one platform and one workflow engine (`@alchemy.run/domain/src/Cloudflare/index.ts`,
 * `layerDurableObjects`): that is `modelsOn` (`Models.ts`), which its test calls too.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import { MemberDirectoryD1 } from "@inventory/access-host/MemberDirectoryD1"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { address } from "./Address.ts"
import { bindingsFromStack, boundDatabase } from "./Bindings.ts"
import { modelD1 } from "./Database.ts"
import { workerOn } from "./Models.ts"
import { modelRetention } from "./Retention.ts"
import { authDatabaseOver, secureCookiesSetting, sessionsOver } from "./SignIn.ts"

/**
 * The bindings the stack gives this Worker beyond its own Durable Objects (`Bindings.ts`), from the one entry the stack
 * may import (the boundaries law's row for the model's Worker).
 */
export { ModelWorkerEnv, modelWorkerEnv } from "./Bindings.ts"

/**
 * The platform of every model of the Worker: Cloudflare's Durable Objects, one set of options (receipts kept for
 * ever, `Retention.ts`), with the Web Crypto random source, which `Domain.InMemory` provides itself to a test.
 */
const DurableObjects = DomainCloudflare.layerDurableObjects({ retention: modelRetention }).pipe(
  Layer.provideMerge(SecureRandom.layerWebCrypto)
)

/**
 * The one session lookup on this Worker (`sessionsOver`, which its test runs over stores in memory): Better Auth on
 * Alchemy's package (`SignIn.ts`) and the member directory, both over the site's D1 database, which the stack binds
 * here under `databaseBinding` (`Bindings.ts`). Read when the Worker starts: its bindings, and
 * whether the site's cookie is a Secure one. Nothing is queried then; the database is opened in each execution.
 */
const SessionsOnWorker = Layer.unwrap(
  Effect.gen(function* () {
    const env = yield* Cloudflare.WorkerEnvironment
    const secureCookies = yield* secureCookiesSetting
    const database = boundDatabase(env)
    return sessionsOver({
      auth: authDatabaseOver(database),
      directory: MemberDirectoryD1.pipe(Layer.provide(modelD1(database))),
      secureCookies
    })
  })
)

/**
 * The model's Worker. Its Durable Object classes are named `<Model>.<class>` (`Usage.` and the class of each block), so
 * a model renamed after a deploy Benjamin keeps starts empty. Its bindings beyond its own objects are the stack's
 * (`Bindings.ts`): the site's D1 database and the site's sign-in secret.
 */
export default class ModelWorker extends Cloudflare.Worker<ModelWorker>()(
  "ModelWorker",
  bindingsFromStack({ main: import.meta.url, ...address }),
  workerOn({ platform: DurableObjects, sessions: SessionsOnWorker })
) {}
