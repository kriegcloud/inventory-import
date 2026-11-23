// Rows of a save that waited, over any order of what two people do (Benjamin, 2026-11-20: "Hold it, show both, ask"):
// nothing is written unasked over what somebody else decided. Each person saves with the decisions they know the server
// may hold (`over`), loses answers, matches columns there and back, stocks items and takes them back, confirms and
// reopens. The run keeps who last pressed each row (a save that wrote it, changed or not) and when each screen read the
// import. After every save, a row not named as decided otherwise was last pressed by its sender, or by somebody else in
// a save her screen had already read when she decided it, or holds what she named as it reads or what she writes; it was
// also stored, just before, as a decision she named, her own, or one the server held at her screen's revision. A row
// named is left as it was. Over the in-memory twins, the store's own state read for what was stored.
import { describe, expect, layer } from "@effect/vitest"
import { decisionFromFlags, RowDecision, type RowDecisionFlags } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { Field, StagedTable } from "@inventory/catalog-contract/Staged"
import { importsEndpoints } from "@inventory/catalog-model/ImportsHandler"
import { catalogMemory, CatalogMemoryRef } from "@inventory/catalog-model/Memory"
import type { Member } from "@inventory/kernel/Member"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Match from "effect/Match"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Ref from "effect/Ref"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as S from "effect/Schema"
import { as, dana, marcus, stage } from "./support.ts"

const App = Layer.mergeAll(catalogMemory(), SecureRandom.layerWebCrypto)

const headings = ["sku", "name", "category", "uom", "unit_cost", "quantity_on_hand", "Alt code", "Net cost"] as const
const letters = ["A", "B", "C", "D", "E", "F", "G", "H"]
type Line = Partial<Record<(typeof headings)[number], string>>
const column = (heading: (typeof headings)[number]): number =>
  O.getOrThrow(A.findFirstIndex(headings, (candidate) => candidate === heading))
const tableOf = (fileName: string, lines: ReadonlyArray<Line>): StagedTable => ({
  fileName,
  kind: "csv",
  sheet: O.none(),
  headerRowNumber: 1,
  columns: A.map(headings, (label, index) => ({ index, letter: O.getOrElse(A.get(letters, index), () => "A"), label })),
  notes: [],
  rows: A.map(lines, (line, index) => ({
    rowNumber: index + 2,
    cells: A.map(headings, (heading) => ({ text: line[heading] ?? "" }))
  }))
})
const item = { category: "packaging", uom: "EA", quantity_on_hand: "10" }

// Each run has SKUs of its own, so an item one run stocks is never another's.
const runs = MutableRef.make(0)

const picks = {
  replaceSack: { stored: "replace", edits: { name: "Sack" } },
  keepSack: { stored: "keep", edits: { name: "Sack" } },
  sack: { edits: { name: "Sack" } },
  out: { out: true },
  nothing: {},
  replace: { stored: "replace" },
  keep: { stored: "keep" },
  both: { stored: "replace", accepted: ["unitCost"] }
} satisfies Record<string, RowDecisionFlags>

const Step = S.Struct({
  kind: S.Literals([
    "save",
    "live",
    "read",
    "matchCost",
    "matchCostBack",
    "matchSku",
    "matchSkuBack",
    "stock",
    "unstock",
    "confirm"
  ]),
  who: S.Literals(["dana", "marcus"]),
  row: S.Literals(["row-2", "row-3"]),
  pick: S.Literals(["replaceSack", "keepSack", "sack", "out", "nothing", "replace", "keep", "both"]),
  lost: S.Boolean
})
type Step = typeof Step.Type

const same = S.toEquivalence(RowDecision)
const nothingSaid = decisionFromFlags({})
const alike = (a: O.Option<RowDecision>, b: O.Option<RowDecision>): boolean =>
  same(
    O.getOrElse(a, () => nothingSaid),
    O.getOrElse(b, () => nothingSaid)
  )

/**
 * What a person's screen holds: the revision it read, when in the run it read it (`readAt`, the step), what it read of
 * each row, and saves whose fate it does not know.
 */
type Screen = {
  readonly revision: number
  readonly readAt: number
  readonly read: Readonly<Record<string, O.Option<RowDecision>>>
  readonly unknown: Readonly<Record<string, ReadonlyArray<RowDecision>>>
}

/** The last press of a row: who sent the save that wrote it, changed or not, and at which step of the run. */
type Press = { readonly who: string; readonly at: number }

/** A stored decision as the twin holds it: what it says, who made it (an id) and the revision it was saved at. */
type Held = { readonly decision: RowDecision; readonly authorId: string; readonly savedAt: number }

const rows = ["row-2", "row-3"] as const
const members: Readonly<Record<Step["who"], Member>> = { dana, marcus }

