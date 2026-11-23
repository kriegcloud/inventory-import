/**
 * The starting points of an experiment: for each, the files `scratch new` writes into its folder. Every one has a
 * test that passes as written, so an experiment starts from something that runs. The files are held to the
 * repository's profile by `scratch:check` and by a test that makes each template and runs it.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Str from "effect/String"

const $I = $RepoCliId.create("commands/Scratch/Scratch.templates")

const TemplateKit = LiteralKit(["probe", "service", "screen", "verify"])

/**
 * What an experiment starts from: a plain function and its test (`probe`), a service with a twin for tests
 * (`service`), a screen on its own page with the design system and atoms (`screen`), or a domain model checked by
 * the prover (`verify`).
 *
 * @category schemas
 */
export const Template = TemplateKit.pipe($I.annoteSchema("Template", { description: "What an experiment starts from" }))

/** The templates' names, for a sentence that lists them. */
export const templates = TemplateKit.literals

/**
 * The decoded value of `Template`.
 *
 * @category models
 */
export type Template = typeof Template.Type

/** A file of a new experiment: its name inside the experiment's folder, and its text. */
export interface TemplateFile {
  readonly name: string
  readonly text: string
}

const lines = (all: ReadonlyArray<string>): string => `${A.join(all, "\n")}\n`

/**
 * An experiment's name as a type's: `stock-count` is `StockCount`.
 *
 * @category rules
 */
export const typeName = (slug: string): string =>
  A.join(
    A.map(Str.split("-")(slug), (word) => `${Str.toUpperCase(Str.slice(0, 1)(word))}${Str.slice(1)(word)}`),
    ""
  )

const probe = (slug: string): ReadonlyArray<TemplateFile> => {
  const name = typeName(slug)
  return [
    {
      name: `${name}.ts`,
      text: lines([
        "/**",
        ` * ${slug}: a first probe. Replace \`canEdit\` with what you are trying. Any package of the repository is imported by`,
        " * its name, as `@inventory/kernel/Role` is here.",
        " */",
        'import { hasRole, type Role } from "@inventory/kernel/Role"',
        'import * as Effect from "effect/Effect"',
        "",
        "/** Whether someone with this role may change a record. */",
        'export const canEdit = (role: Role): boolean => hasRole(role, "editor")',
        "",
        "/** The same question as an Effect, so the test shows both ways of asking. */",
        `export const askCanEdit = Effect.fn("${name}.askCanEdit")(function* (role: Role) {`,
        "  yield* Effect.logDebug(`asked about ${role}`)",
        "  return canEdit(role)",
        "})"
      ])
    },
    {
      name: `${name}.test.ts`,
      text: lines([
        'import { describe, expect, it } from "@effect/vitest"',
        'import * as Effect from "effect/Effect"',
        `import { askCanEdit, canEdit } from "./${name}.ts"`,
        "",
        `describe("${slug}", () => {`,
        '  it("answers as a plain function", () => {',
        '    expect(canEdit("admin")).toBe(true)',
        '    expect(canEdit("viewer")).toBe(false)',
        "  })",
        "",
        '  it.effect("answers as an Effect", () =>',
        "    Effect.gen(function* () {",
        '      const answer = yield* askCanEdit("editor")',
        "      expect(answer).toBe(true)",
        "    })",
        "  )",
        "})"
      ])
    }
  ]
}

const service = (slug: string): ReadonlyArray<TemplateFile> => {
  const name = typeName(slug)
  return [
    {
      name: `${name}.ts`,
      text: lines([
        "/**",
        ` * ${slug}: a service and what uses it. The service is what the experiment needs from outside (a store, a clock,`,
        " * another system); `layerMemory` is its twin for tests, with everything in memory.",
        " */",
        'import * as Context from "effect/Context"',
        'import * as Effect from "effect/Effect"',
        'import * as HashMap from "effect/HashMap"',
        'import * as Layer from "effect/Layer"',
        'import * as O from "effect/Option"',
        'import * as Ref from "effect/Ref"',
        "",
        "/** A place that keeps one note under a name. */",
        `export class ${name} extends Context.Service<`,
        `  ${name},`,
        "  {",
        "    readonly keep: (name: string, note: string) => Effect.Effect<void>",
        "    readonly find: (name: string) => Effect.Effect<O.Option<string>>",
        "  }",
        `>()("@inventory/scratchpad/experiments/${slug}/${name}") {`,
        "  /** Everything in memory, and nothing shared between two tests. */",
        "  static readonly layerMemory = Layer.effect(",
        `    ${name},`,
        "    Effect.gen(function* () {",
        "      const kept = yield* Ref.make(HashMap.empty<string, string>())",
        "      return {",
        `        keep: Effect.fn("${name}.keep")(function* (name: string, note: string) {`,
        "          yield* Ref.update(kept, HashMap.set(name, note))",
        "        }),",
        `        find: Effect.fn("${name}.find")(function* (name: string) {`,
        "          const all = yield* Ref.get(kept)",
        "          return HashMap.get(all, name)",
        "        })",
        "      }",
        "    })",
        "  )",
        "}",
        "",
        "/** Keeps a note unless one is already kept under that name, and says which note stands. */",
        `export const keepOnce = Effect.fn("${name}.keepOnce")(function* (name: string, note: string) {`,
        `  const store = yield* ${name}`,
        "  const already = yield* store.find(name)",
        "  if (O.isSome(already)) return already.value",
        "  yield* store.keep(name, note)",
        "  return note",
        "})"
      ])
    },
    {
      name: `${name}.test.ts`,
      text: lines([
        'import { expect, layer } from "@effect/vitest"',
        'import * as Effect from "effect/Effect"',
        `import { keepOnce, ${name} } from "./${name}.ts"`,
        "",
        `layer(${name}.layerMemory)("${slug}", (it) => {`,
        '  it.effect("the first note under a name stands", () =>',
        "    Effect.gen(function* () {",
        '      const first = yield* keepOnce("shelf", "counted on Monday")',
        '      const second = yield* keepOnce("shelf", "counted on Tuesday")',
        '      expect([first, second]).toEqual(["counted on Monday", "counted on Monday"])',
        "    })",
        "  )",
        "})"
      ])
    }
  ]
}

