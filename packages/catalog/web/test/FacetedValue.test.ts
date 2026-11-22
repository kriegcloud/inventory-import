// What a single-choice filter list shows as chosen when the table holds the filter: after the filter is cleared from
// outside the list (its X, the toolbar's Reset, the address going back), nothing is chosen, and one click on an item
// chooses it. The list's own kept copy from before the table took the value over is not read as chosen again.
import { describe, expect, it } from "@effect/vitest"
import * as O from "effect/Option"
import { type FacetedMemory, facetedValueNow } from "@inventory/ui/components/faceted"

const fresh = (): FacetedMemory => ({ held: false, stale: null })

describe("the value a filter list shows", () => {
  it("is nothing once the table that held it has cleared it, though the list kept a copy from the first pick", () => {
    const memory = fresh()
    // Nothing chosen; she picks "Yes": the list keeps it, and the table holds it from the next draw on.
    expect(facetedValueNow(memory, undefined, O.none(), undefined)).toBe(undefined)
    const kept = O.some<string | Array<string> | undefined>("true")
    expect(facetedValueNow(memory, "true", kept, undefined)).toBe("true")
    // Cleared from outside: the table hands nothing again. Drawn twice, it says the same.
    expect(facetedValueNow(memory, undefined, kept, undefined)).toBe(undefined)
    expect(facetedValueNow(memory, undefined, kept, undefined)).toBe(undefined)
    // She picks again: the list keeps the new pick, and shows it until the table hands it back.
    expect(facetedValueNow(memory, undefined, O.some("false"), undefined)).toBe("false")
  })

  it("is the list's own kept value, or its default, where no caller ever held it", () => {
    const memory = fresh()
    expect(facetedValueNow(memory, undefined, O.none(), "a")).toBe("a")
    expect(facetedValueNow(memory, undefined, O.some("b"), "a")).toBe("b")
    expect(facetedValueNow(memory, undefined, O.some(undefined), "a")).toBe(undefined)
  })
})
