/**
 * `mutants <package>`: runs a model package's mutants, each one change to its source made in a copy of the package,
 * against the mutant's proof and the package's story files, and says whether each is still noticed as its first run
 * found (the package's `mutants/README.md` says what each class means).
 *
 * Nothing about a package is written here. Each model package keeps its own `mutants/mutants.json`: its story files,
 * its sample with the reason for each, and its mutants, each naming its own proof.
 *
 * For each mutant chosen, the package's `src`, `test`, `package.json`, `tsconfig*.json` and `vitest.config.ts` are
 * copied under the repository's `.scratch` (git ignores it), in a folder exactly as deep as the package, so every
 * relative path that leaves the package (`../../../vitest.shared.ts`) reaches the same file from the copy, and the
 * packages resolve from the root's `node_modules` as they do for the package. The change is made there, vitest runs
 * the proof and the stories in that copy, and the copy is removed when its run ends, however it ends (`--keep` keeps
 * it). No file of the package is ever written.
 *
 * A run fails (exit 1) when a mutant is held by neither, when all that is known of one is a test out of time, when
 * one is held by less than its first run found (`weaker`), when one does not apply (its old text is not found exactly
 * once after its anchors and before its end), when a run gives no result, or when the unchanged copy does not pass
 * (`baseline`), since every mutant would then look held.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Clock from "effect/Clock"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as HashMap from "effect/HashMap"
import * as HashSet from "effect/HashSet"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as P from "effect/Predicate"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { type Entry, Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import {
  FailingVerdict,
  FileStatus,
  type Mutant,
  MutantsFile,
  mutantsFile,
  TestStatus,
  Trial,
  TrialClass,
  Verdict,
  type VitestReport
} from "./Mutants.schema.ts"
import { Vitest } from "./Vitest.service.ts"

const $I = $RepoCliId.create("commands/Mutants/Mutants.rules")

const keys = S.Array(S.String).pipe(S.annotateKey({ description: "Mutants' keys" }))
const key = S.String.pipe(S.annotateKey({ description: "A mutant's key" }))
const took = S.Duration.pipe(S.annotateKey({ description: "How long it took" }))
const count = S.Int.pipe(S.annotateKey({ description: "How many" }))

/**
 * One count of a summary line: a class or a trial's holder, and how many.
 *
 * @category schemas
 */
export class Count extends S.Class<Count, { readonly brand: unique symbol }>($I`Count`)(
  { name: TrialClass.pipe(S.annotateKey({ description: "The class, or what held it in its first run" })), count },
  $I.annote("Count", { description: "How many mutants are of one class" })
) {}

/**
 * What `mutants` says, each one line.
 *
 * @category schemas
 */
export const MutantsFinding = S.TaggedUnion({
  Listed: {
    key,
    target: S.String.pipe(S.annotateKey({ description: "Its target" })),
    kind: S.String.pipe(S.annotateKey({ description: "Its kind" })),
    expect: S.String.pipe(S.annotateKey({ description: "What held it in its first run" })),
    file: S.String.pipe(S.annotateKey({ description: "The file it changes" }))
  },
  LeftOut: { keys },
  NotRun: { key, reason: S.String.pipe(S.annotateKey({ description: "Why it is not run" })) },
  Starting: {
    mutants: count,
    jobs: count,
    load: S.String.pipe(S.annotateKey({ description: "The machine's load average" }))
  },
  BaselinePasses: { proof: S.String.pipe(S.annotateKey({ description: "The proof file" })), took },
  BaselineFails: {
    proof: S.String.pipe(S.annotateKey({ description: "The proof file" })),
    took,
    said: S.String.pipe(S.annotateKey({ description: "What the unchanged copy's run found" }))
  },
  Ran: {
    key,
    found: TrialClass.pipe(S.annotateKey({ description: "The run's class" })),
    took,
    verdict: Verdict.pipe(S.annotateKey({ description: "How it compares with the first run" })),
    said: S.String.pipe(S.annotateKey({ description: "What noticed the change, or the note" }))
  },
  Counted: {
    label: S.String.pipe(S.annotateKey({ description: "class or trial" })),
    counts: S.Array(Count).pipe(S.annotateKey({ description: "The counts, in their order" }))
  },
  TargetCounted: {
    target: S.String.pipe(S.annotateKey({ description: "The target" })),
    mutants: count,
    rule: count,
    proof: count,
    story: count,
    neither: count,
    timeout: count,
    testTime: S.Duration.pipe(S.annotateKey({ description: "The time its runs took, added up" })),
    longest: S.Duration.pipe(S.annotateKey({ description: "The time its longest run took" }))
  },
  Wall: {
    took,
    before: S.String.pipe(S.annotateKey({ description: "The load average before" })),
    after: S.String.pipe(S.annotateKey({ description: "The load average after" }))
  },
  Improved: { keys },
  Failed: {
    key,
    what: S.String.pipe(S.annotateKey({ description: "How it failed" })),
    file: S.String.pipe(S.annotateKey({ description: "The file it changes" })),
    old: S.String.pipe(S.annotateKey({ description: "Its old text" })),
    new: S.String.pipe(S.annotateKey({ description: "Its new text" })),
    proof: S.String.pipe(S.annotateKey({ description: "Its proof file" })),
    said: S.String.pipe(S.annotateKey({ description: "What the run found" }))
  },
  Unknown: {
    what: S.String.pipe(S.annotateKey({ description: "Which list named them" })),
    keys
  },
  Duplicated: { keys, file: S.String.pipe(S.annotateKey({ description: "The mutants file" })) },
  NothingLeft: {},
  NoVitest: { path: S.String.pipe(S.annotateKey({ description: "Where vitest was looked for" })) },
  Usage: { said: S.String.pipe(S.annotateKey({ description: "What is wrong with the flags" })) }
}).pipe($I.annoteSchema("MutantsFinding", { description: "One line of a run of a package's mutants" }))

