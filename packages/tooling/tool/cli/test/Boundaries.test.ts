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

  it.effect("names a third-party package a workspace imports without declaring it, under any hoisted name", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "package.json": json({
            name: "root",
            workspaces: ["packages/*", "apps/*"],
            devDependencies: { vitest: "5.1.0" }
          }),
          "packages/ui/package.json": pkg("@x/ui", { family: "ui-system" }, { react: "19.0.0" }),
          // Declared, the root's own tool, a built-in, a path, and words that only look like an import: all pass.
          "packages/ui/src/fine.ts":
            'import { useRef } from "react"\nimport { it } from "vitest"\nimport "node:path"\nimport "./local"\n' +
            '// import x from "use-callback-ref"\nexport const text = `import y from "@tanstack/react-store"`\n',
          // The same hooks under the names another package's dependencies were hoisted as.
          "packages/ui/src/hoisted.tsx":
            'import { useCallbackRef } from "use-callback-ref"\nexport * from "@tanstack/react-store"\n' +
            'export const late = () => import("@base-ui/utils/useForcedRerendering")\n',
          "apps/shop/package.json": pkg("@x/shop", {}),
          "apps/shop/src/main.ts": 'import { a } from "@/lib/a"\nimport "@dnd-kit/utilities"\nexport { a }\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   apps/shop/src/main.ts imports @dnd-kit/utilities, which @x/shop does not declare (add it where it is used)",
        "err:   packages/ui/src/hoisted.tsx imports use-callback-ref, which @x/ui does not declare (add it where it is used)",
        "err:   packages/ui/src/hoisted.tsx imports @tanstack/react-store, which @x/ui does not declare (add it where it is used)",
        "err:   packages/ui/src/hoisted.tsx imports @base-ui/utils, which @x/ui does not declare (add it where it is used)"
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

  it.effect("lets nothing depend on the infra package, not even an app, and lets it use only the foundation", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "packages/schema/package.json": pkg("@x/schema", { family: "foundation" }),
          "packages/infra/package.json": pkg(
            "@x/infra",
            { family: "infra" },
            { "@x/schema": "workspace:*", "@x/kernel": "workspace:*" }
          ),
          "packages/infra/src/stack.ts": 'import "@x/schema"\n',
          "apps/shop/package.json": pkg("@x/shop", {}, { "@x/infra": "workspace:*" }),
          "apps/shop/src/main.ts": 'import "@x/infra/Stage"\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/shop declares @x/infra, which its layer may not use",
        "err:   apps/shop/src/main.ts imports @x/infra, which its layer may not use",
        "err:   @x/infra declares @x/kernel, which its layer may not use"
      ])
    })
  )
})
