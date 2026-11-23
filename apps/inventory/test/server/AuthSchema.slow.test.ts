import { D1Binding } from "@beep/d1/D1"
import { getMigrations } from "better-auth/db/migration"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { expect, layer } from "@effect/vitest"
import { authOptions } from "@inventory/access-host/AuthOptions"
import { TestDatabase } from "./support/app.ts"

// The migrations give Better Auth every table and column its configuration needs. Adding a plugin (or a field) to
// the sign-in options (@inventory/access-host) without a migration fails here, and so does a new Better Auth that
// wants a table or a column the migrations do not make: `better-auth` is held (`.syncpackrc.json`) and moved by hand,
// and this is what says a move needs a migration. `bun run auth:schema` prints the SQL to add. On D1 itself, with the
// migrations applied, a dummy secret and no network.

layer(TestDatabase, { timeout: "60 seconds" })("the Better Auth schema", (it) => {
  it.effect("is fully created by migrations/", () =>
    Effect.gen(function* () {
      const database = yield* D1Binding
      const options = authOptions({ database, secret: Str.repeat(32)("x") })
      const plan = yield* Effect.promise(() => getMigrations(options, { throwOnUnsafe: false }))
      expect(A.map(plan.toBeCreated, (change) => change.table)).toEqual([])
      expect(A.map(plan.toBeAdded, (change) => `${change.table}: ${A.join(R.keys(change.fields), ", ")}`)).toEqual([])
      expect(A.map(plan.toBeAddedIndexes, (change) => change.name)).toEqual([])
    })
  )
})