/**
 * The decoded value of `MutantsFinding`.
 *
 * @category models
 */
export type MutantsFinding = typeof MutantsFinding.Type

const { cases } = MutantsFinding

/** A run that ends on one line. */
const alone = (finding: MutantsFinding): ReadonlyArray<MutantsFinding> => A.of(finding)

/** Text made one line, cut to `n` characters with an ellipsis. */
export const short: { (n: number): (text: string) => string; (text: string, n: number): string } = dual(
  2,
  (text: string, n: number): string => {
    const line = A.join(A.filter(Str.split(/\s+/)(text), Str.isNonEmpty), " ")
    return line.length <= n ? line : `${Str.slice(0, n - 1)(line)}…`
  }
)

/** A text as a quoted literal, its line ends and quotes shown. */
const quoted = (text: string): string =>
  `"${Str.replaceAll('"', '\\"')(Str.replaceAll("\n", "\\n")(Str.replaceAll("\\", "\\\\")(text)))}"`

/** A duration as seconds, with `digits` after the point. */
const inSeconds = (duration: Duration.Duration, digits: number): string => Duration.toSeconds(duration).toFixed(digits)

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const mutantsSentence: (finding: MutantsFinding) => Line = MutantsFinding.match({
  Listed: (m) =>
    out(
      `${Str.padEnd(36)(m.key)} ${Str.padEnd(12)(m.target)} ${Str.padEnd(8)(m.kind)} ${Str.padEnd(6)(m.expect)} ${m.file}`
    ),
  LeftOut: ({ keys: left }) => out(`left out, to be run apart: ${A.join(left, ", ")}`),
  NotRun: ({ key: name, reason }) => out(`NOT RUN ${name}: ${reason}`),
  Starting: ({ mutants: n, jobs, load }) => out(`${n} mutants, ${jobs} at a time; load ${load}`),
  BaselinePasses: ({ proof, took: t }) => out(`baseline ${proof} and the stories pass, ${inSeconds(t, 1)} s`),
  BaselineFails: ({ proof, took: t, said }) =>
    err(
      `BASELINE FAILS for ${proof} (${inSeconds(t, 1)} s): ${said}\nevery mutant would look held; nothing more is run`
    ),
  Ran: ({ key: name, found, took: t, verdict, said }) =>
    out(
      `${Str.padEnd(36)(name)} ${Str.padEnd(8)(found)} ${Str.padStart(7)(inSeconds(t, 1))}s  ${Str.padEnd(11)(verdict)} ${short(said, 120)}`
    ),
  Counted: ({ label, counts }) =>
    out(
      `${Str.padEnd(9)(`${label}:`)}${A.join(
        A.map(counts, (c) => `${c.name} ${c.count}`),
        ", "
      )}`
    ),
  TargetCounted: (t) =>
    out(
      `  ${Str.padEnd(12)(t.target)} ${Str.padStart(3)(`${t.mutants}`)} mutants  rule ${Str.padStart(3)(`${t.rule}`)}  proof ${Str.padStart(3)(`${t.proof}`)}  story ${Str.padStart(3)(`${t.story}`)}  neither ${t.neither}  timeout ${t.timeout}  test time ${Str.padStart(8)(inSeconds(t.testTime, 1))} s  longest ${Str.padStart(7)(inSeconds(t.longest, 1))} s`
    ),
  Wall: ({ took: t, before, after }) => out(`wall ${inSeconds(t, 0)} s; load before ${before}, after ${after}`),
  Improved: ({ keys: better }) =>
    out(`held by a rule where the trial had a story only (improvement): ${A.join(better, ", ")}`),
  Failed: (f) =>
    err(
      `FAIL ${f.key}: ${f.what}. Change in ${f.file}: ${quoted(f.old)} -> ${quoted(f.new)}. Ran ${f.proof} and the stories: ${short(f.said, 200)}`
    ),
  Unknown: ({ what, keys: unknown }) => err(`unknown ${what}: ${A.join(unknown, ", ")}`),
  Duplicated: ({ keys: twice, file }) =>
    err(`${file}: each key names one mutant, and these name more than one: ${A.join(twice, ", ")}`),
  NothingLeft: () => err("nothing is left to run"),
  NoVitest: ({ path }) => err(`vitest not found at ${path}: run bun install first`),
  Usage: ({ said }) => err(said)
})

// ---------------------------------------------------------------------------------------------------------------
// Making a mutant's change.

/** Where `sought` is first found in `text` at `from` or after it. */
const findFrom = (text: string, sought: string, from: number): O.Option<number> =>
  O.map(Str.indexOf(sought)(Str.slice(from)(text)), (at) => at + from)

/**
 * The text of a file with a mutant's change made, or why it cannot be made: an anchor or the end not found, the old
 * text found other than once between them, or a change that changes nothing.
 *
 * @category rules
 */
