// The law run on small repositories with this repository's own profile, installed packages and tools, so a test here
// fails when the rule is turned off in the profile, when an engine stops seeing a form, or when a tool is missing.
// Each repository's files are committed before the law runs, as the real one's are; a test that names `untracked`
// files writes those after the commit.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Str from "effect/String"
import { deprecatedApis, deprecatedApisSentence } from "../src/commands/Laws/DeprecatedApis.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

const clean = "out: deprecated:check OK  no deprecated API is used (.agents/ is not read)"
const refused = "err: deprecated:check FAIL  a deprecated API is used. Move to what its note names:"
const profile = ".oxlintrc.deprecated-apis.json"

/** A comment that turns rules off, put together here so this file holds none itself: the law reads it too. */
const off = (tool: "oxlint" | "eslint", scope: "" | "-next-line" | "-line", rules = "") =>
  Str.trim(`${tool}-disable${scope} ${rules}`)

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
  ".gitignore": "node_modules\ndist\n",
  "packages/lib/package.json": json({ name: "@x/lib", type: "module", exports: { "./Lib": "./src/Lib.tsx" } }),
  "packages/lib/tsconfig.json": project(["src"]),
  "packages/lib/src/Lib.tsx": library,
  "packages/use/package.json": json({ name: "@x/use", type: "module" }),
  "packages/use/tsconfig.json": project(["src"])
}

/** This repository's root, from this file's folder: its profile and what it has installed are what the law is run with. */
const real = (repo: Repo["Service"], path: string) => repo.resolve(import.meta.dirname, "../../../../..", path)

const inRepository = Effect.fn("inRepository")(function* (untracked: Tree) {
  const repo = yield* Repo
  const here = (path: string) => repo.join(repo.root, path)
  const own = here(profile)
  const given = yield* repo.exists(own)
  if (!given) {
    const text = yield* repo.text(real(repo, profile))
    yield* repo.write(own, text)
  }
  yield* repo.run("ln", ["-s", real(repo, "node_modules"), here("node_modules")])
  yield* repo.run("mkdir", ["-p", here("packages/use/node_modules/@x")])
  yield* repo.run("ln", ["-s", here("packages/lib"), here("packages/use/node_modules/@x/lib")])
  yield* repo.run("git", ["init", "-q"])
  yield* repo.run("git", ["add", "--all"])
  const committed = yield* repo.run("git", [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.test",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "-m",
    "files"
  ])
  expect(committed.code, committed.stderr).toBe(0)
  yield* Effect.forEach(R.toEntries(untracked), ([file, content]) => repo.write(here(file), content), {
    concurrency: 1,
    discard: true
  })
  const found = yield* deprecatedApis()
  return render(deprecatedApisSentence)(found)
})

/** What the law prints on the packages, with these files committed beside them and those written after the commit. */
const said = (files: Tree, untracked: Tree = {}) =>
  Effect.map(inTree({ ...packages, ...files }, inRepository(untracked)), printed)

/** What the law prints on one file of the package that uses the library. */
const saidOf = (source: string) => said({ "packages/use/src/Use.tsx": source })

// A run starts git, oxlint and two type-aware engines: well under a second each, on an idle machine.
const patience = 60_000

