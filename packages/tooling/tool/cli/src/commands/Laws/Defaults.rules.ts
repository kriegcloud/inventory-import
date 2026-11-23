/**
 * Absence, starting values and clean-ups are settled by a schema, where a value enters or where its type is declared,
 * never by the code that uses it (Benjamin's standing rule; `docs/standards/schema-first.md`, SF-3 to SF-5). A
 * fallback written at a call site is a rule nobody can find, and two call sites can disagree about it.
 *
 * What is counted, each by how it is written and by nothing else (`internal/defaultsCode.ts`): a fallback (`??`,
 * `??=`, `||` and `||=` before a value written out, `getOrElse`), a comparison with `null` or `undefined`, an Option turned back into a missing value (`getOrUndefined`,
 * `getOrNull`), and a trim or a change of case that is not `SchemaGetter`'s or `SchemaTransformation`'s. The law does
 * not judge whether a place is "really" a default: a law that judges is argued with, and one that reads types costs
 * the whole program on every run.
 *
 * The tree had about 2,000 such places when the law was written (`getOrElse` and `||` were counted a commit later,
 * with a baseline written anew, since without them a refused `x ?? 0` was written again as `O.getOrElse(x, () => 0)`), so it holds a baseline (`defaults-baseline.json` at
 * the root): for each file, how many of each kind it may hold. A file with more than its baseline fails, and a file
 * the baseline does not name may hold none. A file with fewer never fails: `--write` lowers the baseline to what the
 * tree holds, and never raises it (the first one, with no baseline file yet, records the tree as it stands). So nobody is asked to clean a file to finish other work, nobody can add a place,
 * and the numbers only fall. The law is done when the baseline is empty and is deleted.
 *
 * Given files, it reads only those: a few milliseconds, so the same law can answer the moment a file is edited
 * (`.claude/hooks/defaults.sh`) as well as before a commit. Where a file is over, the places said are the ones its
 * committed version does not have, so the line just written is the line named.
 *
 * Left alone: the vendored kit and components, `.agents`, the scratchpad and `packages/tooling` (this package reads
 * arguments and files, not the business's data).
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../Repo.service.ts"
import { scratchpadFolder } from "../../Repo.schema.ts"
import { err, type Line, out } from "../../Report.schema.ts"
import { DefaultsKind, type DefaultsPlace, readDefaults } from "./internal/defaultsCode.ts"

const $I = $RepoCliId.create("commands/Laws/Defaults.rules")

/** The file the baseline is kept in, from the root. */
export const baselineFile = "defaults-baseline.json"

/** The order the baseline writes a file's four counts in. */
const kinds: ReadonlyArray<DefaultsKind> = ["fallback", "absence", "unwrap", "normalise"]

const Count = S.Int.check(S.isGreaterThanOrEqualTo(0))

/** How many places of each kind one file may hold, in the order of `counts`. */
const Held = S.Tuple([Count, Count, Count, Count])
type Held = typeof Held.Type
const none: Held = [0, 0, 0, 0]

/**
 * The baseline as it is stored. A file it does not name holds nothing, which is the state every file ends in.
 */
export const DefaultsBaseline = S.Struct({
  counts: S.Tuple([S.tag("fallback"), S.tag("absence"), S.tag("unwrap"), S.tag("normalise")]).pipe(
    S.annotateKey({ description: "What the four numbers of a file count, in order" })
  ),
  files: S.Record(S.String, Held).pipe(
    S.annotateKey({ description: "Each file that still holds a place, from the root, with its four counts" }),
    S.withDecodingDefaultTypeKey(Effect.succeed({}))
  )
}).pipe(
  $I.annoteSchema("DefaultsBaseline", {
    description: "For each file, how many fallbacks, absence checks, unwraps and clean-ups it may still hold"
  })
)

/** The decoded value of `DefaultsBaseline`. */
export type DefaultsBaseline = typeof DefaultsBaseline.Type

const ownCode = A.appendAll(
  A.map(
    [
      "apps/*/src/**/*.ts",
      "apps/*/src/**/*.tsx",
      "apps/*/test/**/*.ts",
      "apps/*/test/**/*.tsx",
      "packages/**/src/**/*.ts",
      "packages/**/src/**/*.tsx",
      "packages/**/test/**/*.ts",
      "packages/**/test/**/*.tsx",
      "packages/client/**/*.ts",
      "packages/client/**/*.tsx",
      "packages/review/**/*.ts",
      "packages/review/**/*.tsx",
      "packages/ui/**/*.ts",
      "packages/ui/**/*.tsx"
    ],
    (pattern) => `:(glob)${pattern}`
  ),
  [
    ":!packages/ui/src/components",
    ":!packages/ui/src/hooks",
    ":!packages/tooling",
    ":!.agents",
    `:!${scratchpadFolder}`
  ]
)

