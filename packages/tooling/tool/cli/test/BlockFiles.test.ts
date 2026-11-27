import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { blockFiles, blockFilesSentence } from "../src/commands/Laws/BlockFiles.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const domain = 'import * as Domain from "@alchemy.run/domain"\n'

// A model package and a contract package, every block in the file its ending names.
const placed = {
  "packages/shop/model/package.json": json({ name: "@x/shop-model", beep: { layer: "model" } }),
  "packages/shop/model/src/Basket/Basket.aggregate.ts": `${domain}export class Open extends Domain.Command("Open", {}) {}\n`,
  "packages/shop/model/src/Basket/Watch.policy.ts": `${domain}export class Watch extends Domain.Policy("Watch", {}) {}\n`,
  "packages/shop/model/src/Basket/Totals.view.ts":
    'import * as View from "@alchemy.run/domain/View"\nexport class Totals extends View.make("Totals", {}) {}\n',
  "packages/shop/model/src/Session.middleware.ts":
    'import * as RpcMiddleware from "effect/rpc/RpcMiddleware"\nexport class Session extends RpcMiddleware.Service<Session>()("Session", {}) {}\n',
  // Words that name a block in a comment and a string are not a block.
  "packages/shop/model/src/Words.rules.ts":
    '// Domain.Policy("Watch")\nexport const said = "Domain.View(\\"Totals\\")"\n',
  "packages/shop/model/src/Shop.story.test.ts": `${domain}export class Trial extends Domain.Saga("Trial", {}) {}\n`,
  "packages/shop/contract/package.json": json({ name: "@x/shop-contract", beep: { layer: "contract" } }),
  "packages/shop/contract/src/Basket.payload.ts":
    'import * as S from "effect/Schema"\nexport const Add = S.Struct({})\n'
}

