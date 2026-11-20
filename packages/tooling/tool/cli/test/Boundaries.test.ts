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
            dependencies: { tslib: "2.8.1" }
          }),
          "packages/ui/package.json": pkg("@x/ui", { family: "ui-system" }, { react: "19.0.0" }),
          // Declared, what the root runs every workspace with, a built-in, a path, and words that only look like an
          // import: all pass.
          "packages/ui/src/fine.ts":
            'import { useRef } from "react"\nimport "tslib"\nimport "node:path"\nimport "./local"\n' +
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

  it.effect("refuses in src what a workspace declares only for its tests, and lets its tests import it", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "package.json": json({
            name: "root",
            workspaces: ["packages/*", "apps/*"],
            devDependencies: { vitest: "5.1.0" }
          }),
          "packages/review/package.json": json({
            name: "@x/review",
            beep: { family: "web-kit" },
            dependencies: { effect: "4.1.4", "@x/kernel": "workspace:*" },
            peerDependencies: { react: "19.0.0" },
            devDependencies: { "@tanstack/store": "0.11.2", "@x/ui": "workspace:*" }
          }),
          // The code: a dependency, a peer, and two packages declared only for the tests.
          "packages/review/src/Region.ts":
            'import * as O from "effect/Option"\nimport { useRef } from "react"\n' +
            'import { createAtom } from "@tanstack/store"\nimport "@x/kernel"\nexport { O, useRef, createAtom }\n',
          "packages/review/src/Grid.ts": 'export const late = () => import("@x/ui/button")\n',
          // The test may import what is declared for it.
          "packages/review/test/Region.test.ts": 'import { createAtom } from "@tanstack/store"\nexport { createAtom }\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/review declares @x/ui, which its layer may not use",
        "err:   packages/review/src/Grid.ts imports @x/ui, which @x/review declares only for its tests (devDependencies): declare it in dependencies, or keep it in test",
        "err:   packages/review/src/Region.ts imports @tanstack/store, which @x/review declares only for its tests (devDependencies): declare it in dependencies, or keep it in test"
      ])
    })
  )

  // The holes the second review found: the root's tools (its devDependencies) passed in any src, and TypeScript's
  // own `import x = require()` was never read.
  it.effect("refuses in src a tool only the root's devDependencies declare, and reads import x = require()", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "package.json": json({
            name: "root",
            workspaces: ["packages/*", "apps/*"],
            dependencies: { tslib: "2.8.1" },
            devDependencies: { typescript: "7.0.2", vitest: "5.1.0" }
          }),
          "packages/ui/package.json": pkg("@x/ui", { family: "ui-system" }, { react: "19.0.0" }),
          // The code: what the root runs everything with passes; its tools, and a package required the old way, not.
          "packages/ui/src/tool.ts":
            'import "tslib"\nimport ts from "typescript"\nimport store = require("@tanstack/store")\n' +
            'import kernel = require("@x/kernel")\nexport { ts, store, kernel }\n',
          // The tests are run by the root's tools: they may import them, in either form.
          "packages/ui/test/tool.test.ts":
            'import { it } from "vitest"\nimport ts = require("typescript")\nexport { it, ts }\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   packages/ui/src/tool.ts imports typescript, which @x/ui does not declare (add it where it is used)",
        "err:   packages/ui/src/tool.ts imports @tanstack/store, which @x/ui does not declare (add it where it is used)",
        "err:   packages/ui/src/tool.ts imports @x/kernel, which @x/ui does not declare"
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