export const applyMutant: {
  (mutant: Mutant): (text: string) => Result.Result<string, string>
  (text: string, mutant: Mutant): Result.Result<string, string>
} = dual(2, (text: string, mutant: Mutant): Result.Result<string, string> => {
  const origin: Result.Result<number, string> = Result.succeed(0)
  const anchored = A.reduce(mutant.anchors, origin, (at, anchor) =>
    Result.flatMap(at, (from) =>
      O.match(findFrom(text, anchor, from), {
        onNone: () => Result.fail(`anchor not found: ${quoted(anchor)}`),
        onSome: (found) => Result.succeed(found)
      })
    )
  )
  const last = A.lastNonEmpty(mutant.anchors)
  return Result.flatMap(anchored, (start) => {
    const whole: Result.Result<number, string> = Result.succeed(text.length)
    const ended = O.match(mutant.until, {
      onNone: () => whole,
      onSome: (until) =>
        O.match(findFrom(text, until, start + last.length), {
          onNone: () => Result.fail(`end not found: ${quoted(until)}`),
          onSome: (end) => Result.succeed(end)
        })
    })
    return Result.flatMap(ended, (end) => {
      const region = Str.slice(start, end)(text)
      const times = Str.split(mutant.old)(region).length - 1
      if (times !== 1) {
        return Result.fail(
          `old text found ${times} times after the anchors, where it must be once: ${quoted(mutant.old)}`
        )
      }
      return O.match(Str.indexOf(mutant.old)(region), {
        onNone: () => Result.fail(`old text not found: ${quoted(mutant.old)}`),
        onSome: (at) => {
          const i = start + at
          const changed = `${Str.slice(0, i)(text)}${mutant.new}${Str.slice(i + mutant.old.length)(text)}`
          return changed === text ? Result.fail("the change changes nothing") : Result.succeed(changed)
        }
      })
    })
  })
})

// ---------------------------------------------------------------------------------------------------------------
// Reading a run.

const ruleLine = /'(violated|not proved|proved for short lists only|read wrongly|not read|not decided) {2}([^']+)'/g
const expected = /expected (.{1,60}?) to (?:be|deeply equal) (.{1,60}?)(?:\s*\/\/|$)/m
// A rule's name as a report prints it: `OutcomesAddUpToTheRows`, or `Row.TheSizeOfByIsTrue` in a decision's report.
const ruleNamePattern = /^((?:[A-Z][A-Za-z0-9]*\.)?[A-Z][A-Za-z0-9]*)(?=$|:| \()/
const standing =
  /^(?:Violated|Unconfirmed|violated|not proved|proved for short lists only|read wrongly|not read|not decided)\s+/
const broken = /\bviolated\b/
const topLine = /^✗ (.+?)(?:: expected .*)?$/
const subLine = /^\s+✗ (\S+?):? (violated|not proved|unconfirmed|read wrongly|not read|not decided)\b/
const timedOut = "timed out"
/** How a proof test ends: its time limit in milliseconds, alone on a line, then the call closed. */
const proofLimit = /\n {4}[0-9_]+\n {2}\)\n/g

/**
 * The rule a line names, without how it stands and without its commands; none when the line names no rule.
 *
 * @category rules
 */
export const ruleName = (text: string): O.Option<string> =>
  O.flatMap(Str.match(ruleNamePattern)(Str.replace(standing, "")(Str.trim(text))), (m) => A.get(m, 1))

const lines = (text: string) => Str.split(/\r?\n/)(text)

/** A test file's name without its folder and `.test.ts`. */
export const fileOf = (path: string): string => Str.replace(".test.ts", "")(A.lastNonEmpty(Str.split("/")(path)))

/** What the proof said broke, in two lists: the rules violated, and what failed that is no rule. */
const whyProof = (messages: ReadonlyArray<string>) => {
  const text = A.join(messages, "\n")
  // The report printed beside a failure (`whatBroke` in a model's test/proving.ts): a line "✗ <rule>" for each rule
  // not proved, and under it "    ✗ <command>: <how it stands>" for the import's rules. A "✗" line that names no rule
  // ("✗ DecideGroup is never accepted") is the report's own, and no rule.
  interface Walk {
    readonly found: ReadonlyArray<string>
    readonly current: O.Option<string>
    readonly under: ReadonlyArray<string>
  }
  const close = (walk: Walk): ReadonlyArray<string> =>
    O.match(walk.current, {
      onNone: () => walk.found,
      onSome: (rule) => A.append(walk.found, walk.under.length > 0 ? `${rule} (${A.join(walk.under, ", ")})` : rule)
    })
  const walked = A.reduce(
    lines(text),
    { found: A.empty<string>(), current: O.none<string>(), under: A.empty<string>() } satisfies Walk,
    (walk, line): Walk => {
      const top = Str.match(topLine)(line)
      if (O.isSome(top)) {
        return { found: close(walk), current: A.get(top.value, 1), under: [] }
      }
      const sub = Str.match(subLine)(line)
      if (O.isSome(sub) && O.isSome(walk.current)) {
        return { ...walk, under: A.append(walk.under, `${sub.value[1]} ${sub.value[2]}`) }
      }
      if (O.isSome(walk.current) && !Str.startsWith(" ")(line)) {
        return { found: close(walk), current: O.none(), under: [] }
      }
      return walk
    }
  )
  const found = A.filter(A.dedupe(close(walked)), (r) => !Str.startsWith("Import folds")(r))
  // Only "violated" is a rule noticing the change: the solver found a state and a command, and the real code broke
  // the rule on them. Every other standing is the prover not finishing, not reading the changed code, or not
  // confirming what it found, and none of those shows that a rule forbids the change.
  const isRule = (r: string) => O.isSome(ruleName(r)) && broken.test(r)
  const rules = A.filter(found, isRule)
  const other = A.filter(found, (r) => !isRule(r))
  if (found.length === 0) {
    const named = A.fromIterable(Str.matchAll(ruleLine)(text))
    const items = A.dedupe(A.map(named, (m) => ({ standing: `${m[1]}`, item: `${m[1]} ${Str.trim(`${m[2]}`)}` })))
    const violated = A.dedupe(
      A.map(
        A.filter(items, (i) => i.standing === "violated"),
        (i) => i.item
      )
    )
    const rest = A.dedupe(
      A.map(
        A.filter(items, (i) => i.standing !== "violated"),
        (i) => i.item
      )
    )
    if (violated.length > 0 || rest.length > 0) return { rules: violated, other: rest }
  }
  if (rules.length > 0 || other.length > 0) return { rules, other }
  return O.match(Str.match(expected)(text), {
    onSome: (m) => ({
      rules: A.empty<string>(),
      other: [`expected ${Str.trim(`${m[2]}`)}, got ${Str.trim(`${m[1]}`)}`]
    }),
    onNone: () => ({
      rules: A.empty<string>(),
      other: [
        O.match(
          A.findFirst(lines(text), (line) => Str.isNonEmpty(Str.trim(line))),
          { onNone: () => "no message", onSome: (line) => short(line, 140) }
        )
      ]
    })
  })
}

