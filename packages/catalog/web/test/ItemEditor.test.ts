// One item's save, after the row that pressed it has left the screen. A save runs to its end whatever happens to its
// row, so two things must outlive the row: that a save of the item is out (or the row that comes back offers Edit on
// the revision the first save is about to move, and the second save is refused as "changed by someone else": their
// own), and what the person typed (or "Edit again" on a save that failed opens nothing, and their typing is gone).
// And once a save has answered, the next edit is made on the revision it answered with, even while the table, read
// again only after it, still shows the saved values on the old one.
import { describe, expect, it } from "@effect/vitest"
import { assertDefined, assertTrue } from "@effect/vitest/utils"
import { EditorState } from "../src/ItemEditor.state.ts"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { vi } from "vitest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import { type ItemEdit, StoredItem } from "@inventory/catalog-contract/Item"
import { ItemChanged } from "@inventory/catalog-contract/Catalog"
import { Forbidden } from "@inventory/kernel/AccessError"
import type { ItemForm } from "@inventory/catalog-model/ItemEdit"
import { editItem, itemEditor, saveOut } from "../src/ItemEditor.screen.tsx"
import { itemsPage } from "../src/ItemsPage.screen.tsx"
import { registryFor, registryStart } from "./support/catalog.ts"

// A desk-wide page on another screen than Items, with no row of any item drawn unless the test says so; where the
// page is taken to is kept, and so is every toast, so the test can press the button a failed save offers.
const page = vi.hoisted(() => {
  const state = {
    drawn: false,
    went: [] as Array<string>,
    toasts: [] as Array<{ title: string; description: O.Option<string>; again: O.Option<() => void> }>
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
      page.toasts.push({
        title,
        description: O.fromUndefinedOr(options?.description),
        again: O.fromUndefinedOr(options?.action?.onClick)
      })
      return 0
    }
  })
}))

// Hex bolt M6 as the API sends it, read through its own schema: a refusal that carries the item (`ItemChanged`) is
// built with its constructor, which checks the item it is given.
// @effect-diagnostics-next-line schemaSync:off
const item = S.decodeSync(StoredItem)({
  id: "5b0f8a3e-2c41-4c7e-9a55-0f3c1d2e4b6a",
  sku: "HXB-0616",
  name: "Hex bolt M6",
  description: null,
  category: "components",
  uom: "BX",
  unitCost: "0.19",
  quantityOnHand: 500,
  reorderPoint: null,
  stocking: { kind: "active" },
  lotTracked: false,
  tags: [],
  firstReceivedOn: null,
  dimensions: null,
  vendors: [],
  createdAt: "2026-11-19T05:06:15.445Z",
  createdBy: "Dana Whitfield",
  revision: 3
})
const itemId = item.id
const typed: ItemForm = {
  name: "Hex bolt M6 × 16",
  unitCost: "0.21",
  category: item.category,
  uom: item.uom,
  quantityOnHand: `${item.quantityOnHand}`,
  isActive: true,
  lotTracked: item.lotTracked,
  description: "",
  reorderPoint: "",
  firstReceivedOn: "",
  discontinuedOn: ""
}
const edit = { name: "Hex bolt M6 × 16", revision: 3 } as unknown as ItemEdit
const save = { base: item, edit, form: typed }

/** What the server refuses a save with: a role taken away, or someone else's save in between. */
type Refusal = Forbidden | ItemChanged

