/**
 * A model package's mutants, as `beep mutants` reads them: the package's own `mutants/mutants.json`, which names its
 * story files, its sample and every mutant, each one text replaced in one file of its `src`; vitest's JSON report of
 * one run; and what one run of a mutant found.
 *
 * Nothing about a package is written here: a package that has mutants keeps its file, and the runner reads it.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("commands/Mutants/Mutants.schema")

/**
 * Where a package keeps its mutants, from the package's folder.
 *
 * @category models
 */
export const mutantsFile = "mutants/mutants.json"

/**
 * What a mutant changes: a check of a `decide` removed, one field of an event given a wrong value, or an accepted act
 * made to record nothing.
 *
 * @category schemas
 */
export const MutantKind = LiteralKit(["check", "field", "nothing"]).pipe(
  $I.annoteSchema("MutantKind", { description: "A check removed, a field given a wrong value, or an act made empty" })
)
export type MutantKind = typeof MutantKind.Type

/**
 * What must go on holding a mutant, as its first run found: a rule the proof gives as violated, or a story.
 *
 * @category schemas
 */
export const Holder = LiteralKit(["rule", "story"]).pipe(
  $I.annoteSchema("Holder", { description: "A rule violated in the proof, or a story that fails" })
)
export type Holder = typeof Holder.Type

/**
 * One mutant: the text `old`, found exactly once after its anchors and before `until`, replaced by `new` in `file`.
 *
 * @category schemas
 */
export class Mutant extends S.Class<Mutant, { readonly brand: unique symbol }>($I`Mutant`)(
  {
    key: S.NonEmptyString.pipe(S.annotateKey({ description: "Its name, unique in the package" })),
    target: S.NonEmptyString.pipe(
      S.annotateKey({ description: "The command or decision it changes, as the summary groups them" })
    ),
    kind: MutantKind.pipe(S.annotateKey({ description: "What kind of change it is" })),
    file: S.NonEmptyString.pipe(S.annotateKey({ description: "The file it changes, from the package's folder" })),
    anchors: S.NonEmptyArray(S.NonEmptyString).pipe(
      S.annotateKey({ description: "Texts found in this order; the change lands after the last" })
    ),
    until: S.NonEmptyString.pipe(
      S.annotateKey({ description: "Where the region ends; the end of the file when it is left out" }),
      S.OptionFromOptionalKey
    ),
    old: S.NonEmptyString.pipe(S.annotateKey({ description: "The exact text replaced, line ends included" })),
    new: S.String.pipe(S.annotateKey({ description: "What it becomes; empty removes it" })),
    proof: S.NonEmptyString.pipe(S.annotateKey({ description: "The proof file of its target, from the package" })),
    expect: Holder.pipe(S.annotateKey({ description: "What held it in its first run, and must go on holding it" })),
    trialRules: S.Array(S.String).pipe(
      S.annotateKey({ description: "The rules seen violated in that run, each of which must stay named" })
    ),
    trialStories: S.Array(S.String).pipe(S.annotateKey({ description: "The stories seen failing in that run" }))
  },
  $I.annote("Mutant", { description: "One change to a model's source that its proof or its stories must notice" })
) {}

/**
 * A mutant of the sample, and why it is there.
 *
 * @category schemas
 */
export class SampleEntry extends S.Class<SampleEntry, { readonly brand: unique symbol }>($I`SampleEntry`)(
  {
    key: S.NonEmptyString.pipe(S.annotateKey({ description: "The mutant's key" })),
    why: S.NonEmptyString.pipe(S.annotateKey({ description: "What it stands for in the sample" }))
  },
  $I.annote("SampleEntry", { description: "One mutant `--sample` runs, with its reason" })
) {}

/**
 * A package's `mutants/mutants.json`: the story files every mutant runs beside its proof, the sample `--sample`
 * runs, and the mutants.
 *
 * @category schemas
 */
export class MutantsFile extends S.Class<MutantsFile, { readonly brand: unique symbol }>($I`MutantsFile`)(
  {
    stories: S.Array(S.NonEmptyString).pipe(
      S.annotateKey({ description: "The test files of examples run beside each mutant's proof, from the package" })
    ),
    sample: S.Array(SampleEntry).pipe(S.annotateKey({ description: "The fast mutants `--sample` runs" })),
    mutants: S.Array(Mutant).pipe(S.annotateKey({ description: "Every mutant of the package" }))
  },
  $I.annote("MutantsFile", { description: "A model package's mutants, its story files and its sample" })
) {}

const text = (description: string) =>
  S.String.pipe(
    S.annotateKey({ description }),
    S.withConstructorDefault(Effect.succeed("")),
    S.withDecodingDefaultTypeKey(Effect.succeed(""))
  )

/**
 * How one test of vitest's JSON report ended, as its reporter writes it (`JsonAssertionResult["status"]`).
 *
 * @category schemas
 */
export const TestStatus = LiteralKit(["passed", "failed", "skipped", "pending", "todo", "disabled"]).pipe(
  $I.annoteSchema("TestStatus", { description: "How one test of a vitest run ended" })
)
export type TestStatus = typeof TestStatus.Type

