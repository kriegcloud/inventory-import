// The undo history behind a review's decisions, kept in this browser per person and import. The rule: it is written
// with every decision, and used when the review is opened again only while it ends at the decisions the server
// holds. A change made on another screen since starts a new history from the server's: "Undo last step" must never
// take back a step that is no longer the last, or bring back decisions somebody else has replaced.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as Atom from "effect/reactivity/Atom"
import { vi } from "vitest"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import { Action, act, saved } from "@inventory/review/ReviewDraft"
import { ReviewRow } from "@inventory/review/ReviewTypes"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { decisionFromFlags, type SavedDecisions, type SaveRequest } from "@inventory/catalog-contract/Decision"
import type { ImportId } from "@inventory/catalog-contract/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { importView, importViewShown } from "../src/Imports.atoms.ts"
import { followDraft, reviewLocal, reviewState } from "../src/ReviewDraft.atoms.ts"
import { importNo, registryFor, viewAt } from "./support/catalog.ts"

// The browser's storage, which outlives a refresh: looked up once when the saved progress is first read. And the tab's
// own storage, which a refresh of the tab keeps: every visit here is a refresh of one tab.
const browser = vi.hoisted(() => {
  const kept: Record<string, string> = {}
  const tab: Record<string, string> = {}
  Object.assign(globalThis, {
    window: {
      localStorage: {
        getItem: (key: string) => kept[key] ?? null,
        setItem: (key: string, value: string) => {
          kept[key] = value
        },
        removeItem: (key: string) => {
          delete kept[key]
        }
      },
      sessionStorage: {
        getItem: (key: string) => tab[key] ?? null,
        setItem: (key: string, value: string) => {
          tab[key] = value
        }
      },
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }
  })
  // A browser without locks: a refresh here is a page whose old one is gone, and nothing holds the tab's lock.
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: {} })
  return { kept }
})

/** What the server answers a save with. */
type Saved = {
  readonly revision: number
  readonly changed: boolean
  readonly notApplied: ReadonlyArray<{ readonly rowId: string; readonly field: string }>
}

const settle = Effect.sleep("15 millis")
const out = decisionFromFlags({ out: true })

const memberOf = (member: string) =>
  O.some(
    Member.make({
      id: MemberId.make(member),
      name: DisplayName.make("Dana Whitfield"),
      role: "admin",
      organizationId: OrganizationId.make("org_prairie"),
      organizationName: DisplayName.make("Prairie")
    })
  )

/** The Review step of one import opened in a page of its own: a refresh is another page on the same storage. */
const visit = (id: ImportId, options: { readonly member?: string; readonly saves?: "taken" | "lost" } = {}) => {
  const server = { revision: 0 }
  const sent: Array<SaveRequest> = []
  const registry = registryFor({
    endpoints: {
      imports: {
        get: () => Deferred.await(Deferred.makeUnsafe<ImportView>()),
        // The server takes every save, unless the test says the network loses them: those never answer.
        decide: (request: { readonly payload: SaveRequest }) => {
          sent.push(request.payload)
          if (options.saves === "lost") return Deferred.await(Deferred.makeUnsafe<Saved>())
          server.revision += 1
          return Effect.succeed({ revision: server.revision, changed: true, notApplied: [] })
        }
      }
    },
    signedIn: Atom.make(memberOf(options.member ?? "mem_dana"))
  })
  return {
    registry,
    sent,
    /** The server's view is in the tab and the step is drawn. */
    open: (revision: number, decisions: SavedDecisions) => {
      server.revision = revision
      registry.set(importView(id), viewAt({ id, revision, decisions }))
      registry.mount(importViewShown(id))
      registry.mount(reviewLocal(id))
      registry.mount(followDraft(id))
      registry.mount(reviewState(id))
    },
    state: () => registry.get(reviewState(id)),
    /** The person takes a step on the region. */
    run: (action: Action) => {
      const next = act({
        rows: A.map(["row-2", "row-3"], (rowId, index) => ReviewRow.make({ id: rowId, line: index + 2, cells: {} })),
        state: registry.get(reviewState(id)),
        action,
        recheck: undefined,
        fixable: () => false,
        rejects: false
      }).state
      registry.set(reviewState(id), next)
      return next
    }
  }
}