const screen = (slug: string): ReadonlyArray<TemplateFile> => {
  const name = typeName(slug)
  return [
    {
      name: `${name}.atoms.ts`,
      text: lines([
        "/**",
        ` * ${slug}: what the screen holds. State is atoms, as in the app: a value the screen holds is \`Atom.make\`, one worked`,
        " * out from others is `Atom.map`.",
        " */",
        'import * as Atom from "effect/reactivity/Atom"',
        "",
        "/** How many were counted. */",
        "export const counted = Atom.make(0)",
        "",
        "/** What the screen says about it. */",
        'export const said = Atom.map(counted, (count) => (count === 1 ? "1 item counted" : `${count} items counted`))'
      ])
    },
    {
      name: `${name}.screen.tsx`,
      text: lines([
        "/** The screen: the design system's components (`@inventory/ui`) over the atoms beside it. */",
        'import { useAtomSet, useAtomValue } from "@effect/atom-react"',
        'import { Button } from "@inventory/ui/components/button"',
        `import { counted, said } from "./${name}.atoms.ts"`,
        "",
        `export const ${name}Screen = () => {`,
        "  const words = useAtomValue(said)",
        "  const setCounted = useAtomSet(counted)",
        "  return (",
        '    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">',
        `      <h1 className="text-lg font-semibold">${slug}</h1>`,
        '      <p className="tabular-nums">{words}</p>',
        '      <div className="flex gap-2">',
        "        <Button onClick={() => setCounted((count) => count + 1)}>Count one</Button>",
        '        <Button variant="outline" onClick={() => setCounted(0)}>',
        "          Start again",
        "        </Button>",
        "      </div>",
        "    </main>",
        "  )",
        "}"
      ])
    },
    {
      name: `${name}.test.ts`,
      text: lines([
        'import { describe, expect, it } from "@effect/vitest"',
        'import * as AtomRegistry from "effect/reactivity/AtomRegistry"',
        `import { counted, said } from "./${name}.atoms.ts"`,
        "",
        `describe("${slug}", () => {`,
        '  it("says what was counted", () => {',
        "    const registry = AtomRegistry.make()",
        '    expect(registry.get(said)).toBe("0 items counted")',
        "    registry.set(counted, 1)",
        '    expect(registry.get(said)).toBe("1 item counted")',
        "  })",
        "})"
      ])
    },
    {
      name: "main.tsx",
      text: lines([
        `// The page's start. Served by \`bun run scratch:serve experiments/${slug}\` on its own port; the app never loads it.`,
        'import { RegistryProvider } from "@effect/atom-react"',
        'import { ThemeProvider } from "@inventory/ui/Theme"',
        'import { StrictMode } from "react"',
        'import { createRoot } from "react-dom/client"',
        `import { ${name}Screen } from "./${name}.screen.tsx"`,
        'import "./screen.css"',
        "",
        'const root = document.getElementById("root")',
        "if (root !== null) {",
        "  createRoot(root).render(",
        "    <StrictMode>",
        "      <RegistryProvider>",
        "        <ThemeProvider>",
        `          <${name}Screen />`,
        "        </ThemeProvider>",
        "      </RegistryProvider>",
        "    </StrictMode>",
        "  )",
        "}"
      ])
    },
    {
      name: "screen.css",
      text: lines([
        "/* The design system's theme, and the files Tailwind reads class names from: this folder and the components. */",
        '@import "@inventory/ui/theme.css";',
        '@source "./";',
        '@source "../../../packages/ui/src";'
      ])
    },
    {
      name: "index.html",
      text: lines([
        "<!doctype html>",
        '<html lang="en">',
        "  <head>",
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />',
        `    <title>${slug} (experiment)</title>`,
        "  </head>",
        "  <body>",
        '    <div id="root"></div>',
        '    <script type="module" src="./main.tsx"></script>',
        "  </body>",
        "</html>"
      ])
    }
  ]
}

