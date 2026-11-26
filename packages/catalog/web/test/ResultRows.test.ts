import * as DateTime from "effect/DateTime"
import { ImportResult, RowOutcome, DecidedBy } from "@inventory/catalog-contract/Import"
// The Result step's rows when the import is asked again (every return to the tab asks). The read is a new object when
// it starts asking and another when it has answered; the rows are worked out from its answer, so an answer that says
// the same thing works nothing out, and the table keeps its state. Built from the read, they were filtered, and the
// table worked out, twice per return.
import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { vi } from "vitest"
import { importView } from "../src/Imports.atoms.ts"
import { shownRows } from "../src/ResultStep.screen.tsx"
import { importId, registryWith, viewAt } from "./support/catalog.ts"

// The step's module asks how wide the window is when it is first read: a desk-wide page with no sidebar cookie.
vi.hoisted(() => {
  Object.assign(globalThis, {
    document: { cookie: "" },
    window: { innerWidth: 1440, addEventListener: () => undefined, removeEventListener: () => undefined }
  })
})
vi.mock("sonner", () => ({ toast: Object.assign(() => 0, { dismiss: () => undefined, error: () => 0 }) }))

const settle = Effect.sleep("10 millis")

describe("the Result step's rows", () => {
  it.live("are worked out once for an answer, however often the import is asked again", () =>
    Effect.gen(function* () {
      const rows = [
        RowOutcome.cases.created.make({ rowNumber: 2, part: O.none(), sku: "BOLT", name: "Hex bolt" }),
        RowOutcome.cases.notImported.make({
          rowNumber: 3,
          part: O.none(),
          sku: "NUT",
          name: "Hex nut",
          reason: "Cost is missing.",
          decidedBy: DecidedBy.cases.nobody.make({})
        })
      ]
      // What the tab holds of the import: the server answers the very same until something changes.
      const held = viewAt({
        revision: 4,
        status: "imported",
        result: O.some(
          ImportResult.make({
            importedBy: "Dana Whitfield",
            importedAt: DateTime.makeUnsafe("2026-11-19T05:06:15.445Z"),
            created: 1,
            updated: 0,
            already: 0,
            notImported: 1,
            takenBack: 0,
            fixed: { rows: 0, cells: 0 },
            rows
          })
        )
      })
      let asked = 0
      const registry = registryWith({
        imports: {
          get: () =>
            Effect.sync(() => {
              asked += 1
              return held
            })
        }
      })
      registry.mount(importView(importId))
      let worked = 0
      registry.subscribe(shownRows(importId), () => (worked += 1))
      yield* settle
      const first = registry.get(shownRows(importId))
      // Opens on what was left out.
      expect(first).toEqual([rows[1]])
      const before = worked

      registry.refresh(importView(importId))
      yield* settle
      registry.refresh(importView(importId))
      yield* settle
      expect(asked).toBe(3)
      expect(registry.get(shownRows(importId))).toBe(first)
      expect(worked).toBe(before)
    })
  )
})
