// `beep mutants` on a small model package written to a temporary repository, with vitest stood in for: the stand-in
// reads the copy it is given, as the proofs would, and says a rule broke when the check is gone, a story failed when
// the label changed, and nothing at all for a change nobody looks at. So every step but vitest itself is the real one:
// the package is copied, the change made in the copy, the report read, the class and the verdict given, the copy
// removed. The one thing not to break: a mutant nobody notices fails the run, by name.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../src/Cli.errors.ts"
import {
  applyMutant,
  copiesFolder,
  mutants,
  type MutantsFlags,
  mutantsSentence
} from "../src/commands/Mutants/Mutants.rules.ts"
import { Mutant, TestCase, TestFile, VitestReport } from "../src/commands/Mutants/Mutants.schema.ts"
import { Vitest, type VitestAnswer } from "../src/commands/Mutants/Vitest.service.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const aggregate = `export const Shop = {
  decide: {
    Sell: Effect.fn("Shop.Sell")(function* (s, cmd) {
      if (cmd.count < 0) return yield* Negative.make({})
      return [Sold.make({ count: cmd.count, label: "sold" })]
    }),
    Count: Effect.fn("Shop.Count")(function* (s, cmd) {
      if (cmd.count < 0) return yield* Negative.make({})
      return [Counted.make({ count: cmd.count })]
    })
  }
}
`

const mutant = (fields: {
  readonly key: string
  readonly old: string
  readonly new: string
  readonly expect: "rule" | "story"
  readonly trialRules?: ReadonlyArray<string>
}) => ({
  key: fields.key,
  target: "Shop",
  kind: "check",
  file: "src/Shop.aggregate.ts",
  anchors: ['Effect.fn("Shop.Sell")'],
  until: 'Effect.fn("Shop.Count")',
  old: fields.old,
  new: fields.new,
  proof: "test/Shop.prove.test.ts",
  expect: fields.expect,
  trialRules: fields.trialRules ?? [],
  trialStories: []
})

const theCheck = "      if (cmd.count < 0) return yield* Negative.make({})\n"
const sellNegative = mutant({
  key: "sell-negative",
  old: theCheck,
  new: "",
  expect: "rule",
  trialRules: ["NeverNegative"]
})
const sellLabel = mutant({ key: "sell-label", old: 'label: "sold"', new: 'label: "sale"', expect: "story" })
const listed = [
  sellNegative,
  sellLabel,
  // A change no test reads: the stand-in's vitest passes it, as a gap in the tests would.
  mutant({ key: "sell-unread", old: "count: cmd.count, label", new: "count: cmd.count + 0, label", expect: "story" }),
  // Written against code that has changed since: its old text is no longer in the file.
  mutant({ key: "sell-stale", old: "      if (cmd.count <= 0) return\n", new: "", expect: "rule" })
]

const tree = {
  "packages/shop/model/package.json": json({ name: "@x/shop-model", beep: { layer: "model" } }),
  "packages/shop/model/vitest.config.ts": 'import { limits } from "../../../vitest.shared.ts"\n',
  "packages/shop/model/tsconfig.json": json({ extends: "../../../tsconfig.base.json" }),
  "packages/shop/model/src/Shop.aggregate.ts": aggregate,
  "packages/shop/model/test/Shop.prove.test.ts": "// the proof\n",
  "packages/shop/model/test/Shop.story.test.ts": "// the stories\n",
  "packages/shop/model/mutants/mutants.json": json({
    stories: ["test/Shop.story.test.ts"],
    sample: [
      { key: "sell-negative", why: "check, rule" },
      { key: "sell-label", why: "field, story" }
    ],
    mutants: listed
  }),
  "vitest.shared.ts": "export const limits = {}\n",
  "tsconfig.base.json": "{}\n",
  "node_modules/vitest/vitest.mjs": "\n"
}

const flags = (given: Partial<MutantsFlags>): MutantsFlags => ({
  folder: "packages/shop/model",
  all: false,
  sample: false,
  list: false,
  only: O.none(),
  except: "",
  jobs: 2,
  keep: false,
  baseline: true,
  nice: 0,
  timeout: 60,
  proofLimit: O.none(),
  ...given
})

const passed = (title: string) => TestCase.make({ title, fullName: title, status: "passed", failureMessages: [] })
const failed = (title: string, message: string) =>
  TestCase.make({ title, fullName: title, status: "failed", failureMessages: [message] })

/** What the stand-in saw of each run: the copy's folder from the root, the files it was given, its proof's text. */
interface Seen {
  readonly copies: ReadonlyArray<string>
  readonly files: ReadonlyArray<ReadonlyArray<string>>
  readonly proofs: ReadonlyArray<string>
}

const proofFile = "test/Shop.prove.test.ts"
const storyFile = "test/Shop.story.test.ts"

/** One run as the stand-in sees it: the copy, the files it was given, and what the copy's source says. */
interface InCopy {
  readonly copy: string
  readonly files: ReadonlyArray<string>
  readonly reachesRoot: boolean
  readonly checkGone: boolean
  readonly labelChanged: boolean
}

/** The tests of the proof file and of the story file, as one run ends them. */
interface Tests {
  readonly proof: ReadonlyArray<TestCase>
  readonly story: ReadonlyArray<TestCase>
}

const ruleBroke = "AssertionError: the proof failed\n✗ NeverNegative\n    ✗ Sell: violated"

/** The tests as the proofs would end them: the rule broken when the check is gone, the story when the label changed. */
const asTheTestsDo = (run: InCopy): Tests => ({
  proof: [run.checkGone || !run.reachesRoot ? failed("Shop is proved", ruleBroke) : passed("Shop is proved")],
  story: [
    run.labelChanged
      ? failed("a sale is labelled sold", "AssertionError: expected 'sale' to be 'sold'")
      : passed("a sale is labelled sold")
  ]
})

/** The report of a run, with a file for each test file it was given, and only those. */
const reported = (run: InCopy, tests: Tests): VitestAnswer => ({
  report: O.some(
    VitestReport.make({
      testResults: A.filterMap(run.files, (file) => {
        const cases = file === proofFile ? tests.proof : file === storyFile ? tests.story : []
        const status = A.some(cases, (test) => test.status === "failed") ? "failed" : "passed"
        return A.isReadonlyArrayNonEmpty(cases)
          ? Result.succeed(TestFile.make({ name: `${run.copy}/${file}`, status, message: "", assertionResults: cases }))
          : Result.failVoid
      })
    })
  ),
  stopped: false,
  tail: ""
})

/** What the stand-in answers to one run. */
type Answer = (run: InCopy) => Effect.Effect<VitestAnswer, RepoError>

const asVitestDoes: Answer = (run) => Effect.succeed(reported(run, asTheTestsDo(run)))

/** Vitest as the proofs would answer, unless the test says otherwise. It reads the copy it is given. */
const standIn = (
  repo: Repo["Service"],
  seen: MutableRef.MutableRef<Seen>,
  answer: Answer = asVitestDoes
): Vitest["Service"] => ({
  missing: Effect.succeedNone,
  run: Effect.fn("standIn.run")(function* (request) {
    const proofText = yield* repo.text(repo.join(request.copy, proofFile))
    MutableRef.update(seen, (s) => ({
      copies: [...s.copies, repo.relative(request.copy, repo.root)],
      files: [...s.files, request.files],
      proofs: [...s.proofs, proofText]
    }))
    // The copy is as deep as the package: what the package reaches as ../../../ is the root from the copy too.
    const reachesRoot = yield* repo.exists(repo.join(request.copy, "../../../vitest.shared.ts"))
    const source = yield* repo.text(repo.join(request.copy, "src/Shop.aggregate.ts"))
    return yield* answer({
      copy: request.copy,
      files: request.files,
      reachesRoot,
      checkGone: !Str.includes("if (cmd.count < 0) return yield* Negative.make({})\n      return [Sold")(source),
      labelChanged: Str.includes('label: "sale"')(source)
    })
  })
})

/** A line with its times written as #, since a copy takes what it takes. */
const timeless = (line: string) => Str.replace(/[0-9]+\.[0-9]/g, "#")(line)

/**
 * Runs `mutants` on the tree with the stand-in, and gives what it said as it went, its report and what it saw. The
 * stand-in answers as the proofs would, or as `answer` says.
 */
const run = (given: Partial<MutantsFlags>, files: Record<string, string> = tree, answer: Answer = asVitestDoes) =>
  inTree(
    files,
    Effect.gen(function* () {
      const repo = yield* Repo
      const seen = MutableRef.make<Seen>({ copies: [], files: [], proofs: [] })
      const said = MutableRef.make<ReadonlyArray<string>>([])
      const say = (finding: Parameters<typeof mutantsSentence>[0]) =>
        Effect.sync(() => {
          const line = mutantsSentence(finding)
          MutableRef.update(said, (lines) => [...lines, `${line.to}: ${line.text}`])
        })
      const findings = yield* mutants(flags(given), say).pipe(
        Effect.provideService(Vitest, standIn(repo, seen, answer))
      )
      const home = yield* copiesFolder(repo.join(repo.root, "packages/shop/model"))
      const left = yield* repo.entries(home)
      const source = yield* repo.text(repo.join(repo.root, "packages/shop/model/src/Shop.aggregate.ts"))
      return {
        said: A.map(MutableRef.get(said), timeless),
        report: render(mutantsSentence)(findings),
        lines: A.map(printed(render(mutantsSentence)(findings)), timeless),
        copies: MutableRef.get(seen).copies,
        files: MutableRef.get(seen).files,
        proofs: MutableRef.get(seen).proofs,
        left: A.map(left, (entry) => entry.name),
        unchanged: source === aggregate
      }
    })
  )

const first = Mutant.make({
  key: "k",
  target: "Shop",
  kind: "check",
  file: "src/Shop.aggregate.ts",
  anchors: ['Effect.fn("Shop.Sell")'],
  until: O.some('Effect.fn("Shop.Count")'),
  old: theCheck,
  new: "",
  proof: "test/Shop.prove.test.ts",
  expect: "rule",
  trialRules: [],
  trialStories: []
})

describe("beep mutants: applying a mutant", () => {
  it("removes the one old text after its anchors and before its end, though the file holds it twice", () => {
    const changed = applyMutant(aggregate, first)
    expect(Result.isSuccess(changed)).toBe(true)
    expect(Result.getOrElse(changed, () => "")).toBe(Str.replace(theCheck, "")(aggregate))
    expect(Str.includes(theCheck)(Result.getOrElse(changed, () => ""))).toBe(true)
  })

  it("refuses an old text found twice in its region, an anchor or an end not found, and a change that changes nothing", () => {
    const say = (m: Mutant) =>
      Result.match(applyMutant(aggregate, m), { onSuccess: () => "applied", onFailure: (why) => why })
    expect(say(Mutant.make({ ...first, until: O.none() }))).toBe(
      'old text found 2 times after the anchors, where it must be once: "      if (cmd.count < 0) return yield* Negative.make({})\\n"'
    )
    expect(say(Mutant.make({ ...first, anchors: ['Effect.fn("Shop.Buy")'] }))).toBe(
      'anchor not found: "Effect.fn(\\"Shop.Buy\\")"'
    )
    expect(say(Mutant.make({ ...first, until: O.some("never") }))).toBe('end not found: "never"')
    expect(say(Mutant.make({ ...first, new: theCheck }))).toBe("the change changes nothing")
  })
})

describe("beep mutants <package>", () => {
  it.effect("--list gives every mutant in the file's order, without the ones left out, and runs nothing", () =>
    Effect.gen(function* () {
      const result = yield* run({ list: true, except: "sell-unread" })
      expect(result.said).toEqual(["out: left out, to be run apart: sell-unread"])
      expect(printed(result.report)).toEqual([
        "out: sell-negative                        Shop         check    rule   src/Shop.aggregate.ts",
        "out: sell-label                           Shop         check    story  src/Shop.aggregate.ts",
        "out: sell-stale                           Shop         check    rule   src/Shop.aggregate.ts"
      ])
      expect(result.copies).toEqual([])
    })
  )

  it.effect(
    "--sample runs the package's own sample, each held as its first run found, in copies made as deep as the package and removed after",
    () =>
      Effect.gen(function* () {
        const result = yield* run({ sample: true, jobs: 1 })
        expect(result.report.failed).toBe(false)
        expect(A.filter(result.said, Str.startsWith("out: sell-"))).toEqual([
          "out: sell-negative                        rule         #s  same        NeverNegative (Sell violated)",
          "out: sell-label                           story        #s  same        Shop: a sale is labelled sold"
        ])
        expect(result.lines.slice(0, 3)).toEqual([
          "out: class:   rule 1, story 1",
          "out: trial:   rule 1, story 1",
          "out:   Shop           2 mutants  rule   1  proof   0  story   1  neither 0  timeout 0  test time      # s  longest     # s"
        ])
        // The baseline and the two mutants, each in a folder of its own under .scratch, three folders deep as the package is.
        expect(result.copies.length).toBe(3)
        expect(A.every(result.copies, (copy) => Str.startsWith(".scratch/mutants-packages-shop-model/")(copy))).toBe(
          true
        )
        expect(A.map(result.copies, (copy) => Str.split("/")(copy).length)).toEqual([3, 3, 3])
        expect(result.left).toEqual(["results.tsv"])
        expect(result.unchanged).toBe(true)
      })
  )

  it.effect("a mutant nobody notices fails the run, named, with its change", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-negative,sell-unread") })
      expect(result.report.failed).toBe(true)
      expect(A.filter(result.said, Str.includes("sell-unread"))).toEqual([
        "out: sell-unread                          neither      #s  neither     "
      ])
      expect(A.filter(printed(result.report), Str.startsWith("err:"))).toEqual([
        'err: FAIL sell-unread: held by neither. Change in src/Shop.aggregate.ts: "count: cmd.count, label" -> "count: cmd.count + 0, label". Ran test/Shop.prove.test.ts and the stories: '
      ])
      expect(result.left).toEqual(["results.tsv"])
    })
  )

  it.effect("a mutant whose old text is not in the file is not run, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-stale") })
      expect(A.filter(result.said, Str.startsWith("out: NOT RUN"))).toEqual([
        'out: NOT RUN sell-stale: old text found 0 times after the anchors, where it must be once: "      if (cmd.count <= 0) return\\n"'
      ])
      expect(A.filter(printed(result.report), Str.startsWith("err:"))).toEqual([
        'err: FAIL sell-stale: does not apply. Change in src/Shop.aggregate.ts: "      if (cmd.count <= 0) return\\n" -> "". Ran test/Shop.prove.test.ts and the stories: old text found 0 times after the anchors, where it must be once: " if (cmd.count <= 0) return\\n"'
      ])
      expect(result.copies).toEqual([])
    })
  )

  it.effect("a rule the first run saw that the proof no longer names is weaker, and fails the run", () =>
    Effect.gen(function* () {
      const weaker = {
        ...tree,
        "packages/shop/model/mutants/mutants.json": json({
          stories: ["test/Shop.story.test.ts"],
          sample: [],
          mutants: [
            mutant({
              key: "sell-negative",
              old: theCheck,
              new: "",
              expect: "rule",
              trialRules: ["Violated NeverNegative", "NeverZero"]
            })
          ]
        })
      }
      const result = yield* run({ all: true }, weaker)
      expect(A.filter(printed(result.report), Str.startsWith("err:"))).toEqual([
        'err: FAIL sell-negative: a rule got weaker: no longer named, NeverZero. Change in src/Shop.aggregate.ts: "      if (cmd.count < 0) return yield* Negative.make({})\\n" -> "". Ran test/Shop.prove.test.ts and the stories: NeverNegative (Sell violated)'
      ])
    })
  )

  it.effect("an unchanged copy that does not pass stops the run before any mutant, and nothing is left behind", () =>
    Effect.gen(function* () {
      // The package's own tests fail: the stand-in reads the check as gone in the unchanged copy too.
      const broken = {
        ...tree,
        "packages/shop/model/src/Shop.aggregate.ts": Str.replace(
          theCheck,
          "      if (cmd.count < 1) return\n"
        )(aggregate)
      }
      const result = yield* run({ sample: true }, broken)
      expect(result.lines).toEqual([
        "err: BASELINE FAILS for test/Shop.prove.test.ts (# s): rule NeverNegative (Sell violated)\nevery mutant would look held; nothing more is run"
      ])
      expect(result.copies.length).toBe(1)
      expect(result.left).toEqual([])
    })
  )

  it.effect("a run that fails part way leaves no copy behind", () =>
    inTree(
      tree,
      Effect.gen(function* () {
        const repo = yield* Repo
        const breaking: Vitest["Service"] = {
          missing: Effect.succeedNone,
          run: () => Effect.fail(RepoError.make({ path: "node", message: "node could not be run" }))
        }
        const ended = yield* mutants(flags({ sample: true }), () => Effect.void).pipe(
          Effect.provideService(Vitest, breaking),
          Effect.result
        )
        expect(Result.isFailure(ended)).toBe(true)
        const home = yield* copiesFolder(repo.join(repo.root, "packages/shop/model"))
        const left = yield* repo.entries(home)
        expect(left).toEqual([])
      })
    )
  )

  it.effect("refuses no choice, two choices, an unknown key, and a proof limit past the run's", () =>
    Effect.gen(function* () {
      const none = yield* run({})
      const two = yield* run({ all: true, sample: true })
      const unknown = yield* run({ only: O.some("sell-negative,sell-gone") })
      const limit = yield* run({ all: true, proofLimit: O.some(60) })
      expect([
        ...printed(none.report),
        ...printed(two.report),
        ...printed(unknown.report),
        ...printed(limit.report)
      ]).toEqual([
        "err: choose one of --all, --sample, --only <keys> or --list",
        "err: choose one of --all, --sample, --only <keys> or --list",
        "err: unknown keys: sell-gone",
        "err: --proof-limit must be below --timeout: a run stopped from outside leaves no result"
      ])
    })
  )
})

/** A tree whose mutants file holds `mutants`, beside the same stories. */
const holding = (mutants: ReadonlyArray<ReturnType<typeof mutant>>, files: Record<string, string> = tree) => ({
  ...files,
  "packages/shop/model/mutants/mutants.json": json({ stories: [storyFile], sample: [], mutants })
})

/** The lines a run printed to standard error. */
const errors = (result: { readonly report: Parameters<typeof printed>[0] }) =>
  A.filter(printed(result.report), Str.startsWith("err:"))

/** The line a run said for one mutant, its times written as #. */
const ranLine = (result: { readonly said: ReadonlyArray<string> }, key: string) =>
  A.filter(result.said, Str.startsWith(`out: ${key} `))

const proofFails =
  (message: string): Answer =>
  (run) =>
    Effect.succeed(
      reported(run, {
        ...asTheTestsDo(run),
        proof: [run.checkGone ? failed("Shop is proved", message) : passed("Shop is proved")]
      })
    )

describe("beep mutants: what keeps a run from passing quietly", () => {
  it.effect("each run is given its proof and every story file, and a story file that did not run gives no result", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-negative"), baseline: false })
      expect(result.files).toEqual([[proofFile, storyFile]])
      const dropped = yield* run({ only: O.some("sell-negative"), baseline: false }, tree, (one) =>
        asVitestDoes({ ...one, files: [proofFile] })
      )
      expect(dropped.report.failed).toBe(true)
      expect(ranLine(dropped, "sell-negative")).toEqual([
        "out: sell-negative                        error        #s  error       files that did not run: Shop.story"
      ])
      expect(errors(dropped)).toEqual([
        'err: FAIL sell-negative: no result. Change in src/Shop.aggregate.ts: "      if (cmd.count < 0) return yield* Negative.make({})\\n" -> "". Ran test/Shop.prove.test.ts and the stories: files that did not run: Shop.story'
      ])
    })
  )

  it.effect("a test file that did not load gives no result, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-label"), baseline: false }, tree, (one) =>
        Effect.succeed({
          ...reported(one, asTheTestsDo(one)),
          report: O.map(reported(one, asTheTestsDo(one)).report, (report) =>
            VitestReport.make({
              testResults: A.map(report.testResults, (file) =>
                Str.endsWith(storyFile)(file.name)
                  ? TestFile.make({
                      name: file.name,
                      status: "failed",
                      message: "SyntaxError: x",
                      assertionResults: []
                    })
                  : file
              )
            })
          )
        })
      )
      expect(result.report.failed).toBe(true)
      expect(ranLine(result, "sell-label")).toEqual([
        "out: sell-label                           error        #s  error       Shop: did not load: SyntaxError: x"
      ])
    })
  )

  it.effect("a run stopped at its limit gives no result, says so with what vitest printed, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-negative"), baseline: false }, tree, () =>
        Effect.succeed({ report: O.none(), stopped: true, tail: "proving NeverNegative" })
      )
      expect(result.report.failed).toBe(true)
      expect(ranLine(result, "sell-negative")).toEqual([
        "out: sell-negative                        error        #s  error       stopped after 60 s; no result: proving NeverNegative"
      ])
    })
  )

  it.effect("a test out of time notices nothing: alone it is a timeout, not a failing proof, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run(
        { only: O.some("sell-negative"), baseline: false },
        tree,
        proofFails("Error: Test timed out in 5000ms.")
      )
      expect(result.report.failed).toBe(true)
      expect(ranLine(result, "sell-negative")).toEqual([
        "out: sell-negative                        timeout      #s  timeout     ran out of time, and counted as nothing: Shop.prove: Shop is proved"
      ])
      expect(A.map(errors(result), (line) => Str.split(".")(line)[0])).toEqual([
        "err: FAIL sell-negative: only ran out of time: nothing held it"
      ])
    })
  )

  it.effect("only a rule given as violated holds a mutant by a rule: one not proved is weaker, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run(
        { only: O.some("sell-negative"), baseline: false },
        tree,
        proofFails("AssertionError: the proof failed\n✗ NeverNegative\n    ✗ Sell: not proved")
      )
      expect(ranLine(result, "sell-negative")).toEqual([
        "out: sell-negative                        proof        #s  weaker      NeverNegative (Sell not proved)"
      ])
      expect(A.map(errors(result), (line) => Str.split(". Change")(line)[0])).toEqual([
        "err: FAIL sell-negative: a rule got weaker: no rule is named now, where the trial saw NeverNegative"
      ])
    })
  )

  it.effect("a mutant kept as held by a rule is weaker when only a story notices it, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-negative"), baseline: false }, tree, (one) =>
        Effect.succeed(
          reported(one, {
            proof: [passed("Shop is proved")],
            story: [
              one.checkGone
                ? failed("a negative sale is refused", "AssertionError: expected 'Sold' to be 'Negative'")
                : passed("a negative sale is refused")
            ]
          })
        )
      )
      expect(ranLine(result, "sell-negative")).toEqual([
        "out: sell-negative                        story        #s  weaker      Shop: a negative sale is refused"
      ])
      expect(A.map(errors(result), (line) => Str.split(". Change")(line)[0])).toEqual([
        "err: FAIL sell-negative: a rule got weaker: no rule is named now, where the trial saw NeverNegative"
      ])
    })
  )

  it.effect("the report's own lines that name no rule are not read as one", () =>
    Effect.gen(function* () {
      const result = yield* run(
        { only: O.some("sell-negative"), baseline: false },
        tree,
        proofFails(
          "AssertionError: the proof failed\n✗ Import folds every event it records\n✗ NeverNegative\n    ✗ Sell: violated"
        )
      )
      expect(result.report.failed).toBe(false)
      expect(ranLine(result, "sell-negative")).toEqual([
        "out: sell-negative                        rule         #s  same        NeverNegative (Sell violated)"
      ])
    })
  )

  it.effect(
    "a mutant kept as held by a story is weaker when only the proof's numbers move, and same with a story",
    () =>
      Effect.gen(function* () {
        const onlyProof: Answer = (one) =>
          Effect.succeed(
            reported(one, {
              proof: [
                one.labelChanged
                  ? failed("Shop is proved", "AssertionError: expected 2 to be 3")
                  : passed("Shop is proved")
              ],
              story: [passed("a sale is labelled sold")]
            })
          )
        const weaker = yield* run({ only: O.some("sell-label"), baseline: false }, tree, onlyProof)
        expect(ranLine(weaker, "sell-label")).toEqual([
          "out: sell-label                           proof        #s  weaker      expected 3, got 2"
        ])
        expect(A.map(errors(weaker), (line) => Str.split(". Change")(line)[0])).toEqual([
          "err: FAIL sell-label: the trial saw a story fail, and none does now"
        ])
        const both = yield* run({ only: O.some("sell-label"), baseline: false }, tree, (one) =>
          Effect.succeed(
            reported(one, {
              ...asTheTestsDo(one),
              proof: [
                one.labelChanged
                  ? failed("Shop is proved", "AssertionError: expected 2 to be 3")
                  : passed("Shop is proved")
              ]
            })
          )
        )
        expect(both.report.failed).toBe(false)
        expect(ranLine(both, "sell-label")).toEqual([
          "out: sell-label                           proof        #s  same        expected 3, got 2"
        ])
      })
  )

  it.effect("a rule where the trial saw a story only is an improvement, named, and passes", () =>
    Effect.gen(function* () {
      const result = yield* run({ only: O.some("sell-label"), baseline: false }, tree, (one) =>
        Effect.succeed(
          reported(one, {
            ...asTheTestsDo(one),
            proof: [one.labelChanged ? failed("Shop is proved", ruleBroke) : passed("Shop is proved")]
          })
        )
      )
      expect(result.report.failed).toBe(false)
      expect(A.filter(printed(result.report), Str.includes("improvement"))).toEqual([
        "out: held by a rule where the trial had a story only (improvement): sell-label"
      ])
    })
  )

  it.effect("a mutant kept as held by a rule on a standing that is not violated is not run, and fails the run", () =>
    Effect.gen(function* () {
      const result = yield* run(
        { all: true },
        holding([{ ...sellNegative, trialRules: ["Unconfirmed NeverNegative"] }])
      )
      expect(A.filter(result.said, Str.startsWith("out: NOT RUN"))).toEqual([
        "out: NOT RUN sell-negative: kept as held by a rule on a standing that is not a rule violated: Unconfirmed NeverNegative"
      ])
      expect(result.report.failed).toBe(true)
      expect(result.copies).toEqual([])
    })
  )

  it.effect(
    "a mutant whose file changed under the run after its check is not applied in its copy, and fails the run",
    () =>
      Effect.gen(function* () {
        // The package's source is edited while the baseline runs: the mutant applied when it was checked, and does not
        // when its copy is made.
        const result = yield* inTree(
          tree,
          Effect.gen(function* () {
            const repo = yield* Repo
            const seen = MutableRef.make<Seen>({ copies: [], files: [], proofs: [] })
            const source = repo.join(repo.root, "packages/shop/model/src/Shop.aggregate.ts")
            const editing: Answer = (one) =>
              Effect.flatMap(
                Str.includes("/baseline-")(one.copy)
                  ? repo.write(source, Str.replace(theCheck, "")(aggregate))
                  : Effect.void,
                () => asVitestDoes(one)
              )
            const findings = yield* mutants(flags({ only: O.some("sell-negative") }), () => Effect.void).pipe(
              Effect.provideService(Vitest, standIn(repo, seen, editing))
            )
            return render(mutantsSentence)(findings)
          })
        )
        expect(result.failed).toBe(true)
        expect(
          A.map(A.filter(printed(result), Str.startsWith("err:")), (line) => Str.split(". Change")(line)[0])
        ).toEqual(["err: FAIL sell-negative: does not apply"])
      })
  )

  it.effect(
    "--proof-limit sets the proof's limit in each copy only, and refuses a proof whose limit is not found once",
    () =>
      Effect.gen(function* () {
        const limited = {
          ...tree,
          "packages/shop/model/test/Shop.prove.test.ts": 'it.effect("Shop is proved", () => proved,\n    600_000\n  )\n'
        }
        const result = yield* run({ only: O.some("sell-negative"), proofLimit: O.some(30) }, limited)
        expect(result.report.failed).toBe(false)
        expect(result.proofs).toEqual([
          'it.effect("Shop is proved", () => proved,\n    30000\n  )\n',
          'it.effect("Shop is proved", () => proved,\n    30000\n  )\n'
        ])
        const none = yield* run({ only: O.some("sell-negative"), proofLimit: O.some(30), baseline: false })
        expect(ranLine(none, "sell-negative")).toEqual([
          "out: sell-negative                        error        #s  error       the proof's time limit is found 0 times in test/Shop.prove.test.ts, where it must be once"
        ])
        expect(none.report.failed).toBe(true)
      })
  )

  it.effect("--keep keeps each copy, with the package unchanged", () =>
    Effect.gen(function* () {
      const result = yield* run({ sample: true, keep: true, jobs: 1 })
      expect(result.left.length).toBe(4)
      expect(A.filter(result.left, (name) => name !== "results.tsv").length).toBe(3)
      expect(result.unchanged).toBe(true)
    })
  )

  it.effect("refuses a key named twice, an unknown key to leave out, and a repository with no vitest", () =>
    Effect.gen(function* () {
      const twice = yield* run(
        { all: true },
        holding([sellNegative, sellLabel, { ...sellLabel, new: 'label: "sail"' }])
      )
      const unknown = yield* run({ all: true, except: "sell-gone" })
      const noVitest = yield* inTree(
        tree,
        Effect.gen(function* () {
          const repo = yield* Repo
          const seen = MutableRef.make<Seen>({ copies: [], files: [], proofs: [] })
          const findings = yield* mutants(flags({ all: true }), () => Effect.void).pipe(
            Effect.provideService(Vitest, {
              ...standIn(repo, seen),
              missing: Effect.succeedSome("node_modules/vitest/vitest.mjs")
            })
          )
          return render(mutantsSentence)(findings)
        })
      )
      expect([...printed(twice.report), ...printed(unknown.report), ...printed(noVitest)]).toEqual([
        "err: packages/shop/model/mutants/mutants.json: each key names one mutant, and these name more than one: sell-label",
        "err: unknown keys to leave out: sell-gone",
        "err: vitest not found at node_modules/vitest/vitest.mjs: run bun install first"
      ])
    })
  )

  it.effect("refuses a package less than three folders below the root, since its copies are made as deep", () =>
    inTree(
      tree,
      Effect.gen(function* () {
        const repo = yield* Repo
        const refused = yield* Effect.flip(copiesFolder(repo.join(repo.root, "packages/shop")))
        expect(Str.includes("sits three folders or more below the repository's root")(refused.message)).toBe(true)
      })
    )
  )
})

describe("beep mutants: vitest's report", () => {
  it.effect("reads a test that failed with a value that has no message, which vitest writes as null", () =>
    Effect.gen(function* () {
      const report = yield* S.decodeEffect(VitestReport)({
        testResults: [
          {
            name: "/copy/test/a.test.ts",
            status: "failed",
            message: "",
            assertionResults: [{ title: "it holds", fullName: "it holds", status: "failed", failureMessages: [null] }]
          }
        ]
      })
      expect(A.flatMap(report.testResults, (file) => A.map(file.assertionResults, (test) => test.status))).toEqual([
        "failed"
      ])
    })
  )
})