/**
 * How one test file of vitest's JSON report ended (`JsonTestResult["status"]`).
 *
 * @category schemas
 */
export const FileStatus = LiteralKit(["passed", "failed"]).pipe(
  $I.annoteSchema("FileStatus", { description: "How one test file of a vitest run ended" })
)
export type FileStatus = typeof FileStatus.Type

/**
 * One test of vitest's JSON report.
 *
 * @category schemas
 */
export class TestCase extends S.Class<TestCase, { readonly brand: unique symbol }>($I`TestCase`)(
  {
    title: text("The test's own title"),
    fullName: text("Its title under its describe blocks"),
    status: TestStatus.pipe(S.annotateKey({ description: "How it ended" })),
    failureMessages: S.String.pipe(
      S.NullOr,
      S.Array,
      S.annotateKey({
        description: "What it failed with, when it failed; null where the value it failed with had no message"
      }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    )
  },
  $I.annote("TestCase", { description: "One test of a vitest run" })
) {}

/**
 * One test file of vitest's JSON report.
 *
 * @category schemas
 */
export class TestFile extends S.Class<TestFile, { readonly brand: unique symbol }>($I`TestFile`)(
  {
    name: S.String.pipe(S.annotateKey({ description: "The file's absolute path" })),
    status: FileStatus.pipe(S.annotateKey({ description: "How it ended" })),
    message: text("Why the file failed when no test did: it did not load"),
    assertionResults: S.Array(TestCase).pipe(
      S.annotateKey({ description: "Its tests" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    )
  },
  $I.annote("TestFile", { description: "One test file of a vitest run" })
) {}

/**
 * Vitest's JSON report (`--reporter=json`), the parts the runner reads.
 *
 * @category schemas
 */
export class VitestReport extends S.Class<VitestReport, { readonly brand: unique symbol }>($I`VitestReport`)(
  {
    testResults: S.Array(TestFile).pipe(
      S.annotateKey({ description: "Every file the run took" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    )
  },
  $I.annote("VitestReport", { description: "What vitest's JSON reporter writes, the files and their tests" })
) {}

const key = S.NonEmptyString.pipe(S.annotateKey({ description: "The mutant's key, or the baseline's name" }))
const took = S.Duration.pipe(S.annotateKey({ description: "How long the run took" }))
const why = S.Array(S.String).pipe(
  S.annotateKey({ description: "What the proof said broke: the rules first, then what is no rule" })
)
const stories = S.Array(S.String).pipe(S.annotateKey({ description: "The stories that failed, each with its file" }))
const failedStories = S.NonEmptyArray(S.String).pipe(
  S.annotateKey({ description: "The stories that failed, each with its file: one at least" })
)
const notes = S.Array(S.String).pipe(
  S.annotateKey({ description: "What else is known: tests out of time, a run stopped from outside" })
)

/**
 * What one run of a copy found, by the strongest thing that noticed the change. A test that ran out of time noticed
 * nothing: it is a note, and makes the class only when nothing else is known.
 *
 * @category schemas
 */
export const Trial = S.TaggedUnion({
  Rule: {
    key,
    took,
    why,
    rules: S.Array(S.String).pipe(S.annotateKey({ description: "The names of the rules given as violated" })),
    stories,
    notes
  },
  Proof: { key, took, why, stories, notes },
  Story: { key, took, stories: failedStories, notes },
  Neither: { key, took, notes },
  TimedOut: { key, took, notes },
  NotApplied: { key, reason: S.String.pipe(S.annotateKey({ description: "Why its change cannot be made" })) },
  NoResult: { key, took, notes }
}).pipe($I.annoteSchema("Trial", { description: "What one run of a mutant, or of the unchanged copy, found" }))

/**
 * The decoded value of `Trial`.
 *
 * @category models
 */
export type Trial = typeof Trial.Type

/**
 * How a run compares with the mutant's first run: as it was, held by less, held by a rule where a story held it, or
 * not held at all.
 *
 * @category schemas
 */
export const Verdict = LiteralKit(["same", "weaker", "improvement", "neither", "timeout", "notapplied", "error"]).pipe(
  $I.annoteSchema("Verdict", { description: "A mutant's run compared with what its first run found" })
)
export type Verdict = typeof Verdict.Type

/**
 * The verdicts that fail a run: every one but held as the first run found, or by more. A verdict added to `Verdict`
 * fails a run until it is named here.
 *
 * @category schemas
 */
export const FailingVerdict = Verdict.omit(["same", "improvement"]).pipe(
  $I.annoteSchema("FailingVerdict", { description: "A mutant's run that fails the whole run" })
)
export type FailingVerdict = typeof FailingVerdict.Type

/**
 * The class a trial prints as, one for each case of `Trial`.
 *
 * @category schemas
 */
export const TrialClass = LiteralKit(["rule", "proof", "story", "neither", "timeout", "notapplied", "error"]).pipe(
  $I.annoteSchema("TrialClass", { description: "What one run of a mutant found, as a run prints it" })
)
export type TrialClass = typeof TrialClass.Type
