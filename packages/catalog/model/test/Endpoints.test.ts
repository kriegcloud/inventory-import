// The catalog's endpoints over its in-memory twins: what the screens rely on, with no SQL and no HTTP. The same
// scenarios run on D1 through HTTP in the app's Imports, TakeBack, Suggestions and Assistant slow tests.
import { describe, expect, layer } from "@effect/vitest"
import { assistantEndpoints } from "@inventory/catalog-model/AssistantHandler"
import { Answerer, type AnswerSchema, type ModelAnswered, type ModelQuestion } from "@inventory/catalog-model/Answerer"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { itemsEndpoints } from "@inventory/catalog-model/ItemsHandler"
import { catalogMemory, CatalogMemoryRef } from "@inventory/catalog-model/Memory"
import { type ConfirmWrite, ImportStore } from "@inventory/catalog-model/ImportStore"
import { usedUpSentence } from "@inventory/catalog-model/AssistantHandler"
import { memoryUsedUpWords } from "@inventory/catalog-model/ModelAllowance"
import { decisionFromFlags } from "@inventory/catalog-contract/Decision"
import {
  AcceptsTakenBack,
  AlreadyImported,
  DraftMoved,
  ImportNotFound,
  RevisionAhead
} from "@inventory/catalog-contract/ImportRejection"
import { ItemChanged } from "@inventory/catalog-contract/Catalog"
import { Forbidden } from "@inventory/kernel/AccessError"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { DecidedBy, RowOutcome } from "@inventory/catalog-contract/Import"
import { Suggestion } from "@inventory/catalog-contract/Suggestion"
import type { ColumnCatalog } from "@inventory/catalog-contract/TableView"
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as S from "effect/Schema"
import { as, dana, elena, fiveLines, marcus, priya, stage, tableOf } from "./support.ts"

const withCrypto = <A, E>(memory: Layer.Layer<A, E>) => Layer.mergeAll(memory, SecureRandom.layerWebCrypto)
const App = withCrypto(catalogMemory())
/** Runs `effect`, which must be refused, and expects the refusal to be of `kind`. */
const refusedAs = <A, E, R>(effect: Effect.Effect<A, E, R>, kind: abstract new (...args: never) => unknown) =>
  Effect.map(Effect.flip(effect), (error) => {
    expect(error).toBeInstanceOf(kind)
  })
const lines = Effect.gen(function* () {
  const ref = yield* CatalogMemoryRef
  const state = yield* Ref.get(ref)
  return A.map(state.activity, (line) => `${line.actorName}: ${line.action}: ${line.detail}`)
})
const said = (word: string) => Effect.map(lines, A.filter(Str.includes(word)))
const none = { set: {}, clear: [] }