/**
 * What the law says: the tree holds to the baseline, the baseline was lowered, or each file that holds more than it
 * may with the places to change.
 */
export const DefaultsFinding = S.TaggedUnion({
  Clean: {
    files: S.Int.pipe(S.annotateKey({ description: "How many files were read" })),
    held: Held.pipe(S.annotateKey({ description: "The places the files read still hold, by kind" }))
  },
  Below: { files: S.Int.pipe(S.annotateKey({ description: "How many files hold fewer places than their baseline" })) },
  Wrote: { files: S.Int.pipe(S.annotateKey({ description: "How many files the baseline names now" })) },
  NoWrite: {},
  Refused: {},
  Unlisted: { why: S.String.pipe(S.annotateKey({ description: "What git said when it could not list the files" })) },
  Unread: {
    file: S.String.pipe(S.annotateKey({ description: "The file the parser refused" })),
    why: S.String.pipe(S.annotateKey({ description: "What the parser said" }))
  },
  Over: {
    file: S.String.pipe(S.annotateKey({ description: "The file, from the root" })),
    kind: DefaultsKind.pipe(S.annotateKey({ description: "The kind it holds too many of" })),
    now: S.Int.pipe(S.annotateKey({ description: "How many it holds" })),
    may: S.Int.pipe(S.annotateKey({ description: "How many its baseline allows" })),
    test: S.Boolean.pipe(S.annotateKey({ description: "Whether the file is a test, which is told another remedy" }))
  },
  At: {
    place: S.String.pipe(S.annotateKey({ description: "The file and line, as file:line" })),
    code: S.String.pipe(S.annotateKey({ description: "The code at that place" }))
  }
}).pipe(
  $I.annoteSchema("DefaultsFinding", {
    description: "The tree holds to the defaults baseline, or each file over it and the places to change"
  })
)

/** The decoded value of `DefaultsFinding`. */
export type DefaultsFinding = typeof DefaultsFinding.Type

/** What to write instead, for each kind: the line an agent reads the moment it wrote the place. */
const remedy: Readonly<Record<DefaultsKind, string>> = {
  fallback:
    "a `??`, a `||` before a value, or a getOrElse supplies a value the type should already hold. Put the starting value on the schema (S.withConstructorDefault, S.withDecodingDefaultTypeKey), or decode the absence to an Option where the value enters and O.match it where it is drawn, both cases said (SF-5)",
  absence:
    "a comparison with null or undefined. Decode the value where it enters (S.OptionFromOptionalKey, S.OptionFromNullOr, S.OptionFromNullishOr), then O.match, O.map or O.isSome; if it tells two cases apart, the type is a tagged union (SF-4, SF-6)",
  unwrap:
    "O.getOrUndefined or O.getOrNull turns an Option back into a missing value. Keep the Option and O.match it where it is used",
  normalise:
    "a trim or a change of case in code. Make it a transformation on the schema (S.decodeTo with SchemaTransformation.trim(), SchemaGetter.toUpperCase()), so the decoded type is already clean (SF-3)"
}
const testRemedy: Readonly<Record<DefaultsKind, string>> = {
  ...remedy,
  fallback:
    "a `??` or a getOrElse in a test hides a value that is missing. Narrow with assertSome, assertDefined or assertSuccess from @effect/vitest/utils, which fail with the value",
  absence:
    "a comparison with null or undefined in a test. Narrow with assertSome, assertNone or assertDefined from @effect/vitest/utils"
}

/** One line of the code at a place: its first line, cut where a longer one would fill the screen. */
const shown = (code: string): string => {
  const first = A.headNonEmpty(Str.split("\n")(code))
  return first.length > 80 ? `${Str.slice(0, 77)(first)}...` : first
}

/**
 * The line each finding prints.
 */
