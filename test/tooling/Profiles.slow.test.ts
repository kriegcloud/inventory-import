// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

// The two diagnostic profiles (tsconfig.base.json, scripts/check-strict.mjs): a style finding is only a suggestion in
// the hour and counts at production severity; a correctness finding fails the hour's check. Slow: each case runs the
// type-checker on a fixture in test/fixtures/profiles/.

const run = (command: string, args: ReadonlyArray<string>) => {
  const result = spawnSync(command, args, { encoding: "utf8" })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}
const typecheck = (fixture: string) =>
  run(process.execPath, [
    "node_modules/@effect/tsgo/dist/effect-tsgo.cjs",
    "tsrs",
    "-p",
    `test/fixtures/profiles/tsconfig.${fixture}.json`
  ])
const strict = (fixture: string) =>
  run(process.execPath, ["scripts/check-strict.mjs", "--project", `test/fixtures/profiles/tsconfig.${fixture}.json`])

describe("the diagnostic profiles", () => {
  it("lets a style finding pass the hour's type-check and counts it at production severity", () => {
    expect(typecheck("style").status).toBe(0)
    const measured = strict("style")
    expect(measured.status).toBe(0)
    expect(measured.out).toContain("preferEffectString: 1")
    expect(measured.out).toContain("Total: 1 finding in 1 rule")
  }, 60_000)

  it("fails the hour's type-check on a correctness finding", () => {
    const checked = typecheck("correctness")
    expect(checked.status).not.toBe(0)
    expect(checked.out).toContain("effect(floatingEffect)")
  }, 60_000)
})