const labels = (state: ReviewState) => A.map(state.undo, (step) => step.label)

describe("the undo history kept in the browser", () => {
  it.live(
    "is written with every decision, and comes back after a refresh while it ends at the server's decisions",
    () =>
      Effect.gen(function* () {
        const id = importNo(60)
        const first = visit(id)
        first.open(10, {})
        yield* settle
        expect(labels(first.state())).toEqual([])
        first.run({ type: "leaveOut" as const, rowIds: ["row-2"] })
        const left = first.run({ type: "leaveOut" as const, rowIds: ["row-3"] })
        yield* settle
        expect(labels(left)).toHaveLength(2)
        // Written to the browser with each step, not when the screen leaves.
        expect(R.keys(browser.kept)).toHaveLength(1)

        // A refresh: another page, the same browser. The server holds the two decisions the person made.
        const again = visit(id)
        again.open(12, { "row-2": out, "row-3": out })
        yield* settle
        expect(labels(again.state())).toEqual(labels(left))
        // "Undo last step" takes back the last step taken before the refresh.
        const undone = again.run({ type: "undo" as const })
        expect(R.keys(saved(undone))).toEqual(["row-2"])
      })
  )

  it.live(
    "is not used when the server's decisions were changed on another screen: a new history starts from them",
    () =>
      Effect.gen(function* () {
        const id = importNo(61)
        const first = visit(id)
        first.open(10, {})
        yield* settle
        first.run({ type: "leaveOut" as const, rowIds: ["row-2"] })
        yield* settle

        // Somebody else has since put row 2 back and left row 3 out: the kept history ends somewhere else.
        const again = visit(id)
        again.open(13, { "row-3": out })
        yield* settle
        expect(labels(again.state())).toEqual([])
        expect(R.keys(saved(again.state()))).toEqual(["row-3"])
      })
  )

  it.live(
    "does not decide what comes back: rows the server never took come back over what it holds, and are sent again",
    () =>
      Effect.gen(function* () {
        const id = importNo(63)
        // The network loses the save: row 2 is on the screen, kept in this browser, and not on the server.
        const first = visit(id, { saves: "lost" })
        first.open(10, {})
        yield* settle
        first.run({ type: "leaveOut" as const, rowIds: ["row-2"] })
        yield* settle
        expect(first.sent).toEqual([{ madeOn: { "row-2": 10 }, set: { "row-2": out }, clear: [] }])

        // A refresh. Somebody else has left row 3 out meanwhile: the server holds that, and not row 2.
        const again = visit(id)
        again.open(13, { "row-3": out })
        yield* settle
        // Both are on the screen: what the server holds, with the person's waiting row over it.
        expect(R.keys(saved(again.state()))).toEqual(["row-2", "row-3"])
        // And the row is sent again as the person's decision, made on the revision it was made on.
        expect(again.sent).toEqual([{ madeOn: { "row-2": 10 }, set: { "row-2": out }, clear: [] }])
        yield* settle
        // The server took it: nothing of it waits in this browser any more.
        expect(A.filter(R.keys(browser.kept), Str.includes("waiting"))).toEqual([])
      })
  )

  it.live(
    "is one person's: another member opening the same import in this browser starts with none of the undo history (the waiting rows: KeptRows.test.ts)",
    () =>
      Effect.gen(function* () {
        const id = importNo(62)
        const first = visit(id)
        first.open(10, {})
        yield* settle
        first.run({ type: "leaveOut" as const, rowIds: ["row-2"] })
        yield* settle

        const other = visit(id, { member: "mem_lee" })
        other.open(11, { "row-2": out })
        yield* settle
        expect(labels(other.state())).toEqual([])
        expect(R.keys(saved(other.state()))).toEqual(["row-2"])
      })
  )
})