export const defaultsSentence: (finding: DefaultsFinding) => Line = DefaultsFinding.match({
  Clean: ({ files, held }) =>
    files === 0
      ? out("defaults:check OK  no file named is one the law reads")
      : out(
          `defaults:check OK  ${files} files hold to the baseline (still held: ${A.join(
            A.map(A.zip(kinds, held), ([kind, count]) => `${count} ${kind}`),
            ", "
          )})`
        ),
  Below: ({ files }) =>
    out(`${files} files hold fewer places than their baseline: bun run beep laws defaults --write lowers it`),
  Wrote: ({ files }) => out(`defaults:check OK  ${baselineFile} lowered: it names ${files} files`),
  NoWrite: () =>
    err(`--write lowers the baseline for the whole tree and takes no file, and never raises it: nothing was written`),
  Refused: () =>
    err(
      `defaults:check FAIL  code that settles absence, a starting value or a clean-up by itself. A schema settles it, where the value enters (docs/standards/schema-first.md):`
    ),
  Unlisted: ({ why }) => err(`git could not list the files, so none was checked: ${why}`),
  Unread: ({ file, why }) => err(`${file}  not read: ${why}`),
  Over: ({ file, kind, may, now, test }) =>
    err(`${file}  holds ${now} ${kind}, and may hold ${may}: ${(test ? testRemedy : remedy)[kind]}`),
  At: ({ code, place }) => err(`  ${place}  ${shown(code)}`)
})

const countOf = (places: ReadonlyArray<DefaultsPlace>): Held => {
  const of = (kind: DefaultsKind): number => A.filter(places, (place) => place.kind === kind).length
  return [of("fallback"), of("absence"), of("unwrap"), of("normalise")]
}
const sum = (a: Held, b: Held): Held => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]]
const isTest = (file: string): boolean => Str.includes("/test/")(file) || Str.includes(".test.")(file)

// The places a file's committed version does not have: each old place takes one new place with the same code away,
// so a place whose line only moved is not said, and the place just written is.
const added = (
  now: ReadonlyArray<DefaultsPlace>,
  before: ReadonlyArray<DefaultsPlace>
): ReadonlyArray<DefaultsPlace> => {
  const left = Array.from(before, (place) => place.code)
  const fresh: Array<DefaultsPlace> = []
  for (const place of now) {
    const known = A.findFirstIndex(left, (code) => code === place.code)
    if (O.isSome(known)) left.splice(known.value, 1)
    else fresh.push(place)
  }
  return fresh
}

const encodeKey = S.encodeEffect(S.fromJsonString(S.String))

/**
 * Checks the files against the baseline, or with `write` lowers the baseline to what the tree holds.
 *
 * @param write Lower the baseline. Refused with files named, and when any file is over its baseline.
 * @param only The files to read, from the root or from the folder the command runs in; every file when none is named.
 */
