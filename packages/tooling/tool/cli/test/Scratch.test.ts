import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as TestClock from "effect/testing/TestClock"
import {
  commentsOf,
  diagnosticLines,
  expectError,
  ignore,
  ignoredLines,
  leakingComments,
  leakingLines,
  noCheck,
  programFiles,
  type Install,
  type Listing,
  logLine,
  readLogLine,
  readNote,
  scratchCheck,
  scratchEnd,
  scratchList,
  scratchNew,
  scratchSentence,
  scratchTest,
  uncheckedLines
} from "../src/commands/Scratch/Scratch.rules.ts"
import { scratchpadFiles } from "../src/commands/Scratch/Scratch.config.ts"
import { decideFileLine, diagnosticDirective, typeName } from "../src/commands/Scratch/Scratch.templates.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { lines } from "./support/sync.ts"
import { inTree, json, printed, type Tree } from "./support/tree.ts"

// An install and a type-check that only leave a mark: nothing is installed, and no compiler runs.
const marked = (file: string, code = 0, output = ""): Install =>
  Effect.gen(function* () {
    const repo = yield* Repo
    yield* repo.write(repo.join(repo.root, file), "ran\n")
    return { code, output }
  })
const install = marked("installed")
const types = marked("typed")

// What the compiler would list, without running it: every TypeScript file under the scratchpad's folder.
const included: Listing = Effect.gen(function* () {
  const repo = yield* Repo
  const dir = repo.join(repo.root, "scratchpad")
  const paths = yield* repo.tree(dir)
  return A.map(
    A.filter(paths, (path) => /\.tsx?$/.test(path)),
    (path) => repo.join(dir, path)
  )
})
// A list the test states itself, each path from the repository's root.
const only = (...paths: ReadonlyArray<string>): Listing =>
  Effect.gen(function* () {
    const repo = yield* Repo
    return A.map(paths, (path) => repo.join(repo.root, path))
  })
// The same with the scratchpad's own two configuration files, which the compiler always lists.
const lists = (...paths: ReadonlyArray<string>): Listing =>
  only("scratchpad/vite.config.ts", "scratchpad/vitest.config.ts", ...paths)

const at = (iso: string) => DateTime.makeUnsafe(iso).pipe(DateTime.toEpochMillis, TestClock.setTime)
const note = (started: string, template = "probe", libraries = "") =>
  lines([
    "---",
    "status: open",
    `started: ${started}`,
    `template: ${template}`,
    `libraries: ${libraries}`,
    "---",
    "",
    "# an idea"
  ])

// The scratchpad's package.json: only the libraries experiments added, everything else from the root's install.
const manifest = (dependencies: ReadonlyArray<string>, types = "tsrs -p tsconfig.json") =>
  lines([
    "{",
    '  "name": "@x/scratchpad",',
    `  "scripts": { "types": "${types}", "tests": "vitest run", "serve": "vite --config vite.config.ts" },`,
    dependencies.length === 0 ? '  "dependencies": {}' : '  "dependencies": {',
    ...A.map(dependencies, (line, index) => `    ${line}${index === dependencies.length - 1 ? "" : ","}`),
    ...(dependencies.length === 0 ? [] : ["  }"]),
    "}"
  ])

// The scratchpad as the CLI writes its configuration, outside the root's workspaces, and a root install that has
// effect and the repository's packages (what an experiment imports from the root).
const repository = (extra: Tree = {}, dependencies: ReadonlyArray<string> = []): Tree => ({
  "package.json": json({ name: "root", workspaces: ["packages/*"], devDependencies: { vitest: "^5.1.0" } }),
  "packages/kernel/package.json": json({ name: "@x/kernel", dependencies: { effect: "4.1.4" } }),
  "node_modules/effect/package.json": "{}",
  "node_modules/@x/kernel/package.json": "{}",
  ...R.fromEntries(
    A.map(
      A.filter(scratchpadFiles, (file) => file.name !== "package.json"),
      (file) => [`scratchpad/${file.name}`, file.text] as const
    )
  ),
  "scratchpad/package.json": manifest(dependencies),
  "scratchpad/LOG.md": "# What the experiments taught\n\n",
  ...(dependencies.length === 0 ? {} : { "scratchpad/bun.lock": "the scratchpad's lockfile\n" }),
  ...extra
})

const said = <E>(effect: Effect.Effect<ReadonlyArray<Parameters<typeof scratchSentence>[0]>, E, Repo>) =>
  Effect.map(effect, (findings) => printed(render(scratchSentence)(findings)))
const read = Effect.fnUntraced(function* (file: string) {
  const repo = yield* Repo
  return yield* repo.text(repo.join(repo.root, file))
})
const there = Effect.fnUntraced(function* (file: string) {
  const repo = yield* Repo
  return yield* repo.exists(repo.join(repo.root, file))
})

