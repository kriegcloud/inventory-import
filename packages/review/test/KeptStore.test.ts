// A browser that refuses even to hand over its storage (some private windows) keeps nothing for the review, and that
// is no error on the screen. The rule that would hurt if wrong: the row height and each import's saved progress would
// fail to read, and the review region with them; here each is its default, and a choice is held for the visit.
import { describe, expect, it } from "@effect/vitest"
import * as S from "effect/Schema"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { vi } from "vitest"
import { kept } from "../src/Kept.atoms.ts"

describe("a browser that refuses its storage", () => {
  it("reads the default, and holds what is written for the visit", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new DOMException("The operation is insecure.", "SecurityError")
      }
    })
    const registry = AtomRegistry.make()
    const height = kept({ key: "review:density", schema: S.String, defaultValue: () => "comfortable" })
    expect(registry.get(height)).toBe("comfortable")
    registry.set(height, "compact")
    expect(registry.get(height)).toBe("compact")
    registry.dispose()
    vi.unstubAllGlobals()
  })
})