/** What one report says: what failed and how, a test that ran out of time kept apart from one that failed. */
export interface Read {
  readonly rules: ReadonlyArray<string>
  readonly other: ReadonlyArray<string>
  readonly stories: ReadonlyArray<string>
  readonly timeouts: ReadonlyArray<string>
  readonly unloaded: ReadonlyArray<string>
  readonly missing: ReadonlyArray<string>
  /** The files asked for that ran with no test passed: all skipped, or none at all. */
  readonly nonePassed: ReadonlyArray<string>
}

/** A test file a run was given: its path in the copy, absolute and normalized, and as the mutants file names it. */
interface Asked {
  readonly path: string
  readonly name: string
}

/**
 * Reads vitest's report of a mutant's proof and story files. A file is matched by its whole path in the copy: vitest
 * runs every file whose path holds a filter it is given, so `test/a.prove.test.ts` also runs
 * `test/other/test/a.prove.test.ts`, and such a file is no file asked for, read for nothing.
 *
 * @category rules
 */
const readReport = (
  report: VitestReport,
  proof: Asked,
  stories: ReadonlyArray<Asked>,
  normalize: (path: string) => string
): Read => {
  const asked = A.dedupeWith(A.prepend(stories, proof), (a, b) => a.path === b.path)
  const askedPaths = HashSet.fromIterable(A.map(asked, (file) => file.path))
  const results = A.filter(report.testResults, (result) => HashSet.has(askedPaths, normalize(result.name)))
  const perFile = A.map(results, (result) => {
    const failed = A.filter(result.assertionResults, (test) => TestStatus.is.failed(test.status))
    const label = Str.replace(".story", "")(fileOf(result.name))
    const title = (test: (typeof failed)[number]) =>
      `${label}: ${Str.isNonEmpty(test.title) ? test.title : test.fullName}`
    if (FileStatus.is.failed(result.status) && failed.length === 0) {
      return {
        unloaded: [`${label}: did not load: ${short(result.message, 80)}`],
        timeouts: [],
        rules: [],
        other: [],
        stories: []
      }
    }
    const said = (test: (typeof failed)[number]) => A.filter(test.failureMessages, P.isString)
    const late = A.filter(failed, (test) => Str.includes(timedOut)(A.join(said(test), " ")))
    const real = A.filter(failed, (test) => !A.contains(late, test))
    const isProof = normalize(result.name) === proof.path
    const why = isProof && real.length > 0 ? whyProof(A.flatMap(real, said)) : { rules: [], other: [] }
    return {
      unloaded: A.empty<string>(),
      timeouts: A.map(late, title),
      rules: why.rules,
      other: why.other,
      stories: isProof ? A.empty<string>() : A.map(real, title)
    }
  })
  const passedIn = HashSet.fromIterable(
    A.map(
      A.filter(results, (result) => A.some(result.assertionResults, (test) => TestStatus.is.passed(test.status))),
      (result) => normalize(result.name)
    )
  )
  const ran = HashSet.fromIterable(A.map(results, (result) => normalize(result.name)))
  const names = (files: ReadonlyArray<Asked>) =>
    A.sort(
      A.map(files, (file) => file.name),
      Order.String
    )
  return {
    rules: A.flatMap(perFile, (f) => f.rules),
    other: A.flatMap(perFile, (f) => f.other),
    stories: A.flatMap(perFile, (f) => f.stories),
    timeouts: A.flatMap(perFile, (f) => f.timeouts),
    unloaded: A.flatMap(perFile, (f) => f.unloaded),
    missing: names(A.filter(asked, (file) => !HashSet.has(ran, file.path))),
    nonePassed: names(A.filter(asked, (file) => HashSet.has(ran, file.path) && !HashSet.has(passedIn, file.path)))
  }
}

/**
 * A run's trial from what its report says: the strongest thing that noticed the change. A timeout notices nothing.
 *
 * @category rules
 */
const trialOf = (name: string, took: Duration.Duration, read: Read, notes: ReadonlyArray<string>): Trial => {
  const t = Trial.cases
  if (read.missing.length > 0) {
    return t.NoResult.make({
      key: name,
      took,
      notes: [...notes, `files that did not run: ${A.join(read.missing, ", ")}`]
    })
  }
  if (read.unloaded.length > 0)
    return t.NoResult.make({ key: name, took, notes: [...notes, A.join(read.unloaded, "; ")] })
  const noted =
    read.timeouts.length > 0
      ? [...notes, `ran out of time, and counted as nothing: ${A.join(read.timeouts, " | ")}`]
      : notes
  const why = [...read.rules, ...read.other]
  if (read.rules.length > 0) {
    const names = A.sort(A.dedupe(A.getSomes(A.map(read.rules, ruleName))), Order.String)
    return t.Rule.make({ key: name, took, why, rules: names, stories: read.stories, notes: noted })
  }
  if (read.other.length > 0) return t.Proof.make({ key: name, took, why, stories: read.stories, notes: noted })
  if (A.isReadonlyArrayNonEmpty(read.stories))
    return t.Story.make({ key: name, took, stories: read.stories, notes: noted })
  if (read.timeouts.length > 0) return t.TimedOut.make({ key: name, took, notes: noted })
  return t.Neither.make({ key: name, took, notes: noted })
}

