import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as S from "effect/Schema"
import {
  ChangedCheckInput,
  ChangedCheckPlan,
  CheckPackage,
  TurboPackages,
  changedCheckArguments,
  changedCheckPlan
} from "../src/commands/Check/CheckChanged.schema.ts"

const leaf = CheckPackage.make({ name: "@x/leaf", scripts: ["check", "lint", "test"], dependencies: [] })
const model = CheckPackage.make({ name: "@x/model", scripts: ["test", "prove"], dependencies: [] })
const web = CheckPackage.make({ name: "@x/web", scripts: ["test"], dependencies: ["@x/model"] })
const app = CheckPackage.make({ name: "@x/app", scripts: ["test"], dependencies: ["@x/web"] })
const input = ChangedCheckInput.make({
  base: "1234567890",
  changedPackages: [leaf.name],
  packages: [leaf, model, web, app],
  rootTasks: ["//#defaults:check", "//#assertions:check"],
  globalChange: false
})

describe("changed check planner", () => {
  it("forwards turbo flags when Bun consumed the separator, preserving explicit separators and CLI help", () => {
    expect(changedCheckArguments(["check", "changed", "--filter=@x/a", "--force"])).toEqual([
      "check",
      "changed",
      "--",
      "--filter=@x/a",
      "--force"
    ])
    expect(changedCheckArguments(["check", "changed", "--", "--force"])).toEqual(["check", "changed", "--", "--force"])
    expect(changedCheckArguments(["check", "changed", "--help"])).toEqual(["check", "changed", "--help"])
    expect(changedCheckArguments(["check", "changed"])).toEqual(["check", "changed"])
    expect(changedCheckArguments(["check", "run", "--", "turbo", "run", "check"])).toEqual([
      "check",
      "run",
      "--",
      "turbo",
      "run",
      "check"
    ])
  })

  it("runs a leaf's own test and every root law in one turbo run", () => {
    const plan = changedCheckPlan(input)
    expect(plan.words).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      ...input.rootTasks,
      "@x/leaf#test",
      "--filter=...[1234567890]"
    ])
    expect(plan.sentence).toContain("1 package changed since 12345678 (@x/leaf)")
    expect(plan.sentence).toContain("lint of 1 package")
  })
  it("checks transitive dependents but runs only the changed package's tests and prove", () => {
    const plan = changedCheckPlan(ChangedCheckInput.make({ ...input, changedPackages: [model.name] }))
    expect(plan.words).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      ...input.rootTasks,
      "@x/model#test",
      "@x/model#prove",
      "--filter=...[1234567890]"
    ])
    expect(plan.sentence).toContain("lint of 3 packages")
    expect(plan.sentence).toContain("Dependents' tests run in `bun run check`")
  })
  it("runs only root laws when no workspace changed", () => {
    const plan = changedCheckPlan(ChangedCheckInput.make({ ...input, changedPackages: [] }))
    expect(plan.words).toEqual(["turbo", "run", ...input.rootTasks])
    expect(plan.sentence).toBe("check:changed: no package changed since 12345678; root laws only.")
  })
  it("runs every package's own tests and proofs for shared root changes even if turbo selects none", () => {
    const plan = changedCheckPlan(ChangedCheckInput.make({ ...input, changedPackages: [], globalChange: true }))
    expect(plan.words).toEqual([
      "turbo",
      "run",
      "check",
      "lint",
      ...input.rootTasks,
      "@x/leaf#test",
      "@x/model#test",
      "@x/model#prove",
      "@x/web#test",
      "@x/app#test"
    ])
    expect(plan.sentence).toContain("shared root configuration changed")
    expect(plan.sentence).toContain("every package's own tests and proofs")
  })
  it("does not invent a test script for a package without one and terminates on dependency cycles", () => {
    const a = CheckPackage.make({ name: "@x/a", scripts: [], dependencies: ["@x/b"] })
    const b = CheckPackage.make({ name: "@x/b", scripts: ["test"], dependencies: ["@x/a"] })
    const plan = changedCheckPlan(ChangedCheckInput.make({ ...input, packages: [a, b], changedPackages: [a.name] }))
    expect(plan.words).toEqual(["turbo", "run", "check", "lint", ...input.rootTasks, "--filter=...[1234567890]"])
    expect(plan.sentence).toContain("lint of 2 packages")
  })
  it.prop("CheckPackage generates valid values", [Arbitrary.schema(CheckPackage)], ([value]) => {
    expect(S.is(CheckPackage)(value)).toBe(true)
  })
  it.prop("ChangedCheckInput generates valid values", [Arbitrary.schema(ChangedCheckInput)], ([value]) => {
    expect(S.is(ChangedCheckInput)(value)).toBe(true)
  })
  it.prop("ChangedCheckPlan generates valid values", [Arbitrary.schema(ChangedCheckPlan)], ([value]) => {
    expect(S.is(ChangedCheckPlan)(value)).toBe(true)
  })
  it.prop("TurboPackages generates valid values", [Arbitrary.schema(TurboPackages)], ([value]) => {
    expect(S.is(TurboPackages)(value)).toBe(true)
  })
})