describe("an import, over the twins", () => {
  layer(App)("staged, confirmed, confirmed again, taken back twice", (it) => {
    it.effect("a viewer may not stage a file; an editor's upload is an open import with its counts", () =>
      Effect.gen(function* () {
        yield* refusedAs(stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(priya)), Forbidden)
        const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
        expect([view.status, view.rowCount, view.progress.ready, view.progress.needs]).toEqual(["open", 5, 3, 2])
        const got6 = yield* lines
        expect(got6).toEqual(["Marcus Oyelaran: Uploaded a file: five.csv: 5 rows staged, nothing imported yet"])
      })
    )

    it.effect(
      "a confirm writes the ready rows and says so; a second confirm is AlreadyImported and writes nothing",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const items = yield* itemsEndpoints
          const open = yield* imports.open().pipe(as(marcus))
          const { id, revision } = O.getOrThrow(A.head(open.views))
          const confirmed = yield* imports
            .commit({ params: { id }, payload: { ...none, revision, madeOn: {} } })
            .pipe(as(marcus))
          const result = O.getOrThrow(confirmed.result)
          expect([confirmed.status, result.created, result.updated, result.already, result.notImported]).toEqual([
            "imported",
            3,
            0,
            0,
            2
          ])
          const stored = yield* items.list().pipe(as(priya))
          expect(
            A.map(stored, (item) => [item.sku, item.name, BigDecimal.format(item.unitCost), item.revision])
          ).toEqual([
            ["AAA-0001", "Oak Crate", "12.5", 1],
            ["AAA-0002", "Steel Bolt", "3", 1],
            ["AAA-0003", "Nylon Rope", "0.75", 1]
          ])
          // Another organization sees none of them.
          const got12 = yield* items.list().pipe(as(elena))
          expect(got12.length).toBe(0)
          yield* refusedAs(
            imports.commit({ params: { id }, payload: { ...none, revision, madeOn: {} } }).pipe(as(marcus)),
            AlreadyImported
          )
          const got13 = yield* items.list().pipe(as(marcus))
          expect(got13.length).toBe(3)
          const got1 = yield* said("Imported items")
          expect(got1).toEqual(["Marcus Oyelaran: Imported items: Created 3 items from five.csv"])
        })
    )

    it.effect("an edit goes up a revision, the same edit again writes nothing, and a stale one is Changed", () =>
      Effect.gen(function* () {
        const items = yield* itemsEndpoints
        const stored = yield* items.list().pipe(as(marcus))
        const crate = O.getOrThrow(A.findFirst(stored, (item) => item.sku === "AAA-0001"))
        const edit = {
          revision: crate.revision,
          name: "Oak Crate, large",
          description: crate.description,
          category: crate.category,
          uom: crate.uom,
          unitCost: crate.unitCost,
          quantityOnHand: crate.quantityOnHand,
          reorderPoint: crate.reorderPoint,
          stocking: crate.stocking,
          lotTracked: crate.lotTracked,
          firstReceivedOn: crate.firstReceivedOn
        }
        yield* refusedAs(items.edit({ params: { id: crate.id }, payload: edit }).pipe(as(priya)), Forbidden)
        const edited = yield* items.edit({ params: { id: crate.id }, payload: edit }).pipe(as(dana))
        expect([edited.name, edited.revision]).toEqual(["Oak Crate, large", 2])
        const same = yield* items.edit({ params: { id: crate.id }, payload: edit }).pipe(as(dana))
        expect(same.revision).toBe(2)
        yield* refusedAs(
          items.edit({ params: { id: crate.id }, payload: { ...edit, name: "Oak Crate, small" } }).pipe(as(dana)),
          ItemChanged
        )
        const got2 = yield* said("Edited an item")
        expect(got2).toEqual(["Dana Whitfield: Edited an item: AAA-0001 Oak Crate, large"])
      })
    )

    it.effect(
      "a take-back removes the untouched items, keeps and names the edited one, and a second press writes nothing",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const items = yield* itemsEndpoints
          const past = yield* imports.past().pipe(as(marcus))
          const id = O.getOrThrow(A.head(past.imports)).id
          const before = yield* imports.get({ params: { id } }).pipe(as(marcus))
          expect([before.takeBack.removable, before.takeBack.changedCount]).toEqual([2, 1])
          expect(A.map(before.takeBack.changed, (item) => item.sku)).toEqual(["AAA-0001"])
          const payload = { confirms: before.takeBack.confirms }
          const back = yield* imports.takeBack({ params: { id }, payload }).pipe(as(marcus))
          expect([back.status, O.getOrUndefined(back.result)?.takenBack, back.takeBack.keptCount]).toEqual([
            "takenBack",
            2,
            1
          ])
          const got14 = yield* items.list().pipe(as(marcus))
          expect(A.map(got14, (item) => item.sku)).toEqual(["AAA-0001"])
          yield* imports.takeBack({ params: { id }, payload }).pipe(as(marcus))
          const got3 = yield* said("Took back an import")
          expect(got3).toEqual([
            "Marcus Oyelaran: Took back an import: five.csv: removed 2 items, kept 1 that had changed since"
          ])
        })
    )
  })

  layer(App)("decisions and removal", (it) => {
    it.effect(
      "a decision is saved under a new revision, the same one again is not, and leaving a row out counts it",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
          const params = { id: view.id }
          const set = { "row-2": decisionFromFlags({ out: true }) }
          const first = yield* imports
            .decide({ params, payload: { opening: 0, madeOn: R.map(set, () => view.revision), set, clear: [] } })
            .pipe(as(marcus))
          const second = yield* imports
            .decide({ params, payload: { opening: 0, madeOn: R.map(set, () => view.revision), set, clear: [] } })
            .pipe(as(marcus))
          expect(second.revision).toBe(first.revision)
          // The answer says which save moved the draft: the first did, the same one again did not.
          expect([first.changed, second.changed]).toEqual([true, false])
          const after = yield* imports.get({ params }).pipe(as(marcus))
          expect(after.progress.ready).toBe(2)
          const cleared = yield* imports
            .decide({ params, payload: { opening: 0, madeOn: {}, set: {}, clear: ["row-2"] } })
            .pipe(as(marcus))
          expect(cleared.revision).toBe(first.revision + 1)
          expect(cleared.changed).toBe(true)
          // Nothing of it is in the system, so it may be removed, once.
          yield* imports.remove({ params }).pipe(as(marcus))
          yield* refusedAs(imports.get({ params }).pipe(as(marcus)), ImportNotFound)
          const got4 = yield* said("Removed an import")
          expect(got4).toEqual(["Marcus Oyelaran: Removed an import: five.csv: 5 rows, nothing had been imported"])
        })
    )

    it.effect(
      "a confirm made on an older picture is DraftMoved and writes nothing; on the newer one it writes, unsent rows too",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const items = yield* itemsEndpoints
          const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
          const params = { id: view.id }
          // Dana leaves row 2 out; Marcus's screen has not shown it.
          const theirs = yield* imports
            .decide({
              params,
              payload: {
                opening: 0,
                madeOn: { "row-2": view.revision },
                set: { "row-2": decisionFromFlags({ out: true }) },
                clear: []
              }
            })
            .pipe(as(dana))
          const mine = { "row-3": decisionFromFlags({ out: true }) }
          const refused = yield* Effect.flip(
            imports
              .commit({
                params,
                payload: {
                  revision: view.revision,
                  madeOn: R.map(mine, () => view.revision),
                  set: mine,
                  clear: ["row-2"]
                }
              })
              .pipe(as(marcus))
          )
          expect(S.is(DraftMoved)(refused) ? refused.revision : refused).toBe(theirs.revision)
          // Nothing was written: no item, her decision still there, his not, and no line in the audit trail.
          const got1 = yield* items.list().pipe(as(marcus))
          expect(got1.length).toBe(0)
          const still = yield* imports.get({ params }).pipe(as(marcus))
          expect([still.status, still.revision, R.keys(still.decisions)]).toEqual(["open", theirs.revision, ["row-2"]])
          const got2 = yield* said("Imported items")
          expect(got2).toEqual([])
          // On the picture he has now, the confirm writes: one ready row is left, hers and his are left out, and each
          // is said under the name of who left it out.
          const confirmed = yield* imports
            .commit({
              params,
              payload: { revision: still.revision, madeOn: R.map(mine, () => still.revision), set: mine, clear: [] }
            })
            .pipe(as(marcus))
          const result = O.getOrThrow(confirmed.result)
          expect([confirmed.status, confirmed.revision, result.created, result.notImported]).toEqual([
            "imported",
            still.revision + 1,
            1,
            4
          ])
          const leftOutBy = (n: number) =>
            O.flatMap(
              A.findFirst(result.rows, (row) => row.rowNumber === n),
              (row) =>
                RowOutcome.guards.notImported(row) && DecidedBy.guards.person(row.decidedBy)
                  ? O.some(row.decidedBy.name)
                  : O.none()
            )
          expect([leftOutBy(2), leftOutBy(3)]).toEqual([O.some("Dana Whitfield"), O.some("Marcus Oyelaran")])
        })
    )
  })
})

