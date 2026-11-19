// @effect-diagnostics nodeBuiltinImport:off
import { getMigrations } from "better-auth/db/migration"
import { DatabaseSync } from "node:sqlite"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { describe, expect, it } from "vitest"
import { authOptions } from "@inventory/access-host/AuthOptions"

// The migrations give Better Auth every table and column its configuration needs. Adding a plugin (or a field) to
// the sign-in options (@inventory/access-host) without a migration fails here; `bun run auth:schema` prints the SQL to add.

const migrations = import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true })

describe("the Better Auth schema", () => {
  it("is fully created by migrations/", () => {
    const db = new DatabaseSync(":memory:")
    for (const file of A.sort(R.keys(migrations), Order.String)) db.exec(O.getOrElse(R.get(migrations, file), () => ""))
    const options = authOptions({ database: db, secret: Str.repeat(32)("x") })
    return getMigrations(options, { throwOnUnsafe: false }).then((plan) => {
      expect(A.map(plan.toBeCreated, (change) => change.table)).toEqual([])
      expect(A.map(plan.toBeAdded, (change) => `${change.table}: ${A.join(R.keys(change.fields), ", ")}`)).toEqual([])
      expect(A.map(plan.toBeAddedIndexes, (change) => change.name)).toEqual([])
    })
  })
})
