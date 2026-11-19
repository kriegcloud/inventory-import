/**
 * A fresh D1 database for tests: local workerd through wrangler's platform proxy, in memory, nothing persisted, with
 * every migration applied in file-name order and then the seeds. Only tests import this subpath; the Worker never does.
 *
 * @packageDocumentation
 */
import type { D1Database } from "@cloudflare/workers-types"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as D1Client from "@effect/sql-d1/D1Client"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type * as SqlClient from "effect/sql/SqlClient"
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler"
import { D1, D1Binding } from "./D1.service.ts"
import { D1Error } from "./D1.errors.ts"
import { $D1Id } from "./internal/identity.ts"

const $I = $D1Id.create("D1Test")

/**
 * What a test database is built from: a folder of migrations, applied in file-name order, and seed files applied after
 * them, each in order.
 *
 * @category schemas
 */
export class D1TestOptions extends S.Opaque<D1TestOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    migrations: S.URL.pipe(S.annotateKey({ description: "A folder of .sql files, applied in file-name order" })),
    seeds: S.Array(S.URL.pipe(S.annotateKey({ description: "One .sql file applied after the migrations" }))).pipe(
      S.annotateKey({ description: "Seed files, applied in order after the migrations" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    )
  }).pipe($I.annoteSchema("D1TestOptions", { description: "The migrations and seeds a test database is built from" }))
) {}

/** The wrangler configuration the proxy reads: one D1 binding, nothing else. */
const wranglerConfig = new URL("../wrangler.d1-test.jsonc", import.meta.url)

const runSqlText = Effect.fnUntraced(function* (db: D1Database, text: string) {
  const statements = A.map(unstable_splitSqlQuery(text), (sql) => db.prepare(sql))
  if (A.isReadonlyArrayNonEmpty(statements)) {
    yield* Effect.tryPromise({
      try: () => db.batch(statements),
      catch: (cause) => D1Error.make({ stage: "execute", statement: 0, cause })
    })
  }
})

const readSql = Effect.fnUntraced(function* (file: URL) {
  const fs = yield* FileSystem.FileSystem
  return yield* fs
    .readFileString(file.pathname)
    .pipe(Effect.mapError((cause) => D1Error.make({ stage: "execute", statement: 0, cause })))
})

/**
 * Builds and seeds test databases.
 *
 * @category layers
 */
export class D1Test {
  private constructor() {}

  /** A layer that runs one SQL file against the test database's binding, statement by statement, as one batch. */
  static readonly seed = (file: URL): Layer.Layer<never, D1Error, D1Binding> =>
    Layer.effectDiscard(
      Effect.gen(function* () {
        const db = yield* D1Binding
        const text = yield* readSql(file)
        yield* runSqlText(db, text)
      }).pipe(Effect.withSpan("D1Test.seed"))
    ).pipe(Layer.provide(NodeFileSystem.layer))

  /** A fresh in-memory D1 with every migration and seed applied: `D1`, `D1Client`, `SqlClient` and `D1Binding`. */
  static readonly layer = (
    options: D1TestOptions
  ): Layer.Layer<D1 | D1Client.D1Client | SqlClient.SqlClient | D1Binding, D1Error> => {
    const binding = Layer.effect(
      D1Binding,
      Effect.gen(function* () {
        const proxy = yield* Effect.acquireRelease(
          Effect.tryPromise({
            try: () => getPlatformProxy<{ DB: D1Database }>({ configPath: wranglerConfig.pathname, persist: false }),
            catch: (cause) => D1Error.make({ stage: "execute", statement: 0, cause })
          }),
          (open) => Effect.promise(() => open.dispose())
        )
        const db = proxy.env.DB
        const fs = yield* FileSystem.FileSystem
        const names = yield* fs
          .readDirectory(options.migrations.pathname)
          .pipe(Effect.mapError((cause) => D1Error.make({ stage: "execute", statement: 0, cause })))
        const files = A.map(
          A.sort(A.filter(names, Str.endsWith(".sql")), Order.String),
          (name) => new URL(name, options.migrations)
        )
        for (const file of [...files, ...options.seeds]) {
          const text = yield* readSql(file)
          yield* runSqlText(db, text)
        }
        return db
      })
    ).pipe(Layer.provide(NodeFileSystem.layer))
    return Layer.unwrap(
      Effect.map(D1Binding, (db) =>
        Layer.mergeAll(D1.layerFromClient, Layer.succeed(D1Binding, db)).pipe(
          Layer.provideMerge(D1Client.layer({ db }).pipe(Layer.orDie))
        )
      )
    ).pipe(Layer.provide(binding))
  }
}