describe("suggestions, over the twins", () => {
  layer(App)("with no model", (it) => {
    it.effect("the rules suggest a name from the description, once, with one audit line, and change no row", () =>
      Effect.gen(function* () {
        const imports = yield* importsEndpoints
        const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
        const params = { id: view.id }
        yield* refusedAs(imports.suggest({ params }).pipe(as(priya)), Forbidden)
        const first = yield* imports.suggest({ params }).pipe(as(marcus))
        expect(AnsweredBy.guards.Rules(first.answeredBy)).toBe(true)
        expect(
          A.map(first.made, (s) => (Suggestion.guards.column(s) ? [] : [s.rowId, s.kind, s.to, s.by.kind]))
        ).toEqual([["row-5", "name", "Copper Plate", "rule"]])
        const second = yield* imports.suggest({ params }).pipe(as(marcus))
        expect([second.made.length, second.suggestions.length]).toEqual([0, 1])
        const after = yield* imports.get({ params }).pipe(as(marcus))
        expect([after.progress.ready, after.suggestions.length]).toEqual([3, 1])
        const got5 = yield* said("Asked for suggestions")
        expect(got5.length).toBe(1)
      })
    )
  })
})

const columns: ColumnCatalog = [
  { id: "name", label: "Name", type: "text", sortable: true, hideable: false, operators: ["iLike"], values: [] },
  {
    id: "unit",
    label: "Unit",
    type: "select",
    sortable: true,
    hideable: true,
    operators: ["inArray"],
    values: ["EA", "KG"]
  }
]
const request = (prompt: string) => ({ payload: { prompt, table: "Items", columns, searchable: false } })

