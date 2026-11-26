import { RowId } from "@inventory/catalog-contract/Ids"
import { assertTrue } from "@effect/vitest/utils"
// A Replace or a Keep-stored the server took back on an import matched before moves were kept (Benjamin, 2026-11-21,
// "Take it back, say so"): the screen names it with the field that was matched again, which is not the SKU, in each place
// it can learn of it: a save's answer, a confirm's refusal, and the import's view. The words are read here as the person
// reads them, through the runner.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as HttpApiError from "effect/http-api/HttpApiError"
import { vi } from "vitest"
import {
  decisionFromFlags,
  type SavedDecisions,
  type SaveRequest,
  type DecidedSince
} from "@inventory/catalog-contract/Decision"
import { ImportId } from "@inventory/catalog-contract/Ids"
import { type ImportView, MatchTakeBack } from "@inventory/catalog-contract/Import"
import { AcceptsTakenBack } from "@inventory/catalog-contract/ImportRejection"
import { DraftEvent } from "../src/Draft.machine.ts"
import { importView, importViewShown } from "../src/Imports.atoms.ts"
import { heldBackSentence } from "../src/internal/format.tsx"
import { takeBackWords } from "../src/internal/leftOver.ts"
import {
  acceptsWords,
  confirmHeldBack,
  draftEvents,
  followDraft,
  reviewLocal,
  shownDecisions,
  takeBacksNamed
} from "../src/ReviewDraft.atoms.ts"
import { importNo, registryWith, viewAt } from "./support/catalog.ts"

// What is said to the person, title and description.
const page = vi.hoisted(() => {
  Object.assign(globalThis, {
    window: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: { pathname: "/", search: "" }
    }
  })
  return { said: Array<string>() }
})
vi.mock("sonner", () => {
  const say = (title: string, more?: { readonly description?: string }) =>
    page.said.push(
      O.match(O.fromUndefinedOr(more?.description), {
        onNone: () => `${title}: `,
        onSome: (description) => `${title}: ${description}`
      })
    )
  return { toast: Object.assign(say, { dismiss: () => undefined, success: () => 0, loading: () => 0, error: say }) }
})

const settle = Effect.sleep("15 millis")
const replaced = decisionFromFlags({ stored: "replace" })
const keepStored = decisionFromFlags({ stored: "keep" })

interface Saved {
  readonly revision: number
  readonly changed: boolean
  readonly notApplied: ReadonlyArray<{ readonly rowId: string; readonly field: string; readonly kind: "stored" }>
  readonly decidedSince: ReadonlyArray<DecidedSince>
}

/** Rows 7 and 9 as the server names them: taken back because Unit cost was matched again. */
const taken = [
  { rowId: "row-7", field: "unitCost", kind: "stored" },
  { rowId: "row-9", field: "unitCost", kind: "stored" }
] as const

/** The Review step on one import at revision 10: each save and confirm answers only when the test says. */
const world = (id: ImportId, parts: Partial<ImportView>) => {
  const saves: Array<Deferred.Deferred<Saved, HttpApiError.InternalServerErrorProblem>> = []
  const confirms: Array<Deferred.Deferred<ImportView, AcceptsTakenBack>> = []
  const registry = registryWith({
    imports: {
      get: () => Deferred.await(Deferred.makeUnsafe<ImportView>()),
      decide: (_request: { readonly payload: SaveRequest }) => {
        const answer = Deferred.makeUnsafe<Saved, HttpApiError.InternalServerErrorProblem>()
        saves.push(answer)
        return Deferred.await(answer)
      },
      commit: () => {
        const answer = Deferred.makeUnsafe<ImportView, AcceptsTakenBack>()
        confirms.push(answer)
        return Deferred.await(answer)
      }
    }
  })
  registry.set(importView(id), viewAt({ id, revision: 10, ...parts }))
  registry.mount(importViewShown(id))
  registry.mount(reviewLocal(id))
  registry.mount(followDraft(id))
  const happened = (event: DraftEvent) => registry.set(draftEvents(id), event)
  const shownHere = (): SavedDecisions => {
    const expectedSome1 = registry.get(shownDecisions(id))
    assertTrue(O.isSome(expectedSome1), "expected registry.get(shownDecisions(id))")
    return expectedSome1.value
  }
  return { registry, saves, confirms, happened, shownHere }
}

