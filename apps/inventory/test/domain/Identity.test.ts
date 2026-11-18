import { describe, expect, it } from "vitest"
import { hasRole } from "../../src/domain/Identity.ts"

describe("hasRole", () => {
  it("lets a role do what lower roles can", () => {
    expect(hasRole("admin", "editor")).toBe(true)
    expect(hasRole("editor", "editor")).toBe(true)
    expect(hasRole("editor", "viewer")).toBe(true)
  })

  it("refuses a role below the minimum", () => {
    expect(hasRole("viewer", "editor")).toBe(false)
    expect(hasRole("editor", "admin")).toBe(false)
  })
})
