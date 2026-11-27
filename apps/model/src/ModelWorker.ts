/**
 * The model's Worker: a second, Effect-native Worker that hosts the app's models on Durable Objects, the usage model
 * first (Benjamin, 2026-11-26: "A second app, apps/model"). The stack declares it and binds it to the site's Worker
 * (`packages/infra/src/Inventory.stack.ts`), which is the only way in: it has no `workers.dev` address and no
 * domain (`Address.ts`), so neither of its Apis answers on a public address, past the site's cross-site check.
 * `bun run dev` does not run it ("Keep Vite; dev:alchemy beside it"): `bun run dev:alchemy` does, beside the site's
 * Worker, on a port of its own (`Address.ts`).
 *
 * What it does not do yet, each a seam named in its file: read who is signed in (`Session.ts`: every call is refused
 * `NotSignedIn` until host-03), reach the database (`Database.ts`: the D1 client is ready, the binding waits for the
 * first port that reads D1), send its own spans (host-05), and state how long its dedupe rows are kept (host-07: the
 * library's defaults stand until Benjamin chooses). The one thing not to break: every model the Worker hosts is
 * provided the same `layerDurableObjects(...)` options, so they share one platform and one workflow engine
 * (`@alchemy.run/domain/src/Cloudflare/index.ts`, `layerDurableObjects`): that is `modelsOn` (`Models.ts`), which its
 * test calls too.
 *
 * @packageDocumentation
 */
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as DomainCloudflare from "@alchemy.run/domain/Cloudflare"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as Layer from "effect/Layer"
import { address } from "./Address.ts"
import { workerOn } from "./Models.ts"

/**
 * The platform of every model of the Worker: Cloudflare's Durable Objects, one set of options, with the Web Crypto
 * random source, which `Domain.InMemory` provides itself to a test.
 */
const DurableObjects = DomainCloudflare.layerDurableObjects().pipe(Layer.provideMerge(SecureRandom.layerWebCrypto))

/**
 * The model's Worker. Its Durable Object classes are named `<Model>.<class>` (`Usage.` and the class of each block), so
 * a model renamed after a deploy Benjamin keeps starts empty.
 */
export default class ModelWorker extends Cloudflare.Worker<ModelWorker>()(
  "ModelWorker",
  { main: import.meta.url, ...address },
  workerOn(DurableObjects)
) {}
