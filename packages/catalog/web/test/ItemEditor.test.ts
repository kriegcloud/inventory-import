// One item's save, after the row that pressed it has left the screen. A save runs to its end whatever happens to its
// row, so two things must outlive the row: that a save of the item is out (or the row that comes back offers Edit on
// the revision the first save is about to move, and the second save is refused as "changed by someone else": their
// own), and what the person typed (or "Edit again" on a save that failed opens nothing, and their typing is gone).
// And once a save has answered, the next edit is made on the revision it answered with, even while the table, read
// again only after it, still shows the saved values on the old one.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { vi } from "vitest"
import type { ItemEdit, StoredItem } from "@inventory/catalog-contract/Item"
import type { ItemForm } from "@inventory/catalog-model/ItemEdit"
import { editItem, itemEditor, saveOut } from "../src/ItemEditor.screen.tsx"
import { itemsPage } from "../src/ItemsPage.screen.tsx"
import { registryFor } from "./support/catalog.ts"

// A desk-wide page on another screen than Items, with no row of any item drawn unless the test says so; where the
// page is taken to is kept, and so is every toast, so the test can press the button a failed save offers.
const page = vi.hoisted(() => {
  const state = {
    drawn: false,
    went: [] as Array<string>,
    toasts: [] as Array<{ title: string; description: string; again: (() => void) | undefined }>
  }
  Object.assign(globalThis, {
    document: { cookie: "", querySelector: () => (state.drawn ? {} : null) },
    window: {
      innerWidth: 1440,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      location: { pathname: "/activity", search: "" },
      history: {
        pushState: (_state: unknown, _title: string, to: string) => state.went.push(to),
        replaceState: () => undefined
      }
    },
    CSS: { escape: (text: string) => text }
  })
  return state
})
vi.mock("sonner", () => ({
  toast: Object.assign(() => 0, {
    dismiss: () => undefined,
    success: () => 0,
    error: (title: string, options?: { description?: string; action?: { onClick: () => void } }) => {
      page.toasts.push({ title, description: options?.description ?? "", again: options?.action?.onClick })
      return 0
    }
  })
}))

const itemId = "item_bolt" as StoredItem["id"]
// Only what the save and the editor read of an item.
const item = { id: itemId, sku: "HB-M6-16", name: "Hex bolt M6", revision: 3 } as unknown as StoredItem
const typed = { name: "Hex bolt M6 × 16", unitCost: "0.21" } as unknown as ItemForm
const edit = { name: "Hex bolt M6 × 16", revision: 3 } as unknown as ItemEdit
const save = { base: item, edit, form: typed }

/** What the server refuses a save with: a role taken away, or someone else's save in between. */
type Refusal = { readonly _tag: "Forbidden" } | { readonly _tag: "ItemChanged"; readonly item: StoredItem }

/** A server whose edit answers when the test says, with what the test says. */
const world = () => {
  const answers: Array<Deferred.Deferred<StoredItem, Refusal>> = []
  const registry = registryFor({
    endpoints: {
      items: {
        edit: () => {
          const answer = Deferred.makeUnsafe<StoredItem, Refusal>()
          answers.push(answer)
          return Deferred.await(answer)
        },
        page: () => Effect.succeed({ data: [], total: 0, pageCount: 0 }),
        facets: () => Effect.succeed({})
      }
    },
    idleTTL: 20
  })
  /** The save that is out. */
  const out = () => O.getOrThrow(O.fromUndefinedOr(answers[answers.length - 1]))
  return { registry, out }
}

/** Longer than the registry keeps an atom nobody reads (the app's 400 ms is 20 here). */
const afterIdle = Effect.sleep("80 millis")

