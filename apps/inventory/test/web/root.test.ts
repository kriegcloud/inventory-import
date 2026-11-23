// The page is drawn in one atom registry, and it is the root's: what `rootRegistry` holds to its rules (the tests of
// session.test.ts) is what the page has. `main.tsx` makes no registry of its own.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import { isValidElement } from "react"
import { vi } from "vitest"
import mainSource from "../../src/web/main.tsx?raw"
import { openPage, signedInAs } from "./support/page.ts"

vi.mock("sonner", () => ({
  Toaster: () => null,
  toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0, loading: () => 0, success: () => 0 })
}))
// A cold start of the app's modules, on a busy machine.

const settle = Effect.sleep("30 millis")

describe("the page's registry", () => {
  it.live("is the root's, the one the page is drawn in, and the only one", () =>
    Effect.gen(function* () {
      const page = openPage()
      vi.resetModules()
      const [root, member] = yield* Effect.all(
        [
          Effect.promise(() => import("../../src/web/Root.tsx")),
          Effect.promise(() => import("@inventory/client/MemberAtoms"))
        ],
        { concurrency: "unbounded" }
      )
      yield* settle
      page.asked[0]?.answer(signedInAs("dana"))
      yield* settle
      const drawn = root.Root()
      // Made by `rootRegistry`: its member is the session's, and this tab's lock was taken as it was made.
      expect([
        isValidElement<{ readonly value?: unknown }>(drawn) && drawn.props.value === root.pageRegistry,
        root.pageRegistry.get(member.memberKey),
        page.locks.length > 0
      ]).toEqual([true, "mem_dana/org_prairie", true])
      expect([/Registry/.test(mainSource), Str.includes("<Root />")(mainSource)]).toEqual([false, true])
      // The first screen's code, which the answer started, has loaded before the test ends.
      yield* Effect.all(
        [
          Effect.promise(() => import("../../src/web/Workspace.tsx")),
          Effect.promise(() => import("@inventory/catalog-web/ImportPage"))
        ],
        { concurrency: "unbounded" }
      )
    })
  )
})