// A model that counts how often it is asked, and answers one sort.
const sortByName: unknown = { changes: [{ kind: "sort", column: "name", direction: "desc" }], cannot: "" }
const asked = Ref.makeUnsafe(0)
const Counting = Layer.succeed(
  Answerer,
  Answerer.of({
    status: "on",
    ask: Effect.fnUntraced(function* <Sc extends AnswerSchema>(_question: ModelQuestion, schema: Sc) {
      yield* Ref.update(asked, (n) => n + 1)
      const value: Sc["Type"] = yield* S.decodeUnknownEffect(schema)(sortByName).pipe(Effect.orDie)
      const answered: ModelAnswered<Sc["Type"]> = {
        value,
        answeredBy: AnsweredBy.cases.Model.make({ provider: "openrouter", model: "twin/model", fallback: false })
      }
      return answered
    })
  })
)

describe("the table assistant, over the twins", () => {
  layer(withCrypto(catalogMemory({ answerer: Counting, calls: 1 })))("one call left", (it) => {
    it.effect(
      "the model answers once and leaves one line; with the allowance used the rules answer and no model is asked",
      () =>
        Effect.gen(function* () {
          const assistant = yield* assistantEndpoints
          const first = yield* assistant.view(request("sort by name descending")).pipe(as(priya))
          expect(
            Result.isSuccess(first) && AnsweredBy.guards.Model(first.success.answeredBy)
              ? first.success.answeredBy.model
              : first
          ).toBe("twin/model")
          const second = yield* assistant.view(request("sort by name descending")).pipe(as(priya))
          expect(Result.isSuccess(second) ? second.success.answeredBy : second).toEqual(
            AnsweredBy.cases.Rules.make({ reason: usedUpSentence(memoryUsedUpWords) })
          )
          // The rules still do the work: the same sort, read from the words.
          expect(Result.isSuccess(second) ? A.map(second.success.changes, (change) => change.kind) : second).toEqual([
            "sort"
          ])
          const got10 = yield* Ref.get(asked)
          expect(got10).toBe(1)
          const got11 = yield* lines
          expect(got11).toEqual(["Priya Raman: Asked for a view: Items: 1 change to the view, answered by twin/model"])
        })
    )
  })
})

// The handler checks the confirm's revision before it plans the write; another person's save can still land between
// that check and the store's write. The store checks the revision again, in the same step as the write: this store
// makes Dana's save at that moment, once, and then hands Marcus's confirm to the twin.
const danaSavesDuringTheConfirm = Layer.effect(
  ImportStore,
  Effect.gen(function* () {
    const inner = yield* ImportStore
    const raced = yield* Ref.make(false)
    return ImportStore.of({
      ...inner,
      commit: Effect.fnUntraced(function* (write: ConfirmWrite) {
        const first = !(yield* Ref.getAndSet(raced, true))
        if (first) {
          const found = yield* inner.find(write.audit.organizationId, write.draft)
          yield* inner.decide(dana, O.getOrThrow(found), {
            set: { "row-2": decisionFromFlags({ out: true }) },
            clear: []
          })
        }
        return yield* inner.commit(write)
      })
    })
  })
)

