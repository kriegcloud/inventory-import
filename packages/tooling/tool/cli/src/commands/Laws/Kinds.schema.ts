/**
 * The registry of kinds: what the ending of a file in a context's package says the file is, which layer of the context
 * may hold it, which layers may import it from another package, and, for an ending that names a block of a model, what
 * declares that block and what else its file may hold (goals/module-kinds, step 1; explorations/module-taxonomy,
 * decisions 3 and 4).
 *
 * One record by ending. `laws block-files` reads every ending and layer from it. An ending that says what another
 * kind says is listed under `renamed` until its files have moved, and a file whose ending waits on a later step of
 * the goal is listed under `waiting`, by its path, with the step that clears it. The packages outside a context
 * (the kernel, the drivers, the client, the app) have no row: they have not been counted.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const $I = $RepoCliId.create("commands/Laws/Kinds.schema")

/**
 * A layer of a context, as a package's `beep.layer` names it.
 *
 * @category schemas
 */
export const Layer = LiteralKit(["contract", "model", "host", "web"]).pipe(
  $I.annoteSchema("Layer", { description: "A layer of a context: contract, model, host or web" })
)

/**
 * The decoded value of `Layer`.
 *
 * @category models
 */
export type Layer = typeof Layer.Type

/**
 * Who imports a file from another package: a layer of a context, or the app that composes the contexts.
 *
 * @category schemas
 */
export const Importer = LiteralKit(["contract", "model", "host", "web", "app"]).pipe(
  $I.annoteSchema("Importer", { description: "A layer of a context, or the app that composes the contexts" })
)

/**
 * The decoded value of `Importer`.
 *
 * @category models
 */
export type Importer = typeof Importer.Type

const blockKinds = (description: string) =>
  S.Array(S.String).pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.succeed([])),
    S.withDecodingDefaultTypeKey(Effect.succeed([]))
  )

/**
 * One kind of file, as its ending names it.
 *
 * **Details**
 *
 * `block`, `alone`, `holds` and `beside` are read by `laws block-files` and say nothing of a kind that names no block
 * of a model: such a kind leaves them at their starting values.
 *
 * @category schemas
 */
