/**
 * What the three sync commands (`version-sync`, `config-sync`, `deps update`) share: a place whose text differs from
 * what it is derived from, the three ways a command can treat it, and the lines it prints.
 *
 * A command first plans: it reads the tree and hands back places and problems, and writes nothing. Only `settle`
 * writes, and only in the `write` mode, so a test reads the plan of a fixture, has it written, and plans again.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "./Repo.service.ts"
import { err, type Line, out } from "./Report.schema.ts"

const $I = $RepoCliId.create("Sync.schema")

/**
 * What a sync command does with a place that differs: `check` names it and fails, `write` rewrites it, `dry-run`
 * says what `write` would do and changes nothing.
 *
 * @category schemas
 */
export const Mode = LiteralKit(["check", "write", "dry-run"]).pipe(
  $I.annoteSchema("Mode", { description: "Name the places that differ, rewrite them, or say what would be written" })
)

/**
 * The decoded value of `Mode`.
 *
 * @category models
 */
export type Mode = typeof Mode.Type

/**
 * The mode two flags ask for: `--dry-run` wins over `--write`, and with neither the command only checks.
 *
 * @category rules
 */
export const modeOf = (flags: { readonly write: boolean; readonly dryRun: boolean }): Mode =>
  flags.dryRun ? "dry-run" : flags.write ? "write" : "check"

// One segment of a path: any name but `.` and `..`, with no `/` and no NUL. Written without a lookahead, which the
// schema's generator cannot read.
const segment = String.raw`(?:[^/\0.][^/\0]*|\.[^/\0.][^/\0]*|\.\.[^/\0]+)`

/**
 * A file named from the repository's root: relative, and with no `.` or `..` segment, so joined to the root it
 * stays inside the repository. `settle` writes to it.
 *
 * @category schemas
 */
export const RepoFile = S.String.check(
  S.isMaxLength(1024),
  S.isPattern(new RegExp(`^(?:${segment}/)*${segment}$`))
).pipe(
  $I.annoteSchema("RepoFile", {
    description: "A file from the repository's root: relative, with no . or .. segment, so it stays inside it"
  })
)

/** A line of a file, from 1. */
const LineNumber = S.Int.check(S.isGreaterThanOrEqualTo(1))

/**
 * One place whose text is not what it is derived from: where it is, what is there, what belongs there, and the
 * stretch of the file to replace. The stretch starts at or before it ends, so a repair never writes a part of the
 * file twice.
 *
 * @category schemas
 */
export class Drift extends S.Class<Drift, { readonly brand: unique symbol }>($I`Drift`)(
  S.Struct({
    file: RepoFile.pipe(S.annotateKey({ description: "The file, from the repository's root" })),
    line: LineNumber.pipe(S.annotateKey({ description: "The line the place is on, from 1" })),
    what: S.String.pipe(S.annotateKey({ description: "What the place states, and what it is derived from" })),
    found: S.String.pipe(S.annotateKey({ description: "What is written there" })),
    expected: S.String.pipe(S.annotateKey({ description: "What its source says belongs there" })),
    start: S.Natural.pipe(
      S.annotateKey({ description: "Where the text to replace starts, as an offset into the file" })
    ),
    end: S.Natural.pipe(S.annotateKey({ description: "Where it ends: the offset after its last character" })),
    text: S.String.pipe(S.annotateKey({ description: "The text that replaces it" }))
  }).check(
    S.makeFilter((drift: { readonly start: number; readonly end: number }) => drift.start <= drift.end, {
      expected: "a stretch that starts at or before it ends"
    })
  ),
  $I.annote("Drift", { description: "A place whose text differs from its source, and the text that repairs it" })
) {}

/**
 * Whether two repairs of one file touch the same characters. The same stretch with the same text is one repair
 * twice, which `repaired` writes once; any other two that meet would write some characters twice.
 */
const clash = (a: Drift, b: Drift): boolean =>
  a.file === b.file &&
  !(a.start === b.start && a.end === b.end && a.text === b.text) &&
  (a.start === b.start || (a.start < b.end && b.start < a.end))

/**
 * Something a sync command found that it cannot repair itself: two sources that disagree, a path that names
 * nothing, a package no list covers.
 *
 * @category schemas
 */
export class Problem extends S.Class<Problem, { readonly brand: unique symbol }>($I`Problem`)(
  {
    file: S.String.pipe(S.annotateKey({ description: "The file the problem is in, from the repository's root" })),
    message: S.String.pipe(S.annotateKey({ description: "What is wrong and what a person does about it" }))
  },
  $I.annote("Problem", { description: "Something the command cannot repair, as a sentence a person can act on" })
) {}

