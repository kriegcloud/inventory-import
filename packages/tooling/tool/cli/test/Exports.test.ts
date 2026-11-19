import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { exactExports, exportsSentence } from "../src/commands/Laws/Exports.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const manifest = (exports: Record<string, unknown>) => json({ name: "@inventory/ui", exports })

describe("laws exports", () => {
  it.effect("passes when every component and hook has one exact entry", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/ui/package.json": manifest({
            "./components/button": "./src/components/button.tsx",
            "./hooks/use-thing": "./src/hooks/use-thing.ts"
          }),
          "packages/ui/src/components/button.tsx": "",
          "packages/ui/src/hooks/use-thing.ts": ""
        },
        Effect.map(exactExports(), render(exportsSentence)),
        "packages/ui"
      )
      expect(printed(report)).toEqual(["out: check-exports OK  @inventory/ui: 2 exact entries"])
      expect(report.failed).toBe(false)
    })
  )

  it.effect("names a wildcard, an entry with no file, and a file with no entry", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/ui/package.json": manifest({
            "./components/*": "./src/components/*.tsx",
            "./gone": "./src/gone.ts",
            "./odd": null
          }),
          "packages/ui/src/components/nested/card.tsx": ""
        },
        Effect.map(exactExports(), render(exportsSentence)),
        "packages/ui"
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: check-exports FAIL  @inventory/ui",
        "err:   ./components/*: a wildcard export",
        "err:   ./gone: names no file",
        "err:   ./odd: names no file",
        "err:   src/components/nested/card.tsx: no export entry"
      ])
    })
  )
})
