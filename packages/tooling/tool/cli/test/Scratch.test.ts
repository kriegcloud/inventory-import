import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as TestClock from "effect/testing/TestClock"
import {
  type Install,
  logLine,
  readLogLine,
  readNote,
  scratchCheck,
  scratchEnd,
  scratchList,
  scratchNew,
  scratchSentence
} from "../src/commands/Scratch/Scratch.rules.ts"
import { typeName } from "../src/commands/Scratch/Scratch.templates.ts"
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

const manifest = (dependencies: ReadonlyArray<string>) =>
  lines([
    "{",
    '  "name": "@x/scratchpad",',
    '  "dependencies": {',
    ...A.map(dependencies, (line, index) => `    ${line}${index === dependencies.length - 1 ? "" : ","}`),
    "  },",
    '  "devDependencies": {',
    '    "vitest": "^5.1.0"',
    "  }",
    "}"
  ])

const repository = (extra: Tree = {}, dependencies = ['"@x/kernel": "workspace:*"', '"effect": "4.1.4"']): Tree => ({
  "package.json": json({
    name: "root",
    workspaces: ["packages/*", "scratchpad"],
    devDependencies: { vitest: "^5.1.0" }
  }),
  "packages/kernel/package.json": json({ name: "@x/kernel", dependencies: { effect: "4.1.4" } }),
  "scratchpad/package.json": manifest(dependencies),
  "scratchpad/LOG.md": "# What the experiments taught\n\n",
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
          const lines = yield* said(scratchNew({ name: "stock-count", template: "service", question: "" }, install))
          const text = yield* read("scratchpad/experiments/stock-count/NOTE.md")
          const code = yield* read("scratchpad/experiments/stock-count/StockCount.ts")
          const test = yield* there("scratchpad/experiments/stock-count/StockCount.test.ts")
          const installed = yield* there("installed")
          const again = yield* Effect.flip(
            scratchNew({ name: "stock-count", template: "probe", question: "" }, install)
          )
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
          const name = yield* Effect.flip(scratchNew({ name: "Stock_Count", template: "probe", question: "" }, install))
          const verify = yield* Effect.flip(scratchNew({ name: "shelf", template: "verify", question: "" }, install))
          const made = yield* there("scratchpad/experiments/shelf")
          return { name: name.message, verify: verify.message, made }
        })
      )
      expect(result.name).toBe(
        '"Stock_Count" cannot name an experiment: use small letters, digits and single hyphens, starting with a letter, at most 40 characters (stock-count, xlsx-dates-2)'
      )
      expect(result.verify).toBe(
        "the verify template needs @alchemy.run/domain, and this repository does not pin it yet (vendor/alchemy/sources.json is not there). Until it does, start from probe, service, screen"
      )
      expect(result.made).toBe(false)
    })
  )

  it.effect("new makes the verify template once its package is pinned, as the experiment's own library", () =>
    Effect.gen(function* () {
      yield* at("2026-11-22T12:00:00Z")
      const result = yield* inTree(
        repository({
          "vendor/alchemy/sources.json": json({
            commit: "abc1234",
            packages: [
              { package: "@alchemy.run/domain", version: "2.0.0-beta.88", file: "alchemy.run-domain-abc1234.tgz" }
            ]
          })
        }),
        Effect.gen(function* () {
          const lines = yield* said(
            scratchNew({ name: "shelf", template: "verify", question: "Can a shelf overfill?" }, install)
          )
          const text = yield* read("scratchpad/experiments/shelf/NOTE.md")
          const pkg = yield* read("scratchpad/package.json")
          const installed = yield* there("installed")
          const model = yield* there("scratchpad/experiments/shelf/Shelf.aggregate.ts")
          const checked = yield* scratchCheck(types).pipe(said)
          return { first: lines[0], text, pkg, installed, model, checked }
        })
      )
      expect(result.first).toBe(
        "out: scratch:new  shelf, from the verify template: 3 files in scratchpad/experiments/shelf"
      )
      expect(result.text).toContain("libraries: @alchemy.run/domain\n")
      expect(result.text).toContain("Can a shelf overfill?")
      expect(result.pkg).toBe(
        manifest(['"@alchemy.run/domain": "2.0.0-beta.88-abc1234"', '"@x/kernel": "workspace:*"', '"effect": "4.1.4"'])
      )
      expect(result.installed).toBe(true)
      expect(result.model).toBe(true)
      // The library is accounted for: the experiment's note names it.
      expect(result.checked).toEqual([
        "out: scratch:check OK  1 experiment, none with an install of its own; 4 dependencies accounted for",
        "out: scratch:check OK  1 experiment passes the type-checker and the Effect diagnostics"
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

  it.effect("an empty scratchpad lists nothing, passes its check, and is not type-checked", () =>
    Effect.gen(function* () {
      const result = yield* inTree(
        repository(),
        Effect.gen(function* () {
          const listed = yield* said(scratchList())
          const checked = yield* scratchCheck(types).pipe(said)
          const typed = yield* there("typed")
          return { listed, checked, typed }
        })
      )
      expect(result.listed).toEqual(["out: scratch:list  no experiment is open"])
      expect(result.checked).toEqual([
        "out: scratch:check OK  0 experiments, none with an install of its own; 3 dependencies accounted for"
      ])
      expect(result.typed).toBe(false)
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
          ['"@x/kernel": "workspace:*"', '"effect": "4.1.4"', '"left-pad": "^1.3.0"', '"zod": "^4.0.0"']
        ),
        Effect.map(
          scratchCheck(marked("typed", 2, "experiments/no-note/Idea.ts(1,1): error TS1: wrong")),
          render(scratchSentence)
        )
      )
      const install =
        "an experiment has no install of its own: a library goes in the scratchpad's package.json and is named in the experiment's NOTE.md (`libraries:`). Remove this"
      const noNote =
        "is missing or does not read as a note: it starts with status: open, started: a day, template: one of probe, service, screen, verify, and libraries: (empty, or names separated by commas), between two lines of ---"
      expect(report.failed).toBe(true)
      expect(printed(report)).toEqual([
        "err: scratch:check FAIL  7 problems",
        `err:   scratchpad/experiments/bad-note/NOTE.md: ${noNote}`,
        `err:   scratchpad/experiments/no-note/NOTE.md: ${noNote}`,
        `err:   scratchpad/experiments/own-install/node_modules: ${install}`,
        `err:   scratchpad/experiments/own-install/package.json: ${install}`,
        `err:   scratchpad/experiments/own-install/sub/bun.lock: ${install}`,
        "err:   scratchpad/package.json: `left-pad` is a dependency no experiment's NOTE.md names (`libraries:`) and no package of the repository uses: name the experiment that needs it, or remove it",
        "err:   scratchpad/experiments/own-install/NOTE.md: names the library `date-fns`, which is not in the scratchpad's package.json: add it there (`bun add --cwd scratchpad date-fns`), or take it out of the note",
        "err: scratch:check FAIL  the type-checker, with the Effect diagnostics, over the experiments:\nexperiments/no-note/Idea.ts(1,1): error TS1: wrong"
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