/**
 * The word that starts an Effect diagnostic's directive, written in two pieces: the language service reads the whole
 * word wherever it stands in a file, a string included, and would turn the diagnostic off in this file.
 */
const diagnosticsWord = "diagnostics"
export const diagnosticDirective = `@effect-${diagnosticsWord}`

const verify = (slug: string): ReadonlyArray<TemplateFile> => {
  const name = typeName(slug)
  return [
    {
      name: `${name}.aggregate.ts`,
      text: lines([
        "// The prover reads this file's source. An event or a rejection is built with `.make`, here as everywhere: the",
        "// prover reads it as the instance it builds (the repository's third patch to the library, docs/patches.md).",
        "/**",
        ` * ${slug}: a domain model the prover can read. Commands are decided against a state, events change it, and the`,
        " * rules (`invariants` of a state, `transitions` between two) are what the prover holds every path to.",
        " */",
        'import * as Domain from "@alchemy.run/domain"',
        'import * as Effect from "effect/Effect"',
        'import * as S from "effect/Schema"',
        "",
        "const LIMIT = 3",
        "",
        "/** One more was counted on a shelf. */",
        'export class Counted extends Domain.Event("Counted", { shelf: S.String }) {}',
        "/** The shelf already holds as many as it may. */",
        'export class ShelfFull extends Domain.Rejection("ShelfFull", {}) {}',
        "",
        "/** Count one more on a shelf. */",
        'export class CountOne extends Domain.Command("CountOne", {',
        "  input: { shelf: S.String },",
        "  events: [Counted],",
        "  rejects: [ShelfFull]",
        "}) {}",
        "",
        "/** A shelf and how many were counted on it. */",
        'export class Shelf extends Domain.Aggregate("Shelf", {',
        "  id: S.String,",
        "  state: S.Struct({ counted: S.Int }),",
        "  initial: { counted: 0 },",
        "  invariants: {",
        "    NeverMoreThanTheLimit: (state) => state.counted >= 0 && state.counted <= LIMIT",
        "  },",
        "  transitions: {",
        "    TheCountRisesByOne: ({ before, after }) => after.counted === before.counted + 1",
        "  },",
        "  commands: [CountOne],",
        "  keyOf: (command) => command.shelf,",
        "  decide: {",
        "    CountOne: Effect.fn(function* (state, command) {",
        "      if (state.counted >= LIMIT) return yield* ShelfFull.make({})",
        "      return [Counted.make({ shelf: command.shelf })]",
        "    })",
        "  },",
        "  evolve: {",
        "    Counted: (state) => ({ counted: state.counted + 1 })",
        "  }",
        "}) {}",
        "",
        "/** The model the stories run. */",
        `export class ${name}Model extends Domain.Model("${name}Model", { aggregates: [Shelf] }) {}`
      ])
    },
    {
      name: `${name}.test.ts`,
      text: lines([
        "// A story runs the real model command by command; the proof holds every path through it to its rules.",
        'import { Story } from "@alchemy.run/domain/Story"',
        'import * as Verify from "@alchemy.run/domain/Verify"',
        'import * as NodeServices from "@effect/platform-node/NodeServices"',
        'import { expect, layer } from "@effect/vitest"',
        'import * as Effect from "effect/Effect"',
        `import { Counted, CountOne, Shelf, ShelfFull, ${name}Model } from "./${name}.aggregate.ts"`,
        "",
        `const story = Story.make(${name}Model, {})`,
        'const shelf = Shelf.ref("a1")',
        'const one = [Story.when(CountOne.make({ shelf: "a1" })), Story.then(shelf, Counted.make({ shelf: "a1" }))]',
        "",
        `layer(NodeServices.layer)("${slug}", (it) => {`,
        '  it.effect("three are counted, and the fourth is refused", () =>',
        '    story(...one, ...one, ...one, Story.when(CountOne.make({ shelf: "a1" })), Story.rejected(ShelfFull.make({})))',
        "  )",
        "",
        "  it.effect(",
        '    "every path keeps the rules",',
        "    () =>",
        "      Effect.gen(function* () {",
        "        const report = yield* Verify.aggregate(Shelf)",
        '        expect(Verify.render(report)).not.toBe("")',
        "      }),",
        "    300_000",
        "  )",
        "})"
      ])
    }
  ]
}

/**
 * The files of a new experiment, by its template. `verify` is written only once the prover's package is pinned in
 * the repository (`Scratch.rules.ts` refuses it with a sentence until then).
 *
 * @category rules
 */
export const filesOf = (template: Template): ((slug: string) => ReadonlyArray<TemplateFile>) =>
  TemplateKit.match(template, {
    probe: () => probe,
    service: () => service,
    screen: () => screen,
    verify: () => verify
  })
