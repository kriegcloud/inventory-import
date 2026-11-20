// Removing an open import. The rules that hurt when wrong: a card for an import that no longer exists must not stay
// on the first screen (after a refusal the list is asked again), an import somebody already removed counts as removed,
// and nothing of a removed import is kept in the tab, its staged rows least of all.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { AlreadyImported, ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { draftOf } from "../src/Draft.atoms.ts"
import { emptyDraft } from "../src/Draft.machine.ts"
import { importTable, openImports, openWorkbook, removeImport } from "../src/Imports.atoms.ts"
import { importNo, registryWith, viewAt } from "./support/catalog.ts"

const settle = Effect.sleep("40 millis")

/** A server with two open imports; `remove` answers as the test says. */
const world = (remove: () => Effect.Effect<void, ImportNotFound | AlreadyImported>) => {
  const first = viewAt({ id: importNo(21), revision: 1, fileName: "a.csv" })
  const second = viewAt({ id: importNo(22), revision: 1, fileName: "b.csv" })
  const asked = { open: 0, table: 0 }
  const registry = registryWith({
    imports: {
      open: () =>
        Effect.sync(() => {
          asked.open++
          return { views: [first, second], older: 0 }
        }),
      table: () =>
        Effect.sync(() => {
          asked.table++
          return { rows: asked.table }
        }),
      remove
    }
  })
  registry.mount(openImports)
  const listed = () =>
    registry.get(openImports).pipe(
      AsyncResult.value,
      O.map((list) => A.map(list.views, (view) => view.fileName)),
      O.getOrNull
    )
  const press = (view: typeof first) => {
    registry.mount(removeImport(view.id))
    registry.set(removeImport(view.id), view)
    return Effect.promise(() => Effect.runPromiseExit(AtomRegistry.getResult(registry, removeImport(view.id))))
  }
  return { registry, first, second, asked, listed, press }
}

describe("removing an open import", () => {
  it.live("that is already gone counts as removed", () =>
    Effect.gen(function* () {
      const t = world(() => Effect.fail(ImportNotFound.make({ reason: "It is gone." })))
      yield* settle
      const exit = yield* t.press(t.first)
      expect(Exit.isSuccess(exit)).toBe(true)
    })
  )

  it.live("that the server refuses puts the card back and asks for the list again", () =>
    Effect.gen(function* () {
      const t = world(() => Effect.fail(AlreadyImported.make({ reason: "It has created items." })))
      yield* settle
      expect(t.asked.open).toBe(1)
      const exit = yield* t.press(t.first)
      yield* settle
      expect(Exit.isFailure(exit)).toBe(true)
      expect(t.listed()).toEqual(["a.csv", "b.csv"])
      expect(t.asked.open).toBe(2)
    })
  )

  it.live("lets its staged rows go: nothing of it is kept in the tab", () =>
    Effect.gen(function* () {
      const t = world(() => Effect.void)
      yield* settle
      // The review of the file was open: its rows are kept for the page.
      const leave = t.registry.mount(importTable(t.first.id))
      yield* settle
      leave()
      expect(t.asked.table).toBe(1)
      yield* t.press(t.first)
      yield* settle
      // A look at them now asks the server: the kept answer is gone.
      t.registry.mount(importTable(t.first.id))
      yield* settle
      expect(t.asked.table).toBe(2)
    })
  )

  it.live("empties its draft and forgets the workbook it was read from, and leaves the other import's alone", () =>
    Effect.gen(function* () {
      const t = world(() => Effect.void)
      yield* settle
      // Both imports have a decision waiting in their draft, and the workbook each was read from is in the tab.
      const waits = { ...emptyDraft, unsent: { "row-2": O.none() }, stalled: true }
      const book = O.some({ file: new File([], "a.xlsx"), sheets: [], chosen: { name: "Items" } as never })
      for (const view of [t.first, t.second]) {
        t.registry.set(draftOf(view.id), waits)
        t.registry.set(openWorkbook(view.id), book)
      }
      yield* t.press(t.first)
      yield* settle
      expect([t.registry.get(draftOf(t.first.id)), t.registry.get(openWorkbook(t.first.id))]).toEqual([
        emptyDraft,
        O.none()
      ])
      expect([t.registry.get(draftOf(t.second.id)), O.isSome(t.registry.get(openWorkbook(t.second.id)))]).toEqual([
        waits,
        true
      ])
    })
  )

  it.live("leaves the other imports' removal alone while one is on its way", () =>
    Effect.gen(function* () {
      const t = world(() => Effect.sleep("60 millis"))
      yield* settle
      t.registry.mount(removeImport(t.first.id))
      t.registry.mount(removeImport(t.second.id))
      t.registry.set(removeImport(t.first.id), t.first)
      yield* Effect.sleep("10 millis")
      expect(t.registry.get(removeImport(t.first.id)).waiting).toBe(true)
      expect(t.registry.get(removeImport(t.second.id)).waiting).toBe(false)
    })
  )
})