export class Kind extends S.Opaque<Kind, { readonly brand: unique symbol }>()(
  S.Struct({
    declares: S.String.pipe(S.annotateKey({ description: "What a file of the kind declares, in a few words" })),
    heldBy: S.Array(Layer).pipe(S.annotateKey({ description: "The layers whose packages may hold a file of it" })),
    importedBy: S.Array(Importer).pipe(
      S.annotateKey({ description: "Who may import a file of it from another package" })
    ),
    block: S.String.pipe(
      S.annotateKey({ description: "What declares the block the ending names, as a reader writes it: Domain.View" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    ),
    alone: S.Boolean.pipe(
      S.annotateKey({ description: "Whether a file with the ending must declare that block" }),
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ),
    holds: blockKinds("The kinds of block a file with the ending may hold, whatever else it declares"),
    beside: blockKinds("The kinds of block it may hold only when it declares the block its ending names")
  }).pipe($I.annoteSchema("Kind", { description: "One kind of file: what it declares, who holds it, who imports it" }))
) {}

const everyone: ReadonlyArray<Importer> = ["contract", "model", "host", "web", "app"]
const serverSide: ReadonlyArray<Importer> = ["model", "host", "app"]
const screens: ReadonlyArray<Importer> = ["web", "app"]
const words: ReadonlyArray<Layer> = ["contract", "model"]

/** A block of a model that a file of its own ending holds alone: a view, a query, a policy. */
const placed = (
  kind: string,
  block: string,
  importedBy: ReadonlyArray<Importer>,
  beside: ReadonlyArray<string> = []
): Kind =>
  Kind.make({
    declares: `one ${block}`,
    heldBy: ["model"],
    importedBy,
    block: O.some(block),
    alone: true,
    holds: [kind],
    beside
  })

/** What a command's file holds beside it, as a decider's does: its events and its rejections. */
const itsCommands = ["command", "event", "rejection"]

/**
 * The kinds, by ending.
 *
 * @category constants
 */
export const kinds: Readonly<Record<string, Kind>> = {
  // Words: what both sides of the wire name.
  id: Kind.make({ declares: "branded id schemas", heldBy: words, importedBy: everyone }),
  schema: Kind.make({ declares: "value schemas", heldBy: words, importedBy: everyone }),
  read: Kind.make({ declares: "what an endpoint answers", heldBy: ["contract"], importedBy: everyone }),
  payload: Kind.make({ declares: "what an endpoint takes", heldBy: ["contract"], importedBy: everyone }),
  contract: Kind.make({ declares: "the context's HTTP groups", heldBy: ["contract"], importedBy: everyone }),
  rejection: Kind.make({
    declares: "a failure several callers handle",
    heldBy: words,
    importedBy: everyone,
    block: O.some("Domain.Rejection"),
    holds: ["rejection"]
  }),
  // A command and an external system are kept for their block in a contract as in a model (decision 32).
  command: Kind.make({
    declares: "one Domain.Command, its events and its rejections",
    heldBy: words,
    importedBy: everyone,
    block: O.some("Domain.Command"),
    alone: true,
    holds: itsCommands
  }),
  // Deciders: pure, run by the screen and the server alike.
  rules: Kind.make({ declares: "pure functions", heldBy: words, importedBy: everyone }),
  aggregate: Kind.make({
    declares: "one Domain.Aggregate",
    heldBy: ["model"],
    importedBy: everyone,
    block: O.some("Domain.Aggregate"),
    holds: ["aggregate"],
    beside: itsCommands
  }),
  decision: Kind.make({
    declares: "one Domain.Decision",
    heldBy: ["model"],
    importedBy: everyone,
    block: O.some("Domain.Decision"),
    holds: ["decision"],
    beside: itsCommands
  }),
  context: Kind.make({
    declares: "one Domain.RequestContext",
    heldBy: ["model"],
    importedBy: everyone,
    block: O.some("Domain.RequestContext"),
    holds: ["context"]
  }),
  model: Kind.make({
    declares: "the Domain.Model",
    heldBy: ["model"],
    importedBy: everyone,
    block: O.some("Domain.Model"),
    holds: ["model"],
    beside: ["relation"]
  }),
  middleware: placed("middleware", "RpcMiddleware.Service", everyone),
  api: placed("api", "Domain.Api", everyone),
  // Reads: what a client asks a model.
  view: placed("view", "Domain.View", everyone, ["event"]),
  query: placed("query", "Domain.Query", everyone),
  stream: placed("stream", "Domain.Stream", everyone, ["event"]),
  // What a model does after the fact, and what it calls. Never loaded by a screen.
  projection: placed("projection", "Domain.Projection", serverSide),
  policy: placed("policy", "Domain.Policy", serverSide),
  saga: placed("saga", "Domain.Saga", serverSide, ["rejection"]),
  rewrite: placed("rewrite", "Domain.Rewrite", serverSide),
  compaction: placed("compaction", "Domain.Compaction", serverSide),
  external: Kind.make({
    declares: "one Domain.ExternalSystem",
    heldBy: words,
    importedBy: serverSide,
    block: O.some("Domain.ExternalSystem"),
    alone: true,
    holds: ["external"]
  }),
  // Edges: what reaches outside, and what stands in for it. Never loaded by a screen.
  port: Kind.make({
    declares: "one Context.Service the model asks for",
    heldBy: words,
    importedBy: serverSide,
    block: O.some("Context.Service")
  }),
  ports: Kind.make({ declares: "the context's ports, as one type", heldBy: ["model"], importedBy: serverSide }),
  handler: Kind.make({ declares: "what a group of endpoints does", heldBy: ["model"], importedBy: serverSide }),
  handlers: Kind.make({ declares: "every handler of the context", heldBy: ["model"], importedBy: serverSide }),
  memory: Kind.make({ declares: "the ports' in-memory twins", heldBy: ["model"], importedBy: serverSide }),
  adapter: Kind.make({ declares: "a port's Layer over a driver", heldBy: ["host"], importedBy: ["host", "app"] }),
  http: Kind.make({ declares: "the context's endpoints, served", heldBy: ["host"], importedBy: ["app"] }),
  "test-layer": Kind.make({ declares: "a Layer for tests", heldBy: ["host"], importedBy: ["app"] }),
  // Screens.
  screen: Kind.make({ declares: "one React screen", heldBy: ["web"], importedBy: screens }),
  atoms: Kind.make({ declares: "atoms", heldBy: ["web"], importedBy: screens }),
  controller: Kind.make({ declares: "a screen's controller", heldBy: ["web"], importedBy: screens }),
  machine: Kind.make({ declares: "a state machine", heldBy: ["web"], importedBy: screens }),
  keys: Kind.make({ declares: "reactivity keys", heldBy: ["web"], importedBy: screens }),
  runtime: Kind.make({ declares: "the context's atom runtime", heldBy: ["web"], importedBy: screens })
}

/**
 * Endings that say what a kind above says, each with that kind's ending: a file with one is renamed.
 *
 * @category constants
 */
export const renamed: Readonly<Record<string, string>> = { store: "port", gateway: "port" }

/**
 * Files the registry does not ask yet, by path from the root, each with the step of goals/module-kinds that gives it
 * an ending the registry knows. A step that clears one takes its line out.
 *
 * @category constants
 */
export const waiting: Readonly<Record<string, string>> = {
  "packages/catalog/host/src/Host.ts": "step 6: the kind of a file that runs a model on a platform (decision 10a)",
  "packages/access/host/src/Host.ts": "step 6: the kind of a file that runs a model on a platform (decision 10a)",
  "packages/access/host/src/Adapters.ts": "step 7: folded into Host.ts (decision 6)",
  "packages/access/host/src/Config.ts": "step 7: renamed Auth.config.ts (decision 6)",
  "packages/access/host/src/SignIn.route.ts": "step 6: .route.ts becomes a kind (decision 7)",
  "packages/catalog/web/src/ItemEditor.state.ts": "step 6: .state.ts becomes a kind (decision 7)",
  "packages/catalog/model/src/Review/ItemsOfRow.reference.ts": "step 7: renamed ItemsOfRow.context.ts (decision 7)"
}

/**
 * What the registry says of one file a layer holds.
 *
 * @category schemas
 */
export const Placement = S.TaggedUnion({
  Held: {},
  NoEnding: {},
  Unknown: { ending: S.String.pipe(S.annotateKey({ description: "The file's ending, which names no kind" })) },
  Renamed: {
    ending: S.String.pipe(S.annotateKey({ description: "The file's ending, which says what another kind says" })),
    to: S.String.pipe(S.annotateKey({ description: "That kind's ending" }))
  },
  WrongLayer: {
    ending: S.String.pipe(S.annotateKey({ description: "The file's ending, a kind its layer does not hold" })),
    heldBy: S.Array(Layer).pipe(S.annotateKey({ description: "The layers that hold the kind" }))
  }
}).pipe($I.annoteSchema("Placement", { description: "Whether a layer holds a file, by the kind its ending names" }))

/**
 * The decoded value of `Placement`.
 *
 * @category models
 */
export type Placement = typeof Placement.Type

/**
 * The word before a file's extension, when its name has one: `view` of `Thing.view.ts`, and of `Thing.view.mts`.
 *
 * @category rules
 */
export const endingOf = (file: string): O.Option<string> =>
  O.flatMap(Str.match(/\.([a-z-]+)\.(m|c)?tsx?$/)(A.lastNonEmpty(Str.split("/")(file))), (found) => A.get(found, 1))

/**
 * What the registry says of a file a layer holds. A file under `internal/` is its package's own and is not asked, and
 * neither is one listed under `waiting`.
 *
 * @category rules
 */
export const place = ({ file, layer }: { readonly file: string; readonly layer: Layer }): Placement =>
  Str.includes("/internal/")(file) || R.has(waiting, file)
    ? Placement.cases.Held.make({})
    : O.match(endingOf(file), {
        onNone: () => Placement.cases.NoEnding.make({}),
        onSome: (ending) =>
          O.match(R.get(renamed, ending), {
            onSome: (to) => Placement.cases.Renamed.make({ ending, to }),
            onNone: () =>
              O.match(R.get(kinds, ending), {
                onNone: () => Placement.cases.Unknown.make({ ending }),
                onSome: (kind) =>
                  A.contains(kind.heldBy, layer)
                    ? Placement.cases.Held.make({})
                    : Placement.cases.WrongLayer.make({ ending, heldBy: kind.heldBy })
              })
          })
      })