/** One match's take-backs as the view carries them, read through the contract's schema. */
const takenBack = [
  MatchTakeBack.make({
    matched: O.none(),
    reads: O.none(),
    saved: O.none(),
    revision: 10,
    by: "Marcus",
    field: "unitCost",
    kind: "stored",
    count: 2,
    rows: [RowId.make("row-7"), RowId.make("row-9")]
  })
]

const decides = DraftEvent.Decided({ changes: { "row-7": O.some(replaced), "row-9": O.some(keepStored) } })

describe("a Replace and a Keep-stored taken back because another column than the SKU was matched again", () => {
  it.live("are named by a save's answer, with the field and the rows, and each row is undecided again", () =>
    Effect.gen(function* () {
      const t = world(importNo(91), {})
      yield* settle
      page.said.length = 0
      t.happened(decides)
      yield* settle
      const requiredEntry1 = A.get(t.saves, 0)
      assertTrue(O.isSome(requiredEntry1), "expected t.saves[0]")
      yield* Deferred.succeed(requiredEntry1.value, {
        revision: 11,
        changed: true,
        notApplied: taken,
        decidedSince: []
      })
      yield* settle
      expect(page.said).toEqual([
        "2 decisions were taken back: A column was matched again after you decided: the keep-or-replace on row 7 (Unit cost matched again); the keep-or-replace on row 9 (Unit cost matched again). Each row shows what it reads now, to decide again."
      ])
      const undecided = decisionFromFlags({})
      expect(t.shownHere()).toEqual({ "row-7": undecided, "row-9": undecided })
    })
  )

  it.live("are named by a confirm's refusal, in the toast and above the review, where nothing was imported", () =>
    Effect.gen(function* () {
      const id = importNo(92)
      const t = world(id, {})
      yield* settle
      t.happened(decides)
      yield* settle
      // The save fails: the rows wait, and ride with the confirm.
      const requiredEntry2 = A.get(t.saves, 0)
      assertTrue(O.isSome(requiredEntry2), "expected t.saves[0]")
      yield* Deferred.fail(requiredEntry2.value, HttpApiError.InternalServerErrorProblem.make({}))
      yield* settle
      page.said.length = 0
      t.happened(DraftEvent.ConfirmPressed())
      yield* settle
      const requiredEntry3 = A.get(t.confirms, 0)
      assertTrue(O.isSome(requiredEntry3), "expected t.confirms[0]")
      yield* Deferred.fail(
        requiredEntry3.value,
        AcceptsTakenBack.make({ reason: "A column was matched again.", accepts: taken })
      )
      yield* settle
      expect(page.said).toEqual([
        "2 decisions were taken back: A column was matched again after you decided: the keep-or-replace on row 7 (Unit cost matched again); the keep-or-replace on row 9 (Unit cost matched again). Each row shows what it reads now, to decide again."
      ])
      const expectedSome2 = t.registry.get(confirmHeldBack(id))
      assertTrue(O.isSome(expectedSome2), "expected t.registry.get(confirmHeldBack(id))")
      const why = expectedSome2.value
      expect(heldBackSentence({ why, accepts: acceptsWords(why.accepts) })).toBe(
        "Nothing was imported: the import changed while you were reviewing. A column was matched again after you decided, so those decisions were taken back: the keep-or-replace on row 7 (Unit cost matched again); the keep-or-replace on row 9 (Unit cost matched again). The review and its totals below show the import as it is now. Check them, then import again."
      )
      expect(t.shownHere()).toEqual({})
    })
  )

  it.live("are named from the import's view above the review: who matched which field, and the rows", () =>
    Effect.gen(function* () {
      const id = importNo(93)
      const t = world(id, { takenBack })
      t.registry.mount(takeBacksNamed(id))
      yield* settle
      expect(A.map(t.registry.get(takeBacksNamed(id)), takeBackWords)).toEqual([
        "Marcus matched Unit cost again: 2 keep-or-replace answers were taken back, on rows 7 and 9."
      ])
    })
  )
})
