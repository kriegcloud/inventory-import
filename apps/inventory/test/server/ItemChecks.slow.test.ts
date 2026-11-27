// What the item table itself refuses, whoever writes to it: a cost that is not digits with up to four decimals and
// twelve whole digits, in an item or in the copy a replace keeps; a SKU not in the contract's form; and a key that is
// not its SKU's key, which would let "one item per SKU" compare something the import never compared. SQLite's `upper`
// knows only ASCII, so the table holds the SKU's form itself, where the key is the SKU, rather than redoing the key
// (Unicode spaces and case) in SQL. On a fresh D1, with the migrations applied.
import { expect, layer } from "@effect/vitest"
import { decimalPattern, ItemFields, skuPattern, UnitCost } from "@inventory/catalog-contract/Item"
import { skuKey } from "@inventory/catalog-contract/SkuKey"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as SqlClient from "effect/sql/SqlClient"
import type * as SqlError from "effect/sql/SqlError"
import { TestDatabase } from "./support/app.ts"

const runs = { arbitrary: { runs: 40 } }

/** A cost as the contract writes it, or any text at all. */
const CostText = S.Union([S.toEncoded(UnitCost), S.String])
/**
 * A SKU as an item has it; one in lower case or with spaces in it, the key of which is still in the SKU's form; or any
 * text at all, Unicode spaces and letters included.
 */
const SkuText = S.Union([
  ItemFields.fields.sku,
  S.String.check(S.isPattern(/^[A-Za-z]{3}[ \t\u00A0\u2003\u3000]?-[0-9]{4}[ \n\u00A0\uFEFF]?$/)),
  S.String
])
/** A key: the SKU's own, the SKU as it is written, or any text. */
const KeyChoice = S.Struct({ of: S.Literals(["own", "written", "other"]), other: S.String })

// The rows an item points at: a seeded member of a seeded organization (seeds/organizations.sql), and one import and
// its confirm, made once and kept.
const parents = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`INSERT OR IGNORE INTO importDraft (id, organizationId, actorId, actorName, fileName, headJson, rowCount,
      status, createdAt)
    VALUES ('imp_checks', 'org_prairie', 'mem_dana', 'Dana Whitfield', 'checks.csv', '{}', 1, 'imported',
      '2026-11-23T00:00:00.000Z')`
  yield* sql`INSERT OR IGNORE INTO importBatch (id, organizationId, importId, confirmedById, confirmedByName,
      confirmedAt)
    VALUES ('bat_checks', 'org_prairie', 'imp_checks', 'mem_dana', 'Dana Whitfield', '2026-11-23T00:00:00.000Z')`
  return sql
})

/** Whether D1 says a CHECK of the table refused the row: the only failure these properties count as a refusal. */
const refusedByCheck = (error: SqlError.SqlError) => Str.includes("CHECK constraint failed")(String(error.reason.cause))

/**
 * Runs one write and says whether the table took it: `false` when a CHECK refused the row. Any other failure says
 * nothing about the row (once, in `bun run check:full` on a loaded machine, a copy with a valid cost failed and the
 * same input passed on replay), so the write is tried again, twice at most, and a failure that stays fails the test
 * with D1's own words, never as a refusal.
 */
const held = <R>(write: Effect.Effect<unknown, SqlError.SqlError, R>) =>
  write.pipe(
    Effect.retry({ times: 2, while: (error) => !refusedByCheck(error) }),
    Effect.as(true),
    Effect.catchIf(refusedByCheck, () => Effect.succeed(false)),
    Effect.orDie
  )

/** Writes one item and says whether the table took it. */
const writeItem = (
  sql: SqlClient.SqlClient,
  item: { readonly sku: string; readonly key: string; readonly cost: string }
) =>
  held(sql`INSERT INTO item (id, organizationId, sku, skuKey, name, category, uom, unitCost,
        importId, batchId, sourceRow, createdById, createdBy, createdAt)
      VALUES ('itm_checks', 'org_prairie', ${item.sku}, ${item.key}, 'Checked item', 'supplies', 'EA', ${item.cost},
        'imp_checks', 'bat_checks', 1, 'mem_dana', 'Dana Whitfield', '2026-11-23T00:00:00.000Z')`)

/**
 * Takes the item away again, with any copy of it, however the run ended: a run that fails must leave nothing behind,
 * or each shrink after it meets the item it left and fails for that instead.
 */
const removeItem = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`DELETE FROM item WHERE organizationId = 'org_prairie' AND id = 'itm_checks'`
}).pipe(Effect.orDie)

layer(TestDatabase, { timeout: "60 seconds" })("the item table's own checks", (it) => {
  it.effect.prop(
    "an item is held only with a SKU in the contract's form and the key of its own SKU",
    [Arbitrary.schema(SkuText), Arbitrary.schema(KeyChoice), UnitCost.pipe(S.toEncoded, Arbitrary.schema)],
    ([sku, key, cost]) =>
      Effect.gen(function* () {
        const sql = yield* parents
        const own = skuKey({ sku })
        const given = key.of === "own" ? own : key.of === "written" ? sku : key.other
        const written = yield* writeItem(sql, { sku, key: given, cost })
        expect(written).toBe(skuPattern.test(sku) && given === own)
      }).pipe(Effect.ensuring(removeItem)),
    runs
  )

  it.effect.prop(
    "an item is held only with a cost of digits, up to four decimals and twelve whole digits",
    [Arbitrary.schema(ItemFields.fields.sku), Arbitrary.schema(CostText)],
    ([sku, cost]) =>
      Effect.gen(function* () {
        const sql = yield* parents
        const written = yield* writeItem(sql, { sku, key: skuKey({ sku }), cost })
        expect(written).toBe(decimalPattern.test(cost))
      }).pipe(Effect.ensuring(removeItem)),
    runs
  )

  it.effect.prop(
    "a replace keeps a copy only with a cost the item table could hold",
    [Arbitrary.schema(ItemFields.fields.sku), UnitCost.pipe(S.toEncoded, Arbitrary.schema), Arbitrary.schema(CostText)],
    ([sku, cost, kept]) =>
      Effect.gen(function* () {
        const sql = yield* parents
        const itemHeld = yield* writeItem(sql, { sku, key: skuKey({ sku }), cost })
        expect(itemHeld).toBe(true)
        const copied = yield* held(sql`INSERT INTO importReplaced (organizationId, importId, batchId, itemId,
            sourceRow, name, category, uom, unitCost, quantityOnHand, isActive, lotTracked, tags, vendors, revision,
            revisionAfter)
          VALUES ('org_prairie', 'imp_checks', 'bat_checks', 'itm_checks', 1, 'Checked item', 'supplies', 'EA',
            ${kept}, 0, 1, 0, '[]', '[]', 1, 2)`)
        expect(copied).toBe(decimalPattern.test(kept))
      }).pipe(Effect.ensuring(removeItem)),
    runs
  )
})
