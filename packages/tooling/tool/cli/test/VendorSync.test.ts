import { describe, expect, it } from "@effect/vitest"
import { cataloguedIn, vendoredSpec } from "../src/commands/Vendor/VendorSync.rules.ts"
import { json } from "./support/tree.ts"

describe("vendor sync", () => {
  it("asks for a dependency of the root's catalog as `catalog:`, and for any other at its version", () => {
    const root = json({
      name: "root",
      catalog: { effect: "4.1.5", vitest: "^5.1.0" },
      devDependencies: { turbo: "2.11.11" }
    })
    expect(cataloguedIn(root)).toEqual(["effect", "vitest"])
    const asked = vendoredSpec(cataloguedIn(root))
    expect([asked("effect", "4.1.5"), asked("vitest", "^5.1.0"), asked("turbo", "2.11.11")]).toEqual([
      "catalog:",
      "catalog:",
      "2.11.11"
    ])
    expect(asked("@beep/types", "workspace:*")).toBe("workspace:*")
  })

  it("a root with no catalog changes nothing a vendored package asks for", () => {
    const root = json({ name: "root", devDependencies: { effect: "4.1.5" } })
    expect(cataloguedIn(root)).toEqual([])
    expect(vendoredSpec(cataloguedIn(root))("effect", "4.1.5")).toBe("4.1.5")
  })
})
