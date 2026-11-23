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

  // Report 14 section 7.2: the ontology package may use the foundation, the kernel and a context's contract package,
  // and nothing else of the repository's.
  it.effect("lets the ontology package use the foundation, the kernel and a context's contract, and nothing else", () =>
    Effect.gen(function* () {
      const contextPkg = (name: string, layer: string) => pkg(name, { family: "context", context: "access", layer })
      const ontology = (dependencies: Record<string, string>) =>
        pkg("@x/ontology", { family: "ontology" }, dependencies)
      const tree = {
        ...base,
        "packages/schema/package.json": pkg("@x/schema", { family: "foundation" }),
        "packages/access/contract/package.json": contextPkg("@x/access-contract", "contract"),
        "packages/access/model/package.json": contextPkg("@x/access-model", "model")
      }
      const passing = yield* inTree(
        {
          ...tree,
          "packages/ontology/package.json": ontology({
            "@x/schema": "workspace:*",
            "@x/kernel": "workspace:*",
            "@x/access-contract": "workspace:*"
          }),
          "packages/ontology/test/a.test.ts":
            'import "@x/schema"\nimport "@x/kernel/Terms"\nimport "@x/access-contract/People"\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(passing)).toEqual(["out: check-boundaries OK  7 workspaces"])
      const refused = yield* inTree(
        {
          ...tree,
          "packages/ontology/package.json": ontology({ "@x/access-model": "workspace:*", "@x/ui": "workspace:*" }),
          "packages/ontology/test/a.test.ts": 'import "@x/access-model/People"\nimport "@x/ui/button"\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(refused)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/ontology declares @x/access-model, which its layer may not use",
        "err:   @x/ontology declares @x/ui, which its layer may not use",
        "err:   packages/ontology/test/a.test.ts imports @x/access-model, which its layer may not use",
        "err:   packages/ontology/test/a.test.ts imports @x/ui, which its layer may not use"
      ])
    })
  )

  // Decision 9: nothing imports the ontology package, the app and the kernel included, in its code or its tests.
  it.effect("lets nothing depend on the ontology package, not even an app", () =>
    Effect.gen(function* () {
      const onOntology = { "@x/ontology": "workspace:*" }
      const report = yield* inTree(
        {
          ...base,
          "packages/ontology/package.json": pkg("@x/ontology", { family: "ontology" }),
          "packages/kernel/package.json": json({
            name: "@x/kernel",
            beep: { family: "kernel" },
            devDependencies: onOntology
          }),
          "packages/kernel/test/a.test.ts": 'import "@x/ontology/Lift"\n',
          "apps/shop/package.json": pkg("@x/shop", {}, onOntology),
          "apps/shop/src/main.ts": 'import "@x/ontology/Lift"\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/shop declares @x/ontology, which its layer may not use",
        "err:   apps/shop/src/main.ts imports @x/ontology, which its layer may not use",
        "err:   @x/kernel declares @x/ontology, which its layer may not use",
        "err:   packages/kernel/test/a.test.ts imports @x/ontology, which its layer may not use"
      ])
    })
  )

  it.effect("lets nothing reach the scratchpad: not declared, not imported by name or by path, from any file", () =>
    Effect.gen(function* () {
      // Put together here, so the rule does not read this file as reaching into the scratchpad itself.
      const byPath = (up: string) => `import ${`"${up}scratchpad/experiments/idea/Idea.ts"`}`
      const report = yield* inTree(
        {
          ...base,
          // The scratchpad may import anything, and is never read as a workspace.
          "scratchpad/package.json": pkg("@x/scratchpad", { family: "scratchpad" }, { "@x/kernel": "workspace:*" }),
          "scratchpad/experiments/idea/Idea.ts": 'import "@x/ui/button"\nimport "left-pad"\n',
          "apps/shop/package.json": pkg("@x/shop", { family: "app" }, { "@x/scratchpad": "workspace:*" }),
          "apps/shop/src/main.ts": `import "@x/scratchpad/experiments/idea/Idea"\n${byPath("../../../")}\n`,
          "apps/shop/vite.config.ts": `${byPath("../../")}\n`,
          "apps/shop/scripts/seed.mjs": `${byPath("../../../")}\n`,
          "packages/kernel/test/a.test.ts": `${byPath("../../../")}\n`
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      const refused = (where: string, specifier: string) =>
        `err:   ${where} imports "${specifier}": nothing imports from the scratchpad. An experiment's code graduates into a package first`
      expect(printed(report)).toEqual([
        "err: check-boundaries FAIL",
        "err:   @x/shop declares @x/scratchpad: nothing depends on the scratchpad. Move what it needs into a package",
        refused("apps/shop/src/main.ts", "@x/scratchpad/experiments/idea/Idea"),
        refused("apps/shop/src/main.ts", "../../../scratchpad/experiments/idea/Idea.ts"),
        refused("apps/shop/scripts/seed.mjs", "../../../scratchpad/experiments/idea/Idea.ts"),
        refused("apps/shop/vite.config.ts", "../../scratchpad/experiments/idea/Idea.ts"),
        refused("packages/kernel/test/a.test.ts", "../../../scratchpad/experiments/idea/Idea.ts")
      ])
    })
  )

  it.effect(
    "a repository with a scratchpad nothing reaches passes, and the scratchpad is not counted as a workspace",
    () =>
      Effect.gen(function* () {
        const report = yield* inTree(
          {
            ...base,
            "scratchpad/package.json": pkg("@x/scratchpad", { family: "scratchpad" }, { "@x/kernel": "workspace:*" }),
            "scratchpad/experiments/idea/Idea.ts": 'import "@x/ui/button"\nimport "left-pad"\n'
          },
          Effect.map(boundaries(), render(boundariesSentence))
        )
        expect(printed(report)).toEqual(["out: check-boundaries OK  3 workspaces"])
      })
  )

  it.effect(
    "refuses the other ways in: the root's files and manifest, an alias, an import map, a glob, a stylesheet",
    () =>
      Effect.gen(function* () {
        // Put together here, so the rule does not read this file's fixtures as its own.
        const quote = (text: string) => `"${text}"`
        const report = yield* inTree(
          {
            ...base,
            "package.json": json({
              name: "root",
              workspaces: ["apps/*", "packages/*", "scratchpad"],
              devDependencies: { "@x/scratchpad": "workspace:*" },
              imports: { "#exp/*": "./scratchpad/experiments/*" }
            }),
            "scratchpad/package.json": pkg("@x/scratchpad", { family: "scratchpad" }),
            "alchemy.run.ts": `import ${quote("./scratchpad/experiments/idea/Stack.ts")}\n`,
            "apps/shop/package.json": json({
              name: "@x/shop",
              beep: { family: "app" },
              imports: { "#idea": "../../scratchpad/experiments/idea/Idea.ts" }
            }),
            "apps/shop/src/web/Page.tsx": `import ${quote("@/../../../../scratchpad/experiments/idea/Idea.ts")}\nconst all = import.meta.glob(${quote("../../../../scratchpad/experiments/**/*.ts")})\nexport { all }\n`,
            "apps/shop/src/web/index.css": `@source ${quote("../../../../scratchpad/experiments")};\n@import ${quote("../../../../scratchpad/experiments/idea/screen.css")};\n`
          },
          Effect.map(boundaries(), render(boundariesSentence))
        )
        const refused = (where: string, specifier: string) =>
          `err:   ${where} imports "${specifier}": nothing imports from the scratchpad. An experiment's code graduates into a package first`
        expect(printed(report)).toEqual([
          "err: check-boundaries FAIL",
          "err:   the root's package.json declares @x/scratchpad: nothing depends on the scratchpad. Move what it needs into a package",
          refused("package.json", "./scratchpad/experiments/*"),
          refused("alchemy.run.ts", "./scratchpad/experiments/idea/Stack.ts"),
          refused("apps/shop/src/web/Page.tsx", "../../../../scratchpad/experiments/**/*.ts"),
          refused("apps/shop/src/web/Page.tsx", "@/../../../../scratchpad/experiments/idea/Idea.ts"),
          refused("apps/shop/src/web/index.css", "../../../../scratchpad/experiments"),
          refused("apps/shop/src/web/index.css", "../../../../scratchpad/experiments/idea/screen.css"),
          refused("apps/shop/package.json", "../../scratchpad/experiments/idea/Idea.ts")
        ])
      })
  )

  it.effect("a folder of a package that is only named scratchpad is not the scratchpad", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...base,
          "scratchpad/package.json": pkg("@x/scratchpad", { family: "scratchpad" }),
          "packages/ui/src/scratchpad/Note.ts": "export const note = 1\n",
          "packages/ui/src/Use.ts": 'import { note } from "./scratchpad/Note.ts"\nexport { note }\n'
        },
        Effect.map(boundaries(), render(boundariesSentence))
      )
      expect(printed(report)).toEqual(["out: check-boundaries OK  3 workspaces"])
    })
  )
})
