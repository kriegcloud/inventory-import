// What a signed-in member is told above whatever page is shown: what became of their unsaved decisions while this tab
// was away, until they dismiss it; and that who is signed in could not be checked, so nothing is sent until it is. And
// what the workspace keeps for as long as it is drawn: the browser's question before the page is left.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { createElement } from "react"
import { prerender } from "react-dom/static"
import { vi } from "vitest"
import { progressKey } from "@inventory/review/SavedProgress"
import { openPage, signedInAs } from "./support/page.ts"

// A cold start of the app's modules, on a busy machine.
vi.setConfig({ testTimeout: 20_000 })

// Drawn on a server, where no effect runs: what a component mounts is told as it is drawn.
const drawing = vi.hoisted(() => ({ mounted: [] as Array<unknown> }))
vi.mock("@effect/atom-react", (original) =>
  original<typeof import("@effect/atom-react")>().then((all) => ({
    ...all,
    useAtomMount: (atom: unknown) => {
      drawing.mounted.push(atom)
    }
  }))
)
vi.mock("sonner", () => ({
  toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0, loading: () => 0, success: () => 0 })
}))
// The pages, each by its name: this test is about what is above them.
vi.mock("@inventory/catalog-web/ImportPage", () => ({ ImportPage: () => "THE IMPORT PAGE" }))
vi.mock("@inventory/catalog-web/ItemsPage", () => ({ ItemsPage: () => "THE ITEMS PAGE" }))
vi.mock("@inventory/access-web/People", () => ({ PeoplePage: () => "THE PEOPLE PAGE" }))
vi.mock("@/pages/ActivityPage", () => ({ ActivityPage: () => "THE ACTIVITY PAGE" }))

const settle = Effect.sleep("40 millis")

/** Where this tab's notices for Dana are kept, and one: an import of hers was removed while the tab was away. */
const noticesKey = progressKey({ organizationId: "org_prairie", memberId: "mem_dana", screen: "notices:tab-1" })
const removed =
  `[{"_tag":"Removed","importId":"00000000-0000-4000-8000-000000000001","fileName":"items_messy.csv",` +
  `"rows":{"row-12":null},"beside":{},"at":1764000000000}]`

/** A page of the app signed in as Dana, at `at`, with what this browser keeps. */
const load = Effect.fnUntraced(function* (at: string, kept: Record<string, string> = {}) {
  const page = openPage({ at, kept, tab: { "inventory:tab": "tab-1" } })
  vi.resetModules()
  const [root, atomReact, workspace, imports, member] = yield* Effect.promise(() =>
    Promise.all([
      import("../../src/web/lib/root.ts"),
      import("@effect/atom-react"),
      import("../../src/web/Workspace.tsx"),
      import("@inventory/catalog-web/Imports"),
      import("@inventory/client/MemberAtoms")
    ])
  )
  const registry = root.rootRegistry({ api: Layer.empty })
  yield* settle
  page.asked[0]?.answer(signedInAs("dana"))
  yield* settle
  const drawn = Effect.promise(() => {
    drawing.mounted.length = 0
    return prerender(
      createElement(atomReact.RegistryContext, { value: registry }, createElement(workspace.default))
    ).then(({ prelude }) => new Response(prelude).text())
  })
  return { page, registry, imports, member, drawn }
})

const pages = {
  "/": "THE IMPORT PAGE",
  "/items": "THE ITEMS PAGE",
  "/activity": "THE ACTIVITY PAGE",
  "/people": "THE PEOPLE PAGE"
}

describe("the workspace", () => {
  it.live(
    "says what became of the member's unsaved decisions above every page, and nothing when there is nothing",
    () =>
      Effect.gen(function* () {
        for (const [at, name] of R.toEntries(pages)) {
          const t = yield* load(at, { [noticesKey]: removed })
          const html = yield* t.drawn
          expect([
            Str.includes(name)(html),
            Str.includes("items_messy.csv was removed")(html),
            Str.includes("Row 12")(html)
          ]).toEqual([true, true, true])
        }
        const t = yield* load("/")
        const html = yield* t.drawn
        expect([Str.includes("THE IMPORT PAGE")(html), Str.includes("was removed")(html)]).toEqual([true, false])
      })
  )

  it.live("says when who is signed in could not be checked, and goes on drawing the page", () =>
    Effect.gen(function* () {
      const said = "We could not check that you are still signed in"
      const t = yield* load("/items")
      const before = yield* t.drawn
      t.member.askWhoIsSignedIn(t.registry)
      yield* settle
      const asking = yield* t.drawn
      t.page.asked[1]?.fail()
      yield* settle
      const unread = yield* t.drawn
      expect(
        A.map([before, asking, unread], (html) => [Str.includes(pages["/items"])(html), Str.includes(said)(html)])
      ).toEqual([
        [true, false],
        [true, false],
        [true, true]
      ])
    })
  )

  it.live("keeps the browser's question before the page is left, whatever page is shown", () =>
    Effect.gen(function* () {
      const t = yield* load("/people")
      yield* t.drawn
      expect(A.some(drawing.mounted, (atom) => atom === t.imports.askBeforeLeaving)).toBe(true)
    })
  )
})
