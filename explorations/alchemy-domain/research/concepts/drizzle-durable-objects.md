---
type: Reference
title: Drizzle on Durable Objects
description: Drizzle.DurableObject opens a Drizzle v1 (release candidate) database over one Durable Object's own SQLite storage; this app would use it for per-organization tables beside the domain model, starting with the model-call allowance.
tags: [alchemy-domain, extra]
---

# Drizzle on Durable Objects

`Drizzle.DurableObject` (from `@alchemy.run/drizzle/Cloudflare`) opens a Drizzle database over the SQLite storage of
the Durable Object it runs in. You declare tables with Drizzle's `sqliteTable`, commit SQL that `drizzle-kit
generate` writes, capture that folder with `Cloudflare.SqlMigrations` when the Worker is built, and each object
applies its own pending files the first time it wakes after a deploy. Every query is an Effect. Inside one object,
`db.transaction` is a real storage transaction, which D1 does not have. The docs put the migration side in one line:
"Capture SQL during construction; apply it when each object activates"
[https://alchemy.run/sql/drizzle/migrations#durable-object-migrations].

It is not part of `@alchemy.run/domain`. The domain library's own Durable Objects keep events, state and receipts in
the object's key-value storage and never use SQL (see "In this app"). Drizzle on Durable Objects is for objects the
app declares itself, beside the model.

## When to reach for it

- A piece of state belongs to one key (one organization, one import) and never needs a query across keys.
- The write needs a read in the middle ("count, then insert only if under the limit"; "read the import's revision,
  then save the decision") and must be atomic. D1 can only do this as a batch of statements fixed in advance.
- The state fits one object. Cloudflare publishes a per-object storage limit; its size was not verified in any
  source read for this page.

Do not reach for it for data that must be read across organizations, for Better Auth's tables (people sign in
across organizations), or to make the domain library's own objects use SQL.

## How it is declared

Three parts: a Drizzle schema module, a committed migrations folder, and an object that captures the folder in its
outer (construction) Effect and opens the database in its inner (instance) Effect.

```ts
// SKETCH: not compiled
// packages/access/host/src/Allowance.tables.ts
import { index, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const modelCall = sqliteTable("modelCall", {
  id: text("id").notNull(),
  actorId: text("actorId").notNull(),
  kind: text("kind", { enum: ["view", "check", "suggest"] }).notNull(),
  createdAt: text("createdAt").notNull()
}, (t) => [primaryKey({ columns: [t.id] }), index("modelCall_createdAt").on(t.createdAt)])
```

```ts
// SKETCH: not compiled
// packages/access/host/src/AllowanceObject.ts
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Drizzle from "@alchemy.run/drizzle/Cloudflare"
import { count, gte } from "drizzle-orm"
import * as Effect from "effect/Effect"
import { modelCall } from "./Allowance.tables.ts"

// One object per organization: its name is the organization id, so the table needs no organizationId column.
export class AllowanceObject extends Cloudflare.DurableObject<AllowanceObject>()(
  "AllowanceObject",
  Effect.gen(function* () {
    const migrations = yield* Cloudflare.SqlMigrations("./packages/access/host/drizzle")
    return Effect.gen(function* () {
      const db = yield* Drizzle.DurableObject({ migrations })
      return {
        take: Effect.fn("AllowanceObject.take")(function* (call: {
          readonly id: string
          readonly actorId: string
          readonly kind: "view" | "check" | "suggest"
          readonly at: string
          readonly since: string
          readonly limit: number
        }) {
          return yield* db.transaction((tx) =>
            Effect.gen(function* () {
              const [used] = yield* tx.select({ n: count() }).from(modelCall)
                .where(gte(modelCall.createdAt, call.since))
              if ((used?.n ?? 0) >= call.limit) return false
              yield* tx.insert(modelCall).values({
                id: call.id, actorId: call.actorId, kind: call.kind, createdAt: call.at
              })
              return true
            })
          )
        })
      }
    })
  })
) {}
```

What each piece does, from the source:

- `Drizzle.DurableObject(config?)` reads `DurableObjectState` (so it only runs inside an Effect-native
  `Cloudflare.DurableObject`), builds `@effect/sql-sqlite-do`'s `SqliteClient` over `state.raw.storage`, and returns
  Drizzle's `EffectSQLiteDoDatabase` from `drizzle-orm/effect-sqlite-do` (`makeWithDefaults`).
- `config` is Drizzle's own `EffectDrizzleSQLiteDoConfig` (so `relations` for `db.query.*`) plus `migrations`:
  either the value `Cloudflare.SqlMigrations(dir)` returns (applied with Alchemy's engine and its
  `__alchemy_migrations` table) or Drizzle's generated `migrations.js` shape `{ migrations, migrationsTable? }`
  (applied with Drizzle's own migrator).
- A migration that cannot apply is a defect (`Effect.orDie`): the object answers nothing until a later activation
  succeeds. Opening the database never fails otherwise.
- Queries: `db.select().from(t)` yields the rows as `typeof t.$inferSelect` objects; `insert(...).values(...)
  .returning()` yields the inserted rows; `db.query.<table>.findMany/findFirst` needs `relations`. A failed query
  fails with `EffectDrizzleQueryError` (query, params, cause); `db.transaction` adds `SqlError`. The four Drizzle
  error classes are re-exported from `@alchemy.run/drizzle`.
- `db.transaction(body)` calls the client's `withTransaction`, which in `@effect/sql-sqlite-do` 4.1.4 opens the
  object's native `storage.transaction`, with nested calls as nested storage transactions. Alchemy replaces that
  `withTransaction` with one that runs the body on a synchronous scheduler, so a parent input-gate timer cannot
  block it.
- `Cloudflare.SqlMigrations(dir | { dir, table })` reads the folder when the Worker is built and embeds the files in
  the bundle; the runtime never reads the directory. It accepts flat `.sql` files or drizzle-kit v1 directories
  (`<timestamp>_<name>/migration.sql`); a v0 layout (`meta/_journal.json`) fails with `DrizzleV0LayoutError`.
  Each pending file and its history row commit in one `storage.transactionSync`. A folder is either flat or
  directories, not both (the first `<ts>_<name>/migration.sql` decides).
- Generating SQL is separate. Either run `drizzle-kit generate` with `dialect: "sqlite"` and commit the folder (the
  docs' recommended flow), or declare the `Drizzle.Schema` resource (props `schema`, `out` default
  `"./migrations"`, `dialect` default `"postgres"`, `generate`), which runs drizzle-kit during `alchemy deploy`.
  `SqlMigrations` does not wait for `Drizzle.Schema`, so with Durable Objects the committed-files flow is the one
  that works in order.
- Import path: `Drizzle.DurableObject` is in `@alchemy.run/drizzle/Cloudflare`, not the package root. The root
  (`index.ts`) exports `D1`, `Schema`, `providers` and the error classes; `MySQL` and `Postgres` are subpaths too.

Checked in:

- `packages/drizzle/src/Cloudflare.ts` at `v2.0.0-beta.87`: `DurableObjectMigrations` 17-20,
  `DurableObjectConfig` 22-33, `DurableObject` 110-144 (state 113-114, client 118-119, transaction override
  120-126, `SqlMigrations` path 130-131, Drizzle migrator 132-142). The published file
  (`unpkg.com/@alchemy.run/drizzle@2.0.0-beta.87/src/Cloudflare.ts`) is byte-identical.
- `packages/drizzle/src/index.ts` 1-19, `D1.ts` 41-53, `Schema.ts` 186-218 (props), 276 (resource) at
  `v2.0.0-beta.87`.
- `packages/cloudflare/src/Workers/SqlMigrations.ts` 19-31 (`apply` and its errors `MigrationError |
  MigrationHistoryConflictError`), 96-100; `SqlMigrationsApply.ts` 15-24; `packages/sql/src/Migrations/Embedded.ts`
  50-72 (`transactionSync` per file); `Detect.ts` 21-44, at `main@dbfd0ddb` (the Cloudflare package is not in the
  beta.87 export; the published beta.87 `SqlMigrations.ts` on unpkg is identical to main).
- `effect`: `packages/sql/sqlite-do/src/SqliteClient.ts` at tag `@effect/sql-sqlite-do@4.1.4` (the app does not install
  this package, so these lines were not re-checked against an installed copy), lines 1-18 (header,
  `@stability unstable`), 132-202 (storage-backed `withTransaction`), 336-340 (no `storage`, no transactions).
- `drizzle-orm@1.0.0-rc.5`, `effect-sqlite-do/session.js` (`transaction` delegates to `client.withTransaction`) and
  `migrator.js` (splits on `--> statement-breakpoint`), read from an installed copy, not from a repository.

### What main changes

Nothing. Every file under `packages/drizzle/src` and `packages/drizzle/package.json` is identical at
`main@dbfd0ddb` (`diff -u`). The docs pages on Drizzle are identical. The only change on the Durable Objects docs page
is unrelated: scheduled callbacks now need `Cloudflare.DurableObjectCallbacks` provided
(`website/src/content/docs/cloudflare/compute/durable-objects.mdx`, section "Create an object for scheduled work").
`examples/cloudflare-durable-object-sql` is the worked example of this API and exists on main only (the beta.87
export holds three domain examples); the API it uses is the published one.

## Rules, and the mistakes to avoid

- **Versions.** `@alchemy.run/drizzle@2.0.0-beta.87` pins `drizzle-orm` and `drizzle-kit` to exactly `1.0.0-rc.5`.
  The repository's manifest says `catalog:` for both (`packages/drizzle/package.json:69`, `:79-80`, identical at both
  refs); main's `pnpm-workspace.yaml` catalog resolves them (lines 183-184; the beta.87 export has no workspace file);
  the published manifest (`npm view @alchemy.run/drizzle@2.0.0-beta.87`) lists them as peers at `1.0.0-rc.5`, with
  `drizzle-kit` optional (`package.json:96-98`) and `@effect/sql-sqlite-do` `^4.1.4` as a dependency. That is Drizzle's v1 line, but a
  release candidate: npm's `latest` for `drizzle-orm` is still `0.45.4` and `rc` is `1.0.0-rc.5`. Keep the two pins
  together. `@effect/sql-sqlite-do` is `@stability unstable`; `alchemy` is a beta.
- **Construction versus instance.** `SqlMigrations` goes in the outer Effect (it reads files at build time);
  `Drizzle.DurableObject` goes in the inner Effect (it needs the instance's storage). Swapping them fails.
- **Paths** are relative to the directory the Alchemy command runs in, not to the module. SQL folders are not
  watched by `alchemy dev`; restart after editing SQL.
- **Migrations are lazy and per object.** A deploy migrates no object; each one migrates when it next wakes. Never
  edit an applied file: history is hash-checked and forward-only (`MigrationHistoryConflictError`).
- **Engines are one-way.** Moving from Drizzle's `migrations.js` (`__drizzle_migrations`) to `SqlMigrations`
  (`__alchemy_migrations`) copies matching history once; do not go back.
- **A transaction covers one object.** D1, R2, other objects and HTTP calls are outside it. Keep transaction work on
  the fiber that opened it; Alchemy's storage rejects use from a sibling fiber.
- **drizzle-kit does not write the hard SQL.** FTS5 virtual tables and triggers are hand-written `migration.sql`
  files in their own `<timestamp>_<name>/` directory; queries on them go through Drizzle's `sql` template.
- **Do not point it at the domain library's objects.** Their storage is the library's (key-value), and a table
  of yours in the same object is outside the library's contract.

## In this app

**How the domain host stores things today.** `packages/domain/src/DurableObjects.ts` uses only the key-value calls
`state.storage.get/put/delete/list/transaction`. A command's commit puts the events under `event:<seq>`, the state
under `"meta"` and the reply under `receipt:<commandId>` in one `storage.transaction` (beta.87 lines 829-838; main
956-974); the generic store the backfill and outbox use is the same calls (beta.87 531-555; main 543-567). No line
at either ref touches `storage.sql`. So Drizzle would describe only objects the app declares itself, and the
library's aggregates would not change.

**Candidates, against `apps/inventory/migrations/0001_init.sql`:**

| Object (named by) | Tables in it | What it replaces in D1 | Gained | Lost |
| --- | --- | --- | --- | --- |
| Allowance, per organization | `modelCall` | `modelCall` (405-420); `AllowanceStore.take` in `packages/access/host/src/AllowanceStore.adapter.ts` | The count-then-insert becomes a plain transaction instead of an `INSERT ... WHERE (SELECT COUNT(*))`; no `organizationId` column | The foreign key to `member` (stays in D1); one query for all organizations' usage |
| Catalog, per organization | `item`, `itemSearch` (FTS5) and its three triggers, `importDraft`, `importChunk`, `importDecision`, `importSuggestion`, `importBatch`, `importReplaced`, `importOutcome`, `importChange` | The whole catalog part of the file (115-402, 440-470) | Confirm and take-back become one transaction with reads in the middle; composite tenant keys and the `organizationId = ?` in every statement disappear | Search and paging across organizations; the audit line in `activity` and the `member` foreign keys are in D1, so confirm is no longer one atomic write with its audit line; one object holds every item of the organization |
| Import, per import | `importChunk`, `importDecision`, `importSuggestion` (staged rows and decisions) | Those three tables | `decide` can read the revision and write the decision in one transaction | Confirm reads from the object and writes items to D1: two stores, so "a confirm of an import no longer open writes nothing" needs `importDraft` to stay in D1 as the guard |
| Store behind a projection's port | The items read model, fed by the import aggregate's events | `item`, `itemSearch` | Fits the domain library: the aggregate's commit is the atomic write and the read model is rebuilt from events (see [projection](./projection.md)) | Only once the import lives on an [aggregate](./aggregate.md); the read model is then eventually consistent |

**The earlier objection, and whether it stands.** `explorations/ideal-architecture/DECISIONS.md` ("D1 driver") left
Drizzle because every write that matters is an atomic `D1Client.batch`, and `drizzle-orm/effect-d1` has no batch
and its transactions are refused. That is still true on D1: Drizzle's Effect SQLite database has `run`, `all`,
`get`, `values` and `transaction` but no `batch`, and its D1 `transaction` calls `D1Client.withTransaction`, which
dies with "transactions are not supported in D1" (`effect` `packages/sql/d1/src/D1Client.ts` 340, the app's installed `@effect/sql-d1@4.1.4`). Inside a
Durable Object it does not apply: `db.transaction` is a native storage transaction. The other half of the objection
stands everywhere: FTS5, its triggers and `COLLATE NOCASE` ordering stay hand-written SQL, and Drizzle tables are a
second schema language beside the `Model.Class` rows. `drizzle-orm/effect-schema` (`createSelectSchema`, Effect 4
schemas) can derive Effect Schemas from tables, but that runs table to schema, the opposite of the app's
schema-first rule. In a per-organization object the composite `(organizationId, ...)` keys mostly go away, which
removes part of the "hard SQL".

Worked example, the first table to move: the model-call allowance. `AllowanceStore.take(reservation)` keeps its
port (`packages/access/model/src/Allowance/AllowanceStore.store.ts`); a new adapter calls
`allowance.getByName(reservation.organization).take({...})` on the `AllowanceObject` above, whose transaction counts
the organization's calls since `reservation.since` (24 hours before now: the app's window rolls,
`packages/access/model/src/Allowance/Allowance.rules.ts:16`) and inserts one only under 40. Nothing else writes `modelCall`
(it appears only in that adapter, its contract gateway, the migration and `Tenancy.slow.test.ts`), so no D1 batch
loses a member.

- **Used today:** no. Every table is in D1 behind ports, written through `@beep/d1` (`packages/drivers/d1/src/D1.service.ts`).
- **Where it goes:** a new `AllowanceStore` adapter in `packages/access/host/src/`, an object class and its
  `drizzle/` folder beside it, and `modelCall` removed from `apps/inventory/migrations/0001_init.sql` (with the
  `Tenancy.slow.test.ts` expectation for it).
- **What the person gets:** nothing they can see; the 40-a-day rule holds as before.

**One decision, two routes.** [cluster](./cluster.md) proposes the same move, the allowance into one Durable Object
per organization behind `AllowanceStore`, as an Effect Cluster entity on `ClusterCloudflare.DurableObjectPool` with
the call times in `InstanceStorage`. Both need the same second, Effect-native Worker beside the app's (see "What it
needs"). This route brings a SQL table, committed migrations and a typed query, and no cluster; the entity brings the
cluster's pool Worker, its per-minute Cron Trigger and its alarms, and keeps the count as key-value data. The
allowance goes on one of them, not both. If it goes on the entity, the next table to move here is the per-import
staging row in the table above, with the guard it needs.

## How to check it

- A slow test against the object: 41 `take` calls for one organization answer 40 `true` and one `false`; a second
  organization's object still answers `true` (rule 9 and rule 6 of the app).
- Two `take` calls started together for the 40th call: exactly one is `true` (the transaction, not the count, is
  what is being tested).
- A deploy test in the shape of `examples/cloudflare-durable-object-sql/test/integ.test.ts` (deploy, call two named
  objects, check isolation, destroy).
- After a schema change: wake an object made by the previous version and read `__alchemy_migrations`; the new file
  is there once.

## What it needs

- The Cloudflare host: an Effect-native `Cloudflare.DurableObject` class hosted by an Effect-native Worker, so that
  `DurableObjectState` exists (`Drizzle.DurableObject` yields it, `packages/drizzle/src/Cloudflare.ts:113`; see
  [host-cloudflare](./host-cloudflare.md)). The app's Worker cannot host one: it is built by `Cloudflare.Website.Vite`
  (`packages/infra/src/Inventory.stack.ts:102`), whose Vite build bundles `apps/inventory/src/server/worker.ts` as it
  is, while the bridge classes an Effect-native Durable Object needs are written only into the generated entry of an
  Effect-native Worker (`makeEffectVirtualEntry`, `packages/cloudflare/src/Workers/Sources/Rolldown.ts:190-240`; the
  Vite source, `Workers/Sources/Vite.ts:329-387`, never calls it; see [cluster](./cluster.md), "Why a second Worker").
  So the object lives on a second, Effect-native `Cloudflare.Worker` (the same one [cluster](./cluster.md) and
  [cluster-workflows](./cluster-workflows.md) add), which the app's Worker reaches by a service binding in its
  `Website.Vite` `env`. An async Worker can also bind another Worker's object by `scriptName`
  (`packages/cloudflare/src/Workers/DurableObject.ts:54`, docs `cloudflare/compute/cross-worker-durable-object.mdx`);
  calling an Effect-native object's methods from the app's plain Worker that way was not verified.
- `@alchemy.run/drizzle@2.0.0-beta.87` (published), `drizzle-orm` and `drizzle-kit` `1.0.0-rc.5`,
  `@effect/sql-sqlite-do` `^4.1.4`, `@alchemy.run/cloudflare@2.0.0-beta.87`. Nothing from main.
- Not `@alchemy.run/domain`: the allowance and catalog candidates work without it; the projection-store candidate
  needs it.
- Nothing on this page was run: the trials of 2026-11-19 ran no Durable Object, Drizzle query or deploy.

## Verdict

**Use:** declare a per-organization `AllowanceObject` with `Cloudflare.SqlMigrations` and `Drizzle.DurableObject` on a
second, Effect-native `Cloudflare.Worker` reached from the app's `Website.Vite` Worker by a service binding, move
`modelCall` into it behind the existing `AllowanceStore` port, and keep everything else in D1. This works on beta.87.
It is the same decision as the cluster entity for the allowance ([cluster](./cluster.md)): pick one. Move `item` and
`itemSearch` only when the items list becomes a projection of an import aggregate, because moving them alone splits
the confirm across two stores.

## Where this was read

- https://alchemy.run/providers/drizzle/durableobject.md (the address without a slash answers a redirect; with a
  slash, the HTML page; the live site documents beta.87), and the siblings `/providers/drizzle/{d1,schema,libsql,
  mysql,postgres}.md`
- `packages/drizzle/src/{Cloudflare,D1,index,Providers,Schema,LibSQL,MySQL,Postgres}.ts` and
  `packages/drizzle/package.json` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/sql/drizzle/migrations.mdx`, `sql/databases.mdx`, `cloudflare/data/d1-drizzle.mdx`,
  `cloudflare/data/drizzle.mdx`, `better-auth/databases/drizzle.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `website/src/content/docs/cloudflare/compute/durable-objects.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed
  (callbacks only)
- `website/src/content/docs/cloudflare/frontend/full-stack-tanstack-rpc-drizzle.mdx` (Drizzle parts) at
  `v2.0.0-beta.87`; on `main@dbfd0ddb`: same
- `packages/domain/src/DurableObjects.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: changed (line numbers move;
  still key-value only)
- `packages/cloudflare/src/Workers/{SqlMigrations,SqlMigrationsApply,DurableObjectState}.ts`,
  `packages/sql/src/Migrations/{Embedded,Detect}.ts`: on `main@dbfd0ddb` only (not in the beta.87 export)
- `examples/cloudflare-durable-object-sql`, `examples/cloudflare-d1-drizzle`,
  `examples/cloudflare-tanstack-rpc-drizzle`: on `main@dbfd0ddb` only
- `effect` `packages/sql/sqlite-do/src/SqliteClient.ts` and `packages/sql/d1/src/D1Client.ts` at 4.1.4