describe("a save of an item whose row has left the screen", () => {
  it.live("is still read as out by the row that comes back, until it has answered", () =>
    Effect.gen(function* () {
      const t = world()
      // The row is drawn: it reads its item's write and whether a save is out.
      const row = [t.registry.mount(editItem(itemId)), t.registry.mount(saveOut(itemId))]
      t.registry.set(editItem(itemId), save)
      yield* Effect.sleep("10 millis")
      expect(t.registry.get(saveOut(itemId))).toBe(true)
      // The person pages on: the row leaves, and its atoms are let go.
      for (const leave of row) leave()
      yield* afterIdle
      // They come back before the save has answered. The write's own atom was let go with the row, and read anew it
      // knows of no press; that a save of the item is out is still known, so Edit waits.
      expect(t.registry.get(editItem(itemId)).waiting).toBe(false)
      expect(t.registry.get(saveOut(itemId))).toBe(true)
      yield* Deferred.succeed(t.out(), { ...item, revision: 4 })
      yield* Effect.sleep("40 millis")
      expect(t.registry.get(saveOut(itemId))).toBe(false)
    })
  )

  it.live("opens again on what the person typed, and takes them to the item when its row is not drawn", () =>
    Effect.gen(function* () {
      const t = world()
      const row = t.registry.mount(editItem(itemId))
      t.registry.set(editItem(itemId), save)
      yield* Effect.sleep("10 millis")
      row()
      yield* afterIdle
      // The save is refused after the row has gone: the toast still says so, and offers "Edit again".
      yield* Deferred.fail(t.out(), { _tag: "Forbidden" })
      yield* Effect.sleep("40 millis")
      const said = page.toasts[page.toasts.length - 1]
      expect(said?.description).toContain("Hex bolt M6 was not saved.")
      expect(t.registry.get(saveOut(itemId))).toBe(false)

      page.went.length = 0
      said?.again?.()
      // No row of the item is on screen: the person is taken to it, the Items table searched for its SKU.
      expect(page.went).toEqual(["/items?search=HB-M6-16"])
      // And the editor is open on what they typed, for as long as it takes the row to be drawn.
      yield* afterIdle
      const editor = t.registry.get(itemEditor(itemId))
      expect(editor.open).toBe(true)
      expect(editor.form).toEqual(O.some(typed))
      expect(editor.base).toEqual(O.some(item))
    })
  )

  it.live("opens in place, on the other person's revision, when someone else saved first and the row is drawn", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.mount(editItem(itemId))
      t.registry.set(editItem(itemId), save)
      yield* Effect.sleep("10 millis")
      const theirs = { ...item, name: "Hex bolt", revision: 4 }
      yield* Deferred.fail(t.out(), { _tag: "ItemChanged", item: theirs })
      yield* Effect.sleep("40 millis")
      const said = page.toasts[page.toasts.length - 1]
      expect(said?.title).toBe("Changed by someone else")
      page.drawn = true
      page.went.length = 0
      said?.again?.()
      page.drawn = false
      expect(page.went).toEqual([])
      const editor = t.registry.get(itemEditor(itemId))
      expect(editor.open).toBe(true)
      // Their values are the base the next save is made on; the form is the person's own.
      expect(editor.base).toEqual(O.some(theirs))
      expect(editor.form).toEqual(O.some(typed))
      // Closed again, the editor holds nothing.
      t.registry.set(itemEditor(itemId), { ...editor, open: false })
      expect(t.registry.get(itemEditor(itemId)).form).toEqual(O.none())
    })
  )
})

describe("an item edited again after its save has answered, before the table is read again", () => {
  it.live("is saved on the revision the first save made, not refused as someone else's change", () =>
    Effect.gen(function* () {
      // The server keeps the item and refuses an edit on any revision but the stored one, as the real one does, a
      // moment after the request (an answer is never in the same tick as the press). The table's first read answers
      // at once; every read after it (the one a save asks for) answers when the test says.
      const server = { stored: item, reads: 0 }
      const late = Deferred.makeUnsafe<void>()
      const pageOf = (row: StoredItem) => ({ data: [row], total: 1, pageCount: 1 })
      const registry = registryFor({
        endpoints: {
          items: {
            edit: (request: { readonly payload: ItemEdit }) =>
              Effect.sleep("1 millis").pipe(
                Effect.andThen(() =>
                  request.payload.revision === server.stored.revision
                    ? Effect.sync(() => {
                        const { revision: _revision, ...values } = request.payload
                        server.stored = { ...server.stored, ...values, revision: server.stored.revision + 1 }
                        return server.stored
                      })
                    : Effect.fail({ _tag: "ItemChanged", item: server.stored })
                )
              ),
            page: () => {
              server.reads += 1
              return server.reads === 1
                ? Effect.succeed(pageOf(server.stored))
                : Deferred.await(late).pipe(Effect.map(() => pageOf(server.stored)))
            },
            facets: () => Effect.succeed({})
          }
        }
      })
      const rowShown = () =>
        registry.get(itemsPage).pipe(
          AsyncResult.value,
          O.flatMap((shown) => A.head(shown.data)),
          O.getOrThrow
        )
      registry.mount(itemsPage)
      registry.mount(editItem(itemId))
      yield* Effect.sleep("10 millis")
      const toastsBefore = page.toasts.length

      registry.set(editItem(itemId), { base: rowShown(), edit, form: typed })
      yield* Effect.sleep("20 millis")
      // The save has answered and is no longer out, so Edit is offered; the table has not been read again, and its
      // row shows the saved values on the revision before the save.
      expect(registry.get(saveOut(itemId))).toBe(false)
      expect(rowShown()).toMatchObject({ name: "Hex bolt M6 × 16", revision: 3 })

      // The person opens the editor from that row, as the pencil does, and saves again on the editor's base.
      registry.set(itemEditor(itemId), {
        open: true,
        base: O.some(rowShown()),
        form: O.some(typed),
        problems: {},
        notice: null
      })
      const base = O.getOrThrow(registry.get(itemEditor(itemId)).base)
      const again = { name: "Hex bolt M6 × 20", revision: base.revision } as unknown as ItemEdit
      registry.set(editItem(itemId), { base, edit: again, form: typed })
      yield* Effect.sleep("20 millis")

      // Nobody else touched the item: the second save is kept, on the revision the first one made.
      const refused = A.filter(A.drop(page.toasts, toastsBefore), (said) => said.title === "Changed by someone else")
      expect(refused).toEqual([])
      expect(server.stored).toMatchObject({ name: "Hex bolt M6 × 20", revision: 5 })

      yield* Deferred.succeed(late, undefined)
      yield* Effect.sleep("20 millis")
      expect(rowShown()).toMatchObject({ name: "Hex bolt M6 × 20", revision: 5 })
    })
  )
})
