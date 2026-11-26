// Tenancy held by SQL itself, under the application's checks: every table of customer data has organizationId, its
// indexes start with it, and it names its parent by (organizationId, id), so a row of one organization that points at
// another organization's member, import, confirm or item is refused by the database, whatever a handler forgot.
// Checked against the real migration with statements written by hand, the way a bug in a service would write them.
// A new table joins the first test by itself: it reads the schema, not a list.
import * as D1Client from "@effect/sql-d1/D1Client"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import * as S from "effect/Schema"
import type * as SqlError from "effect/sql/SqlError"
import * as SqlSchema from "effect/sql/SqlSchema"
import { TestDatabase } from "./support/app.ts"

const at = "2026-11-17T00:00:00.000Z"

/** Runs a statement that must be refused, and says how the database refused it. */
const refused = <A, R>(statement: Effect.Effect<A, SqlError.SqlError, R>) =>
  Effect.map(Effect.flip(statement), (error) => `${error.reason._tag}: ${String(error.reason.cause)}`)

// Tables that are not one organization's data: the tenants themselves, Better Auth's own, and the search index's
// shadow tables (the index rows carry organizationId and are only ever queried with it).
const notTenantData = ["organization", "user", "session", "account", "verification", "invitation", "rateLimit"]
// The one index of a tenant table that does not start with organizationId: Better Auth finds a person's memberships
// before any organization is known (migrations/0001_init.sql, part 2).
const crossTenantIndexes = ["member_userId_idx"]

layer(TestDatabase)("tenancy in the database", (it) => {
  it.effect("every table of customer data has organizationId, and every index on one starts with it", () =>
    Effect.gen(function* () {
      const sql = yield* D1Client.D1Client
      const tables = yield* SqlSchema.findAll({
        Request: S.Void,
        Result: S.Struct({ name: S.String }),
        execute: () => sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
          AND name NOT LIKE '_cf_%' AND name NOT LIKE 'd1_%' AND name NOT LIKE 'itemSearch%' ORDER BY name`
      })(undefined)
      const tenant = A.filter(tables, (table) => !A.contains(notTenantData, table.name))
      expect(A.map(tenant, (table) => table.name)).toEqual([
        "activity",
        "importBatch",
        "importChange",
        "importChunk",
        "importDecision",
        "importDraft",
        "importOutcome",
        "importReplaced",
        "importSuggestion",
        "importUpload",
        "importUploadChunk",
        "importWriteList",
        "item",
        "member",
        "modelCall"
      ])
      for (const table of tenant) {
        const columns = yield* SqlSchema.findAll({
          Request: S.String,
          Result: S.Struct({ name: S.String }),
          execute: (name) => sql`SELECT name FROM pragma_table_info(${name})`
        })(table.name)
        expect([table.name, A.some(columns, (column) => column.name === "organizationId")]).toEqual([table.name, true])
        const indexes = yield* SqlSchema.findAll({
          Request: S.String,
          Result: S.Struct({ name: S.String }),
          execute: (name) => sql`SELECT name FROM pragma_index_list(${name})`
        })(table.name)
        for (const index of indexes) {
          if (A.contains(crossTenantIndexes, index.name)) continue
          const first = yield* SqlSchema.findAll({
            Request: S.String,
            Result: S.Struct({ name: S.NullOr(S.String) }),
            execute: (name) => sql`SELECT name FROM pragma_index_info(${name}) WHERE seqno = 0`
          })(index.name)
          // A table's own primary key on `id` alone (member) is the plugin's; every other key starts with the tenant.
          const leads = A.map(first, (column) => column.name)
          if (table.name === "member" && Str.startsWith("sqlite_autoindex_member_1")(index.name)) continue
          expect([table.name, index.name, leads]).toEqual([table.name, index.name, ["organizationId"]])
        }
      }
    })
  )

  it.effect("refuses a row that points at another organization's member, import, confirm or item", () =>
    Effect.gen(function* () {
      const sql = yield* D1Client.D1Client
      // Example Works' own rows: an import by its admin, one confirm of it, and one item it created.
      yield* sql`INSERT INTO importDraft (id, organizationId, actorId, actorName, fileName, headJson, rowCount, status,
          createdAt)
        VALUES ('imp_p', 'org_prairie', 'mem_dana', 'Dana Whitfield', 'items.csv', '{}', 1, 'imported', ${at})`
      yield* sql`INSERT INTO importBatch (id, organizationId, importId, confirmedById, confirmedByName, confirmedAt)
        VALUES ('bat_p', 'org_prairie', 'imp_p', 'mem_dana', 'Dana Whitfield', ${at})`
      const item = (id: string, org: string, by: string) =>
        sql`INSERT INTO item (id, organizationId, sku, skuKey, name, category, uom, unitCost, importId, batchId,
            sourceRow, createdById, createdBy, createdAt)
          VALUES (${id}, ${org}, 'XXX-0001', 'XXX-0001', 'Bracket', 'components', 'EA', '1.5', 'imp_p', 'bat_p', 2,
            ${by}, 'Someone', ${at})`

      // Sample Supply writing as Example Works' admin, onto Example Works' import, or with Example Works' confirm: each one refused.
      const errors = [
        yield* refused(
          sql`INSERT INTO activity (id, organizationId, actorId, actorName, action, detail, createdAt)
            VALUES ('00000000-0000-4000-8000-0000000000aa', 'org_northline', 'mem_dana', 'Dana Whitfield', 'Imported items', '', ${at})`
        ),
        yield* refused(
          sql`INSERT INTO importDecision (organizationId, importId, rowId, decisionJson, decidedById, decidedByName,
              updatedAt)
            VALUES ('org_northline', 'imp_p', 'row-2', '{}', 'mem_tom', 'Tom Becker', ${at})`
        ),
        yield* refused(item("rec_n", "org_northline", "mem_tom")),
        yield* refused(
          sql`INSERT INTO importOutcome (organizationId, importId, rowNumber, sku, name, outcome, reason)
            VALUES ('org_northline', 'imp_p', 2, 'XXX-0001', 'Bracket', 'created', '')`
        ),
        yield* refused(
          sql`INSERT INTO importChange (organizationId, importId, batchId, rowNumber, sku, field, fromValue, toValue,
              source, decidedBy, how, createdAt)
            VALUES ('org_northline', 'imp_p', 'bat_p', 2, 'XXX-0001', 'uom', 'ea', 'EA', 'rule', 'person',
              'accepted a proposal', ${at})`
        ),
        yield* refused(
          sql`INSERT INTO modelCall (id, organizationId, actorId, kind, createdAt)
            VALUES ('call_n', 'org_northline', 'mem_dana', 'view', ${at})`
        )
      ]
      for (const error of errors) expect(error).toContain("FOREIGN KEY constraint failed")

      // The same rows inside one organization are accepted: the keys refuse the crossing, not the write. One SKU
      // per organization: a second item with the same SKU key is refused too.
      yield* item("rec_p", "org_prairie", "mem_dana")
      const twice = yield* refused(item("rec_p2", "org_prairie", "mem_dana"))
      expect(twice).toContain("UNIQUE constraint failed")
      const found = yield* sql<{
        readonly n: number
      }>`SELECT COUNT(*) AS n FROM item WHERE organizationId = 'org_northline'`
      expect(found[0]?.n).toBe(0)
      // The search index names each row's organization, and is queried with it.
      const indexed = yield* sql<{ readonly n: number }>`SELECT COUNT(*) AS n FROM itemSearch
        WHERE itemSearch MATCH 'bracket' AND organizationId = 'org_northline'`
      expect(indexed[0]?.n).toBe(0)
    })
  )
})
