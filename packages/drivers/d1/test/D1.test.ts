// The rules the driver protects: a statement's values pass through its request Schema and its rows through its
// result Schema, a write that answers rows when none were expected fails, a batch lands whole or not at all, and each
// answer of a batch is the rows of its own statement decoded by that statement's own result Schema.
import { describe, expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as SqlClient from "effect/sql/SqlClient"
import * as Str from "effect/String"
import * as SqlSchema from "effect/sql/SqlSchema"
import { D1, NoRows } from "@beep/d1/D1"
import { D1Error } from "@beep/d1/D1Error"
import { D1Test, D1TestOptions } from "@beep/d1/D1Test"

const fixtures = new URL("./fixtures/", import.meta.url)
const Database = D1Test.layer(
  D1TestOptions.make({
    migrations: new URL("migrations/", fixtures),
    seeds: [new URL("seeds/notes.sql", fixtures)]
  })
)

const NoteId = S.String.check(S.isMinLength(1)).pipe(S.brand("NoteId"))
// A note's text as a statement binds it: at most 200 characters, so a request can be refused before any SQL runs.
const Body = S.String.check(S.isMaxLength(200))
const Note = S.Struct({ id: NoteId, body: S.String, tag: S.String })

/**
 * What a statement of a drawn batch does: a write that answers nothing, a write that answers the id it wrote, or a read
 * of how many of the batch's notes there are so far. Each answers through a result Schema of its own.
 */
const Step = S.Literals(["write", "returning", "count"])
type Step = typeof Step.Type

/** The tag the drawn batches write with, so a count reads only their notes, and each run can clear them. */
const batched = "batched"

layer(Database)("D1", (it) => {
  const sql = SqlClient.SqlClient.pipe(Effect.map((client) => client))

  const insert = Effect.map(sql, (client) =>
    D1.statement({
      Request: S.Struct({ id: NoteId, body: Body }),
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
        expect(S.is(D1Error)(error)).toBe(true)
        expect(error).toMatchObject({ stage: "decode", statement: 0 })
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
        expect(S.is(D1Error)(error)).toBe(true)
        expect(error).toMatchObject({ stage: "execute" })
        const after = yield* (yield* all)(undefined)
        expect(after.length).toBe(before)
        expect(A.some(after, (row) => row.id === "three")).toBe(false)
      })
    )

    it.effect.prop(
      "answers each statement of a batch with its own rows, decoded by its own result Schema, in order",
      [Arbitrary.array(Arbitrary.schema(Step), { minLength: 1, maxLength: 6 })],
      ([steps]) =>
        Effect.gen(function* () {
          const d1 = yield* D1
          const client = yield* sql
          yield* client`DELETE FROM note WHERE tag = ${batched}`
          const write = D1.statement({
            Request: S.Struct({ id: NoteId }),
            Result: NoRows,
            execute: (r) => client`INSERT INTO note (id, body, tag) VALUES (${r.id}, 'Batched', ${batched})`
          })
          const returning = D1.statement({
            Request: S.Struct({ id: NoteId }),
            Result: S.Array(S.Struct({ id: NoteId })),
            execute: (r) =>
              client`INSERT INTO note (id, body, tag) VALUES (${r.id}, 'Batched', ${batched}) RETURNING id`
          })
          const count = D1.statement({
            Request: S.Void,
            Result: S.Array(S.Struct({ notes: S.Int })),
            execute: () => client`SELECT count(*) AS notes FROM note WHERE tag = ${batched}`
          })
          const idOf = (index: number) => NoteId.make(`batched-${index}`)
          const queries = A.map(steps, (step: Step, index) =>
            step === "write"
              ? write({ id: idOf(index) })
              : step === "returning"
                ? returning({ id: idOf(index) })
                : count(undefined)
          )
          const answers = yield* d1.batch(queries)
          // What each statement answers, from the steps alone: a count sees the writes before it in the batch.
          const expected = A.map(steps, (step: Step, index) =>
            step === "write"
              ? []
              : step === "returning"
                ? [{ id: idOf(index) }]
                : [{ notes: A.filter(A.take(steps, index), (before) => before !== "count").length }]
          )
          expect(answers).toEqual(expected)
          yield* client`DELETE FROM note WHERE tag = ${batched}`
        }),
      { arbitrary: { runs: 60 } }
    )

    it.effect("refuses a request its Schema refuses before any SQL runs, naming its place in the batch", () =>
      Effect.gen(function* () {
        const d1 = yield* D1
        const make = yield* insert
        const error = yield* Effect.flip(
          d1.batch([
            make({ id: NoteId.make("five"), body: "Fifth" }),
            make({ id: NoteId.make("six"), body: Str.repeat(201)("x") })
          ])
        )
        expect(S.is(D1Error)(error)).toBe(true)
        expect(error).toMatchObject({ stage: "encode", statement: 1 })
        const after = yield* (yield* all)(undefined)
        expect(A.some(after, (row) => row.id === "five")).toBe(false)
      })
    )
  })
})
