import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { globFits, modelInputs, modelInputsSentence } from "../src/commands/Laws/ModelInputs.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

// A model package whose model reaches an aggregate, a view through it, and a rule through the view (no extension).
const tree = (inputs: string) => ({
  "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
  "packages/shop/turbo.json": `{
  // The search of the whole model, with a comment as turbo allows.
  "tasks": {
    "verify": {
      "inputs": [${inputs}, "$TURBO_ROOT$/packages/kernel/src/**",]
    }
  }
}
`,
  "packages/shop/src/Shop.model.ts":
    'import { Basket } from "./Basket/Basket.aggregate.ts"\nimport * as A from "effect/Array"\n',
  "packages/shop/src/Basket/Basket.aggregate.ts": 'import type { Totals } from "./Totals.view.ts"\n',
  "packages/shop/src/Basket/Totals.view.ts": 'import { sum } from "../Sum"\n',
  "packages/shop/src/Sum.ts": "export const sum = 1\n",
  "packages/shop/src/Unreached.query.ts": "export const q = 1\n"
})

describe("laws model-inputs", () => {
  it.effect("refuses a file the model imports that no input of verify reads, naming the glob to add", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        tree('"src/**/*.model.ts", "src/**/*.aggregate.ts"'),
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: model-inputs:check FAIL  a model reaches a file a task of its package does not read, so a change to it would replay an old pass:",
        'err:   packages/shop/src/Basket/Totals.view.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "src/**/*.view.ts" to its inputs',
        'err:   packages/shop/src/Sum.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "src/Sum.ts" to its inputs'
      ])
    })
  )

  it.effect("passes once the globs read every file the model reaches", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        tree('"src/**/*.{model,aggregate,view}.ts", "src/Sum.ts"'),
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report)).toEqual([
        "out: model-inputs:check OK  4 starts reach 4 files (the models, Apis, aggregates and decisions, and the code each task reads), each an input of every task of its package that reads it"
      ])
    })
  )

  // Before, this refusal advised adding "src/**/*.view.ts", which the ! glob would still take out.
  it.effect("takes out what a ! glob names, and names that glob to remove or narrow", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        tree('"src/**", "!src/**/*.view.ts"'),
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        'err:   packages/shop/src/Basket/Totals.view.ts, which packages/shop/src/Shop.model.ts imports, is taken out of the inputs of verify in packages/shop/turbo.json by "!src/**/*.view.ts": remove that glob, or narrow it so it leaves this file in'
      ])
    })
  )

  // Each case below passed before the walk resolved against the whole package, mapped .js to .ts, read the type
  // import(), refused an import naming no file, and held prove and the mutants as it holds verify.
  it.effect(
    "follows a .js written for .ts, a file outside src, and a type import(), and refuses an import of no file",
    () =>
      Effect.gen(function* () {
        const report = yield* inTree(
          {
            "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
            "packages/shop/turbo.json": json({ tasks: { verify: { inputs: ["src/**/*.model.ts"] } } }),
            "packages/shop/src/Shop.model.ts":
              'import { a } from "./A.js"\nimport { b } from "../lib/B.ts"\nexport type D = typeof import("./D.ts")\nimport { m } from "./Missing.ts"\n',
            "packages/shop/src/A.ts": "export const a = 1\n",
            "packages/shop/lib/B.ts": "export const b = 1\n",
            "packages/shop/src/D.ts": "export const d = 1\n"
          },
          Effect.map(modelInputs(), render(modelInputsSentence))
        )
        expect(printed(report).slice(1)).toEqual([
          'err:   packages/shop/src/Shop.model.ts imports "./Missing.ts", which names no file: write the path of the file it means',
          'err:   packages/shop/src/A.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "src/A.ts" to its inputs',
          'err:   packages/shop/lib/B.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "lib/B.ts" to its inputs',
          'err:   packages/shop/src/D.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "src/D.ts" to its inputs'
        ])
      })
  )

  it.effect("holds prove from each decision, the mutants from the model, and walks an Api's own imports", () =>
    Effect.gen(function* () {
      const narrow = ["src/**/*.{model,api,decision}.ts"]
      const report = yield* inTree(
        {
          "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
          "packages/shop/turbo.json": json({
            tasks: {
              verify: { inputs: ["src/**/*.{model,api,decision,rules}.ts", "src/Api/**"] },
              prove: { inputs: narrow },
              mutants: { inputs: narrow },
              "mutants:sample": { inputs: [...narrow, "src/**/*.rules.ts"] }
            }
          }),
          "packages/shop/src/Shop.model.ts": 'import { Pay } from "./Pay.decision.ts"\n',
          "packages/shop/src/Pay.decision.ts": 'import { foo } from "./Foo.rules.ts"\n',
          "packages/shop/src/Foo.rules.ts": "export const foo = 1\n",
          "packages/shop/src/Shop.api.ts": 'import { own } from "./Api/Own.ts"\n',
          "packages/shop/src/Api/Own.ts": "export const own = 1\n"
        },
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        'err:   packages/shop/src/Api/Own.ts, which packages/shop/src/Shop.api.ts imports, is in no input of mutants in packages/shop/turbo.json: add "src/Api/Own.ts" to its inputs',
        'err:   packages/shop/src/Foo.rules.ts, which packages/shop/src/Shop.model.ts imports, is in no input of mutants in packages/shop/turbo.json: add "src/**/*.rules.ts" to its inputs',
        'err:   packages/shop/src/Api/Own.ts, which packages/shop/src/Shop.api.ts imports, is in no input of mutants:sample in packages/shop/turbo.json: add "src/Api/Own.ts" to its inputs',
        'err:   packages/shop/src/Foo.rules.ts, which packages/shop/src/Pay.decision.ts imports, is in no input of prove in packages/shop/turbo.json: add "src/**/*.rules.ts" to its inputs',
        // prove's inputs read the Api, so what it imports is held too.
        'err:   packages/shop/src/Api/Own.ts, which packages/shop/src/Shop.api.ts imports, is in no input of prove in packages/shop/turbo.json: add "src/Api/Own.ts" to its inputs'
      ])
    })
  )

  // Each case below passed before the law read $TURBO_DEFAULT$ as the package's own files, walked from each code file a
  // task's inputs read, cut a ?query or #hash, read an import() of a template, and mapped .cjs to .cts.
  it.effect("reads $TURBO_DEFAULT$ as the package's own files, never one reached through ../", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
          "packages/shop/turbo.json": json({ tasks: { verify: { inputs: ["$TURBO_DEFAULT$"] } } }),
          "packages/shop/src/Shop.model.ts": 'import { a } from "./A.ts"\nimport { b } from "../../lib/B.ts"\n',
          "packages/shop/src/A.ts": "export const a = 1\n",
          "packages/lib/B.ts": "export const b = 1\n"
        },
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        'err:   packages/lib/B.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "$TURBO_ROOT$/packages/lib/B.ts" to its inputs'
      ])
    })
  )

  it.effect("walks from every code file a task's inputs read: a proof, a helper, a mutant", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
          "packages/shop/turbo.json": json({
            tasks: {
              prove: { inputs: ["src/**/*.decision.ts", "test/**/*.prove.test.ts", "test/proving.ts", "mutants/**"] }
            }
          }),
          "packages/shop/src/Pay.decision.ts": "export const pay = 1\n",
          "packages/shop/src/Words.rules.ts": "export const words = 1\n",
          "packages/shop/src/Seen.rules.mts": "export const seen = 1\n",
          "packages/shop/test/Pay.prove.test.ts":
            'import { words } from "../src/Words.rules.ts"\nimport { help } from "./proving.ts"\n',
          "packages/shop/test/proving.ts": 'import { seen } from "../src/Seen.rules.mts"\n',
          "packages/shop/test/Other.test.ts": 'import { other } from "../src/Other.ts"\n',
          "packages/shop/src/Other.ts": "export const other = 1\n",
          "packages/shop/mutants/Flip.ts":
            'import { pay } from "../src/Pay.decision.ts"\nimport { cut } from "../lib/Cut.cts"\n',
          "packages/shop/lib/Cut.cts": "export const cut = 1\n"
        },
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        'err:   packages/shop/lib/Cut.cts, which packages/shop/mutants/Flip.ts imports, is in no input of prove in packages/shop/turbo.json: add "lib/Cut.cts" to its inputs',
        'err:   packages/shop/src/Words.rules.ts, which packages/shop/test/Pay.prove.test.ts imports, is in no input of prove in packages/shop/turbo.json: add "src/**/*.rules.ts" to its inputs',
        'err:   packages/shop/src/Seen.rules.mts, which packages/shop/test/Pay.prove.test.ts imports, is in no input of prove in packages/shop/turbo.json: add "src/**/*.rules.mts" to its inputs'
      ])
    })
  )

  // Before, a story file the mutants file names, and what it imports, passed when no input of the mutants' tasks read
  // it: the walk started only from files the inputs already match, and turbo replayed an old run when it changed.
  it.effect("walks the mutants' tasks from every file their mutants file names, and refuses one that is no file", () =>
    Effect.gen(function* () {
      const inputs = ["src/**/*.decision.ts", "test/**/*.prove.test.ts", "mutants/**"]
      const report = yield* inTree(
        {
          "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
          "packages/shop/turbo.json": json({ tasks: { mutants: { inputs }, "mutants:sample": { inputs } } }),
          "packages/shop/src/Pay.decision.ts": "export const pay = 1\n",
          "packages/shop/test/Pay.prove.test.ts": "export const proved = 1\n",
          "packages/shop/test/Pay.api.test.ts": 'import { session } from "./session.ts"\n',
          "packages/shop/test/session.ts": "export const session = 1\n",
          "packages/shop/mutants/mutants.json": json({
            stories: ["test/Pay.api.test.ts", "test/Gone.story.test.ts"],
            sample: [],
            mutants: [
              {
                key: "pay-check",
                target: "Pay",
                kind: "check",
                file: "src/Pay.decision.ts",
                anchors: ["export"],
                old: "1",
                new: "2",
                proof: "test/Pay.prove.test.ts",
                expect: "rule",
                trialRules: [],
                trialStories: []
              }
            ]
          })
        },
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/mutants/mutants.json names test/Gone.story.test.ts, which is no file of packages/shop: write the path of the test it means",
        'err:   packages/shop/test/Pay.api.test.ts, which packages/shop/mutants/mutants.json names, is in no input of mutants in packages/shop/turbo.json: add "test/**/*.test.ts" to its inputs',
        'err:   packages/shop/test/session.ts, which packages/shop/test/Pay.api.test.ts imports, is in no input of mutants in packages/shop/turbo.json: add "test/session.ts" to its inputs',
        'err:   packages/shop/test/Pay.api.test.ts, which packages/shop/mutants/mutants.json names, is in no input of mutants:sample in packages/shop/turbo.json: add "test/**/*.test.ts" to its inputs',
        'err:   packages/shop/test/session.ts, which packages/shop/test/Pay.api.test.ts imports, is in no input of mutants:sample in packages/shop/turbo.json: add "test/session.ts" to its inputs'
      ])
    })
  )

  it.effect("cuts a ?query and a #hash off before the path is resolved, and holds the file itself", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
          "packages/shop/turbo.json": json({ tasks: { verify: { inputs: ["src/**/*.model.ts", "public/a.csv"] } } }),
          "packages/shop/src/Shop.model.ts":
            'import a from "../public/a.csv?raw"\nimport b from "../public/b.csv#top"\nimport { m } from "./Missing.ts?raw"\n',
          "packages/shop/public/a.csv": "sku\n",
          "packages/shop/public/b.csv": "sku\n"
        },
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        'err:   packages/shop/src/Shop.model.ts imports "./Missing.ts?raw", which names no file: write the path of the file it means',
        'err:   packages/shop/public/b.csv, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "public/b.csv" to its inputs'
      ])
    })
  )

  it.effect("reads an import() of a template with nothing put into it, and a .cjs written for its .cts", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/shop/package.json": json({ name: "@x/shop", beep: { layer: "model" } }),
          "packages/shop/turbo.json": json({ tasks: { verify: { inputs: ["src/**/*.model.ts"] } } }),
          "packages/shop/src/Shop.model.ts":
            'export const lazy = () => import(`./Lazy.ts`)\nimport { c } from "./C.cjs"\n',
          "packages/shop/src/Lazy.ts": "export const lazy = 1\n",
          "packages/shop/src/C.cts": "export const c = 1\n"
        },
        Effect.map(modelInputs(), render(modelInputsSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        'err:   packages/shop/src/Lazy.ts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "src/Lazy.ts" to its inputs',
        'err:   packages/shop/src/C.cts, which packages/shop/src/Shop.model.ts imports, is in no input of verify in packages/shop/turbo.json: add "src/C.cts" to its inputs'
      ])
    })
  )

  it("reads a glob as turbo does", () => {
    expect(globFits("src/**/*.view.ts")("src/Catalog.view.ts")).toBe(true)
    expect(globFits("src/**/*.view.ts")("src/Review/Open.view.ts")).toBe(true)
    expect(globFits("src/**/*.{view,api}.ts")("src/Catalog.api.ts")).toBe(true)
    expect(globFits("src/*.ts")("src/Review/Open.view.ts")).toBe(false)
    expect(globFits("src/Actor/**")("src/Actor/Session.middleware.ts")).toBe(true)
  })
})