/** One run: the sacks staged with SKUs of its own, and each step done in turn as its person. */
const played = Effect.fnUntraced(function* (steps: ReadonlyArray<Step>) {
  const imports = yield* importsEndpoints
  const ref = yield* CatalogMemoryRef
  const run = MutableRef.incrementAndGet(runs)
  const sack = `P${run}-SACK`
  const canvas = `P${run}-CANVAS`
  const sacks = tableOf(`sacks-${run}.csv`, [
    { ...item, sku: sack, name: "Jute Sack", unit_cost: "5", "Net cost": "7", "Alt code": sack },
    { ...item, sku: canvas, name: "Canvas Sack", unit_cost: "3", "Net cost": "3", "Alt code": canvas }
  ])
  const stockTable = tableOf(`stock-${run}.csv`, [
    { ...item, sku: sack, name: "Jute Sack", unit_cost: "5" },
    { ...item, sku: canvas, name: "Canvas Sack", unit_cost: "3" }
  ])
  const view = yield* stage(sacks).pipe(as(marcus))
  const params = { id: view.id }
  // The step the run is at: a screen read at step n read after every press of the steps before it.
  const clock = yield* Ref.make(0)
  const pressed = yield* Ref.make<Readonly<Record<string, Press>>>({})
  const press = (who: Member, row: string) =>
    Effect.flatMap(Ref.get(clock), (at) => Ref.update(pressed, (all) => ({ ...all, [row]: { who: who.id, at } })))
  const readScreen = Effect.fnUntraced(function* (who: Member) {
    const now = yield* imports.get({ params }).pipe(as(who))
    const readAt = yield* Ref.get(clock)
    const screen: Screen = {
      revision: now.revision,
      readAt,
      read: R.fromEntries(A.map(rows, (row) => [row, R.get(now.decisions, row)] as const)),
      unknown: {}
    }
    return screen
  })
  const screens = yield* Ref.make<Readonly<Record<Step["who"], Screen>>>({
    dana: yield* readScreen(dana),
    marcus: yield* readScreen(marcus)
  })
  const stocks = yield* Ref.make<ReadonlyArray<ImportId>>([])
  const held = Effect.map(Ref.get(ref), (state): Readonly<Record<string, Held>> =>
    O.match(
      A.findFirst(state.drafts, (entry) => entry.draft.id === view.id),
      {
        onNone: () => ({}),
        onSome: (entry) =>
          R.fromEntries(
            A.map(
              entry.decisions,
              (one) => [one.rowId, { decision: one.decision, authorId: one.authorId, savedAt: one.savedAt }] as const
            )
          )
      }
    )
  )
  const match = (field: Field, heading: (typeof headings)[number]) =>
    Effect.ignore(imports.match({ params, payload: { field, column: O.some(column(heading)) } }).pipe(as(marcus)))
  const stock = Effect.gen(function* () {
    const staged = yield* stage(stockTable).pipe(as(marcus))
    const done = yield* Effect.exit(
      imports
        .commit({ params: { id: staged.id }, payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] } })
        .pipe(as(marcus))
    )
    if (Exit.isSuccess(done)) yield* Ref.update(stocks, A.append(staged.id))
  })
  const unstock = Effect.gen(function* () {
    const kept = yield* Ref.get(stocks)
    yield* O.match(A.last(kept), {
      onNone: () => Effect.void,
      onSome: Effect.fnUntraced(function* (id: ImportId) {
        yield* Ref.set(stocks, A.dropRight(kept, 1))
        const done = yield* imports.get({ params: { id } }).pipe(as(marcus))
        yield* Effect.ignore(
          imports.takeBack({ params: { id }, payload: { confirms: done.takeBack.confirms } }).pipe(as(marcus))
        )
      })
    })
  })
  const confirm = Effect.gen(function* () {
    const now = yield* imports.get({ params }).pipe(as(marcus))
    yield* Effect.ignore(
      imports.commit({ params, payload: { revision: now.revision, madeOn: {}, set: {}, clear: [] } }).pipe(as(marcus))
    )
    yield* Effect.ignore(imports.reopen({ params }).pipe(as(marcus)))
  })
  // A live press: the last one stands, nothing named over. The screen reads the import again after it.
  const live = Effect.fnUntraced(function* (step: Step) {
    const who = members[step.who]
    const now = yield* imports.get({ params }).pipe(as(who))
    const done = yield* Effect.exit(
      imports
        .decide({
          params,
          payload: {
            opening: 0,
            madeOn: { [step.row]: now.revision },
            set: { [step.row]: decisionFromFlags(picks[step.pick]) },
            clear: []
          }
        })
        .pipe(as(who))
    )
    if (Exit.isSuccess(done)) yield* press(who, step.row)
    const screen = yield* readScreen(who)
    yield* Ref.update(screens, (all) => ({ ...all, [step.who]: screen }))
  })
  const save = Effect.fnUntraced(function* (step: Step) {
    const who = members[step.who]
    const screen = (yield* Ref.get(screens))[step.who]
    const decision = decisionFromFlags(picks[step.pick])
    const waited = O.getOrElse(R.get(screen.unknown, step.row), (): ReadonlyArray<RowDecision> => [])
    const named: ReadonlyArray<O.Option<RowDecision>> = [
      O.flatten(R.get(screen.read, step.row)),
      ...A.map(waited, O.some)
    ]
    const before = yield* held
    const presses = yield* Ref.get(pressed)
    const last = R.get(presses, step.row)
    const saved = yield* Effect.exit(
      imports
        .decide({
          params,
          payload: {
            opening: 0,
            madeOn: { [step.row]: screen.revision },
            set: { [step.row]: decision },
            clear: [],
            over: { [step.row]: named }
          }
        })
        .pipe(as(who))
    )
    const after = yield* held
    const was = R.get(before, step.row)
    const now = R.get(after, step.row)
    const decided = Exit.match(saved, {
      onFailure: () => O.none<ReadonlyArray<string>>(),
      onSuccess: (answer) => O.some(A.map(answer.decidedSince, (row) => row.rowId))
    })
    const left = O.match(decided, { onNone: () => true, onSome: (named) => A.contains(named, step.row) })
    if (left) {
      // Named, or nothing written: left exactly as it was.
      expect(O.map(now, (one) => [one.decision, one.savedAt])).toEqual(O.map(was, (one) => [one.decision, one.savedAt]))
    } else {
      yield* press(who, step.row)
      const stored = O.map(was, (one) => one.decision)
      const asNamed = A.some(named, (one) => alike(stored, one))
      const asWritten = alike(
        stored,
        O.map(now, (one) => one.decision)
      )
      // Nobody else pressed the row after her screen read it, unless what is stored is what she named or writes.
      const pressedOk =
        asNamed ||
        asWritten ||
        O.match(last, { onNone: () => true, onSome: (one) => one.who === who.id || one.at < screen.readAt })
      const storedOk =
        asNamed ||
        asWritten ||
        O.exists(was, (one) => one.authorId === who.id) ||
        O.exists(was, (one) => one.savedAt >= 1 && one.savedAt <= screen.revision)
      expect({ step, named, stored, last, pressedOk, storedOk }).toEqual({
        step,
        named,
        stored,
        last,
        pressedOk: true,
        storedOk: true
      })
    }
    // A lost answer leaves the decision among those the screen does not know the fate of; any other reads again.
    const next =
      step.lost && !left
        ? { ...screen, unknown: { ...screen.unknown, [step.row]: [...waited, decision] } }
        : yield* readScreen(who)
    yield* Ref.update(screens, (all) => ({ ...all, [step.who]: next }))
  })
  yield* Effect.forEach(
    steps,
    (step) =>
      Ref.update(clock, (at) => at + 1).pipe(
        Effect.andThen(() =>
          Match.value(step.kind).pipe(
            Match.when("save", () => save(step)),
            Match.when("live", () => live(step)),
            Match.when("read", () =>
              Effect.flatMap(readScreen(members[step.who]), (screen) =>
                Ref.update(screens, (all) => ({ ...all, [step.who]: screen }))
              )
            ),
            Match.when("matchCost", () => match("unitCost", "Net cost")),
            Match.when("matchCostBack", () => match("unitCost", "unit_cost")),
            Match.when("matchSku", () => match("sku", "Alt code")),
            Match.when("matchSkuBack", () => match("sku", "sku")),
            Match.when("stock", () => stock),
            Match.when("unstock", () => unstock),
            Match.when("confirm", () => confirm),
            Match.exhaustive
          )
        )
      ),
    { concurrency: 1, discard: true }
  )
})

describe("a row that waited, over any order of saves, lost answers, matches, items and confirms", () => {
  layer(App)("is never written over what somebody else decided", (it) => {
    it.effect.prop(
      "a row not named was last pressed by its sender or before her screen read it, and stored as a decision she named",
      [S.Array(Step).check(S.isMinLength(12), S.isMaxLength(30))],
      ([steps]) => played(steps),
      // 2,000 runs took 24 s alone on two pinned cores, the stand-in for CI's runner: 180 s leaves room for the rest of
      // the check running beside it, and a hang still fails within the job's 15 minutes.
      { timeout: 180_000, arbitrary: { runs: 2000 } }
    )
  })
})
