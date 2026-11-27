// Reads the catalog and access contexts as they are and asks the registry about every file and every import of one
// of their packages. The numbers below are what it refuses today: the size of the work, not a failing check.
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { classify, doorOpen, endingOf, Finding, type Layer } from "./Kinds.registry.ts"

const contexts = ["catalog", "access"]
const layers: ReadonlyArray<Layer> = ["contract", "model", "host", "web"]

const Manifest = S.fromJsonString(S.Struct({ exports: S.Record(S.String, S.String) }))

const isCode = (file: string): boolean =>
  O.isSome(Str.match(/\.tsx?$/)(file)) &&
  O.isNone(Str.match(/\.d\.ts$/)(file)) &&
  O.isNone(Str.match(/\.(test|spec)\.tsx?$/)(file))

/** Every import of a context's package in a source text: whether it is `import type`, and what it names. */
const importsOf = (source: string): ReadonlyArray<{ readonly typeOnly: boolean; readonly specifier: string }> =>
  A.map(
    A.fromIterable(
      Str.matchAll(
        /import\s+(type\s+)?[\w*\s{},$]*?from\s+"(@inventory\/(?:catalog|access)-(?:contract|model|host|web)\/[A-Za-z]+)"/g
      )(source)
    ),
    (found) => ({ typeOnly: found[1] !== undefined, specifier: found[2] ?? "" })
  )

const read = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const root = yield* path.fromFileUrl(new URL("../../../", import.meta.url))
  const codeUnder = Effect.fnUntraced(function* (dir: string) {
    const all = yield* fs.readDirectory(path.join(root, dir), { recursive: true })
    return A.sort(
      A.map(A.filter(all, isCode), (file) => `${dir}/${file}`),
      Order.String
    )
  })
  const packages = yield* Effect.forEach(
    A.flatMap(contexts, (context) => A.map(layers, (held) => ({ context, held }))),
    Effect.fnUntraced(function* ({ context, held }) {
      const dir = `packages/${context}/${held}`
      const manifest = yield* fs
        .readFileString(path.join(root, dir, "package.json"))
        .pipe(Effect.flatMap(S.decodeEffect(Manifest)))
      const files = yield* codeUnder(`${dir}/src`)
      return { name: `@inventory/${context}-${held}`, dir, held, exports: manifest.exports, files }
    }),
    { concurrency: 1 }
  )
  const app = yield* codeUnder("apps/inventory/src")
  const importers = A.appendAll(
    A.flatMap(packages, (pkg) => A.map(pkg.files, (file) => ({ file, from: pkg.held }))),
    A.map(app, (file) => ({ file, from: "app" as Layer }))
  )
  const sources = yield* Effect.forEach(
    importers,
    Effect.fnUntraced(function* ({ file, from }) {
      const source = yield* fs.readFileString(path.join(root, file))
      return { file, from, imports: importsOf(source) }
    }),
    { concurrency: 1 }
  )
  return { packages, sources }
}, Effect.orDie)

layer(NodeServices.layer)("kind-registry", (it) => {
  it.effect(
    "what the registry refuses in the catalog and access contexts today",
    Effect.fnUntraced(function* () {
      const { packages, sources } = yield* read()
      const placed = A.flatMap(packages, (pkg) => A.map(pkg.files, (file) => classify({ file, layer: pkg.held })))
      const exported: Readonly<Record<string, string>> = R.fromEntries(
        A.flatMap(packages, (pkg) =>
          A.map(R.toEntries(pkg.exports), ([key, target]): readonly [string, string] => [
            `${pkg.name}/${Str.slice(2)(key)}`,
            target
          ])
        )
      )
      const crossings = A.flatMap(sources, ({ file, from, imports }) =>
        A.flatMap(imports, ({ specifier, typeOnly }) =>
          O.match(O.flatMap(R.get(exported, specifier), endingOf), {
            onNone: () => [],
            onSome: (ending) => [{ file, from, specifier, ending, typeOnly }]
          })
        )
      )
      const closed = A.map(
        A.filter(crossings, (crossing) => !crossing.typeOnly && !doorOpen({ ending: crossing.ending, from: crossing.from })),
        ({ file, from, specifier, ending }) => Finding.cases.ClosedDoor.make({ file, imports: specifier, kind: ending, from })
      )
      const count = (findings: ReadonlyArray<Finding>): Readonly<Record<string, number>> =>
        A.reduce(findings, R.empty<string, number>(), (counts, finding) =>
          R.set(counts, finding._tag, O.getOrElse(R.get(counts, finding._tag), () => 0) + 1)
        )
      const count2 = (names: ReadonlyArray<string>): Readonly<Record<string, number>> =>
        A.reduce(names, R.empty<string, number>(), (counts, name) =>
          R.set(counts, name, O.getOrElse(R.get(counts, name), () => 0) + 1)
        )
      const lines = A.map(
        A.filter(A.appendAll(placed, closed), (finding) => finding._tag !== "Held"),
        Finding.match({
          Held: ({ file }) => file,
          NoEnding: ({ file }) => `no ending     ${file}`,
          Unknown: ({ file, ending }) => `unknown       ${file} (.${ending})`,
          Renamed: ({ file, ending, to }) => `rename        ${file} (.${ending} is .${to})`,
          WrongLayer: ({ file, ending, layer: held }) => `wrong layer   ${file} (.${ending} in ${held})`,
          ClosedDoor: ({ file, imports, kind, from }) => `closed door   ${file} (${from}) imports ${imports} (.${kind})`
        })
      )
      // Which layers load a port, a handler or an in-memory twin from another package: the imports the door is for.
      const edges = ["port", "store", "gateway", "ports", "handler", "handlers", "memory"]
      const edgeImports = count2(
        A.map(
          A.filter(crossings, (crossing) => !crossing.typeOnly && A.contains(edges, crossing.ending)),
          (crossing) => crossing.from
        )
      )
      expect(
        {
          files: placed.length,
          ...count(placed),
          importsOfAContextsPackage: crossings.length,
          typeOnly: A.filter(crossings, (crossing) => crossing.typeOnly).length,
          exportKeys: R.size(exported),
          closedDoors: closed.length,
          edgeImports
        },
        A.join(lines, "\n")
      ).toEqual({
        files: 173,
        Held: 157,
        Renamed: 9,
        Unknown: 3,
        NoEnding: 4,
        importsOfAContextsPackage: 312,
        typeOnly: 43,
        exportKeys: 150,
        closedDoors: 0,
        edgeImports: { app: 2, host: 23, model: 4 }
      })
      // The door does close: a screen may not load a port, under either of its endings today.
      expect(doorOpen({ ending: "store", from: "web" })).toBe(false)
      expect(doorOpen({ ending: "handler", from: "web" })).toBe(false)
      expect(doorOpen({ ending: "rules", from: "web" })).toBe(true)
    })
  )
})