/** The class a trial prints as. */
export const classOf: (trial: Trial) => TrialClass = Trial.match({
  Rule: () => TrialClass.Enum.rule,
  Proof: () => TrialClass.Enum.proof,
  Story: () => TrialClass.Enum.story,
  Neither: () => TrialClass.Enum.neither,
  TimedOut: () => TrialClass.Enum.timeout,
  NotApplied: () => TrialClass.Enum.notapplied,
  NoResult: () => TrialClass.Enum.error
})

const whyOf: (trial: Trial) => ReadonlyArray<string> = Trial.match({
  Rule: (r) => r.why,
  Proof: (r) => r.why,
  Story: () => [],
  Neither: () => [],
  TimedOut: () => [],
  NotApplied: () => [],
  NoResult: () => []
})

const storiesOf: (trial: Trial) => ReadonlyArray<string> = Trial.match({
  Rule: (r) => r.stories,
  Proof: (r) => r.stories,
  Story: (r) => r.stories,
  Neither: () => [],
  TimedOut: () => [],
  NotApplied: () => [],
  NoResult: () => []
})

const noteOf: (trial: Trial) => string = Trial.match({
  Rule: (r) => A.join(r.notes, "; "),
  Proof: (r) => A.join(r.notes, "; "),
  Story: (r) => A.join(r.notes, "; "),
  Neither: (r) => A.join(r.notes, "; "),
  TimedOut: (r) => A.join(r.notes, "; "),
  NotApplied: (r) => r.reason,
  NoResult: (r) => A.join(r.notes, "; ")
})

const tookOf: (trial: Trial) => Duration.Duration = Trial.match({
  Rule: (r) => r.took,
  Proof: (r) => r.took,
  Story: (r) => r.took,
  Neither: (r) => r.took,
  TimedOut: (r) => r.took,
  NotApplied: () => Duration.zero,
  NoResult: (r) => r.took
})

const rulesOf: (trial: Trial) => ReadonlyArray<string> = Trial.match({
  Rule: (r) => r.rules,
  Proof: () => [],
  Story: () => [],
  Neither: () => [],
  TimedOut: () => [],
  NotApplied: () => [],
  NoResult: () => []
})

/**
 * The rules the first run saw this mutant break that the proof no longer names.
 *
 * @category rules
 */
export const weakerRules: {
  (trial: Trial): (mutant: Mutant) => ReadonlyArray<string>
  (mutant: Mutant, trial: Trial): ReadonlyArray<string>
} = dual(2, (mutant: Mutant, trial: Trial): ReadonlyArray<string> => {
  const first = A.sort(A.dedupe(A.getSomes(A.map(mutant.trialRules, ruleName))), Order.String)
  return A.filter(first, (name) => !A.contains(rulesOf(trial), name))
})

/**
 * How a mutant's run compares with its first run.
 *
 * @category rules
 */
export const verdictOf: {
  (trial: Trial): (mutant: Mutant) => Verdict
  (mutant: Mutant, trial: Trial): Verdict
} = dual(2, (mutant: Mutant, trial: Trial): Verdict =>
  Trial.match(trial, {
    NotApplied: (): Verdict => "notapplied",
    NoResult: (): Verdict => "error",
    Neither: (): Verdict => "neither",
    TimedOut: (): Verdict => "timeout",
    Rule: (): Verdict =>
      mutant.expect === "rule" ? (weakerRules(mutant, trial).length === 0 ? "same" : "weaker") : "improvement",
    // The first run had a story only: a story must still fail. The proof's own numbers moving is not the story
    // noticing.
    Proof: (r): Verdict =>
      mutant.expect === "rule" ? "weaker" : A.isReadonlyArrayNonEmpty(r.stories) ? "same" : "weaker",
    // A story trial has a story failing (its schema holds one at least), and that is what a story kept asks.
    Story: (): Verdict => (mutant.expect === "rule" ? "weaker" : "same")
  })
)

// ---------------------------------------------------------------------------------------------------------------
// The run.

/** The flags of `mutants`, as given. */
export interface MutantsFlags {
  /** The package's folder, from where the command was started. */
  readonly folder: string
  readonly all: boolean
  readonly sample: boolean
  readonly list: boolean
  /** Keys, comma-separated. */
  readonly only: O.Option<string>
  /** Keys to leave out, comma-separated. */
  readonly except: string
  readonly jobs: number
  readonly keep: boolean
  readonly baseline: boolean
  readonly nice: number
  readonly timeout: number
  /** Seconds a proof test may take, set in each copy; the test file's own limit when none. */
  readonly proofLimit: O.Option<number>
}

/** Says one line as the run goes, before its summary. */
export type Say = (finding: MutantsFinding) => Effect.Effect<void>

const keysOf = (text: string) => A.filter(A.map(Str.split(",")(text), Str.trim), Str.isNonEmpty)