export const defaults = Effect.fn("Defaults.defaults")(function* (write: boolean, only: ReadonlyArray<string>) {
  const repo = yield* Repo
  const git = (pathspec: ReadonlyArray<string>) =>
    repo.run("git", ["ls-files", "--cached", "--others", "--exclude-standard", ...pathspec], { cwd: repo.root })
  const listed = yield* git(["--", ...ownCode])
  const vendored = yield* git(["--", ":(glob)packages/**/vendor.json"])
  // A list git could not give is not an empty list: nothing was checked, and the law says so.
  if (listed.code !== 0 || vendored.code !== 0) {
    return A.make<[DefaultsFinding, DefaultsFinding]>(
      DefaultsFinding.cases.Refused.make({}),
      DefaultsFinding.cases.Unlisted.make({ why: listed.code !== 0 ? listed.stderr : vendored.stderr })
    )
  }
  if (write && A.isReadonlyArrayNonEmpty(only)) return A.of<DefaultsFinding>(DefaultsFinding.cases.NoWrite.make({}))
  // A package the kit is copied into keeps beep-effect's code as it is: its folder, from the root, with a slash.
  const kit = A.map(
    A.filter(Str.split("\n")(vendored.stdout), (file) => file !== ""),
    (file) => Str.slice(0, file.length - "vendor.json".length)(file)
  )
  const inScope = A.dedupe(
    A.filter(
      Str.split("\n")(listed.stdout),
      (file) => file !== "" && !Str.endsWith(".d.ts")(file) && !A.some(kit, (folder) => Str.startsWith(folder)(file))
    )
  )
  // A named file is read as the caller wrote it: from the root, from the folder the command runs in, or in full.
  const asked = A.map(only, (file) => repo.relative(repo.root, repo.resolve(repo.cwd, file)))
  const wanted = A.isReadonlyArrayNonEmpty(asked) ? A.filter(inScope, (file) => A.contains(asked, file)) : inScope
  const files = yield* Effect.filter(wanted, (file) => repo.exists(repo.join(repo.root, file)), { concurrency: 1 })
  const baselinePath = repo.join(repo.root, baselineFile)
  const kept = yield* repo.exists(baselinePath)
  const baseline = kept ? (yield* repo.json(DefaultsBaseline)(baselinePath)).files : {}
  const read = yield* Effect.forEach(
    files,
    (file) =>
      Effect.map(repo.text(repo.join(repo.root, file)), (source) => ({ file, ...readDefaults({ file, source }) })),
    { concurrency: 1 }
  )
  const unread = A.flatMap(read, (one) =>
    O.match(one.unread, {
      onNone: () => [],
      onSome: (why) => [DefaultsFinding.cases.Unread.make({ file: one.file, why })]
    })
  )
  const counted = A.map(read, (one) => ({
    ...one,
    count: countOf(one.found),
    may: O.getOrElse(R.get(baseline, one.file), () => none)
  }))
  // The first `--write`, with no baseline file yet, records the tree as it stands: nothing can be over nothing kept.
  const starting = write && !kept
  const over = starting ? [] : A.filter(counted, (one) => A.some(A.zip(one.count, one.may), ([now, may]) => now > may))
  const problems = yield* Effect.forEach(
    over,
    Effect.fnUntraced(function* (one) {
      // What the file held when it was last committed says which places are new; a file never committed has none.
      const committed = yield* repo.run("git", ["show", `HEAD:${one.file}`], { cwd: repo.root })
      const before = committed.code === 0 ? readDefaults({ file: one.file, source: committed.stdout }).found : []
      return A.flatMap(A.zip(kinds, A.zip(one.count, one.may)), ([kind, [now, may]]) => {
        if (now <= may) return []
        const ofKind = A.filter(one.found, (place) => place.kind === kind)
        const fresh = added(
          ofKind,
          A.filter(before, (place) => place.kind === kind)
        )
        const said: ReadonlyArray<DefaultsPlace> = A.isReadonlyArrayNonEmpty(fresh) ? fresh : ofKind
        return A.prepend<DefaultsFinding, DefaultsFinding>(
          A.map(said, (place) =>
            DefaultsFinding.cases.At.make({ place: `${one.file}:${place.line}`, code: place.code })
          ),
          DefaultsFinding.cases.Over.make({ file: one.file, kind, now, may, test: isTest(one.file) })
        )
      })
    }),
    { concurrency: 1 }
  )
  const failures = A.appendAll(unread, A.flatten(problems))
  if (A.isArrayNonEmpty(failures)) {
    return A.prepend<DefaultsFinding, DefaultsFinding>(failures, DefaultsFinding.cases.Refused.make({}))
  }
  const holding = A.filter(counted, (one) => A.some(one.count, (count) => count > 0))
  if (write) {
    const lines = yield* Effect.forEach(
      A.sortWith(
        holding,
        (one) => one.file,
        (a, b) => (a < b ? -1 : a > b ? 1 : 0)
      ),
      (one) => Effect.map(encodeKey(one.file), (key) => `    ${key}: [${A.join(A.map(one.count, String), ", ")}]`),
      { concurrency: 1 }
    )
    const body = A.isArrayNonEmpty(lines) ? `{\n${A.join(lines, ",\n")}\n  }` : "{}"
    yield* repo.write(
      baselinePath,
      `{\n  "counts": ["fallback", "absence", "unwrap", "normalise"],\n  "files": ${body}\n}\n`
    )
    return A.of<DefaultsFinding>(DefaultsFinding.cases.Wrote.make({ files: holding.length }))
  }
  const below = A.filter(counted, (one) => A.some(A.zip(one.count, one.may), ([now, may]) => now < may)).length
  const clean = DefaultsFinding.cases.Clean.make({
    files: files.length,
    held: A.reduce(counted, none, (total, one) => sum(total, one.count))
  })
  return below > 0
    ? A.make<[DefaultsFinding, DefaultsFinding]>(clean, DefaultsFinding.cases.Below.make({ files: below }))
    : A.of<DefaultsFinding>(clean)
})
