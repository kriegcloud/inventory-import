// What the import page draws of an import its address names, and what it follows while it is drawn. A read that failed
// with an answer from before keeps the step drawn (the same one, with whatever is typed in it) under a line that says
// so; only a first read that failed, or an import found gone, takes its place. What could not be read is read again by
// itself when the connection is back. And an import found removed is followed, whatever step the page draws.
import * as MutableRef from "effect/MutableRef"
import { describe, expect, it } from "@effect/vitest"
import { RegistryContext } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import type * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { createElement } from "react"
import { prerender } from "react-dom/static"
import { vi } from "vitest"
import { serverAnswered } from "@inventory/client/ConnectionAtoms"
import { OrganizationId } from "@inventory/kernel/Ids"
import type { ImportView } from "@inventory/catalog-contract/Import"
import { ImportNotFound } from "@inventory/catalog-contract/ImportRejection"
import { ImportPage, readAgainWhenBack } from "../src/ImportPage.screen.tsx"
import { followRemoval, importTable, importView, importViewShown } from "../src/Imports.atoms.ts"
import { importNo, registryFor, viewAt, registryStart } from "./support/catalog.ts"
import { memberStart, memberOf, sessionStandIn } from "./support/session.ts"

const id = importNo(98)

// A desk-wide page at the import's review, and what a component mounts while it is drawn: drawn on a server, where no
// effect runs, so each is mounted as it is drawn.
const browser = vi.hoisted(() => {
  const mounted: Array<unknown> = []
  Object.assign(globalThis, {
    document: Object.assign(new EventTarget(), { cookie: "", visibilityState: "visible", querySelector: () => null }),
    window: Object.assign(new EventTarget(), {
      innerWidth: 1440,
      location: { pathname: "/", search: "?import=00000000-0000-4000-8000-000000000198&step=review" },
      matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined })
    })
  })
  return { mounted }
})
vi.mock("@effect/atom-react", (original) =>
  original<typeof import("@effect/atom-react")>().then((all) => ({
    ...all,
    useAtomMount: (atom: unknown) => {
      browser.mounted.push(atom)
    }
  }))
)
vi.mock("sonner", () => ({
  toast: Object.assign(() => 0, { dismiss: () => undefined, success: () => 0, error: () => 0 })
}))
vi.mock("../src/ReviewStep.screen.tsx", () => ({ ReviewStep: () => "THE REVIEW" }))
vi.mock("../src/UploadStep.screen.tsx", () => ({ UploadStep: () => "THE UPLOAD" }))

// A cold start of the page's modules, on a busy machine.

const settle = Effect.sleep("30 millis")

type Refusal = ImportNotFound | HttpApiError.InternalServerErrorProblem

/** A page on one import, whose reads answer as the test says. */
const pageStart = Effect.succeed(viewAt({ id, revision: 4, fileName: "items.csv", result: O.none() }))
const world = (first: Effect.Effect<ImportView, Refusal>) => {
  const session = sessionStandIn(memberOf({ ...memberStart, account: "mem_dana", id: "mem_dana" }))
  const server: MutableRef.MutableRef<{ readonly answer: Effect.Effect<ImportView, Refusal>; readonly reads: number }> =
    MutableRef.make<{ readonly answer: Effect.Effect<ImportView, Refusal>; readonly reads: number }>({
      answer: first,
      reads: 0
    })
  const registry = registryFor({
    ...registryStart,
    endpoints: {
      imports: {
        get: () =>
          Effect.suspend(() => {
            server.current = { ...server.current, reads: server.current.reads + 1 }
            return Effect.sleep("2 millis").pipe(Effect.andThen(server.current.answer))
          }),
        table: () => Effect.succeed({ rows: [] })
      }
    },
    signedIn: O.some(session.signedIn),
    asked: O.some(session.asked)
  })
  // The page is drawn: it reads the import and its rows, and follows what it mounts.
  registry.mount(importViewShown(id))
  registry.mount(importTable(id))
  return { registry, server }
}

/** What the page draws now, as a browser would be given it. */
const drawn = (registry: AtomRegistry.AtomRegistry) =>
  Effect.promise(() => {
    browser.mounted.length = 0
    return prerender(createElement(RegistryContext, { value: registry }, createElement(ImportPage))).then(
      ({ prelude }) => new Response(prelude).text()
    )
  })

