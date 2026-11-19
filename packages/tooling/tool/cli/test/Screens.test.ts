import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { screens } from "../src/commands/Laws/Screens.rules.ts"
import { inTree, json, printed } from "./support/tree.ts"

const tree = (css: string, vite: string) => ({
  "apps/inventory/package.json": json({
    name: "@x/app",
    dependencies: { "@x/ui": "workspace:*", "@x/kernel": "workspace:*" }
  }),
  "apps/inventory/src/web/index.css": css,
  "apps/inventory/vite.config.ts": vite,
  "packages/ui/package.json": json({ name: "@x/ui" }),
  "packages/ui/src/Button.tsx": "",
  "packages/kernel/package.json": json({ name: "@x/kernel" }),
  "packages/kernel/src/Ids.ts": ""
})

const css = '@source "./";\n@source "../../../../packages/ui/src";\n'
const vite = 'const screenPackages = {\n  "@x/ui": fileURLToPath(new URL("../../packages/ui", import.meta.url))\n}\n'

describe("laws screens", () => {
  it.effect("passes when every package with screens is in both lists", () =>
    Effect.gen(function* () {
      const report = yield* inTree(tree(css, vite), screens())
      expect(printed(report)).toEqual(["out: check-screens OK  1 packages with screens, each in both lists: @x/ui"])
    })
  )

  it.effect("names a package missing from each list, and an entry or a source that names nothing", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        tree(
          '@source "../../../../packages/gone/src";\n',
          'const screenPackages = {\n  "@x/ghost": fileURLToPath(new URL("../../packages/ghost", import.meta.url))\n}\n'
        ),
        screens()
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: check-screens FAIL",
        'err:   @x/ui has screens (packages/ui/src) and no `@source` line in apps/inventory/src/web/index.css: add @source "../../../../packages/ui/src";',
        "err:   @x/ui has screens and is not in `screenPackages` in apps/inventory/vite.config.ts with its folder (packages/ui): the production stylesheet would lack its classes",
        "err:   screenPackages names @x/ghost at packages/ghost, which is no package",
        "err:   index.css names the source packages/gone/src, which does not exist"
      ])
    })
  )

  it.effect("says so when the build file has no list to read", () =>
    Effect.gen(function* () {
      const report = yield* inTree(tree(css, "export default {}\n"), screens())
      expect(printed(report).slice(0, 2)).toEqual([
        "err: check-screens FAIL",
        "err:   apps/inventory/vite.config.ts has no `const screenPackages = { ... }` to read"
      ])
    })
  )
})
