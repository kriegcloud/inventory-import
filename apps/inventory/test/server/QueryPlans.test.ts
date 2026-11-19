// @effect-diagnostics nodeBuiltinImport:off
import { DatabaseSync } from "node:sqlite"
import { expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"

// The statements whose speed depends on an index, asked of SQLite's own planner on the real migrations (the same
// engine D1 runs). A page of items in its default order is read off `item_org_sku` in both directions, with no
// sort; removing an import finds its changes by `importChange_import`; and the item index changes no other plan,
// since without statistics SQLite may pick any index that starts with organizationId for a scan it does not suit.

const migrations = import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true })

const PlanRow = S.Struct({ detail: S.String })

const columns = "id, sku, name, category, uom, unitCost, quantityOnHand, createdAt, createdBy, revision"

const planOf = (db: DatabaseSync, query: string) =>
  S.decodeUnknownEffect(S.Array(PlanRow))(db.prepare(`EXPLAIN QUERY PLAN ${query}`).all()).pipe(
    Effect.map((rows) =>
      A.join(
        A.map(rows, (row) => row.detail),
        "; "
      )
    )
  )

it.effect("a page by SKU, either way, and an import's changes are read off an index", () =>
  Effect.gen(function* () {
    const db = new DatabaseSync(":memory:")
    for (const file of A.sort(R.keys(migrations), Order.String)) {
      db.exec(O.getOrElse(R.get(migrations, file), () => ""))
    }
    for (const direction of ["ASC", "DESC"]) {
      const page = yield* planOf(
        db,
        `SELECT ${columns} FROM item WHERE organizationId = 'org' ORDER BY sku COLLATE NOCASE ${direction}, id ${direction} LIMIT 10 OFFSET 20`
      )
      expect(page, direction).toContain("USING INDEX item_org_sku")
      expect(page, direction).not.toContain("TEMP B-TREE")
    }
    const changes = yield* planOf(db, "DELETE FROM importChange WHERE organizationId = 'org' AND importId = 'imp'")
    expect(changes).toContain("importChange_import (organizationId=? AND importId=?)")

    // The scans that read every item of the organization keep the index they had.
    for (const scan of [
      "SELECT COUNT(*) AS n FROM item WHERE organizationId = 'org'",
      "SELECT uom AS value, COUNT(*) AS n FROM item WHERE organizationId = 'org' GROUP BY uom ORDER BY uom",
      "SELECT COUNT(*), MIN(quantityOnHand), MAX(quantityOnHand), MIN(CAST(unitCost AS REAL)), MAX(CAST(unitCost AS REAL)) FROM item WHERE organizationId = 'org'",
      `SELECT ${columns} FROM item WHERE organizationId = 'org' ORDER BY name COLLATE NOCASE ASC, id ASC LIMIT 10`
    ]) {
      const plan = yield* planOf(db, scan)
      expect(plan, scan).not.toContain("item_org_sku")
    }
  })
)