const down = Effect.fail(HttpApiError.InternalServerErrorProblem.make({}))
const notFound = Effect.fail(
  ImportNotFound.make({
    reason: "No import with that id in your organization.",
    organizationId: OrganizationId.make("org_prairie")
  })
)
const line = "This import could not be read again"
const couldNot = "This import could not be opened"
const gone = "This import is not here any more"

/** Which of the page's sentences are drawn, and whether the review is. */
const says = (html: string) => A.filter([line, couldNot, gone, "THE REVIEW"], (words) => Str.includes(words)(html))

/** The box the step is drawn in: the same whether the line is above it or not, so the step stays the one drawn. */
const stepBox = '<div class="min-h-0 flex-1">'
const inStepBox = (html: string) =>
  Str.includes(`${stepBox}THE REVIEW`)(Str.replace(/<!--[^>]*-->/g, "")(html)) &&
  Str.includes('<div class="flex h-full flex-col">')(html)

describe("the import page", () => {
  it.live("keeps the step drawn, the same one, when a later read fails, also while it is asked once more", () =>
    Effect.gen(function* () {
      const t = world(pageStart)
      yield* settle
      const before = yield* drawn(t.registry)
      expect([says(before), inStepBox(before)]).toEqual([["THE REVIEW"], true])
      t.server.current = { ...t.server.current, answer: down }
      importView(id).askAgain(t.registry, O.none())
      yield* settle
      const after = yield* drawn(t.registry)
      expect([says(after), inStepBox(after)]).toEqual([[line, "THE REVIEW"], true])
      importView(id).askAgain(t.registry, O.none())
      const asking = yield* drawn(t.registry)
      expect(says(asking)).toEqual([line, "THE REVIEW"])
      yield* settle
      t.server.current = { ...t.server.current, answer: Effect.succeed(viewAt({ id, revision: 5, result: O.none() })) }
      importView(id).askAgain(t.registry, O.none())
      yield* settle
      const back = yield* drawn(t.registry)
      expect(says(back)).toEqual(["THE REVIEW"])
    })
  )

  it.live("draws nothing from before for an import found gone, also while it is asked once more", () =>
    Effect.gen(function* () {
      const t = world(pageStart)
      yield* settle
      t.server.current = { ...t.server.current, answer: notFound }
      importView(id).askAgain(t.registry, O.none())
      yield* settle
      const found = yield* drawn(t.registry)
      expect(says(found)).toEqual([gone])
      importView(id).askAgain(t.registry, O.none())
      expect(t.registry.get(importView(id)).waiting).toBe(true)
      const asking = yield* drawn(t.registry)
      expect(says(asking)).toEqual([gone])
    })
  )

  it.live("says a first read that failed in the step's place", () =>
    Effect.gen(function* () {
      const t = world(down)
      yield* settle
      const html = yield* drawn(t.registry)
      expect(says(html)).toEqual([couldNot])
    })
  )

  it.live("follows the import being removed, and what could not be read being read again, on any of its steps", () =>
    Effect.gen(function* () {
      const t = world(pageStart)
      yield* settle
      yield* drawn(t.registry)
      const follows = (atom: Atom.Atom<unknown>) => A.some(browser.mounted, (one) => one === atom)
      expect([follows(followRemoval(id)), follows(readAgainWhenBack(id))]).toEqual([true, true])
      // Found gone too: there is no step then, and the page still follows it.
      t.server.current = { ...t.server.current, answer: notFound }
      importView(id).askAgain(t.registry, O.none())
      yield* settle
      yield* drawn(t.registry)
      expect(follows(followRemoval(id))).toBe(true)
    })
  )

  it.live("reads what could not be read again by itself: online, or once the server has answered anything", () =>
    Effect.gen(function* () {
      const t = world(pageStart)
      t.registry.mount(readAgainWhenBack(id))
      yield* settle
      for (const back of [() => window.dispatchEvent(new Event("online")), () => serverAnswered(200)]) {
        t.server.current = { ...t.server.current, answer: down }
        importView(id).askAgain(t.registry, O.none())
        yield* settle
        expect(AsyncResult.isFailure(t.registry.get(importView(id)))).toBe(true)
        t.server.current = {
          ...t.server.current,
          answer: Effect.succeed(viewAt({ id, revision: 5, result: O.none() }))
        }
        back()
        yield* settle
        expect(AsyncResult.isSuccess(t.registry.get(importView(id)))).toBe(true)
      }
    })
  )
})
