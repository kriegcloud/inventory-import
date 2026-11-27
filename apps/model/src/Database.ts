/**
 * The repository's D1 driver on the model's Worker (host-02): `D1.layerFromClient` over Alchemy's `SQL.D1Layer`, so a
 * port of the model's Worker (the session's member lookup, the projections and queries of move 3) is written against
 * `D1` as the site's adapters are, every statement through a Schema both ways and a batch all or none. No constructor
 * is added to `@beep/d1`: the driver stays free of Alchemy, and `D1.layer({ db })` stays the site's.
 *
 * The client is opened once per execution (a Worker event, a Durable Object call, a Workflow run) and a statement run
 * outside one is a defect (`@alchemy.run/sql/src/DeferredClient.ts`), so nothing may query while a Layer is built.
 * The source is read in each execution with only the runtime's own services, whatever its type says, so it is the
 * bound database's client or an Effect of a binding already in hand (an Effect that reads a service of the Layer
 * failed "Service not found" when this was built; no test holds it). `D1Binding` is not provided: only the test
 * database's seed reads it. The binding itself is the seam: which module declares the D1 database so both Workers
 * bind it is open (the stack declares it today), and nothing in the Worker reads D1 at move 2.
 *
 * @packageDocumentation
 */
import * as SQL from "@alchemy.run/cloudflare/D1/SQL"
import { D1 } from "@beep/d1/D1"
import * as Layer from "effect/Layer"

/**
 * `D1`, `D1Client` and `SqlClient` over a D1 database: the client `Cloudflare.D1.QueryDatabase(database)` gives a
 * Worker, or a bare Effect of the raw binding, as a test gives it.
 *
 * **Example** (In the Worker's init, once the database is bound)
 *
 * ```ts
 * const database = yield* Cloudflare.D1.QueryDatabase(Database)
 * const ports = MemberDirectoryD1.pipe(Layer.provide(modelD1(database)))
 * ```
 */
export const modelD1 = <E, R>(database: SQL.D1DatabaseSource<E, R>) =>
  D1.layerFromClient.pipe(Layer.provideMerge(SQL.D1Layer(database)))
