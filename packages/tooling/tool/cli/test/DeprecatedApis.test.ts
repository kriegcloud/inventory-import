// The law run on small repositories with this repository's own profile, installed packages and tools, so a test here
// fails when the rule is turned off in the profile, when an engine stops seeing a form, or when a tool is missing.
// The layers are provided where a tree is made ready, as in ./support/tree.ts.
// @effect-diagnostics strictEffectProvide:off
import * as NodeServices from "@effect/platform-node/NodeServices"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Order from "effect/Order"
import * as Str from "effect/String"
import * as Digest from "effect/crypto/Digest"
import { deprecatedApis, deprecatedApisSentence } from "../src/commands/Laws/DeprecatedApis.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

const clean = "out: deprecated:check OK  no deprecated API is used"
const refused = "err: deprecated:check FAIL  a deprecated API is used. Move to what its note names:"
const profile = ".oxlintrc.deprecated-apis.json"

const project = (include: ReadonlyArray<string>, types: ReadonlyArray<string> = []) =>
  json({
    compilerOptions: {
      noEmit: true,
      strict: true,
      module: "esnext",
      moduleResolution: "bundler",
      target: "ES2025",
      lib: ["ESNext", "DOM"],
      jsx: "react-jsx",
      allowImportingTsExtensions: true,
      types
    },
    include
  })

/** A package that exports one deprecated thing of each kind, each beside what replaces it. */
const library = `
/** @deprecated use next */
export const old = 1
export const next = 2

/** @deprecated use the object form */
export function ask(question: string): string
export function ask(question: { readonly words: string }): string
export function ask(question: unknown): string {
  return String(question)
}

export interface CardProps {
  /** @deprecated use label */
  readonly text?: string
  readonly label?: string
}
export const Card = (_: CardProps) => null

/** @deprecated use NewCard */
export type OldCard = string
export type NewCard = string
`

const packages: Tree = {
  "packages/lib/package.json": json({ name: "@x/lib", type: "module", exports: { "./Lib": "./src/Lib.tsx" } }),
  "packages/lib/tsconfig.json": project(["src"]),
  "packages/lib/src/Lib.tsx": library,
  "packages/use/package.json": json({ name: "@x/use", type: "module" }),
  "packages/use/tsconfig.json": project(["src"])
}

const inRepository = Effect.gen(function* () {
  const repo = yield* Repo
  const fs = yield* FileSystem.FileSystem
  // This package's own root, found from the folder the tests run in.
  const real = yield* Repo.pipe(Effect.provide(Repo.layer().pipe(Layer.provide(Digest.layerWebCrypto))))
  const here = (path: string) => repo.join(repo.root, path)
  const own = here(profile)
  const given = yield* repo.exists(own)
  if (!given) {
    const text = yield* repo.text(real.join(real.root, profile))
    yield* repo.write(own, text)
  }
  yield* fs.symlink(real.join(real.root, "node_modules"), here("node_modules"))
  yield* fs.makeDirectory(here("packages/use/node_modules/@x"), { recursive: true })
  yield* fs.symlink(here("packages/lib"), here("packages/use/node_modules/@x/lib"))
  yield* repo.run("git", ["init", "-q"])
  const found = yield* deprecatedApis()
  return render(deprecatedApisSentence)(found)
}).pipe(Effect.provide(NodeServices.layer))

/** What the law prints on the packages, with these files beside them. */
const said = (files: Tree) => Effect.map(inTree({ ...packages, ...files }, inRepository), printed)

/** What the law prints on one file of the package that uses the library. */
const saidOf = (source: string) => said({ "packages/use/src/Use.tsx": source })

// A run starts git, oxlint and two type-aware engines: well under a second each, on an idle machine.
const patience = 60_000

