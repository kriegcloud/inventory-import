// The model Worker's D1 client (host-02) on a test database in workerd: `D1.layerFromClient` over Alchemy's
// `SQL.D1Layer`, given a bare Effect of the test's binding as a Worker would give it the bound database. What it holds:
// a statement passes its Schemas both ways, and a batch whose second statement fails writes neither row, so a port
// written against `D1` keeps its batch all or none on this Worker too. Each run is in a scope of its own, as each
// event of a Worker is: the client opens once per execution and is never reached outside one.
import { D1, D1Binding, NoRows } from "@beep/d1/D1"
import { D1Error } from "@beep/d1/D1Error"
import { D1Test, D1TestOptions } from "@beep/d1/D1Test"
import { describe, expect, layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import * as SqlSchema from "effect/sql/SqlSchema"
import { modelD1 } from "../src/Database.ts"

const TestDatabase = D1Test.layer(
  D1TestOptions.make({ migrations: new URL("./fixtures/migrations/", import.meta.url) })
)

/**
 * The Worker's client, on the test database's binding and nothing else of the test layer. The binding is read once,
 * when the Layer is built, as a Worker reads its own at its start: the client drops what its source requires, since
 * each execution of a Worker provides only the runtime's own services.
 */
const OnBinding = D1Binding.pipe(
  Effect.service,
  Effect.map((db) => modelD1(Effect.succeed(db))),
  Layer.unwrap,
  Layer.provide(TestDatabase)
)

const NoteId = S.String.check(S.isMinLength(1)).pipe(S.brand("NoteId"))
const Note = S.Struct({ id: NoteId, body: S.String })

const statements = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const insert = D1.statement({
    Request: Note,
    Result: NoRows,
    execute: (note) => sql`INSERT INTO note (id, body) VALUES (${note.id}, ${note.body})`
  })
  const all = SqlSchema.findAll({
    Request: S.Void,
    Result: Note,
    execute: () => sql`SELECT id, body FROM note ORDER BY id`
  })
  return { insert, all }
})

describe("the model Worker's D1 client", () => {
  layer(OnBinding)("on a test database", (it) => {
    it.effect(
      "writes a statement through its Schema and reads it back decoded",
      Effect.fnUntraced(function* () {
        const d1 = yield* D1
        const { insert, all } = yield* statements
        yield* d1.run(insert({ id: NoteId.make("one"), body: "First" }))
        const rows = yield* all(undefined)
        expect(rows).toEqual([{ id: "one", body: "First" }])
      }, Effect.scoped)
    )

    it.effect(
      "writes neither row of a batch whose second statement fails",
      Effect.fnUntraced(function* () {
        const d1 = yield* D1
        const { insert, all } = yield* statements
        const before = yield* all(undefined)
        const failed = yield* d1
          .batch([insert({ id: NoteId.make("two"), body: "Second" }), insert({ id: NoteId.make("three"), body: "" })])
          .pipe(Effect.flip)
        expect(S.is(D1Error)(failed)).toBe(true)
        const after = yield* all(undefined)
        expect(after).toEqual(before)
      }, Effect.scoped)
    )
  })
})
