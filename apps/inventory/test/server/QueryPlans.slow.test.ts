import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import { TestDatabase } from "./support/app.ts"

// The statements whose speed depends on an index, asked of SQLite's own planner on the real migrations, in D1 itself.
// A page of items in its default order is read off `item_org_sku` in both directions, with no sort; removing an
// import finds its changes by `importChange_import`; and the item index changes no other plan, since without
// statistics SQLite may pick any index that starts with organizationId for a scan it does not suit.

const PlanRow = S.Struct({ detail: S.String })
const decodePlan = S.decodeUnknownEffect(S.Array(PlanRow))

const columns = "id, sku, name, category, uom, unitCost, quantityOnHand, createdAt, createdBy, revision"

/** The planner's steps for `query`, joined in order. */
const planOf = Effect.fnUntraced(function* (query: string) {
  const sql = yield* SqlClient.SqlClient
  const rows = yield* sql.unsafe(`EXPLAIN QUERY PLAN ${query}`)
  const plan = yield* decodePlan(rows)
  return A.join(
    A.map(plan, (row) => row.detail),
    "; "
  )
})

layer(TestDatabase, { timeout: "60 seconds" })("the planner on the migrations", (it) => {
  it.effect("a page by SKU, either way, and an import's changes are read off an index", () =>
    Effect.gen(function* () {
      for (const direction of ["ASC", "DESC"]) {
        const page = yield* planOf(
          `SELECT ${columns} FROM item WHERE organizationId = 'org' ORDER BY sku COLLATE NOCASE ${direction}, id ${direction} LIMIT 10 OFFSET 20`
        )
        expect(page, direction).toContain("USING INDEX item_org_sku")
        expect(page, direction).not.toContain("TEMP B-TREE")
      }
      const changes = yield* planOf("DELETE FROM importChange WHERE organizationId = 'org' AND importId = 'imp'")
      expect(changes).toContain("importChange_import (organizationId=? AND importId=?)")

      // The scans that read every item of the organization keep the index they had.
      for (const scan of [
        "SELECT COUNT(*) AS n FROM item WHERE organizationId = 'org'",
        "SELECT uom AS value, COUNT(*) AS n FROM item WHERE organizationId = 'org' GROUP BY uom ORDER BY uom",
        "SELECT COUNT(*), MIN(quantityOnHand), MAX(quantityOnHand), MIN(CAST(unitCost AS REAL)), MAX(CAST(unitCost AS REAL)) FROM item WHERE organizationId = 'org'",
        `SELECT ${columns} FROM item WHERE organizationId = 'org' ORDER BY name COLLATE NOCASE ASC, id ASC LIMIT 10`
      ]) {
        const plan = yield* planOf(scan)
        expect(plan, scan).not.toContain("item_org_sku")
      }
    })
  )
})
