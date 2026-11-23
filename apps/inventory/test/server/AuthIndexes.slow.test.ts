import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import { TestDatabase } from "./support/app.ts"

// Every lookup Better Auth's performance guide names goes through an index: SQLite's own planner, asked about each
// query on the real migrations, in D1 itself. A `SCAN` of the table would mean a missing index.

const PlanRow = S.Struct({ detail: S.String })
const decodePlan = S.decodeUnknownEffect(S.Array(PlanRow))

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

layer(TestDatabase, { timeout: "60 seconds" })("the sign-in tables", (it) => {
  it.effect("search every column the performance guide names by an index", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      for (const query of lookups) {
        const rows = yield* sql.unsafe(`EXPLAIN QUERY PLAN ${query}`, ["x"])
        const steps = yield* decodePlan(rows)
        const plan = A.join(
          A.map(steps, (row) => row.detail),
          "; "
        )
        expect(plan, query).toMatch(/USING (COVERING )?INDEX/)
        expect(plan, query).not.toMatch(/^SCAN/)
      }
    })
  )
})