describe("a confirm another save overtakes after the handler checked its revision", () => {
  layer(withCrypto(Layer.provideMerge(danaSavesDuringTheConfirm, catalogMemory())))("the store's own check", (it) => {
    it.effect("is DraftMoved at the revision the save left, and writes nothing", () =>
      Effect.gen(function* () {
        const imports = yield* importsEndpoints
        const items = yield* itemsEndpoints
        const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
        const params = { id: view.id }
        const refused = yield* Effect.flip(
          imports.commit({ params, payload: { ...none, revision: view.revision, madeOn: {} } }).pipe(as(marcus))
        )
        expect(S.is(DraftMoved)(refused) ? refused.revision : refused).toBe(view.revision + 1)
        // Nothing of the confirm: no item, the import still open with Dana's decision, no line for an import.
        const stored = yield* items.list().pipe(as(marcus))
        const still = yield* imports.get({ params }).pipe(as(marcus))
        const imported = yield* said("Imported items")
        expect([stored.length, still.status, still.revision, R.keys(still.decisions), imported]).toEqual([
          0,
          "open",
          view.revision + 1,
          ["row-2"],
          []
        ])
      })
    )
  })
})

describe("a revision the draft has not reached", () => {
  layer(withCrypto(catalogMemory()))("is not taken on the client's word", (it) => {
    it.effect(
      "a save whose row names a later madeOn, and a confirm naming a later revision, are refused and write nothing",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
          const params = { id: view.id }
          const accept = { "row-2": decisionFromFlags({ out: true }) }
          const save = yield* Effect.flip(
            imports
              .decide({
                params,
                payload: { opening: 0, madeOn: { "row-2": view.revision + 1 }, set: accept, clear: [] }
              })
              .pipe(as(marcus))
          )
          const confirm = yield* Effect.flip(
            imports
              .commit({ params, payload: { revision: view.revision + 1, madeOn: {}, set: {}, clear: [] } })
              .pipe(as(marcus))
          )
          expect([S.is(RevisionAhead)(save), S.is(RevisionAhead)(confirm)]).toEqual([true, true])
          const still = yield* imports.get({ params }).pipe(as(marcus))
          expect([still.status, still.revision, R.keys(still.decisions)]).toEqual(["open", view.revision, []])
        })
    )
  })
})

describe("an accept made before its column was matched again, over the twins", () => {
  layer(withCrypto(catalogMemory()))("the twin holds the rule as D1 does", (it) => {
    it.effect(
      "is not applied by a save, which names it, and a confirm that carries it is refused and writes nothing",
      () =>
        Effect.gen(function* () {
          const imports = yield* importsEndpoints
          const items = yield* itemsEndpoints
          const view = yield* stage(tableOf({ fileName: "five.csv", lines: fiveLines })).pipe(as(marcus))
          const params = { id: view.id }
          const table = yield* imports.table({ params }).pipe(as(dana))
          const other = O.getOrThrow(A.findFirst(table.columns, (column) => column.label === "description"))
          const matched = yield* imports
            .match({ params, payload: { field: "unitCost", column: O.some(other.index) } })
            .pipe(as(dana))
          expect(matched.revision).toBe(view.revision + 1)
          const accept = { "row-2": decisionFromFlags({ accepted: ["unitCost"] }) }
          const saved = yield* imports
            .decide({ params, payload: { opening: 0, madeOn: { "row-2": view.revision }, set: accept, clear: [] } })
            .pipe(as(marcus))
          expect(saved.notApplied).toEqual([{ rowId: "row-2", field: "unitCost", kind: "accept" }])
          const after = yield* imports.get({ params }).pipe(as(marcus))
          expect(R.get(after.decisions, "row-2")).toEqual(O.some(decisionFromFlags({})))
          const refused = yield* Effect.flip(
            imports
              .commit({
                params,
                payload: { revision: after.revision, madeOn: { "row-2": view.revision }, set: accept, clear: [] }
              })
              .pipe(as(marcus))
          )
          expect([S.is(AcceptsTakenBack)(refused), S.is(AcceptsTakenBack)(refused) ? refused.accepts : []]).toEqual([
            true,
            [{ rowId: "row-2", field: "unitCost", kind: "accept" }]
          ])
          expect((yield* items.list().pipe(as(marcus))).length).toBe(0)
        })
    )
  })
})