/** A server whose edit answers when the test says, with what the test says. */
const world = () => {
  const answers: Array<Deferred.Deferred<StoredItem, Refusal>> = []
  const registry = registryFor({
    ...registryStart,
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
    idleTTL: O.some(20)
  })
  /** The save that is out. */
  const out = () => {
    const expectedSome1 = O.fromUndefinedOr(answers[answers.length - 1])
    assertTrue(O.isSome(expectedSome1), "expected O.fromUndefinedOr(answers[answers.length - 1])")
    return expectedSome1.value
  }
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
      yield* Deferred.fail(
        t.out(),
        Forbidden.make({ reason: "Your role is viewer, and saving an item needs editor.", required: "editor" })
      )
      yield* Effect.sleep("40 millis")
      const said = page.toasts[page.toasts.length - 1]
      assertDefined(said)
      assertTrue(O.isSome(said.description), "the failed item save has its description")
      expect(said.description.value).toContain("Hex bolt M6 was not saved.")
      expect(t.registry.get(saveOut(itemId))).toBe(false)

      page.went.length = 0
      assertTrue(O.isSome(said.again), "the refusal toast offers Edit again")
      said.again.value()
      // No row of the item is on screen: the person is taken to it, the Items table searched for its SKU.
      expect(page.went).toEqual(["/items?search=HXB-0616"])
      // And the editor is open on what they typed, for as long as it takes the row to be drawn.
      yield* afterIdle
      const editor = t.registry.get(itemEditor(itemId))
      assertTrue(EditorState.guards.Open(editor))
      expect(editor.form).toEqual(typed)
      expect(editor.base).toEqual(item)
    })
  )

  it.live("opens in place, on the other person's revision, when someone else saved first and the row is drawn", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.mount(editItem(itemId))
      t.registry.set(editItem(itemId), save)
      yield* Effect.sleep("10 millis")
      const theirs = { ...item, name: "Hex bolt", revision: 4 }
      yield* Deferred.fail(
        t.out(),
        ItemChanged.make({ reason: "Someone changed this item since you opened it.", item: theirs })
      )
      yield* Effect.sleep("40 millis")
      const said = page.toasts[page.toasts.length - 1]
      assertDefined(said)
      expect(said.title).toBe("Changed by someone else")
      page.drawn = true
      page.went.length = 0
      assertTrue(O.isSome(said.again), "the refusal toast offers Edit again")
      said.again.value()
      page.drawn = false
      expect(page.went).toEqual([])
      const editor = t.registry.get(itemEditor(itemId))
      assertTrue(EditorState.guards.Open(editor))
      // Their values are the base the next save is made on; the form is the person's own.
      expect(editor.base).toEqual(theirs)
      expect(editor.form).toEqual(typed)
      // Closed again, the editor holds nothing.
      t.registry.set(itemEditor(itemId), EditorState.cases.Closed.make({}))
      expect(t.registry.get(itemEditor(itemId))).toEqual(EditorState.cases.Closed.make({}))
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
        ...registryStart,
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
                    : Effect.fail(
                        ItemChanged.make({
                          reason: "Someone changed this item since you opened it.",
                          item: server.stored
                        })
                      )
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
      const rowShown = () => {
        const expectedSome2 = registry.get(itemsPage).pipe(
          AsyncResult.value,
          O.flatMap((shown) => A.head(shown.data))
        )
        assertTrue(
          O.isSome(expectedSome2),
          "expected registry.get(itemsPage).pipe(AsyncResult.value, O.flatMap((shown) => A.head(shown.data)))"
        )
        return expectedSome2.value
      }
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
      registry.set(
        itemEditor(itemId),
        EditorState.cases.Open.make({
          base: rowShown(),
          form: typed,
          problems: {},
          notice: O.none()
        })
      )
      const base = yield* EditorState.match(registry.get(itemEditor(itemId)), {
        Closed: () => Effect.die("the test opened the editor"),
        Open: (editor) => Effect.succeed(editor.base)
      })
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

describe("an open editor and the server's answers to the item saves", () => {
  it.live(
    "are one member's: in another organization nothing typed or answered is there, and nothing of it can be sent",
    () =>
      Effect.gen(function* () {
        const member = (id: string, organizationId: string) =>
          O.some(
            Member.make({
              id: MemberId.make(id),
              name: DisplayName.make("Dana Whitfield"),
              role: "admin",
              organizationId: OrganizationId.make(organizationId),
              organizationName: DisplayName.make(organizationId)
            })
          )
        const who = Atom.make(member("mem_dana", "org_prairie"))
        const registry = registryFor({
          ...registryStart,
          endpoints: {
            items: {
              edit: () => Effect.succeed({ ...item, revision: 4 }),
              page: () => Effect.succeed({ data: [], total: 0, pageCount: 0 }),
              facets: () => Effect.succeed({})
            }
          },
          signedIn: O.some(who)
        })
        registry.mount(editItem(itemId))
        registry.mount(itemEditor(itemId))
        registry.set(editItem(itemId), save)
        yield* Effect.sleep("20 millis")
        const opened = EditorState.cases.Open.make({ base: item, form: typed, problems: {}, notice: O.none() })
        registry.set(itemEditor(itemId), opened)
        // Dana's save answered at revision 4: her editor opened on the row's revision 3 is on 4.
        expect(
          O.map(
            O.liftPredicate(EditorState.guards.Open)(registry.get(itemEditor(itemId))),
            (editor) => editor.base.revision
          )
        ).toEqual(O.some(4))
        // The same member, as the session answers when it is asked again: everything stays.
        registry.set(who, member("mem_dana", "org_prairie"))
        expect(
          O.map(O.liftPredicate(EditorState.guards.Open)(registry.get(itemEditor(itemId))), (editor) => editor.form)
        ).toEqual(O.some(typed))
        // She switches to her other organization: no editor is open there, and nothing is typed in one.
        registry.set(who, member("mem_dana_northline", "org_northline"))
        expect(registry.get(itemEditor(itemId))).toEqual(EditorState.cases.Closed.make({}))
        // Opened anew on the row's revision 3: the answer of the other organization's save is not taken for its base.
        registry.set(itemEditor(itemId), opened)
        expect(
          O.map(
            O.liftPredicate(EditorState.guards.Open)(registry.get(itemEditor(itemId))),
            (editor) => editor.base.revision
          )
        ).toEqual(O.some(3))
      })
  )

  it.live("'Edit again' of a save that was not kept opens no editor in another organization, and says why", () =>
    Effect.gen(function* () {
      const member = (id: string, organizationId: string) =>
        O.some(
          Member.make({
            id: MemberId.make(id),
            name: DisplayName.make("Dana Whitfield"),
            role: "admin",
            organizationId: OrganizationId.make(organizationId),
            organizationName: DisplayName.make(organizationId)
          })
        )
      const who = Atom.make(member("mem_dana", "org_prairie"))
      const registry = registryFor({
        ...registryStart,
        endpoints: {
          items: {
            edit: () =>
              Effect.fail(
                Forbidden.make({ reason: "Your role is viewer, and saving an item needs editor.", required: "editor" })
              ),
            page: () => Effect.succeed({ data: [], total: 0, pageCount: 0 }),
            facets: () => Effect.succeed({})
          }
        },
        signedIn: O.some(who)
      })
      registry.mount(editItem(itemId))
      registry.set(editItem(itemId), save)
      yield* Effect.sleep("20 millis")
      const said = A.last(page.toasts)
      assertTrue(O.isSome(said), "the failed save recorded a toast")
      const again = said.value.again
      assertTrue(O.isSome(again), "the failed save offers Edit again")
      registry.set(who, member("mem_dana_northline", "org_northline"))
      page.went.length = 0
      again.value()
      expect([
        EditorState.guards.Open(registry.get(itemEditor(itemId))),
        page.went,
        page.toasts[page.toasts.length - 1]?.title
      ]).toEqual([false, [], "Hex bolt M6 is not in this organization"])
    })
  )
})

describe("the answer of an item's last save", () => {
  it.live("is let go the moment the person is in another organization, though no editor reads it", () =>
    Effect.gen(function* () {
      const member = (id: string, organizationId: string) =>
        O.some(
          Member.make({
            id: MemberId.make(id),
            name: DisplayName.make("Dana Whitfield"),
            role: "admin",
            organizationId: OrganizationId.make(organizationId),
            organizationName: DisplayName.make(organizationId)
          })
        )
      const who = Atom.make(member("mem_dana", "org_prairie"))
      const registry = registryFor({
        ...registryStart,
        endpoints: {
          items: {
            edit: () => Effect.succeed({ ...item, revision: 4 }),
            page: () => Effect.succeed({ data: [], total: 0, pageCount: 0 }),
            facets: () => Effect.succeed({})
          }
        },
        signedIn: O.some(who),
        idleTTL: O.some(20)
      })
      registry.mount(editItem(itemId))
      registry.set(editItem(itemId), save)
      yield* afterIdle
      // Answered at revision 4, with no editor open. She is in Northline a while, then back in Prairie.
      registry.set(who, member("mem_dana_northline", "org_northline"))
      yield* afterIdle
      registry.set(who, member("mem_dana", "org_prairie"))
      registry.mount(itemEditor(itemId))
      registry.set(
        itemEditor(itemId),
        EditorState.cases.Open.make({
          base: item,
          form: typed,
          problems: {},
          notice: O.none()
        })
      )
      // Nothing of Prairie waited in memory while she was in Northline: the editor opens on the row's revision.
      expect(
        O.map(
          O.liftPredicate(EditorState.guards.Open)(registry.get(itemEditor(itemId))),
          (editor) => editor.base.revision
        )
      ).toEqual(O.some(3))
    })
  )
})