describe("scratch", () => {
  it.effect("new writes an experiment from a template, with a note that says when it started", () =>
    Effect.gen(function* () {
      yield* at("2026-11-22T12:00:00Z")
      const result = yield* inTree(
        repository(),
        Effect.gen(function* () {
          const lines = yield* said(scratchNew({ name: "stock-count", template: "service", question: "" }))
          const text = yield* read("scratchpad/experiments/stock-count/NOTE.md")
          const code = yield* read("scratchpad/experiments/stock-count/StockCount.ts")
          const test = yield* there("scratchpad/experiments/stock-count/StockCount.test.ts")
          const installed = yield* there("installed")
          const again = yield* Effect.flip(scratchNew({ name: "stock-count", template: "probe", question: "" }))
          return { lines, text, code, test, installed, again: again.message }
        })
      )
      expect(result.lines).toEqual([
        "out: scratch:new  stock-count, from the service template: 3 files in scratchpad/experiments/stock-count",
        "out:   bun run scratch:test stock-count    its test, which passes as written",
        "out:   bun run scratch:check    the type-checker and the Effect diagnostics, over every experiment",
        "out:   scratchpad/experiments/stock-count/NOTE.md    say what it is trying to find out"
      ])
      expect(
        O.map(readNote(result.text), (found) => [found.status, found.started, found.template, found.libraries])
      ).toEqual(O.some(["open", "2026-11-22", "service", []]))
      expect(result.code).toContain('>()("@inventory/scratchpad/experiments/stock-count/StockCount") {')
      expect(result.test).toBe(true)
      // No library was added, so nothing is installed.
      expect(result.installed).toBe(false)
      expect(result.again).toBe(
        "scratchpad/experiments/stock-count is already there: choose another name, or end that experiment first"
      )
    })
  )

  it.effect("new refuses a name that is not one, and the verify template until its package is pinned", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository(),
        Effect.gen(function* () {
          const name = yield* Effect.flip(scratchNew({ name: "Stock_Count", template: "probe", question: "" }))
          const verify = yield* Effect.flip(scratchNew({ name: "shelf", template: "verify", question: "" }))
          const made = yield* there("scratchpad/experiments/shelf")
          return { name: name.message, verify: verify.message, made }
        })
      )
      expect(result.name).toBe(
        '"Stock_Count" cannot name an experiment: use small letters, digits and single hyphens, starting with a letter, at most 40 characters (stock-count, xlsx-dates-2)'
      )
      expect(result.verify).toBe(
        "the verify template needs @alchemy.run/domain, and the root's install does not have it (no package asks for it yet, or `bun install` has not run). Until it does, start from probe, service, screen"
      )
      expect(result.made).toBe(false)
    })
  )

  it.effect("new makes the verify template once the root's install has the prover, with no library of its own", () =>
    Effect.gen(function* () {
      yield* at("2026-11-22T12:00:00Z")
      const result = yield* inTree(
        repository({ "node_modules/@alchemy.run/domain/package.json": "{}" }),
        Effect.gen(function* () {
          const lines = yield* said(
            scratchNew({ name: "shelf", template: "verify", question: "Can a shelf overfill?" })
          )
          const text = yield* read("scratchpad/experiments/shelf/NOTE.md")
          const pkg = yield* read("scratchpad/package.json")
          const model = yield* there("scratchpad/experiments/shelf/Shelf.aggregate.ts")
          const checked = yield* scratchCheck(types, included).pipe(said)
          return { first: lines[0], text, pkg, model, checked }
        })
      )
      expect(result.first).toBe(
        "out: scratch:new  shelf, from the verify template: 3 files in scratchpad/experiments/shelf"
      )
      expect(result.text).toContain("libraries: \n")
      expect(result.text).toContain("Can a shelf overfill?")
      // The prover comes from the root, as the packages' effect does: the scratchpad's package.json is unchanged.
      expect(result.pkg).toBe(manifest([]))
      expect(result.model).toBe(true)
      expect(result.checked).toEqual([
        "out: scratch:check OK  1 experiment, none with an install of its own; 0 dependencies accounted for",
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it.effect("new writes the scratchpad's configuration where it is missing; check names one that differs", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        {
          ...repository(),
          "scratchpad/tsconfig.json": "{}\n",
          "scratchpad/vite.config.ts": ""
        },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* repo.remove(repo.join(repo.root, "scratchpad", "vitest.config.ts"))
          const before = yield* Effect.map(scratchCheck(types, included), render(scratchSentence))
          yield* scratchNew({ name: "idea", template: "probe", question: "" })
          const written = yield* read("scratchpad/vitest.config.ts")
          const after = yield* scratchCheck(types, included).pipe(said)
          return { before, written, after }
        })
      )
      const differs =
        "differs from what the CLI writes (packages/tooling/tool/cli/src/commands/Scratch/Scratch.config.ts): change both together"
      expect(result.before.failed).toBe(true)
      expect(A.filter(printed(result.before), Str.includes("scratchpad/"))).toEqual([
        `err:   scratchpad/tsconfig.json: ${differs}`,
        "err:   scratchpad/vitest.config.ts: is missing: `bun run scratch:new` writes it",
        `err:   scratchpad/vite.config.ts: ${differs}`
      ])
      // The missing file is written; one that differs is a person's to settle, and stays.
      expect(result.written).toBe(
        A.findFirst(scratchpadFiles, (file) => file.name === "vitest.config.ts").pipe(
          O.map((file) => file.text),
          O.getOrElse(() => "")
        )
      )
      expect(A.filter(result.after, Str.includes("scratchpad/"))).toEqual([
        `err:   scratchpad/tsconfig.json: ${differs}`,
        `err:   scratchpad/vite.config.ts: ${differs}`
      ])
    })
  )

  it.effect("list says what is open and how old, names what is past 30 days or 200 files, and reads the log back", () =>
    Effect.gen(function* () {
      yield* at("2026-11-22T12:00:00Z")
      const many = R.fromEntries(
        A.map(A.range(1, 201), (n) => [`scratchpad/experiments/big/file-${n}.ts`, ""] as const)
      )
      const listed = yield* inTree(
        repository({
          "scratchpad/experiments/fresh/NOTE.md": note("2026-11-20"),
          "scratchpad/experiments/fresh/Fresh.ts": "",
          "scratchpad/experiments/fresh/.state/db.sqlite": "",
          "scratchpad/experiments/old/NOTE.md": note("2026-10-22", "screen"),
          "scratchpad/experiments/edge/NOTE.md": note("2026-10-23"),
          "scratchpad/experiments/big/NOTE.md": note("2026-11-22"),
          ...many,
          "scratchpad/experiments/unnamed/Loose.ts": "",
          "scratchpad/LOG.md": lines([
            "# What the experiments taught",
            "",
            "One line for each experiment that ended.",
            "",
            "- 2026-11-01 xlsx-dates: graduated to packages/foundation/modeling/xlsx/src/Dates.ts. Serial 60 is not a day.",
            "- 2026-11-03 drag-rows: dropped. The table library already reorders."
          ])
        }),
        said(scratchList())
      )
      expect(listed).toEqual([
        "out: scratch:list  5 experiments are open",
        "out:   open  big (probe), since 2026-11-22: 0 days, 202 files",
        "out:   look  big holds 202 files (more than 200): graduate it (`bun run scratch:graduate`) or drop it (`bun run scratch:drop`)",
        "out:   open  edge (probe), since 2026-10-23: 30 days, 1 file",
        "out:   open  fresh (probe), since 2026-11-20: 2 days, 2 files",
        "out:   open  old (screen), since 2026-10-22: 31 days, 1 file",
        "out:   look  old is 31 days old (more than 30): graduate it (`bun run scratch:graduate`) or drop it (`bun run scratch:drop`)",
        "out:   look  unnamed has no NOTE.md that says what it is (`bun run scratch:check` says what is missing): graduate it (`bun run scratch:graduate`) or drop it (`bun run scratch:drop`)",
        "out:   2026-11-01 xlsx-dates: graduated to packages/foundation/modeling/xlsx/src/Dates.ts. Serial 60 is not a day.",
        "out:   2026-11-03 drag-rows: dropped. The table library already reorders."
      ])
    })
  )

  it.effect("an empty scratchpad lists nothing, and its check type-checks its own configuration", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository(),
        Effect.gen(function* () {
          const listed = yield* said(scratchList())
          const checked = yield* scratchCheck(types, included).pipe(said)
          const typed = yield* there("typed")
          return { listed, checked, typed }
        })
      )
      expect(result.listed).toEqual(["out: scratch:list  no experiment is open"])
      expect(result.checked).toEqual([
        "out: scratch:check OK  0 experiments, none with an install of its own; 0 dependencies accounted for",
        "out: scratch:check OK  the scratchpad's configuration and 0 experiments pass the type-checker and the Effect diagnostics"
      ])
      expect(result.typed).toBe(true)
    })
  )

  it.effect("check refuses an install inside an experiment, a missing note and a dependency nobody accounts for", () =>
    Effect.gen(function* () {
      const report = yield* inTree(
        repository(
          {
            "scratchpad/experiments/own-install/NOTE.md": note("2026-11-22", "probe", "zod, date-fns"),
            "scratchpad/experiments/own-install/package.json": "{}",
            "scratchpad/experiments/own-install/sub/bun.lock": "",
            "scratchpad/experiments/own-install/node_modules/zod/index.js": "",
            "scratchpad/experiments/no-note/Idea.ts": "",
            "scratchpad/experiments/bad-note/NOTE.md": "---\nstatus: graduated\n---\n"
          },
          [
            '"@x/kernel": "workspace:*"',
            '"effect": "4.1.4"',
            '"left-pad": "^1.3.0"',
            '"react": "^19.0.0"',
            '"zod": "^4.0.0"'
          ]
        ),
        Effect.map(
          scratchCheck(marked("typed", 2, "experiments/no-note/Idea.ts(1,1): error TS1: wrong"), included),
          render(scratchSentence)
        )
      )
      const install =
        "an experiment has no install of its own: a library goes in the scratchpad's package.json and is named in the experiment's NOTE.md (`libraries:`). Remove this"
      const noNote =
        "is missing or does not read as a note: it starts with status: open, started: a day, template: one of probe, service, screen, verify, and libraries: (empty, or names separated by commas), between two lines of ---"
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: scratch:check FAIL  10 problems",
        `err:   scratchpad/experiments/bad-note/NOTE.md: ${noNote}`,
        `err:   scratchpad/experiments/no-note/NOTE.md: ${noNote}`,
        `err:   scratchpad/experiments/own-install/node_modules: ${install}`,
        `err:   scratchpad/experiments/own-install/package.json: ${install}`,
        `err:   scratchpad/experiments/own-install/sub/bun.lock: ${install}`,
        "err:   scratchpad/package.json: `@x/kernel` comes from the root's install: an experiment imports it as the packages do. Remove it here (`bun remove --cwd scratchpad @x/kernel`), so there is one copy",
        "err:   scratchpad/package.json: `effect` comes from the root's install: an experiment imports it as the packages do. Remove it here (`bun remove --cwd scratchpad effect`), so there is one copy",
        "err:   scratchpad/package.json: `react` comes from the root's install: an experiment imports it as the packages do. Remove it here (`bun remove --cwd scratchpad react`), so there is one copy",
        "err:   scratchpad/package.json: `left-pad` is a library no experiment's NOTE.md names (`libraries:`): name the experiment that needs it, or remove it",
        "err:   scratchpad/experiments/own-install/NOTE.md: names the library `date-fns`, which is not in the scratchpad's package.json: add it there (`bun add --cwd scratchpad date-fns`), or take it out of the note",
        "err: scratch:check FAIL  the type-checker, with the Effect diagnostics, over the experiments:\nexperiments/no-note/Idea.ts(1,1): error TS1: wrong"
      ])
    })
  )

  it("a diagnostic may be turned off only by the one line, first in a decide file", () => {
    const line = decideFileLine
    expect(diagnosticLines("Shelf.aggregate.ts")(`${line}\nexport const x = 1\n`)).toEqual([])
    expect(diagnosticLines("Count.decision.ts")(`${line}\r\n`)).toEqual([])
    expect(diagnosticLines("Shelf.ts")(`${line}\n`)).toEqual([1])
    expect(diagnosticLines("Shelf.test.ts")(`${line}\n`)).toEqual([1])
    expect(diagnosticLines("Shelf.aggregate.ts")(`// a comment\n${line}\n`)).toEqual([2])
    expect(diagnosticLines("Shelf.aggregate.ts")(`// ${diagnosticDirective} strictEffectProvide:off\n`)).toEqual([1])
    expect(
      diagnosticLines("Shelf.aggregate.ts")(`${line}\n// ${diagnosticDirective}-next-line floatingEffect:off\n`)
    ).toEqual([2])
  })

  it.effect("check refuses a diagnostic turned off anywhere but the first line of a decide file", () =>
    Effect.gen(function* () {
      const line = decideFileLine
      const result = yield* inTree(
        repository({
          "scratchpad/experiments/shelf/NOTE.md": note("2026-11-22", "verify", ""),
          "scratchpad/experiments/shelf/Shelf.aggregate.ts": `${line}\nexport const decide = 1\n`,
          "scratchpad/experiments/shelf/Shelf.decision.ts": `// first\n${line}\n`,
          "scratchpad/experiments/shelf/Shelf.ts": `${line}\n`,
          "scratchpad/experiments/shelf/Shelf.test.ts": `// ${diagnosticDirective} floatingEffect:off\n`
        }),
        scratchCheck(types, included).pipe(said)
      )
      const refused = `turns an Effect diagnostic off. Only a decide file (\`*.aggregate.ts\`, \`*.decision.ts\`) may, and only \`${decideFileLine}\` as its first line (decision 33 of the Alchemy brief): build with \`.make\` here`
      expect(result).toEqual([
        "err: scratch:check FAIL  3 problems",
        `err:   scratchpad/experiments/shelf/Shelf.decision.ts:2: ${refused}`,
        `err:   scratchpad/experiments/shelf/Shelf.test.ts:1: ${refused}`,
        `err:   scratchpad/experiments/shelf/Shelf.ts:1: ${refused}`,
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it.effect("check reads the files the compiler lists, wherever they are, and no other", () =>
    Effect.gen(function* () {
      const off = `// ${diagnosticDirective} floatingEffect:off\n`
      const result = yield* inTree(
        {
          ...repository({
            "scratchpad/experiments/shelf/NOTE.md": note("2026-11-22", "probe", ""),
            "scratchpad/experiments/Loose.ts": off,
            "scratchpad/experiments/shelf/dist/Shelf.ts": off,
            "scratchpad/experiments/shelf/.lib/Imported.ts": off,
            "scratchpad/experiments/shelf/.state/Imported.ts": "// @TS-NoCheck\n",
            "scratchpad/experiments/shelf/linked/Reached.ts": off,
            "scratchpad/extra.config.ts": off,
            // Never loaded by the compiler, so what they say changes nothing.
            "scratchpad/experiments/shelf/.state/cache.ts": off,
            "scratchpad/experiments/shelf/gen/api.js": `// ${noCheck}\n`,
            // A library an install put there, and a file somebody wrote in a folder of the same name.
            "scratchpad/node_modules/left-pad/package.json": "{}",
            "scratchpad/node_modules/left-pad/index.ts": off,
            "scratchpad/node_modules/@scope/pad/package.json": "{}",
            "scratchpad/node_modules/@scope/pad/src/index.ts": off,
            "scratchpad/lib/node_modules/Written.ts": off,
            "scratchpad/node_modules/mine/Written.ts": off
          }),
          // Reached by a relative import that leaves the scratchpad: the experiment's own, and no less so beside a
          // package.json somebody wrote, which makes no workspace of the folder.
          "notes/Outside.ts": off,
          "notes/own/package.json": "{}",
          "notes/own/Beside.ts": off,
          // A package's file is that package's, held by its own check.
          // A package's file is that package's, held by its own check: what a tsconfig file of it includes.
          "packages/kernel/package.json": json({ name: "@x/kernel" }),
          "packages/kernel/tsconfig.json": json({ include: ["src/**/*.ts"] }),
          "packages/kernel/tsconfig.node.json":
            '{\n  // its one configuration file\n  "include": ["vite.config.ts",],\n}\n',
          "packages/kernel/src/Role.ts": off,
          "packages/kernel/vite.config.ts": off,
          // Elsewhere in a package's folder its check reads nothing, so there the file is the experiment's: a folder
          // beside `src`, and a `test` folder no project of the package includes.
          "packages/kernel/notes/Stray.ts": off,
          "packages/kernel/test/Unread.ts": off
        },
        scratchCheck(
          types,
          lists(
            "scratchpad/experiments/Loose.ts",
            "scratchpad/experiments/shelf/dist/Shelf.ts",
            "scratchpad/experiments/shelf/.lib/Imported.ts",
            "scratchpad/experiments/shelf/.state/Imported.ts",
            "scratchpad/experiments/shelf/linked/Reached.ts",
            "scratchpad/extra.config.ts",
            "scratchpad/node_modules/left-pad/index.ts",
            "scratchpad/node_modules/@scope/pad/src/index.ts",
            "scratchpad/lib/node_modules/Written.ts",
            "scratchpad/node_modules/mine/Written.ts",
            "notes/Outside.ts",
            "notes/own/Beside.ts",
            "packages/kernel/notes/Stray.ts",
            "packages/kernel/src/Role.ts",
            "packages/kernel/test/Unread.ts",
            "packages/kernel/vite.config.ts"
          )
        ).pipe(said)
      )
      const refused = `turns an Effect diagnostic off. Only a decide file (\`*.aggregate.ts\`, \`*.decision.ts\`) may, and only \`${decideFileLine}\` as its first line (decision 33 of the Alchemy brief): build with \`.make\` here`
      expect(result).toEqual([
        "err: scratch:check FAIL  12 problems",
        `err:   notes/Outside.ts:1: ${refused}`,
        `err:   notes/own/Beside.ts:1: ${refused}`,
        `err:   packages/kernel/notes/Stray.ts:1: ${refused}`,
        `err:   packages/kernel/test/Unread.ts:1: ${refused}`,
        `err:   scratchpad/experiments/Loose.ts:1: ${refused}`,
        `err:   scratchpad/experiments/shelf/.lib/Imported.ts:1: ${refused}`,
        `err:   scratchpad/experiments/shelf/.state/Imported.ts:1: names \`${noCheck}\`, which turns the type-checker and every Effect diagnostic off for a whole file. No file of the scratchpad may hold it: remove the line and fix what the type-checker then says`,
        `err:   scratchpad/experiments/shelf/dist/Shelf.ts:1: ${refused}`,
        `err:   scratchpad/experiments/shelf/linked/Reached.ts:1: ${refused}`,
        `err:   scratchpad/extra.config.ts:1: ${refused}`,
        `err:   scratchpad/lib/node_modules/Written.ts:1: ${refused}`,
        `err:   scratchpad/node_modules/mine/Written.ts:1: ${refused}`,
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it("the compiler's list is its absolute TypeScript paths, a runner's own lines left out", () => {
    expect(
      programFiles("$ tsrs -p tsconfig.json --listFilesOnly\n/repo/scratchpad/vite.config.ts\r\n/repo/a/B.tsx\n\n")
    ).toEqual(["/repo/scratchpad/vite.config.ts", "/repo/a/B.tsx"])
  })

  it.effect("check says so when the compiler's list is not whole, and passes nothing on an empty one", () =>
    Effect.gen(function* () {
      const tree = repository({
        "scratchpad/experiments/shelf/NOTE.md": note("2026-11-22", "probe", ""),
        "scratchpad/experiments/shelf/Shelf.ts": `// ${noCheck}\nexport const count = 1\n`
      })
      const lacks = (names: string) =>
        `err:   scratchpad/tsconfig.json: the type-checker's list of the files it reads lacks ${names}, which it always reads. So the list is not whole, and a line that turns a check off may stand in a file nobody read: run \`bun run types --listFilesOnly\` in scratchpad and see what it prints (its \`types\` script is \`tsrs -p tsconfig.json\`)`
      const empty = yield* inTree(tree, scratchCheck(types, only()).pipe(said))
      expect(A.take(empty, 2)).toEqual([
        "err: scratch:check FAIL  1 problem",
        lacks("scratchpad/vite.config.ts and scratchpad/vitest.config.ts")
      ])
      const partial = yield* inTree(
        tree,
        scratchCheck(types, only("scratchpad/vite.config.ts", "scratchpad/experiments/shelf/Shelf.ts")).pipe(said)
      )
      expect(A.map(A.take(partial, 3), (line) => Str.replace(/: names .*$/, ": names")(line))).toEqual([
        "err: scratch:check FAIL  2 problems",
        lacks("scratchpad/vitest.config.ts"),
        "err:   scratchpad/experiments/shelf/Shelf.ts:1: names"
      ])
    })
  )

  it("a comment is what the parser reads as one: not a string, a template, a regular expression or JSX text", () => {
    expect(
      commentsOf("Try.tsx")(
        A.join(
          [
            'const quoted = "// no" // one',
            "const single = '/* no */'",
            "const lines = `",
            "// no ${[1].map((n) => `${n} // no`) /* two */}",
            "// no`",
            'const pattern = /[/]\\/"/ // three',
            "const half = 4 / 2 /* four",
            "still four */",
            "const after = (4) /2/ 1 // five",
            "const text = <p>Don't // no</p> // six"
          ],
          "\n"
        )
      )
    ).toEqual(
      O.some([
        { line: 1, text: "// one" },
        { line: 4, text: "/* two */" },
        { line: 6, text: "// three" },
        { line: 7, text: "/* four\nstill four */" },
        { line: 9, text: "// five" },
        { line: 10, text: "// six" }
      ])
    )
  })

  it("a directive is found after a tag that closes itself, after JSX text with a quote, and after `++` or a `!`", () => {
    const code = A.join(
      [
        `const row = <Row item={item} /> // ${ignore}`,
        `const spread = <Row {...props} /> // ${ignore}`,
        `const tight = <Row item={item}/> // ${ignore}`,
        `const button = <Btn onClick={() => { go() }} /> // ${ignore}`,
        `const text = <p>Don't</p> // ${ignore}`,
        `const said = <p>say "hi \`</p> // ${ignore}`,
        "const list = (",
        "  <div>",
        `    <Row item={item} /> {/* ${ignore} */}`,
        `    <p>Don't</p> {/* ${ignore} */}`,
        "  </div>",
        ")",
        `const label = <b>{name}</b> // ${ignore}`,
        `const half = count++ / 2 // ${ignore}`,
        `const less = count-- / 2 // ${ignore}`,
        `const sure = count! / 2 // ${ignore}`,
        `const not = !/[/]/.test(name) // ${ignore}`,
        `const sum = (1) / 2 + /"/.source.length // ${ignore}`
      ],
      "\n"
    )
    expect(ignoredLines("Try.tsx")(code)).toEqual([1, 2, 3, 4, 5, 6, 9, 10, 13, 14, 15, 16, 17, 18])
  })

  it("a line ends where the compiler ends one: a lone carriage return and the two separators too", () => {
    expect(ignoredLines("Try.ts")(`const a = 1 // note\u2028// ${ignore}\nconst b: number = "x"\n`)).toEqual([2])
    expect(ignoredLines("Try.ts")(`const a = 1 // note\u2029// ${ignore}\nconst b: number = "x"\n`)).toEqual([2])
    expect(ignoredLines("Try.ts")(`// note\r// ${ignore}\rconst b: number = "x"\r`)).toEqual([2])
    expect(uncheckedLines("Try.ts")(`// note\u2028// ${noCheck}\n`)).toEqual([2])
    expect(uncheckedLines("Try.ts")(`// note\r// ${noCheck}\r`)).toEqual([2])
  })

  it("in a file the parser refuses, every line that names a directive is given", () => {
    const broken = `export const broken = {\nconst count = 1\n// ${ignore}\nconst sample = "${ignore}"\n`
    expect(commentsOf("Try.ts")(broken)).toEqual(O.none())
    expect(ignoredLines("Try.ts")(broken)).toEqual([3, 4])
    expect(uncheckedLines("Try.ts")(`/* never closed\n${noCheck}\n`)).toEqual([2])
    expect(ignoredLines("Try.ts")("export const broken = {\n")).toEqual([])
  })

  it("a directive is one where a comment starts with it; a string or a sentence that names it is none", () => {
    const quoted = A.join(
      [
        `const sample = "// ${ignore}\\nfoo()"`,
        `const other = \`\n// ${noCheck}\n// ${ignore}\n\``,
        `/** Replaces ${ignore} with ${expectError}, and never writes ${noCheck}. */`,
        `// see ${ignore} and ${noCheck}`
      ],
      "\n"
    )
    expect(ignoredLines("Try.ts")(quoted)).toEqual([])
    expect(uncheckedLines("Try.ts")(quoted)).toEqual([])
    expect(ignoredLines("Try.ts")(`const count = 1 // ${ignore}\n/*\n * ${ignore} */\n/// ${ignore}: why\n`)).toEqual([
      1, 3, 4
    ])
  })

  it("the comments that silence a leaking requirement are found in any capitals, wherever they stand", () => {
    expect(leakingComments).toEqual(["@effect-leakable-service", "@effect-expect-leaking"])
    expect(
      leakingLines("/** @effect-leakable-service */\nclass Database {}\n// @Effect-Expect-Leaking Database\n")
    ).toEqual([1, 3])
    expect(leakingLines("// @effect-diagnostics floatingEffect:off\n")).toEqual([])
  })

  it.effect("check refuses a comment that silences a leaking requirement, and lets a quoted directive stand", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository({
          "scratchpad/experiments/shelf/NOTE.md": note("2026-11-22", "service", ""),
          "scratchpad/experiments/shelf/Shelf.ts": "/** @effect-leakable-service */\nexport class Database {}\n",
          "scratchpad/experiments/shelf/Strip.test.ts": `const sample = "// ${ignore}\\nfoo()"\n/** Replaces ${ignore}. */\n`
        }),
        scratchCheck(types, included).pipe(said)
      )
      expect(result).toEqual([
        "err: scratch:check FAIL  1 problem",
        "err:   scratchpad/experiments/shelf/Shelf.ts:1: names a comment that silences the `leakingRequirements` diagnostic (`@effect-leakable-service` or `@effect-expect-leaking`). No file of the scratchpad may: give the service what it needs in its Layer, so no method requires it",
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it("the comment that turns a whole file's checks off is found on any line", () => {
    expect(uncheckedLines("Try.ts")(`// ${noCheck}\nexport const count = 1\n`)).toEqual([1])
    expect(uncheckedLines("Try.ts")(`/* a note */\r\n/// ${noCheck}\r\n`)).toEqual([2])
    expect(uncheckedLines("Try.ts")("// @TS-NoCheck\nexport const count = 1\n// @ts-NOCHECK\n")).toEqual([1, 3])
    expect(uncheckedLines("Try.ts")("// @ts-check\nexport const count = 1\n")).toEqual([])
  })

  it.effect("check refuses a file that turns the type-checker off whole, a decide file too", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository({
          "scratchpad/experiments/shelf/NOTE.md": note("2026-11-22", "verify", ""),
          "scratchpad/experiments/shelf/Shelf.ts": `// ${noCheck}\nexport const count = 1\n`,
          "scratchpad/experiments/shelf/Shelf.aggregate.ts": `${decideFileLine}\n// ${noCheck}\n`
        }),
        scratchCheck(types, included).pipe(said)
      )
      const refused = `names \`${noCheck}\`, which turns the type-checker and every Effect diagnostic off for a whole file. No file of the scratchpad may hold it: remove the line and fix what the type-checker then says`
      expect(result).toEqual([
        "err: scratch:check FAIL  2 problems",
        `err:   scratchpad/experiments/shelf/Shelf.aggregate.ts:2: ${refused}`,
        `err:   scratchpad/experiments/shelf/Shelf.ts:1: ${refused}`,
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it("the comment that hides the next line's error is found in any capitals; the one that expects it is not", () => {
    expect(ignoredLines("Try.ts")(`const count = 1\n// ${ignore}\ncount()\n`)).toEqual([2])
    expect(ignoredLines("Try.ts")("// @TS-Ignore\r\n/* @ts-IGNORE */\r\n")).toEqual([1, 2])
    expect(ignoredLines("Try.ts")(`// ${expectError}\ncount()\n`)).toEqual([])
  })

  it.effect("check refuses a line that hides a type error, and lets one that expects it stand", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository({
          "scratchpad/experiments/shelf/NOTE.md": note("2026-11-22", "probe", ""),
          "scratchpad/experiments/shelf/Shelf.ts": `export const count = 1\n// ${ignore}\ncount()\n`,
          "scratchpad/experiments/shelf/Shelf.test.ts": `// @TS-Ignore\nexport const size = 1\n`,
          "scratchpad/experiments/shelf/Wrong.ts": `// ${expectError}\nexport const wrong: number = "one"\n`
        }),
        scratchCheck(types, included).pipe(said)
      )
      const refused = `names \`${ignore}\`, which hides a type error on the next line and keeps hiding it after the code is fixed. Fix the error, or, where the experiment shows that a wrong call does not compile, write \`${expectError}\`, which fails by itself once the error is gone`
      expect(result).toEqual([
        "err: scratch:check FAIL  2 problems",
        `err:   scratchpad/experiments/shelf/Shelf.test.ts:1: ${refused}`,
        `err:   scratchpad/experiments/shelf/Shelf.ts:2: ${refused}`,
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it.effect(
    "check holds the scratchpad's scripts to the CLI's: the type-check and its list of files run through them",
    () =>
      Effect.gen(function* () {
        const result = yield* inTree(
          {
            ...repository({ "scratchpad/experiments/idea/NOTE.md": note("2026-11-22") }),
            "scratchpad/package.json": manifest([], "tsrs -p tsconfig.json --noCheck")
          },
          scratchCheck(types, included).pipe(said)
        )
        expect(result).toEqual([
          "err: scratch:check FAIL  1 problem",
          "err:   scratchpad/package.json: its `types` script is `tsrs -p tsconfig.json --noCheck`, not `tsrs -p tsconfig.json` as the CLI writes it (packages/tooling/tool/cli/src/commands/Scratch/Scratch.config.ts): the scratchpad's checks run through its scripts, so change both together",
          "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
        ])
      })
  )

  it.effect("check asks for the scratchpad's own lockfile once it lists a library", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        {
          ...repository({ "scratchpad/experiments/idea/NOTE.md": note("2026-11-22", "probe", "zod") }, [
            '"zod": "^4.0.0"'
          ]),
          "scratchpad/bun.lock": ""
        },
        Effect.gen(function* () {
          const repo = yield* Repo
          yield* repo.remove(repo.join(repo.root, "scratchpad", "bun.lock"))
          return yield* scratchCheck(types, included).pipe(said)
        })
      )
      expect(result).toEqual([
        "err: scratch:check FAIL  1 problem",
        "err:   scratchpad/package.json: lists libraries and scratchpad/bun.lock is not there: run `bun install --cwd scratchpad` and commit scratchpad/bun.lock",
        "out: scratch:check OK  the scratchpad's configuration and 1 experiment pass the type-checker and the Effect diagnostics"
      ])
    })
  )

  it.effect("graduate deletes the folder, removes the libraries only it named, and logs what was learned", () =>
    Effect.gen(function* () {
      yield* at("2026-11-25T08:00:00Z")
      const result = yield* inTree(
        repository(
          {
            "scratchpad/experiments/dates/NOTE.md": note("2026-11-20", "probe", "zod, date-fns"),
            "scratchpad/experiments/dates/Dates.ts": "",
            "scratchpad/experiments/dates/Dates.test.ts": "",
            "scratchpad/experiments/other/NOTE.md": note("2026-11-21", "probe", "zod"),
            "packages/kernel/src/Dates.ts": ""
          },
          ['"@x/kernel": "workspace:*"', '"date-fns": "^4.4.0"', '"effect": "4.1.4"', '"zod": "^4.0.0"']
        ),
        Effect.gen(function* () {
          const lines = yield* said(
            scratchEnd(
              {
                name: "dates",
                to: O.some("packages/kernel/src/Dates.ts"),
                learned: "  A day is\n not a   date-time. "
              },
              install
            )
          )
          const folder = yield* there("scratchpad/experiments/dates")
          const pkg = yield* read("scratchpad/package.json")
          const log = yield* read("scratchpad/LOG.md")
          const installed = yield* there("installed")
          const dropped = yield* said(scratchEnd({ name: "other", to: O.none(), learned: "Not needed." }, install))
          const after = yield* read("scratchpad/package.json")
          const listed = yield* said(scratchList())
          return { lines, folder, pkg, log, installed, dropped, after, listed }
        })
      )
      expect(result.lines).toEqual([
        "out: scratch  dates graduated to packages/kernel/src/Dates.ts: 3 files deleted, date-fns removed from the scratchpad's package.json, one line added to scratchpad/LOG.md"
      ])
      expect(result.folder).toBe(false)
      // zod stays: the other experiment names it too.
      expect(result.pkg).toBe(manifest(['"@x/kernel": "workspace:*"', '"effect": "4.1.4"', '"zod": "^4.0.0"']))
      expect(result.log).toBe(
        "# What the experiments taught\n\n- 2026-11-25 dates: graduated to packages/kernel/src/Dates.ts. A day is not a date-time.\n"
      )
      expect(result.installed).toBe(true)
      expect(result.dropped).toEqual([
        "out: scratch  other dropped: 1 file deleted, zod removed from the scratchpad's package.json, one line added to scratchpad/LOG.md"
      ])
      expect(result.after).toBe(manifest(['"@x/kernel": "workspace:*"', '"effect": "4.1.4"']))
      expect(result.listed).toEqual([
        "out: scratch:list  no experiment is open",
        "out:   2026-11-25 dates: graduated to packages/kernel/src/Dates.ts. A day is not a date-time.",
        "out:   2026-11-25 other: dropped. Not needed."
      ])
    })
  )

  it.effect("an experiment does not end without what was learned, or by graduating to nowhere", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository({ "scratchpad/experiments/idea/NOTE.md": note("2026-11-20"), "packages/kernel/src/a.ts": "" }),
        Effect.gen(function* () {
          const refused = (to: O.Option<string>, learned: string, name = "idea") =>
            Effect.map(Effect.flip(scratchEnd({ name, to, learned }, install)), (error) => error.message)
          const silent = yield* refused(O.none(), "  ")
          const nowhere = yield* refused(O.some("packages/kernel/src/gone.ts"), "x")
          const inside = yield* refused(O.some("scratchpad/experiments/idea"), "x")
          const outside = yield* refused(O.some("../elsewhere"), "x")
          const unknown = yield* refused(O.none(), "x", "ghost")
          const still = yield* there("scratchpad/experiments/idea/NOTE.md")
          return { silent, nowhere, inside, outside, unknown, still }
        })
      )
      const moveFirst = (to: string) =>
        `an experiment graduates to where its code now is: a file or folder of this repository outside the scratchpad, with no space in its path. ${to} is not one. Move the code first, then graduate`
      expect(result).toEqual({
        silent: "say what was learned, in one line (--learned): it is all that stays of the experiment",
        nowhere: moveFirst("packages/kernel/src/gone.ts"),
        inside: moveFirst("scratchpad/experiments/idea"),
        outside: moveFirst("../elsewhere"),
        unknown: "scratchpad/experiments/ghost is not there. Open: idea",
        still: true
      })
    })
  )

  it.effect(
    "test runs one experiment's folder, never another whose name starts the same, and refuses one that is not there",
    () =>
      Effect.gen(function* () {
        const asked: Array<string> = []
        const run = (folder: string) =>
          Effect.sync(() => {
            asked.push(folder)
            return {
              code: 0,
              output:
                folder === "experiments/empty" ? "No test files found, exiting with code 0" : "Test Files  1 passed (1)"
            }
          })
        const result = yield* inTree(
          repository({
            "scratchpad/experiments/xlsx-dates/NOTE.md": note("2026-11-22"),
            "scratchpad/experiments/xlsx-dates-2/NOTE.md": note("2026-11-22"),
            "scratchpad/experiments/empty/NOTE.md": note("2026-11-22")
          }),
          Effect.gen(function* () {
            const one = yield* said(scratchTest(O.some("xlsx-dates"), run))
            const every = yield* said(scratchTest(O.none(), run))
            const empty = yield* Effect.map(scratchTest(O.some("empty"), run), render(scratchSentence))
            const missing = yield* Effect.flip(scratchTest(O.some("xlsx"), run))
            return { one, every, empty, missing: missing.message }
          })
        )
        expect(asked).toEqual(["experiments/xlsx-dates", "experiments", "experiments/empty"])
        expect(result.one).toEqual(["out: scratch:test OK  xlsx-dates\nTest Files  1 passed (1)"])
        expect(result.every).toEqual(["out: scratch:test OK  every experiment\nTest Files  1 passed (1)"])
        expect(result.empty.failed).toBe(true)
        expect(result.missing).toBe("scratchpad/experiments/xlsx is not there. Open: empty, xlsx-dates, xlsx-dates-2")
      })
  )

  it("reads a note saved on Windows or with a byte-order mark as the same note", () => {
    const unix = note("2026-11-22", "service", "zod")
    const windows = `\uFEFF${A.join(Str.split("\n")(unix), "\r\n")}`
    expect(readNote(windows)).toEqual(readNote(unix))
    expect(O.isSome(readNote(windows))).toBe(true)
  })

  it("a line of the log reads back as what was written, and a name becomes a type's", () => {
    const lines = [
      "- 2026-11-01 xlsx-dates: graduated to packages/foundation/modeling/xlsx/src/Dates.ts. Serial 60 is not a day.",
      "- 2026-11-03 drag-rows: dropped. Nothing. Really."
    ]
    expect(A.map(lines, (line) => O.map(readLogLine(line), logLine))).toEqual(A.map(lines, O.some))
    expect(A.map(["# What the experiments taught", "", "- not a line"], (line) => O.isNone(readLogLine(line)))).toEqual(
      [true, true, true]
    )
    expect(A.map(["stock-count", "xlsx-dates-2", "idea"], typeName)).toEqual(["StockCount", "XlsxDates2", "Idea"])
  })
})
