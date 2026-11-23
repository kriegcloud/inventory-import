// @effect-diagnostics nodeBuiltinImport:off
import { getMigrations } from "better-auth/db/migration"
import { DatabaseSync } from "node:sqlite"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { describe, expect, it } from "@effect/vitest"
import { authOptions } from "@inventory/access-host/AuthOptions"

// The migrations give Better Auth every table and column its configuration needs. Adding a plugin (or a field) to
// the sign-in options (@inventory/access-host) without a migration fails here, and so does a new Better Auth that
// wants a table or a column the migrations do not make: `better-auth` is held (`.syncpackrc.json`) and moved by hand,
// and this is what says a move needs a migration. `bun run auth:schema` prints the SQL to add. In the loop check: an
// in-memory SQLite database, a dummy secret, no network, half a second.

const migrations = import.meta.glob<string>("../../migrations/*.sql", { query: "?raw", import: "default", eager: true })

describe("the Better Auth schema", () => {
  it.effect("is fully created by migrations/", () => {
    const db = new DatabaseSync(":memory:")
    for (const file of A.sort(R.keys(migrations), Order.String)) db.exec(O.getOrElse(R.get(migrations, file), () => ""))
    const options = authOptions({ database: db, secret: Str.repeat(32)("x") })
    return Effect.map(
      Effect.promise(() => getMigrations(options, { throwOnUnsafe: false })),
      (plan) => {
        expect(A.map(plan.toBeCreated, (change) => change.table)).toEqual([])
        expect(A.map(plan.toBeAdded, (change) => `${change.table}: ${A.join(R.keys(change.fields), ", ")}`)).toEqual([])
        expect(A.map(plan.toBeAddedIndexes, (change) => change.name)).toEqual([])
      }
    )
  })
})