/** The load average, from Linux's own file; `unknown` where there is none. */
const loadAverage = Effect.fnUntraced(function* () {
  const repo = yield* Repo
  return yield* repo.text("/proc/loadavg").pipe(
    Effect.map((text) => A.join(A.take(A.filter(Str.split(/\s+/)(text), Str.isNonEmpty), 3), " ")),
    Effect.orElseSucceed(() => "unknown")
  )
})

/**
 * Where a package's copies are made: under the root's `.scratch`, exactly as deep as the package, so every relative
 * path that leaves the package reaches the same file from a copy.
 *
 * @category rules
 */
export const copiesFolder = Effect.fn("Mutants.copiesFolder")(function* (packageFolder: string) {
  const repo = yield* Repo
  const fromRoot = repo.relative(packageFolder, repo.root)
  const parts = Str.split("/")(fromRoot)
  if (Str.startsWith("..")(fromRoot) || parts.length < 3) {
    return yield* RepoError.make({
      path: packageFolder,
      message: `${packageFolder}: a model package sits three folders or more below the repository's root (packages/<context>/model), and its copies are made as deep as it is`
    })
  }
  const slug = A.join(parts, "-")
  return parts.length === 3
    ? repo.join(repo.root, ".scratch", `mutants-${slug}`)
    : repo.join(repo.root, ".scratch", "mutants", slug, ...A.replicate("deeper", parts.length - 4))
})

/** The package's files a copy holds: what vitest needs to run its tests as the package does. */
const copiedFiles = Effect.fn("Mutants.copiedFiles")(function* (packageFolder: string) {
  const repo = yield* Repo
  const entries = yield* repo.entries(packageFolder)
  const configs = A.filter(
    entries,
    (entry) =>
      !entry.directory &&
      (entry.name === "package.json" ||
        entry.name === "vitest.config.ts" ||
        (Str.startsWith("tsconfig")(entry.name) && Str.endsWith(".json")(entry.name)))
  )
  const folders = A.filter(entries, (entry) => entry.directory && (entry.name === "src" || entry.name === "test"))
  return A.map(
    A.sort(
      A.appendAll(folders, configs),
      Order.mapInput(Order.String, (entry: Entry) => entry.name)
    ),
    (entry) => entry.path
  )
})

/**
 * Runs a package's mutants as `flags` say, saying each line as it goes, and gives the summary.
 *
 * @category rules
 */