describe("laws deprecated-apis", () => {
  it.effect(
    "passes what replaces each, and refuses the one deprecated use beside them",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import * as Graph from "effect/Graph"
import { pipe } from "effect/Function"
import * as Url from "node:url"
import type { SubmitEvent } from "react"
import { ask, Card, next, type NewCard, old } from "@x/lib/Lib"
export const neighbors = Graph.successors
export const sent = (event: SubmitEvent) => event.preventDefault()
export const value = pipe(next, (n) => n + 1)
export const answer = ask({ words: "which" })
export const card: NewCard = "card"
export const drawn = <Card label="Card" />
export const framed = <iframe title="Frame" style={{ border: 0 }} />
export const address = Url.pathToFileURL
export const still = old
`)
        expect(lines).toEqual([refused, "err: packages/use/src/Use.tsx:14:22  `old` is deprecated. use next"])
      }),
    patience
  )

  it.effect(
    "passes a repository with no deprecated use",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf('export { next } from "@x/lib/Lib"\n')
        expect(lines).toEqual([clean])
      }),
    patience
  )

  it.effect(
    "refuses an export effect marks deprecated, the one whose overloads carry the tag too",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import * as Graph from "effect/Graph"
const graph = Graph.directed<string, string>()
export const held = Graph.neighborsDirected
export const called = Graph.neighborsDirected(graph, 0, "outgoing")
`)
        expect(lines).toEqual([
          refused,
          "err: packages/use/src/Use.tsx:3:27  `neighborsDirected` is deprecated. Use for outgoing neighbors or for incoming neighbors.",
          "err: packages/use/src/Use.tsx:4:29  `neighborsDirected` is deprecated. Use for outgoing neighbors or for incoming neighbors."
        ])
      }),
    patience
  )

  it.effect(
    "refuses another package's deprecated export: React's FormEvent, which says SubmitEvent",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import type { FormEvent } from "react"
export const sent = (event: FormEvent) => event.preventDefault()
`)
        expect(A.map(lines, Str.takeLeft(75))).toEqual([
          Str.takeLeft(75)(refused),
          "err: packages/use/src/Use.tsx:2:29  `FormEvent` is deprecated. FormEvent do"
        ])
      }),
    patience
  )

  it.effect(
    "refuses a deprecated export of one of our own packages, across the package boundary",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import { old, type OldCard } from "@x/lib/Lib"
import * as Lib from "@x/lib/Lib"
export const named = old
export const spaced = Lib.old
export const typed: OldCard = "card"
export { old as passedOn } from "@x/lib/Lib"
`)
        expect(lines).toEqual([
          refused,
          "err: packages/use/src/Use.tsx:3:22  `old` is deprecated. use next",
          "err: packages/use/src/Use.tsx:4:27  `old` is deprecated. use next",
          "err: packages/use/src/Use.tsx:5:21  `OldCard` is deprecated. use NewCard",
          "err: packages/use/src/Use.tsx:6:17  `passedOn` is deprecated. use next"
        ])
      }),
    patience
  )

  it.effect(
    "refuses the deprecated overload of a function and passes the other",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import { ask } from "@x/lib/Lib"
export const before = ask("which")
export const after = ask({ words: "which" })
`)
        expect(lines).toEqual([refused, "err: packages/use/src/Use.tsx:2:23  `ask` is deprecated. use the object form"])
      }),
    patience
  )

  it.effect(
    "refuses a deprecated property, read, taken out or written, and a deprecated prop",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import { Card, type CardProps } from "@x/lib/Lib"
export const read = (props: CardProps) => props.text
export const named = (props: CardProps) => props["text"]
export const taken = ({ text }: CardProps) => text
export const written: CardProps = { text: "card" }
export const drawn = <Card text="card" />
export const framed = <iframe title="Frame" frameBorder={0} />
`)
        expect(lines).toEqual([
          refused,
          "err: packages/use/src/Use.tsx:2:49  `text` is deprecated. use label",
          "err: packages/use/src/Use.tsx:3:50  `text` is deprecated. use label",
          "err: packages/use/src/Use.tsx:4:25  `text` is deprecated. use label",
          "err: packages/use/src/Use.tsx:5:37  `text` is deprecated. use label",
          "err: packages/use/src/Use.tsx:6:28  `text` is deprecated. use label",
          "err: packages/use/src/Use.tsx:7:45  `frameBorder` is deprecated."
        ])
      }),
    patience
  )

  it.effect(
    "reads the tests, the root's own files, a package's scripts and a file git has not seen yet",
    () =>
      Effect.gen(function* () {
        const use = `import { old } from "@x/lib/Lib"\nexport const value = old\n`
        const lines = yield* said({
          "tsconfig.json": json({
            files: [],
            references: [{ path: "./packages/use/tsconfig.test.json" }, { path: "./tsconfig.config.json" }]
          }),
          "tsconfig.config.json": project(["*.ts", "packages/use/*.ts"], ["node"]),
          "packages/use/tsconfig.test.json": project(["test"], ["node"]),
          "packages/use/test/Use.test.ts": `${use}import * as Url from "node:url"\nexport const parse = Url.parse\n`,
          "packages/use/build.config.ts": use,
          "packages/use/scripts/run.mjs": use,
          "deploy.run.ts": `import * as Url from "node:url"\nexport const parse = Url.parse\n`,
          "packages/use/dist/built.js": use,
          ".gitignore": "dist\nnode_modules\n",
          ".agents/skills/one/skill.ts": use
        })
        expect(A.sort(lines, Order.String)).toEqual([
          "err: deploy.run.ts:2:26  `parse` is deprecated. Use the WHATWG URL API instead.",
          refused,
          "err: packages/use/build.config.ts:2:22  `old` is deprecated. use next",
          "err: packages/use/scripts/run.mjs:2:22  `old` is deprecated. use next",
          "err: packages/use/test/Use.test.ts:2:22  `old` is deprecated. use next",
          "err: packages/use/test/Use.test.ts:4:26  `parse` is deprecated. Use the WHATWG URL API instead."
        ])
      }),
    patience
  )

  it.effect(
    "refuses a TypeScript file no tsconfig includes: it would be read without its package's types",
    () =>
      Effect.gen(function* () {
        const lines = yield* said({
          "packages/use/src/Use.ts": "export const value = 1\n",
          "packages/use/test/Use.test.ts": 'import * as Url from "node:url"\nexport const parse = Url.parse\n',
          "packages/use/scripts/run.mjs": "export const value = 1\n"
        })
        expect(lines).toEqual([
          "err: deprecated:check FAIL  packages/use/test/Use.test.ts is in no tsconfig, so it is read without its package's types: include it in one the root tsconfig.json references"
        ])
      }),
    patience
  )

  it.effect(
    "refuses a profile that leaves files out",
    () =>
      Effect.gen(function* () {
        const lines = yield* said({
          "packages/use/src/Use.ts": `import { old } from "@x/lib/Lib"\nexport const value = old\n`,
          [profile]: json({
            plugins: ["typescript"],
            options: { typeAware: true },
            categories: { correctness: "off" },
            ignorePatterns: ["packages/use/**"],
            rules: { "typescript/no-deprecated": "error" }
          })
        })
        expect(lines).toEqual([
          "err: deprecated:check FAIL  oxlint read 1 of 2 files: .oxlintrc.deprecated-apis.json leaves none out (no ignorePatterns)"
        ])
      }),
    patience
  )

  // Pinned so a new engine that sees one of these fails here, and the list in docs/standards/deprecated-apis.md is put
  // right with it. Each is a use a person would call one.
  it.effect(
    "does not see a use that no type carries, a parameter's default, or a line that turns the rule off",
    () =>
      Effect.gen(function* () {
        const lines = yield* said({
          "packages/lib/src/Lib.tsx": `${library}
// eslint-disable-next-line
export const bound = old
export const untyped: any = { old: 1 }
export interface Inline { /** @deprecated use label */ readonly text?: string }
export const draw = (
  /** @deprecated use label */
  text?: string
) => null
`,
          "packages/use/src/Use.tsx": `import * as Lib from "@x/lib/Lib"
import { bound, type CardProps, draw, type Inline, old, untyped } from "@x/lib/Lib"
export const another = bound
export const unknown = untyped.old
export const reflected = Reflect.get(Lib, "old")
export const braced = (card: Inline) => card.text
export const argument = draw("card")
export const defaulted = (value = old) => value
export type Text = CardProps["text"]
export type Picked = Pick<CardProps, "text">
export const key: keyof CardProps = "text"
export const either = (card: CardProps, name: "text" | "label") => card[name]
export const listed = (card: Record<keyof CardProps, string>) => card.text
const card = { text: "card" }
export const whole: CardProps = card
export const spread: CardProps = { ...card }
export * from "@x/lib/Lib"
// oxlint-disable-next-line typescript/no-deprecated
export const silenced = old
export const seen = old
`
        })
        expect(lines).toEqual([refused, "err: packages/use/src/Use.tsx:20:21  `old` is deprecated. use next"])
      }),
    patience
  )
})