/**
 * What a command planned: the places it looked at, the ones that differ, and what it cannot repair.
 *
 * @category schemas
 */
export class Plan extends S.Class<Plan, { readonly brand: unique symbol }>($I`Plan`)(
  {
    checked: S.Natural.pipe(S.annotateKey({ description: "How many places were compared with their source" })),
    drifts: S.Array(Drift)
      .check(
        S.makeFilter(
          (drifts: ReadonlyArray<Drift>) =>
            A.every(drifts, (a, i) => A.every(A.drop(drifts, i + 1), (b) => !clash(a, b))),
          { expected: "repairs of a file that do not touch the same characters" }
        )
      )
      .pipe(S.annotateKey({ description: "The places that differ, each with its repair" })),
    problems: S.Array(Problem).pipe(S.annotateKey({ description: "What the command cannot repair" }))
  },
  $I.annote("Plan", { description: "The places a sync command compared, those that differ, and what it cannot repair" })
) {}

/** Several plans as one. */
export const mergePlans = (plans: ReadonlyArray<Plan>): Plan =>
  Plan.make({
    checked: A.reduce(plans, 0, (sum, plan) => sum + plan.checked),
    drifts: A.flatMap(plans, (plan) => plan.drifts),
    problems: A.flatMap(plans, (plan) => plan.problems)
  })

const place = {
  file: S.String.pipe(S.annotateKey({ description: "The file, from the repository's root" })),
  line: S.Int.pipe(S.annotateKey({ description: "The line, from 1" })),
  what: S.String.pipe(S.annotateKey({ description: "What the place states, and what it is derived from" })),
  found: S.String.pipe(S.annotateKey({ description: "What is written there" })),
  expected: S.String.pipe(S.annotateKey({ description: "What belongs there" }))
}
const command = S.String.pipe(S.annotateKey({ description: "The command's name, as its root script is called" }))

/**
 * What a sync command says: everything agrees, or each place that differs (named, written, or to be written) and
 * each problem it cannot repair.
 *
 * @category schemas
 */
export const SyncFinding = S.TaggedUnion({
  Agrees: {
    command,
    checked: S.Int.pipe(S.annotateKey({ description: "How many places were compared" }))
  },
  Refused: {
    command,
    places: S.Int.pipe(S.annotateKey({ description: "How many places differ" })),
    problems: S.Int.pipe(S.annotateKey({ description: "How many problems the command cannot repair" })),
    repair: S.String.pipe(S.annotateKey({ description: "The command that writes the places that differ" }))
  },
  Differs: place,
  Wrote: {
    command,
    places: S.Int.pipe(S.annotateKey({ description: "How many places were rewritten" })),
    files: S.Int.pipe(S.annotateKey({ description: "In how many files" }))
  },
  Written: place,
  WouldWrite: {
    command,
    places: S.Int.pipe(S.annotateKey({ description: "How many places would be rewritten" })),
    files: S.Int.pipe(S.annotateKey({ description: "In how many files" }))
  },
  Pending: place,
  Installed: { command },
  InstallFailed: {
    command,
    output: S.String.pipe(S.annotateKey({ description: "What bun said, its last lines" }))
  },
  Unrepaired: {
    file: S.String.pipe(S.annotateKey({ description: "The file the problem is in" })),
    message: S.String.pipe(S.annotateKey({ description: "What is wrong and what a person does about it" }))
  }
}).pipe($I.annoteSchema("SyncFinding", { description: "What a sync command found, wrote or would write" }))

/**
 * The decoded value of `SyncFinding`.
 *
 * @category models
 */
export type SyncFinding = typeof SyncFinding.Type

const placed = (at: { readonly file: string; readonly line: number; readonly what: string }) =>
  `  ${at.file}:${at.line}  ${at.what}`
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const syncSentence: (finding: SyncFinding) => Line = SyncFinding.match({
  Agrees: ({ command: name, checked }) =>
    out(
      `${name} OK  ${plural(checked, "place agrees with what it is", "places agree with what they are")} derived from`
    ),
  Refused: ({ command: name, places, problems, repair }) => {
    const differing = `${plural(places, "place differs from what it is", "places differ from what they are")} derived from (\`${repair}\` writes ${places === 1 ? "it" : "them"})`
    const needing = `${plural(problems, "problem needs", "problems need")} a person, and no command repairs ${problems === 1 ? "it" : "them"}`
    return err(
      `${name} FAIL  ${places > 0 && problems > 0 ? `${differing}; ${needing}` : places > 0 ? differing : needing}`
    )
  },
  Differs: (at) => err(`${placed(at)}: found ${at.found}, expected ${at.expected}`),
  Wrote: ({ command: name, places, files }) =>
    out(`${name}  wrote ${plural(places, "place", "places")} in ${plural(files, "file", "files")}`),
  Written: (at) => out(`${placed(at)}: ${at.found} -> ${at.expected}`),
  WouldWrite: ({ command: name, places, files }) =>
    out(`${name}  would write ${plural(places, "place", "places")} in ${plural(files, "file", "files")} (dry run)`),
  Pending: (at) => out(`${placed(at)}: ${at.found} -> ${at.expected}`),
  Installed: ({ command: name }) =>
    out(`${name}  a package.json changed, so bun install ran: bun.lock follows what the package.json files say`),
  InstallFailed: ({ command: name, output }) =>
    err(
      `${name} FAIL  a package.json changed and bun install did not finish, so bun.lock may not follow it: run \`bun install\` and commit bun.lock with the change. bun said:\n${output}`
    ),
  Unrepaired: ({ file, message }) => err(`  ${file}: ${message}`)
})

