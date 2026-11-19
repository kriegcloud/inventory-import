import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { boundaries, boundariesSentence } from "../src/commands/Laws/Boundaries.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const pkg = (name: string, beep: Record<string, string>, dependencies: Record<string, string> = {}) =>
  json({ name, beep, dependencies })

const base = {
  "packages/kernel/package.json": pkg("@x/kernel", { family: "kernel" }),
  "packages/ui/package.json": pkg("@x/ui", { family: "ui-system" }),
  "packages/tooling/tool/cli/package.json": pkg("@x/cli", { family: "tooling" })
}

// Put together here, so the rule does not read this file as reaching into apps/ itself.
const intoApps = `import ${'"../../../apps/shop/src/x"'}`

describe("laws boundaries", () => {
  it.effect("passes when each workspace imports what it declares and its row allows", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "apps/shop/package.json": pkg("@x/shop", {}, { "@x/ui": "workspace:*", "@x/kernel": "workspace:*" }),
          "apps/shop/src/main.ts": 'import { a } from "@x/ui/button"\nimport { b } from "@x/kernel"\nexport { a, b }\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual(["out: check-boundaries OK  4 workspaces"])
    })
  )

  it.effect("names an undeclared import, a refused one, and a path into apps", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "packages/kernel/package.json": pkg("@x/kernel", { family: "kernel" }, { "@x/ui": "workspace:*" }),
          "packages/kernel/src/a.ts": `import "@x/ui/button"\n${intoApps}\n`,
          "packages/ui/src/b.ts": 'export const k = import("@x/kernel")\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/kernel declares @x/ui, which its layer may not use",
        "err:   packages/kernel/src/a.ts imports @x/ui, which its layer may not use",
        'err:   packages/kernel/src/a.ts imports "../../../apps/shop/src/x": a package never reaches into apps/',
        "err:   packages/ui/src/b.ts imports @x/kernel, which @x/ui does not declare"
      ])
    })
  )

  it.effect("lets nothing depend on the tooling package, not even an app", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        { ...base, "apps/shop/package.json": pkg("@x/shop", {}, { "@x/cli": "workspace:*" }) },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/shop declares @x/cli, which its layer may not use"
      ])
    })
  )
})