export const mutants = Effect.fn("Mutants.mutants")(function* (flags: MutantsFlags, say: Say) {
  const repo = yield* Repo
  const vitest = yield* Vitest
  const packageFolder = repo.resolve(flags.folder)
  const fileName = repo.relative(repo.join(packageFolder, mutantsFile), repo.root)
  const file = yield* repo.json(MutantsFile)(repo.join(packageFolder, mutantsFile))

  const picked = A.filter([flags.all, flags.sample, flags.list, O.isSome(flags.only)], (on) => on)
  if (picked.length !== 1) {
    return alone(cases.Usage.make({ said: "choose one of --all, --sample, --only <keys> or --list" }))
  }
  if (O.isSome(flags.proofLimit) && flags.proofLimit.value >= flags.timeout) {
    return alone(
      cases.Usage.make({ said: "--proof-limit must be below --timeout: a run stopped from outside leaves no result" })
    )
  }
  const allKeys = A.map(file.mutants, (m) => m.key)
  const twice = A.dedupe(A.filter(allKeys, (k, i) => A.contains(A.take(allKeys, i), k)))
  if (twice.length > 0) return alone(cases.Duplicated.make({ keys: twice, file: fileName }))
  const byKey = HashMap.fromIterable(A.map(file.mutants, (m) => [m.key, m] as const))

  const wanted =
    flags.all || flags.list
      ? allKeys
      : flags.sample
        ? A.map(file.sample, (s) => s.key)
        : keysOf(O.getOrElse(flags.only, () => ""))
  const unknown = A.filter(wanted, (k) => !HashMap.has(byKey, k))
  if (unknown.length > 0) return alone(cases.Unknown.make({ what: "keys", keys: unknown }))
  const leftOut = keysOf(flags.except)
  const unknownLeft = A.filter(leftOut, (k) => !HashMap.has(byKey, k))
  if (unknownLeft.length > 0) return alone(cases.Unknown.make({ what: "keys to leave out", keys: unknownLeft }))
  const chosen = A.getSomes(
    A.map(
      A.filter(wanted, (k) => !A.contains(leftOut, k)),
      (k) => HashMap.get(byKey, k)
    )
  )
  if (leftOut.length > 0) yield* say(cases.LeftOut.make({ keys: leftOut }))
  if (chosen.length === 0) return alone(cases.NothingLeft.make({}))
  if (flags.list) {
    return A.map(chosen, (m): MutantsFinding =>
      cases.Listed.make({ key: m.key, target: m.target, kind: m.kind, expect: m.expect, file: m.file })
    )
  }
  const missingVitest = yield* vitest.missing
  if (O.isSome(missingVitest)) return alone(cases.NoVitest.make({ path: missingVitest.value }))

  // Every chosen mutant must apply to the package's own text before anything runs, and one kept as held by a rule
  // must record each of its rules as violated: any other standing is the prover giving up, which holds nothing.
  const checked = yield* Effect.forEach(
    chosen,
    Effect.fnUntraced(function* (m) {
      const source = yield* repo.text(repo.join(packageFolder, m.file))
      const applied = applyMutant(source, m)
      if (Result.isFailure(applied)) return O.some({ mutant: m, reason: applied.failure })
      const gaveUp = A.filter(m.trialRules, (t) => standing.test(t) && !Str.startsWith("violated ")(Str.toLowerCase(t)))
      return m.expect === "rule" && gaveUp.length > 0
        ? O.some({
            mutant: m,
            reason: `kept as held by a rule on a standing that is not a rule violated: ${A.join(gaveUp, "; ")}`
          })
        : O.none()
    }),
    { concurrency: 1 }
  )
  const problems = A.getSomes(checked)
  yield* Effect.forEach(problems, (p) => say(cases.NotRun.make({ key: p.mutant.key, reason: p.reason })), {
    concurrency: 1,
    discard: true
  })
  const ready = A.filter(chosen, (m) => !A.some(problems, (p) => p.mutant.key === m.key))

  const home = yield* copiesFolder(packageFolder)
  const stamp = (yield* Clock.currentTimeMillis).toString(36)
  const sources = yield* copiedFiles(packageFolder)
  const jobs = Num.max(1, flags.jobs)
  const started = yield* Clock.currentTimeMillis
  const loadBefore = yield* loadAverage()
  yield* say(cases.Starting.make({ mutants: ready.length, jobs, load: loadBefore }))

  const copyOf = (name: string) => repo.join(home, `${name}.${stamp}`)
  // The copy goes however its run ends, and the folder of copies with it once it holds nothing: `rmdir` removes only
  // an empty folder, so a copy another job is making keeps it.
  const removed = (name: string) =>
    repo.remove(copyOf(name)).pipe(Effect.andThen(repo.run("rmdir", [home])), Effect.ignore)

  /** Copies the package, makes the change (none for the baseline), runs vitest, and removes the copy. */
  const runCopy: (name: string, mutant: O.Option<Mutant>, proof: string) => Effect.Effect<Trial, RepoError> =
    Effect.fnUntraced(
      function* (name: string, mutant: O.Option<Mutant>, proof: string) {
        const copy = copyOf(name)
        const began = yield* Clock.currentTimeMillis
        const took = Effect.map(Clock.currentTimeMillis, (now) => Duration.millis(now - began))
        const noResult = (note: string) =>
          Effect.map(took, (t) => Trial.cases.NoResult.make({ key: name, took: t, notes: [note] }))
        yield* repo.remove(copy)
        yield* repo.run("mkdir", ["-p", copy])
        const copied = yield* repo.run("cp", ["-R", ...sources, copy])
        if (copied.code !== 0) return yield* noResult(`the package could not be copied: ${short(copied.stderr, 200)}`)
        if (O.isSome(flags.proofLimit)) {
          // The proof test's own time limit, made longer in the copy only: the package's file keeps the limit that
          // the proofs' jobs are sized for. The limit is the number that closes the test, written once.
          const target = repo.join(copy, proof)
          const text = yield* repo.text(target)
          const found = A.fromIterable(Str.matchAll(proofLimit)(text)).length
          if (found !== 1) {
            return yield* noResult(`the proof's time limit is found ${found} times in ${proof}, where it must be once`)
          }
          yield* repo.write(target, Str.replace(proofLimit, `\n    ${flags.proofLimit.value * 1000}\n  )\n`)(text))
        }
        if (O.isSome(mutant)) {
          const target = repo.join(copy, mutant.value.file)
          const source = yield* repo.text(target)
          const changed = applyMutant(source, mutant.value)
          if (Result.isFailure(changed)) return Trial.cases.NotApplied.make({ key: name, reason: changed.failure })
          yield* repo.write(target, changed.success)
        }
        const answer = yield* vitest.run({
          copy,
          files: [proof, ...file.stories],
          nice: flags.nice,
          limit: flags.timeout
        })
        const notes = answer.stopped ? [`stopped after ${flags.timeout} s`] : []
        const ran = yield* took
        const asked = (path: string): Asked => ({ path: repo.normalize(repo.join(copy, path)), name: path })
        return O.match(answer.report, {
          onNone: () =>
            Trial.cases.NoResult.make({
              key: name,
              took: ran,
              notes: [...notes, `no result: ${short(answer.tail, 200)}`]
            }),
          onSome: (report) => {
            const read = readReport(report, asked(proof), A.map(file.stories, asked), repo.normalize)
            const trial = trialOf(name, ran, read, notes)
            if (O.isSome(mutant) || !Trial.guards.Neither(trial)) return trial
            // The unchanged copy passes only when each file it was given passed a test and vitest ended with 0: a file
            // of skipped tests fails nothing and proves nothing, and an error thrown outside every test is in the code
            // vitest ends with, not in its report.
            const unproven = [
              ...(read.nonePassed.length > 0 ? [`no test passed in ${A.join(read.nonePassed, ", ")}`] : []),
              ...(O.contains(answer.exit, 0)
                ? []
                : [
                    O.match(answer.exit, {
                      onNone: () => "vitest ended with no code",
                      onSome: (code) => `vitest ended with code ${code}`
                    })
                  ])
            ]
            return unproven.length === 0
              ? trial
              : Trial.cases.NoResult.make({ key: name, took: ran, notes: [...notes, ...unproven] })
          }
        })
      },
      (run, name) => (flags.keep ? run : run.pipe(Effect.ensuring(removed(name))))
    )

  if (flags.baseline) {
    const proofs = A.sort(A.dedupe(A.map(ready, (m) => m.proof)), Order.String)
    const failedBase = yield* Effect.reduce(
      proofs,
      () => O.none<MutantsFinding>(),
      (stopped, proof) =>
        O.isSome(stopped)
          ? Effect.succeed(stopped)
          : Effect.flatMap(runCopy(`baseline-${Str.replace(".prove", "")(fileOf(proof))}`, O.none(), proof), (base) =>
              Trial.guards.Neither(base)
                ? Effect.as(say(cases.BaselinePasses.make({ proof, took: base.took })), O.none<MutantsFinding>())
                : Effect.succeedSome<MutantsFinding>(
                    cases.BaselineFails.make({
                      proof,
                      took: tookOf(base),
                      said: A.join(
                        A.filter([classOf(base), ...whyOf(base), ...storiesOf(base), noteOf(base)], Str.isNonEmpty),
                        " "
                      )
                    })
                  )
            )
    )
    if (O.isSome(failedBase)) return alone(failedBase.value)
  }

  const ran = yield* Effect.forEach(
    ready,
    (m) =>
      Effect.tap(runCopy(m.key, O.some(m), m.proof), (trial) => {
        const verdict = verdictOf(m, trial)
        const found = classOf(trial)
        const said =
          found === "rule" || found === "proof" ? A.join(whyOf(trial), "; ") : A.join(storiesOf(trial), " | ")
        return say(
          cases.Ran.make({
            key: m.key,
            found,
            took: tookOf(trial),
            verdict,
            said: Str.isNonEmpty(said) ? said : noteOf(trial)
          })
        )
      }),
    { concurrency: jobs }
  )
  const trials = HashMap.fromIterable([
    ...A.map(ran, (trial) => [trial.key, trial] as const),
    ...A.map(
      problems,
      (p) => [p.mutant.key, Trial.cases.NotApplied.make({ key: p.mutant.key, reason: p.reason })] as const
    )
  ])
  const trialFor = (m: Mutant): Trial =>
    O.getOrElse(HashMap.get(trials, m.key), () =>
      Trial.cases.NoResult.make({ key: m.key, took: Duration.zero, notes: ["not run"] })
    )

  const dash = (text: string) => (Str.isNonEmpty(text) ? text : "-")
  const rows = A.map(chosen, (m) => {
    const trial = trialFor(m)
    return A.join(
      [
        m.key,
        m.target,
        m.kind,
        m.expect,
        classOf(trial),
        verdictOf(m, trial),
        inSeconds(tookOf(trial), 1),
        dash(A.join(whyOf(trial), "; ")),
        dash(A.join(storiesOf(trial), " | ")),
        dash(noteOf(trial))
      ],
      "\t"
    )
  })
  yield* repo.write(
    repo.join(home, "results.tsv"),
    `${A.join(["key\ttarget\tkind\ttrial\tclass\tverdict\tseconds\tproof said\tstories failed\tnote", ...rows], "\n")}\n`
  )

  const countOf = (ms: ReadonlyArray<Mutant>, name: TrialClass) =>
    A.filter(ms, (m) => classOf(trialFor(m)) === name).length
  const classCounts = A.filter(
    A.map(TrialClass.literals, (name) => Count.make({ name, count: countOf(chosen, name) })),
    (c) => c.count > 0
  )
  const trialCounts = A.map(["rule", "story"] as const, (name) =>
    Count.make({ name, count: A.filter(chosen, (m) => m.expect === name).length })
  )
  const targets = A.sort(A.dedupe(A.map(chosen, (m) => m.target)), Order.String)
  const perTarget = A.map(targets, (target) => {
    const ms = A.filter(chosen, (m) => m.target === target)
    const times = A.map(ms, (m) => tookOf(trialFor(m)))
    return cases.TargetCounted.make({
      target,
      mutants: ms.length,
      rule: countOf(ms, "rule"),
      proof: countOf(ms, "proof"),
      story: countOf(ms, "story"),
      neither: countOf(ms, "neither"),
      timeout: countOf(ms, "timeout"),
      testTime: A.reduce(times, Duration.zero, Duration.sum),
      longest: A.reduce(times, Duration.zero, Duration.max)
    })
  })
  const finished = yield* Clock.currentTimeMillis
  const loadAfter = yield* loadAverage()
  const improved = A.map(
    A.filter(chosen, (m) => verdictOf(m, trialFor(m)) === "improvement"),
    (m) => m.key
  )
  const failing = A.filterMap(chosen, (m) => {
    const trial = trialFor(m)
    const verdict = verdictOf(m, trial)
    return S.is(FailingVerdict)(verdict) ? Result.succeed({ m, trial, verdict }) : Result.failVoid
  })
  const failed = A.map(failing, ({ m, trial, verdict }) => {
    const gone = weakerRules(m, trial)
    const weaker =
      m.expect === "story"
        ? "the trial saw a story fail, and none does now"
        : classOf(trial) !== "rule"
          ? `a rule got weaker: no rule is named now, where the trial saw ${dash(A.join(m.trialRules, "; "))}`
          : `a rule got weaker: no longer named, ${A.join(gone, ", ")}`
    const what = FailingVerdict.match(verdict, {
      neither: () => "held by neither",
      weaker: () => weaker,
      timeout: () => "only ran out of time: nothing held it",
      notapplied: () => "does not apply",
      error: () => "no result"
    })
    return cases.Failed.make({
      key: m.key,
      what,
      file: m.file,
      old: m.old,
      new: m.new,
      proof: m.proof,
      said: `${A.join(whyOf(trial), "; ")} ${A.join(storiesOf(trial), " | ")} ${noteOf(trial)}`
    })
  })
  return [
    cases.Counted.make({ label: "class", counts: classCounts }),
    cases.Counted.make({ label: "trial", counts: trialCounts }),
    ...perTarget,
    cases.Wall.make({ took: Duration.millis(finished - started), before: loadBefore, after: loadAfter }),
    ...(improved.length > 0 ? [cases.Improved.make({ keys: improved })] : []),
    ...failed
  ] satisfies ReadonlyArray<MutantsFinding>
})
