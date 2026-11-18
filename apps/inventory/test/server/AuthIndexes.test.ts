// @effect-diagnostics nodeBuiltinImport:off
import { DatabaseSync } from "node:sqlite"
import { expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option, Order, Record as Rec } from "effect"
import * as S from "effect/Schema"

// Every lookup Better Auth's performance guide names goes through an index: SQLite's own planner, asked about each
// query on the real migrations (the same engine D1 runs). A `SCAN` of the table would mean a missing index.

const migrations = import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true })

const PlanRow = S.Struct({ detail: S.String })

/** The lookups the guide asks to index, as Better Auth sends them. */
const lookups = [
  `SELECT * FROM "user" WHERE email = ?`,
  `SELECT * FROM account WHERE userId = ?`,
  `SELECT * FROM session WHERE userId = ?`,
  `SELECT * FROM session WHERE token = ?`,
  `SELECT * FROM verification WHERE identifier = ?`,
  `SELECT * FROM invitation WHERE email = ?`,
  `SELECT * FROM invitation WHERE organizationId = ?`,
  `SELECT * FROM member WHERE userId = ?`,
  `SELECT * FROM member WHERE organizationId = ?`,
  `SELECT * FROM organization WHERE slug = ?`
]

it.effect("the sign-in tables search every column the performance guide names by an index", () =>
  Effect.gen(function* () {
    const db = new DatabaseSync(":memory:")
    for (const file of Arr.sort(Rec.keys(migrations), Order.String)) {
      db.exec(Option.getOrElse(Rec.get(migrations, file), () => ""))
    }
    for (const query of lookups) {
      const rows = yield* S.decodeUnknownEffect(S.Array(PlanRow))(db.prepare(`EXPLAIN QUERY PLAN ${query}`).all("x"))
      const plan = Arr.join(
        Arr.map(rows, (row) => row.detail),
        "; "
      )
      expect(plan, query).toMatch(/USING (COVERING )?INDEX/)
      expect(plan, query).not.toMatch(/^SCAN/)
    }
  })
)
