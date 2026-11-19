// @effect-diagnostics nodeBuiltinImport:off
import { getMigrations } from "better-auth/db/migration"
import { DatabaseSync } from "node:sqlite"
import { Array as Arr, Option, Order, Record as Rec, String as Str } from "effect"
import { describe, expect, it } from "vitest"
import { authOptions } from "@inventory/access-host/AuthOptions"

// The migrations give Better Auth every table and column its configuration needs. Adding a plugin (or a field) to
// the sign-in options (@inventory/access-host) without a migration fails here; `bun run auth:schema` prints the SQL to add.

const migrations = import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true })

describe("the Better Auth schema", () => {
  it("is fully created by migrations/", () => {
    const db = new DatabaseSync(":memory:")
    for (const file of Arr.sort(Rec.keys(migrations), Order.String))
      db.exec(Option.getOrElse(Rec.get(migrations, file), () => ""))
    const options = authOptions({ database: db, secret: Str.repeat(32)("x") })
    return getMigrations(options, { throwOnUnsafe: false }).then((plan) => {
      expect(Arr.map(plan.toBeCreated, (change) => change.table)).toEqual([])
      expect(
        Arr.map(plan.toBeAdded, (change) => `${change.table}: ${Arr.join(Rec.keys(change.fields), ", ")}`)
      ).toEqual([])
      expect(Arr.map(plan.toBeAddedIndexes, (change) => change.name)).toEqual([])
    })
  })
})
