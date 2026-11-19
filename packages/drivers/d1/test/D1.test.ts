// The rules the driver protects: a statement's values pass through its request Schema and its rows through its
// result Schema, a write that answers rows when none were expected fails, and a batch lands whole or not at all.
import { describe, expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { SqlClient, SqlSchema } from "effect/sql"
import { D1, NoRows } from "@beep/d1/D1"
import { D1Test, D1TestOptions } from "@beep/d1/D1Test"

const fixtures = new URL("./fixtures/", import.meta.url)
const Database = D1Test.layer(
  D1TestOptions.make({
    migrations: new URL("migrations/", fixtures),
    seeds: [new URL("seeds/notes.sql", fixtures)]
  })
)

const NoteId = S.String.check(S.isMinLength(1)).pipe(S.brand("NoteId"))
const Note = S.Struct({ id: NoteId, body: S.String, tag: S.String })

layer(Database)("D1", (it) => {
  const sql = SqlClient.SqlClient.pipe(Effect.map((client) => client))

  const insert = Effect.map(sql, (client) =>
    D1.statement({
      Request: S.Struct({ id: NoteId, body: S.String }),
      Result: NoRows,
      execute: (r) => client`INSERT INTO note (id, body) VALUES (${r.id}, ${r.body})`
    })
  )
  const insertReturning = Effect.map(sql, (client) =>
    D1.statement({
      Request: S.Struct({ id: NoteId, body: S.String }),
      Result: NoRows,
      execute: (r) => client`INSERT INTO note (id, body) VALUES (${r.id}, ${r.body}) RETURNING id`
    })
  )
  const all = Effect.map(sql, (client) =>
    SqlSchema.findAll({
      Request: S.Void,
      Result: Note,
      execute: () => client`SELECT id, body, tag FROM note ORDER BY id`
    })
  )

  describe("migrations and seeds", () => {
    it.effect("applies migrations in file-name order, then the seeds", () =>
      Effect.gen(function* () {
        const rows = yield* (yield* all)(undefined)
        expect(rows).toEqual([{ id: "seeded", body: "From the seed", tag: "seed" }])
      })
    )
  })

  describe("run and batch", () => {
    it.effect("runs one statement and decodes its answer", () =>
      Effect.gen(function* () {
        const d1 = yield* D1
        const make = yield* insert
        const answer = yield* d1.run(make({ id: NoteId.make("one"), body: "First" }))
        expect(answer).toEqual([])
      })
    )

    it.effect("fails a write that answers rows when it was declared to answer none", () =>
      Effect.gen(function* () {
        const d1 = yield* D1
        const make = yield* insertReturning
        const error = yield* Effect.flip(d1.run(make({ id: NoteId.make("two"), body: "Second" })))
        expect(error).toMatchObject({ _tag: "D1Error", stage: "decode", statement: 0 })
      })
    )

    it.effect("lands a batch whole or not at all, and names the statement that failed", () =>
      Effect.gen(function* () {
        const d1 = yield* D1
        const make = yield* insert
        const before = (yield* (yield* all)(undefined)).length
        const error = yield* Effect.flip(
          d1.batch([make({ id: NoteId.make("three"), body: "Third" }), make({ id: NoteId.make("four"), body: "" })])
        )
        expect(error).toMatchObject({ _tag: "D1Error", stage: "execute" })
        const after = yield* (yield* all)(undefined)
        expect(after.length).toBe(before)
        expect(A.some(after, (row) => row.id === "three")).toBe(false)
      })
    )

    it.effect("refuses a request its Schema refuses before any SQL runs, naming its place in the batch", () =>
      Effect.gen(function* () {
        const d1 = yield* D1
        const make = yield* insert
        const error = yield* Effect.flip(
          d1.batch([
            make({ id: NoteId.make("five"), body: "Fifth" }),
            make({ id: "" as typeof NoteId.Type, body: "x" })
          ])
        )
        expect(error).toMatchObject({ _tag: "D1Error", stage: "encode", statement: 1 })
        const after = yield* (yield* all)(undefined)
        expect(A.some(after, (row) => row.id === "five")).toBe(false)
      })
    )
  })
})