describe("laws block-files", () => {
  it.effect("passes when every block is in the file its ending names", () =>
    Effect.gen(function* () {
      const report = yield* inTree(placed, Effect.map(blockFiles(), render(blockFilesSentence)))
      expect(printed(report)).toEqual([
        "out: block-files:check OK  6 files in 2 model and contract packages, each block in the file its ending names"
      ])
    })
  )

  it.effect("refuses a view file that declares a policy, and says the ending to write", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Basket/Thing.view.ts": `${domain}\nexport class Thing extends Domain.Policy("Thing", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: block-files:check FAIL  a block of a model is not in the file its ending names, or an ending is taken by something else. Write what each line says:",
        "err:   packages/shop/model/src/Basket/Thing.view.ts:3 declares Thing with Domain.Policy: rename the file to Thing.policy.ts"
      ])
    })
  )

  it.effect("refuses a contract's command file that holds a plain schema, naming .payload.ts", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/contract/src/Basket/Add.command.ts":
            'import * as S from "effect/Schema"\nexport const Add = S.Struct({})\n'
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report)).toEqual([
        "err: block-files:check FAIL  a block of a model is not in the file its ending names, or an ending is taken by something else. Write what each line says:",
        "err:   packages/shop/contract/src/Basket/Add.command.ts ends .command.ts, which is kept for Domain.Command, and declares none: rename it to Add.payload.ts (a payload schema), or Add.port.ts if it is a hand-written Context.Service port"
      ])
    })
  )

  it.effect("moves a block out of a file of blocks of its own, and frees .external.ts from a port", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Shop.model.ts": `import { Api as MakeApi, Model } from "@alchemy.run/domain"\nexport class Shop extends Model("Shop", {}) {}\nexport class ShopApi extends MakeApi("ShopApi", {}) {}\n`,
          "packages/shop/model/src/Pricing.external.ts":
            'import * as Context from "effect/Context"\nexport class Pricing extends Context.Service<Pricing, {}>()("Pricing") {}\n'
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Pricing.external.ts:2 declares Pricing with Context.Service: rename the file to Pricing.port.ts",
        "err:   packages/shop/model/src/Shop.model.ts:3 declares ShopApi with Domain.Api: move it to ShopApi.api.ts, beside this file"
      ])
    })
  )

  // Each case below passed before the law read every maker of the library and held a placed ending to its one kind.
  it.effect("refuses a block of any other kind in a file with a block's ending, ports and models included", () =>
    Effect.gen(function* () {
      const port = 'import * as Context from "effect/Context"\n'
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/D.view.ts": `${domain}export class D extends Domain.View("D", {}) {}\nexport class Shop extends Domain.Model("Shop", {}) {}\nexport class Cart extends Domain.Aggregate("Cart", {}) {}\n`,
          "packages/shop/model/src/B.policy.ts": `${domain}${port}export class B extends Domain.Policy("B", {}) {}\nexport class Prices extends Context.Service<Prices, {}>()("Prices") {}\n`,
          "packages/shop/model/src/Ext.external.ts": `${domain}${port}export class Ext extends Domain.ExternalSystem("Ext", {}) {}\nexport class Client extends Context.Service<Client, {}>()("Client") {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/B.policy.ts:4 declares Prices with Context.Service: move it to Prices.port.ts, beside this file",
        "err:   packages/shop/model/src/D.view.ts:3 declares Shop with Domain.Model: move it to Shop.model.ts, beside this file",
        "err:   packages/shop/model/src/D.view.ts:4 declares Cart with Domain.Aggregate: move it to Cart.aggregate.ts, beside this file",
        "err:   packages/shop/model/src/Ext.external.ts:4 declares Client with Context.Service: move it to Client.port.ts, beside this file"
      ])
    })
  )

  it.effect("moves a view out of a store that also holds a port, and renames no file that holds another kind", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Ledger.store.ts": `${domain}import * as Context from "effect/Context"\nexport class Ledger extends Context.Service<Ledger, {}>()("Ledger") {}\nexport class Lines extends Domain.View("Lines", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Ledger.store.ts:4 declares Lines with Domain.View: move it to Lines.view.ts, beside this file"
      ])
    })
  )

  it.effect("reads a maker named by a computed member with a string, and a test layer under src", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Computed.rules.ts": `${domain}export class V extends Domain["View"]("V", {}) {}\n`,
          "packages/shop/model/src/Fixture.test-layer.ts": `${domain}export class F extends Domain.View("F", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Computed.rules.ts:2 declares V with Domain.View: rename the file to Computed.view.ts",
        "err:   packages/shop/model/src/Fixture.test-layer.ts:2 declares F with Domain.View: rename the file to Fixture.view.ts"
      ])
    })
  )

  it.effect("names a .tsx file's ending as written, and a view written inside a model by its own name", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Thing.view.tsx": `${domain}export class Thing extends Domain.Policy("Thing", {}) {}\n`,
          "packages/shop/model/src/Empty.view.tsx": "export const nothing = 1\n",
          "packages/shop/model/src/Shop.model.ts": `${domain}export class Shop extends Domain.Model("Shop", { views: [Domain.View("Inline", {})] }) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Empty.view.tsx ends .view.tsx, which is kept for Domain.View, and declares none: declare its Domain.View here, or give the file the ending of what it holds",
        "err:   packages/shop/model/src/Shop.model.ts:2 declares Inline with Domain.View: move it to Inline.view.ts, beside this file",
        "err:   packages/shop/model/src/Thing.view.tsx:2 declares Thing with Domain.Policy: rename the file to Thing.policy.tsx"
      ])
    })
  )

  // Each case below passed before the law read a callee through what wraps it, a module's `/index`, a template
  // written out as a member, and the files ending `.mts` or `.cts`.
  it.effect("reads a maker through parentheses, !, as, satisfies, <T>x, x<T> and a sequence", () =>
    Effect.gen(function* () {
      const policy = (stem: string, callee: string) => ({
        [`packages/shop/model/src/${stem}.rules.ts`]: `${domain}export class ${stem} extends ${callee}("${stem}", {}) {}\n`
      })
      const report = yield* inTree(
        {
          ...placed,
          ...policy("As", "(Domain.Policy as typeof Domain.Policy)"),
          ...policy("Assert", "(<typeof Domain>Domain).Policy"),
          ...policy("Inst", "(Domain.Policy<never>)"),
          ...policy("NonNull", "Domain.Policy!"),
          ...policy("Paren", "(Domain.Policy)"),
          ...policy("Satisfies", "(Domain satisfies object).Policy"),
          ...policy("Seq", "(0, Domain.Policy)")
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/As.rules.ts:2 declares As with Domain.Policy: rename the file to As.policy.ts",
        "err:   packages/shop/model/src/Assert.rules.ts:2 declares Assert with Domain.Policy: rename the file to Assert.policy.ts",
        "err:   packages/shop/model/src/Inst.rules.ts:2 declares Inst with Domain.Policy: rename the file to Inst.policy.ts",
        "err:   packages/shop/model/src/NonNull.rules.ts:2 declares NonNull with Domain.Policy: rename the file to NonNull.policy.ts",
        "err:   packages/shop/model/src/Paren.rules.ts:2 declares Paren with Domain.Policy: rename the file to Paren.policy.ts",
        "err:   packages/shop/model/src/Satisfies.rules.ts:2 declares Satisfies with Domain.Policy: rename the file to Satisfies.policy.ts",
        "err:   packages/shop/model/src/Seq.rules.ts:2 declares Seq with Domain.Policy: rename the file to Seq.policy.ts"
      ])
    })
  )

  it.effect("reads the library imported through its /index, and a member named by a template written out", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Index.rules.ts":
            'import * as Domain from "@alchemy.run/domain/index"\nexport class Index extends Domain.View("Index", {}) {}\n',
          "packages/shop/model/src/Module.rules.ts":
            'import * as Saga from "@alchemy.run/domain/Saga/index"\nexport class Module extends Saga.make("Module", {}) {}\n',
          "packages/shop/model/src/Template.rules.ts": `${domain}export class Template extends Domain[\`View\`]("Template", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Index.rules.ts:2 declares Index with Domain.View: rename the file to Index.view.ts",
        "err:   packages/shop/model/src/Module.rules.ts:2 declares Module with Domain.Saga: rename the file to Module.saga.ts",
        "err:   packages/shop/model/src/Template.rules.ts:2 declares Template with Domain.View: rename the file to Template.view.ts"
      ])
    })
  )

  it.effect("reads .mts and .cts files and names their own extension, and skips their tests and declarations", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Thing.view.mts": `${domain}export class Thing extends Domain.Policy("Thing", {}) {}\n`,
          "packages/shop/model/src/Empty.policy.cts": "export const nothing = 1\n",
          "packages/shop/model/src/Lines.store.cts": `${domain}export class Lines extends Domain.View("Lines", {}) {}\nexport class Totals extends Domain.Query("Totals", {}) {}\n`,
          "packages/shop/model/src/Trial.test.mts": `${domain}export class Trial extends Domain.Saga("Trial", {}) {}\n`,
          "packages/shop/model/src/Shapes.d.mts": `${domain}export class Shape extends Domain.Saga("Shape", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Empty.policy.cts ends .policy.cts, which is kept for Domain.Policy, and declares none: declare its Domain.Policy here, or give the file the ending of what it holds",
        "err:   packages/shop/model/src/Lines.store.cts:2 declares Lines with Domain.View: move it to Lines.view.cts, beside this file",
        "err:   packages/shop/model/src/Lines.store.cts:3 declares Totals with Domain.Query: move it to Totals.query.cts, beside this file",
        "err:   packages/shop/model/src/Thing.view.mts:2 declares Thing with Domain.Policy: rename the file to Thing.policy.mts"
      ])
    })
  )

  it.effect("counts one file in one package in the singular", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          "packages/shop/model/package.json": json({ name: "@x/shop-model", beep: { layer: "model" } }),
          "packages/shop/model/src/Watch.policy.ts": `${domain}export class Watch extends Domain.Policy("Watch", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report)).toEqual([
        "out: block-files:check OK  1 file in 1 model or contract package, each block in the file its ending names"
      ])
    })
  )
})