const fromTheEnd = Order.mapInput(Order.flip(Order.Number), (drift: Drift) => drift.start)
const byPlace = Order.combine(
  Order.mapInput(Order.String, (drift: Drift) => drift.file),
  Order.mapInput(Order.Number, (drift: Drift) => drift.start)
)

/**
 * A file's text with its places repaired. Two repairs of the same stretch count once; the last place in the file is
 * written first, so an earlier offset still points where it did.
 *
 * @category rules
 */
export const repaired =
  (drifts: ReadonlyArray<Drift>) =>
  (text: string): string =>
    A.reduce(
      A.sort(
        A.dedupeWith(drifts, (a, b) => a.start === b.start && a.end === b.end),
        fromTheEnd
      ),
      text,
      (current, drift) => `${Str.slice(0, drift.start)(current)}${drift.text}${Str.slice(drift.end)(current)}`
    )

/**
 * Carries a plan out in its mode and says what happened: `check` names each place and fails, `write` rewrites each
 * file once, `dry-run` lists what `write` would do. A problem is said and fails the command in every mode, since no
 * mode repairs it.
 *
 * @category rules
 */
export const settle = Effect.fn("Sync.settle")(function* (
  options: { readonly command: string; readonly repair: string; readonly mode: Mode },
  plan: Plan
) {
  const repo = yield* Repo
  const drifts = A.sort(plan.drifts, byPlace)
  const files = R.toEntries(A.groupBy(drifts, (drift) => drift.file))
  const unrepaired = A.map(plan.problems, (problem): SyncFinding =>
    SyncFinding.cases.Unrepaired.make({ file: problem.file, message: problem.message })
  )
  const refusal = SyncFinding.cases.Refused.make({
    command: options.command,
    places: options.mode === "check" ? drifts.length : 0,
    problems: unrepaired.length,
    repair: options.repair
  })
  const at = (drift: Drift) => ({
    file: drift.file,
    line: drift.line,
    what: drift.what,
    found: drift.found,
    expected: drift.expected
  })

  if (options.mode === "check") {
    if (drifts.length === 0 && unrepaired.length === 0) {
      return A.of<SyncFinding>(SyncFinding.cases.Agrees.make({ command: options.command, checked: plan.checked }))
    }
    return A.flatten<ReadonlyArray<ReadonlyArray<SyncFinding>>>([
      [refusal],
      A.map(drifts, (drift) => SyncFinding.cases.Differs.make(at(drift))),
      unrepaired
    ])
  }

  if (options.mode === "write") {
    yield* Effect.forEach(
      files,
      Effect.fnUntraced(function* ([file, own]) {
        const absolute = repo.join(repo.root, file)
        const text = yield* repo.text(absolute)
        yield* repo.write(absolute, repaired(own)(text))
      }),
      { concurrency: 1, discard: true }
    )
  }
  const summary =
    options.mode === "write"
      ? SyncFinding.cases.Wrote.make({ command: options.command, places: drifts.length, files: files.length })
      : SyncFinding.cases.WouldWrite.make({ command: options.command, places: drifts.length, files: files.length })
  return A.flatten<ReadonlyArray<ReadonlyArray<SyncFinding>>>([
    drifts.length === 0 && unrepaired.length === 0
      ? [SyncFinding.cases.Agrees.make({ command: options.command, checked: plan.checked })]
      : drifts.length === 0
        ? []
        : [summary],
    A.map(drifts, (drift) =>
      options.mode === "write" ? SyncFinding.cases.Written.make(at(drift)) : SyncFinding.cases.Pending.make(at(drift))
    ),
    unrepaired.length === 0 ? [] : [refusal],
    unrepaired
  ])
})
