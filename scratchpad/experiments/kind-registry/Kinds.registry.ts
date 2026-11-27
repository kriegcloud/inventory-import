// One registry of kinds, as data: what a file's ending says it is, which layer of a context may hold it, and which
// layers may import it from another package. A first cut, written from the endings the catalog and access contexts
// use today; the test beside it counts what this table would refuse in them.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

/** A layer of a context, or the app that composes the contexts. */
export const Layer = S.Literals(["contract", "model", "host", "web", "app"])
/** The decoded value of `Layer`. */
export type Layer = typeof Layer.Type

/** One kind of file. */
export const Kind = S.Struct({
  declares: S.String,
  heldBy: S.Array(Layer),
  importedBy: S.Array(Layer)
})
/** The decoded value of `Kind`. */
export type Kind = typeof Kind.Type

const everyone: ReadonlyArray<Layer> = ["contract", "model", "host", "web", "app"]
const serverSide: ReadonlyArray<Layer> = ["model", "host", "app"]
const screens: ReadonlyArray<Layer> = ["web", "app"]

/** The kinds, by ending. */
export const registry: Readonly<Record<string, Kind>> = {
  // Words: what both sides of the wire name.
  id: { declares: "branded id schemas", heldBy: ["contract", "model"], importedBy: everyone },
  schema: { declares: "value schemas", heldBy: ["contract", "model"], importedBy: everyone },
  read: { declares: "what an endpoint answers", heldBy: ["contract"], importedBy: everyone },
  payload: { declares: "what an endpoint takes", heldBy: ["contract"], importedBy: everyone },
  rejection: { declares: "a failure several callers handle", heldBy: ["contract", "model"], importedBy: everyone },
  command: { declares: "one Domain.Command, its events, its rejections", heldBy: ["model"], importedBy: everyone },
  contract: { declares: "the context's HTTP groups", heldBy: ["contract"], importedBy: everyone },
  // Deciders: pure, run by the screen and the server alike.
  rules: { declares: "pure functions", heldBy: ["contract", "model"], importedBy: everyone },
  aggregate: { declares: "one Domain.Aggregate", heldBy: ["model"], importedBy: everyone },
  decision: { declares: "one Domain.Decision", heldBy: ["model"], importedBy: everyone },
  context: { declares: "one Domain.RequestContext", heldBy: ["model"], importedBy: everyone },
  middleware: { declares: "one RpcMiddleware.Service", heldBy: ["model"], importedBy: everyone },
  model: { declares: "the Domain.Model", heldBy: ["model"], importedBy: everyone },
  api: { declares: "one Domain.Api", heldBy: ["model"], importedBy: everyone },
  // Edges: what reaches outside, and what stands in for it. Never loaded by a screen.
  port: { declares: "one Context.Service the model asks for", heldBy: ["contract", "model"], importedBy: serverSide },
  ports: { declares: "the context's ports, as one type", heldBy: ["model"], importedBy: serverSide },
  handler: { declares: "what a group of endpoints does", heldBy: ["model"], importedBy: serverSide },
  handlers: { declares: "every handler of the context", heldBy: ["model"], importedBy: serverSide },
  memory: { declares: "the ports' in-memory twins", heldBy: ["model"], importedBy: serverSide },
  adapter: { declares: "a port's Layer over a driver", heldBy: ["host"], importedBy: ["host", "app"] },
  http: { declares: "the context's endpoints, served", heldBy: ["host"], importedBy: ["app"] },
  "test-layer": { declares: "a Layer for tests", heldBy: ["host"], importedBy: ["app"] },
  // Screens.
  screen: { declares: "one React screen", heldBy: ["web"], importedBy: screens },
  atoms: { declares: "atoms", heldBy: ["web"], importedBy: screens },
  controller: { declares: "a screen's controller", heldBy: ["web"], importedBy: screens },
  machine: { declares: "a state machine", heldBy: ["web"], importedBy: screens },
  keys: { declares: "reactivity keys", heldBy: ["web"], importedBy: screens },
  runtime: { declares: "the context's atom runtime", heldBy: ["web"], importedBy: screens }
}

/** Endings that say the same thing as a kind above, and take its name. */
export const renamed: Readonly<Record<string, string>> = { store: "port", gateway: "port" }

/** What the registry says of one file, or of one import. */
export const Finding = S.TaggedUnion({
  Held: { file: S.String },
  NoEnding: { file: S.String },
  Unknown: { file: S.String, ending: S.String },
  Renamed: { file: S.String, ending: S.String, to: S.String },
  WrongLayer: { file: S.String, ending: S.String, layer: Layer },
  ClosedDoor: { file: S.String, imports: S.String, kind: S.String, from: Layer }
})
/** The decoded value of `Finding`. */
export type Finding = typeof Finding.Type

/** The word before `.ts` or `.tsx`, when the name has one. */
export const endingOf = (file: string): O.Option<string> =>
  O.flatMap(Str.match(/\.([a-z-]+)\.tsx?$/)(file), (found) => A.get(found, 1))

/** The kind an ending names, through a rename when it has one. */
export const kindOf = (ending: string): O.Option<string> =>
  O.orElse(R.get(renamed, ending), () => (R.has(registry, ending) ? O.some(ending) : O.none()))

/** What the registry says of a file a layer holds. A file under `internal/` is the package's own and is not asked. */
export const classify = ({ file, layer }: { readonly file: string; readonly layer: Layer }): Finding =>
  Str.includes("/internal/")(file)
    ? Finding.cases.Held.make({ file })
    : O.match(endingOf(file), {
        onNone: () => Finding.cases.NoEnding.make({ file }),
        onSome: (ending) =>
          O.match(R.get(renamed, ending), {
            onSome: (to) => Finding.cases.Renamed.make({ file, ending, to }),
            onNone: () =>
              O.match(R.get(registry, ending), {
                onNone: () => Finding.cases.Unknown.make({ file, ending }),
                onSome: (kind) =>
                  A.contains(kind.heldBy, layer)
                    ? Finding.cases.Held.make({ file })
                    : Finding.cases.WrongLayer.make({ file, ending, layer })
              })
          })
      })

/** Whether a layer may import a file of this ending from another package. An ending with no kind is left open. */
export const doorOpen = ({ ending, from }: { readonly ending: string; readonly from: Layer }): boolean =>
  O.match(
    O.flatMap(kindOf(ending), (kind) => R.get(registry, kind)),
    { onNone: () => true, onSome: (kind) => A.contains(kind.importedBy, from) }
  )
