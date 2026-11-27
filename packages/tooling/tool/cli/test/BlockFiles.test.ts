import { describe, expect, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { blockFiles, blockFilesSentence } from "../src/commands/Laws/BlockFiles.rules.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const domain = 'import * as Domain from "@alchemy.run/domain"\n'

const context = 'import * as Context from "effect/Context"\n'
const schema = 'import * as S from "effect/Schema"\n'

// A model package and a contract package, every block in the file its kind is kept in.
const placed = {
  "packages/shop/model/package.json": json({ name: "@x/shop-model", beep: { layer: "model" } }),
  // An aggregate, a decision and a command each hold their commands, events and rejections.
  "packages/shop/model/src/Basket/Basket.aggregate.ts": `${domain}export class Open extends Domain.Command("Open", {}) {}\nexport class Opened extends Domain.Event("Opened", {}) {}\nexport class Closed extends Domain.Rejection("Closed", {}) {}\nexport class Basket extends Domain.Aggregate("Basket", {}) {}\n`,
  "packages/shop/model/src/Basket/Checkout.decision.ts": `${domain}export class Pay extends Domain.Command("Pay", {}) {}\nexport class Paid extends Domain.Event("Paid", {}) {}\nexport class Short extends Domain.Rejection("Short", {}) {}\nexport class Checkout extends Domain.Decision(Pay, {}) {}\n`,
  "packages/shop/model/src/Basket/Add.command.ts": `${domain}export class Add extends Domain.Command("Add", {}) {}\nexport class Added extends Domain.Event("Added", {}) {}\nexport class Full extends Domain.Rejection("Full", {}) {}\n`,
  "packages/shop/model/src/Basket/NotOpen.rejection.ts": `${domain}export class NotOpen extends Domain.Rejection("NotOpen", {}) {}\n`,
  "packages/shop/model/src/Basket/BasketStore.store.ts": `${context}export class BasketStore extends Context.Service<BasketStore, {}>()("BasketStore") {}\n`,
  "packages/shop/model/src/Basket/Watch.policy.ts": `${domain}export class Watch extends Domain.Policy("Watch", {}) {}\n`,
  "packages/shop/model/src/Basket/Totals.view.ts":
    'import * as View from "@alchemy.run/domain/View"\nexport class Totals extends View.make("Totals", {}) {}\n',
  "packages/shop/model/src/Session.middleware.ts":
    'import * as RpcMiddleware from "effect/rpc/RpcMiddleware"\nexport class Session extends RpcMiddleware.Service<Session>()("Session", {}) {}\n',
  // A model with the relations it lists, and a request context with the schema it carries.
  "packages/shop/model/src/Shop.model.ts": `${domain}export class Shop extends Domain.Model("Shop", { relations: { Owns: Domain.Relation({}) } }) {}\n`,
  "packages/shop/model/src/Actor/Actor.context.ts": `${domain}${schema}export const Actor = S.Struct({})\nexport class CurrentActor extends Domain.RequestContext<CurrentActor>()("CurrentActor", Actor) {}\n`,
  // Words that name a block in a comment and a string are not a block.
  "packages/shop/model/src/Words.rules.ts":
    '// Domain.Policy("Watch")\nexport const said = "Domain.View(\\"Totals\\")"\n',
  "packages/shop/model/src/Shop.story.test.ts": `${domain}export class Trial extends Domain.Saga("Trial", {}) {}\n`,
  "packages/shop/contract/package.json": json({ name: "@x/shop-contract", beep: { layer: "contract" } }),
  "packages/shop/contract/src/Basket.payload.ts": `${schema}export const Add = S.Struct({})\n`,
  // A contract's command beside its payload, its external system, and a gateway it keeps.
  "packages/shop/contract/src/Basket/Add.command.ts": `${domain}${schema}export const AddInput = S.Struct({})\nexport class Add extends Domain.Command("Add", { input: AddInput }) {}\n`,
  "packages/shop/contract/src/Pricing.external.ts": `${domain}export class Pricing extends Domain.ExternalSystem("Pricing", {}) {}\n`,
  "packages/shop/contract/src/Allowance.gateway.ts": `${context}export class Allowance extends Context.Service<Allowance, {}>()("Allowance") {}\n`
}

describe("laws block-files", () => {
  it.effect("passes when every block is in the file its ending names", () =>
    Effect.gen(function* () {
      const report = yield* inTree(placed, Effect.map(blockFiles(), render(blockFilesSentence)))
      expect(printed(report)).toEqual([
        "out: block-files:check OK  15 files in 2 model and contract packages, each block in the file its ending names"
      ])
    })
  )

  // Each case below passed before the law held every kind of block to its file (Benjamin, 2026-11-26, "Hold all
  // kinds").
  it.effect("refuses an aggregate, a decision, a model or a request context outside its own ending", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Shop.rules.ts": `${domain}export class Shop extends Domain.Aggregate("Shop", {}) {}\n`,
          "packages/shop/model/src/Cart.rules.ts": `${domain}export class Cart extends Domain.Aggregate("Cart", {}) {}\nexport type Lines = typeof Cart.Type\nexport const empty = (n: number): boolean => n === 0\n`,
          "packages/shop/model/src/Refund.handler.ts": `${domain}export class Refund extends Domain.Decision(Refund, {}) {}\n`,
          "packages/shop/model/src/Store.aggregate.ts": `${domain}export class Store extends Domain.Aggregate("Store", {}) {}\nexport class Mall extends Domain.Model("Mall", {}) {}\n`,
          "packages/shop/model/src/Who.rules.ts": `${domain}export class Who extends Domain.RequestContext<Who>()("Who", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(report.failed).toBe(true)
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Cart.rules.ts:2 declares Cart with Domain.Aggregate: move it to Cart.aggregate.ts, beside this file",
        "err:   packages/shop/model/src/Refund.handler.ts:2 declares Refund with Domain.Decision: rename the file to Refund.decision.ts",
        "err:   packages/shop/model/src/Shop.rules.ts:2 declares Shop with Domain.Aggregate: rename the file to Shop.aggregate.ts",
        "err:   packages/shop/model/src/Store.aggregate.ts:3 declares Mall with Domain.Model: move it to Mall.model.ts, beside this file",
        "err:   packages/shop/model/src/Who.rules.ts:2 declares Who with Domain.RequestContext: rename the file to Who.context.ts"
      ])
    })
  )

  it.effect("keeps a model's command file to its command, events and rejections, and refuses a port there", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Basket/Add.command.ts": `${domain}${context}export class Add extends Domain.Command("Add", {}) {}\nexport class Shop extends Domain.Model("Shop", {}) {}\nexport class Prices extends Context.Service<Prices, {}>()("Prices") {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Basket/Add.command.ts:4 declares Shop with Domain.Model: move it to Shop.model.ts, beside this file",
        "err:   packages/shop/model/src/Basket/Add.command.ts:5 declares Prices with Context.Service: move it to Prices.port.ts, beside this file"
      ])
    })
  )

  it.effect("sends an event and a rejection to their command's file, and a relation to the package's model", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Basket/Open.rules.ts": `${domain}export class Open extends Domain.Command("Open", {}) {}\nexport class Opened extends Domain.Event("Opened", {}) {}\nexport class Shut extends Domain.Rejection("Shut", {}) {}\n`,
          "packages/shop/model/src/Basket/Lost.rules.ts": `${domain}export class Lost extends Domain.Event("Lost", {}) {}\nexport class Gone extends Domain.Rejection("Gone", {}) {}\n`,
          "packages/shop/model/src/Basket/Links.aggregate.ts": `${domain}export class Links extends Domain.Aggregate("Links", {}) {}\nexport const owns = Domain.Relation({})\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Basket/Links.aggregate.ts:3 declares owns with Domain.Relation: move it into the relations of the model in packages/shop/model/src/Shop.model.ts",
        "err:   packages/shop/model/src/Basket/Lost.rules.ts:2 declares Lost with Domain.Event: move it to the .command.ts, .aggregate.ts or .decision.ts of the command that records it, or the .view.ts or .stream.ts that emits it",
        "err:   packages/shop/model/src/Basket/Lost.rules.ts:3 declares Gone with Domain.Rejection: move it to Gone.rejection.ts, beside this file",
        "err:   packages/shop/model/src/Basket/Open.rules.ts:2 declares Open with Domain.Command: move it to Open.command.ts, beside this file",
        "err:   packages/shop/model/src/Basket/Open.rules.ts:3 declares Opened with Domain.Event: move it to Open.command.ts, beside this file, with the command that records it",
        "err:   packages/shop/model/src/Basket/Open.rules.ts:4 declares Shut with Domain.Rejection: move it to Open.command.ts, beside this file, with the command that records it"
      ])
    })
  )

  it.effect("refuses a contract's command outside .command.ts, renaming only a file that holds nothing else", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/contract/src/Basket/Add.payload.ts": `${domain}export class Add extends Domain.Command("Add", {}) {}\n`,
          "packages/shop/contract/src/Basket/Edit.payload.ts": `${domain}${schema}export const EditInput = S.Struct({})\nexport class Edit extends Domain.Command("Edit", { input: EditInput }) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/contract/src/Basket/Add.payload.ts:2 declares Add with Domain.Command: rename the file to Add.command.ts",
        "err:   packages/shop/contract/src/Basket/Edit.payload.ts:4 declares Edit with Domain.Command: move it to Edit.command.ts, beside this file"
      ])
    })
  )

  it.effect("refuses any other block of the library in a contract, naming its file in the model package", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/contract/src/Watch.view.ts": `${domain}export class Watch extends Domain.Policy("Watch", {}) {}\n`,
          "packages/shop/contract/src/Basket/Basket.read.ts": `${domain}export class Basket extends Domain.Aggregate("Basket", {}) {}\nexport class Opened extends Domain.Event("Opened", {}) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/contract/src/Basket/Basket.read.ts:2 declares Basket with Domain.Aggregate: a contract declares no Domain.Aggregate: move it to packages/shop/model/src/Basket/Basket.aggregate.ts",
        "err:   packages/shop/contract/src/Basket/Basket.read.ts:3 declares Opened with Domain.Event: a contract declares a Domain.Event only beside its command, in .command.ts: move it to the file of the command that records it",
        "err:   packages/shop/contract/src/Watch.view.ts:2 declares Watch with Domain.Policy: a contract declares no Domain.Policy: move it to packages/shop/model/src/Watch.policy.ts"
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

  // Each case below passed, or was refused against the library's own layout, before the law kept a command, an event,
  // a rejection and a relation beside their own block only, and held a contract's two endings to their blocks.
  it.effect("refuses a command, an event, a rejection or a relation in a decider's or a model's file without it", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Basket/Pay.aggregate.ts": `${domain}export class Pay extends Domain.Command("Pay", {}) {}\n`,
          "packages/shop/model/src/Basket/Paid.decision.ts": `${domain}export class Paid extends Domain.Event("Paid", {}) {}\nexport class Late extends Domain.Rejection("Late", {}) {}\n`,
          "packages/shop/model/src/Owns.model.ts": `${domain}export const owns = Domain.Relation({})\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Basket/Paid.decision.ts:2 declares Paid with Domain.Event: move it to the .command.ts, .aggregate.ts or .decision.ts of the command that records it, or the .view.ts or .stream.ts that emits it",
        "err:   packages/shop/model/src/Basket/Paid.decision.ts:3 declares Late with Domain.Rejection: move it to Late.rejection.ts, beside this file",
        "err:   packages/shop/model/src/Basket/Pay.aggregate.ts:2 declares Pay with Domain.Command: rename the file to Pay.command.ts",
        "err:   packages/shop/model/src/Owns.model.ts:2 declares owns with Domain.Relation: move it into the relations of the model in packages/shop/model/src/Shop.model.ts"
      ])
    })
  )

  it.effect("keeps an event beside the view or stream that emits it, and a rejection beside its saga", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Account/AccountCard.stream.ts": `${domain}export class CardChanged extends Domain.Event("CardChanged", {}) {}\nexport class AccountCard extends Domain.Stream("AccountCard", { entries: [CardChanged] }) {}\n`,
          "packages/shop/model/src/Account/Statement.view.ts": `${domain}export class StatementLine extends Domain.Event("StatementLine", {}) {}\nexport class Statement extends Domain.View("Statement", { events: [StatementLine] }) {}\n`,
          "packages/shop/model/src/Transfer/ExecuteTransfer.saga.ts": `${domain}export class DestinationClosed extends Domain.Rejection("DestinationClosed") {}\nexport class ExecuteTransfer extends Domain.Saga("ExecuteTransfer", { rejects: [DestinationClosed] }) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report)).toEqual([
        "out: block-files:check OK  18 files in 2 model and contract packages, each block in the file its ending names"
      ])
    })
  )

  it.effect("refuses an event in a stream file without its stream, and a rejection beside a view", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Account/Card.stream.ts": `${domain}export class CardChanged extends Domain.Event("CardChanged", {}) {}\n`,
          "packages/shop/model/src/Account/Summary.view.ts": `${domain}export class NotOwner extends Domain.Rejection("NotOwner", {}) {}\nexport class Summary extends Domain.View("Summary", { rejects: [NotOwner] }) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Account/Card.stream.ts:2 declares CardChanged with Domain.Event: move it to the .command.ts, .aggregate.ts or .decision.ts of the command that records it, or the .view.ts or .stream.ts that emits it",
        "err:   packages/shop/model/src/Account/Card.stream.ts ends .stream.ts, which is kept for Domain.Stream, and declares none: declare its Domain.Stream here, or give the file the ending of what it holds",
        "err:   packages/shop/model/src/Account/Summary.view.ts:2 declares NotOwner with Domain.Rejection: move it to NotOwner.rejection.ts, beside this file"
      ])
    })
  )

  it.effect("holds a contract's .command.ts and .external.ts to their block, ports and middleware included", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/contract/src/Ext.external.ts": `${domain}${context}export class Ext extends Domain.ExternalSystem("Ext", {}) {}\nexport class Client extends Context.Service<Client, {}>()("Client") {}\n`,
          "packages/shop/contract/src/Basket/Remove.command.ts": `${domain}import * as RpcMiddleware from "effect/rpc/RpcMiddleware"\nexport class Remove extends Domain.Command("Remove", {}) {}\nexport class Guard extends RpcMiddleware.Service<Guard>()("Guard", {}) {}\n`,
          "packages/shop/contract/src/Only.external.ts": `${context}export class Only extends Context.Service<Only, {}>()("Only") {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/contract/src/Basket/Remove.command.ts:4 declares Guard with RpcMiddleware.Service: move it to Guard.middleware.ts, beside this file",
        "err:   packages/shop/contract/src/Ext.external.ts:4 declares Client with Context.Service: move it to Client.port.ts, beside this file",
        "err:   packages/shop/contract/src/Only.external.ts:2 declares Only with Context.Service: rename the file to Only.port.ts"
      ])
    })
  )

  it.effect("keeps a contract command's events and rejections beside it, and sends them there from another file", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/contract/src/Basket/Add.command.ts": `${domain}export class Added extends Domain.Event("Added", {}) {}\nexport class Full extends Domain.Rejection("Full", {}) {}\nexport class Add extends Domain.Command("Add", { events: [Added], rejects: [Full] }) {}\n`,
          "packages/shop/contract/src/Basket/Edit.payload.ts": `${domain}export class Edited extends Domain.Event("Edited", {}) {}\nexport class Edit extends Domain.Command("Edit", { events: [Edited] }) {}\n`
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/contract/src/Basket/Edit.payload.ts:2 declares Edited with Domain.Event: move it to Edit.command.ts, beside this file, with the command that records it",
        "err:   packages/shop/contract/src/Basket/Edit.payload.ts:3 declares Edit with Domain.Command: move it to Edit.command.ts, beside this file"
      ])
    })
  )

  it.effect("reads a maker through an optional chain, and a namespace bound by import = require", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        {
          ...placed,
          "packages/shop/model/src/Chain.rules.ts": `${domain}export class Chain extends (Domain?.Aggregate)("Chain", {}) {}\n`,
          "packages/shop/model/src/Required.rules.ts":
            'import Domain = require("@alchemy.run/domain")\nexport class Required extends Domain.View("Required", {}) {}\n',
          "packages/shop/model/src/Typed.rules.ts":
            'import type Domain = require("@alchemy.run/domain")\nexport class Typed extends Domain.View("Typed", {}) {}\n'
        },
        Effect.map(blockFiles(), render(blockFilesSentence))
      )
      expect(printed(report).slice(1)).toEqual([
        "err:   packages/shop/model/src/Chain.rules.ts:2 declares Chain with Domain.Aggregate: rename the file to Chain.aggregate.ts",
        "err:   packages/shop/model/src/Required.rules.ts:2 declares Required with Domain.View: rename the file to Required.view.ts"
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