describe("laws deprecated-apis", () => {
  it.effect(
    "passes what replaces each, and refuses the deprecated use beside it, in a project that has Node's types",
    () =>
      Effect.gen(function* () {
        const lines = yield* said({
          "packages/use/tsconfig.json": project(["src"], ["node"]),
          "packages/use/src/Use.tsx": `import * as Graph from "effect/Graph"
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
export const parsed = Url.parse
export const still = old
`
        })
        expect(lines).toEqual([
          refused,
          "err: packages/use/src/Use.tsx:14:27  `parse` is deprecated. Use the WHATWG URL API instead.",
          "err: packages/use/src/Use.tsx:15:22  `old` is deprecated. use next"
        ])
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

  // The engine tells the overloads apart only at a call. A reference to the function with no call is refused when
  // any overload is deprecated, even where only the other one fits: call it inside a function of your own there.
  it.effect(
    "refuses a call of the deprecated overload and passes a call of the other; refuses the function handed on uncalled, whichever overload fits",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import { ask } from "@x/lib/Lib"
export const before = ask("which")
export const after = ask({ words: "which" })
export const each = [{ words: "which" }].map(ask)
export const wrapped = [{ words: "which" }].map((question) => ask(question))
`)
        expect(lines).toEqual([
          refused,
          "err: packages/use/src/Use.tsx:2:23  `ask` is deprecated. use the object form",
          "err: packages/use/src/Use.tsx:4:46  `ask` is deprecated. use the object form"
        ])
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
    "reads the tests, the root's own files, a package's scripts, a folder nobody listed, a name outside ASCII and a file git has not seen yet",
    () =>
      Effect.gen(function* () {
        const use = `import { old } from "@x/lib/Lib"\nexport const value = old\n`
        const node = `import * as Url from "node:url"\nexport const parse = Url.parse\n`
        const lines = yield* said(
          {
            "tsconfig.json": json({
              files: [],
              references: [{ path: "./packages/use/tsconfig.test.json" }, { path: "./tsconfig.config.json" }]
            }),
            "tsconfig.config.json": project(["*.ts", "packages/use/*.ts"], ["node"]),
            "packages/use/tsconfig.test.json": project(["test"], ["node"]),
            "packages/use/test/Use.test.ts": `${use}${node}`,
            "packages/use/build.config.ts": use,
            "packages/use/scripts/tsconfig.json": json({
              compilerOptions: { noEmit: true, allowJs: true, module: "nodenext", types: ["node"] },
              include: ["."]
            }),
            "packages/use/scripts/run.mjs": node,
            "packages/use/src/Usé.ts": use,
            "deploy.run.ts": node,
            "tools/tsconfig.json": project(["."], ["node"]),
            "tools/seed.ts": node,
            "packages/use/dist/built.js": use,
            ".agents/skills/one/skill.ts": use
          },
          { "packages/use/src/New.ts": use }
        )
        expect(A.sort(lines, Order.String)).toEqual([
          "err: deploy.run.ts:2:26  `parse` is deprecated. Use the WHATWG URL API instead.",
          refused,
          "err: packages/use/build.config.ts:2:22  `old` is deprecated. use next",
          "err: packages/use/scripts/run.mjs:2:26  `parse` is deprecated. Use the WHATWG URL API instead.",
          "err: packages/use/src/New.ts:2:22  `old` is deprecated. use next",
          "err: packages/use/src/Usé.ts:2:22  `old` is deprecated. use next",
          "err: packages/use/test/Use.test.ts:2:22  `old` is deprecated. use next",
          "err: packages/use/test/Use.test.ts:4:26  `parse` is deprecated. Use the WHATWG URL API instead.",
          "err: tools/seed.ts:2:26  `parse` is deprecated. Use the WHATWG URL API instead."
        ])
      }),
    patience
  )

  it.effect(
    "refuses a file no tsconfig includes, JavaScript too: it would be read without its package's types",
    () =>
      Effect.gen(function* () {
        const node = 'import * as Url from "node:url"\nexport const parse = Url.parse\n'
        const lines = yield* said({
          "packages/use/src/Use.ts": "export const value = 1\n",
          "packages/use/test/Use.test.ts": node,
          "packages/use/scripts/run.mjs": node,
          "tools/seed.mjs": node
        })
        const unowned = (file: string) =>
          `err: deprecated:check FAIL  ${file} is in no tsconfig, so it is read without its package's types: include it in one the nearest tsconfig.json above it references, or the root's`
        expect(A.sort(lines, Order.String)).toEqual([
          unowned("packages/use/scripts/run.mjs"),
          unowned("packages/use/test/Use.test.ts"),
          unowned("tools/seed.mjs")
        ])
      }),
    patience
  )

  const loosened = (extra: Readonly<Record<string, unknown>>, rule = "error") =>
    said({
      "packages/use/src/Use.ts": `import { old } from "@x/lib/Lib"\nexport const value = old\n`,
      [profile]: json({
        plugins: ["typescript"],
        options: { typeAware: true },
        categories: { correctness: "off" },
        rules: { "typescript/no-deprecated": rule },
        ...extra
      })
    })
  const unchecked = Str.takeLeft(170)(
    "err: deprecated:check FAIL  .oxlintrc.deprecated-apis.json must be the one rule as an error and nothing else (no overrides, ignorePatterns or extends), so nothing was checked: "
  )

  it.effect(
    "refuses a profile that leaves files out, turns the rule off for some, takes another's settings or warns",
    () =>
      Effect.gen(function* () {
        const answers = yield* Effect.forEach(
          [
            loosened({ ignorePatterns: ["packages/use/**"] }),
            loosened({ overrides: [{ files: ["packages/use/**"], rules: { "typescript/no-deprecated": "off" } }] }),
            loosened({ extends: ["./other.json"] }),
            loosened({}, "warn"),
            loosened({ rules: { "typescript/no-deprecated": "error", "no-console": "off" } })
          ],
          (answer) => answer,
          { concurrency: 1 }
        )
        expect(A.map(answers, A.map(Str.takeLeft(170)))).toEqual(A.makeBy(5, () => [unchecked]))
        // The profile as it must be still finds the use: the five above differ from it in one thing each.
        const exact = yield* loosened({})
        expect(exact).toEqual([refused, "err: packages/use/src/Use.ts:2:22  `old` is deprecated. use next"])
      }),
    patience * 2
  )

  it.effect(
    "refuses a comment that turns the rule off, by its name or by naming none, and passes one that names another rule",
    () =>
      Effect.gen(function* () {
        const lines = yield* saidOf(`import { next, old } from "@x/lib/Lib"
// ${off("eslint", "-next-line")}
export const bare = old
// ${off("oxlint", "-next-line", "typescript/no-deprecated -- the old one, for now")}
export const named = old
export const sameLine = old // ${off("oxlint", "-line", "no-console, @typescript-eslint/no-deprecated")}
/* ${off("eslint", "")} */
// ${off("oxlint", "-next-line", "no-console")}
export const other = next
`)
        const silenced = (line: number, written: string) =>
          `err: deprecated:check FAIL  packages/use/src/Use.tsx:${line} turns the rule off (${written}): no comment does. Move to what the note names`
        expect(lines).toEqual([
          silenced(2, off("eslint", "-next-line")),
          silenced(4, off("oxlint", "-next-line")),
          silenced(6, off("oxlint", "-line")),
          silenced(7, off("eslint", ""))
        ])
      }),
    patience
  )

  // Pinned so a new engine that sees one of these fails here, and the list in docs/standards/deprecated-apis.md is put
  // right with it. Each is a use a person would call one.
  it.effect(
    "does not see a use that no type carries or a parameter's default",
    () =>
      Effect.gen(function* () {
        const lines = yield* said({
          "packages/lib/src/Lib.tsx": `${library}
export const bound = next
export const untyped: any = { old: 1 }
export interface Inline { /** @deprecated use label */ readonly text?: string }
export const draw = (
  /** @deprecated use label */
  text?: string
) => null
`,
          "packages/use/src/Use.tsx": `import * as Lib from "@x/lib/Lib"
import { type CardProps, draw, type Inline, old, untyped } from "@x/lib/Lib"
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
export const seen = old
`
        })
        expect(lines).toEqual([refused, "err: packages/use/src/Use.tsx:17:21  `old` is deprecated. use next"])
      }),
    patience
  )
})
