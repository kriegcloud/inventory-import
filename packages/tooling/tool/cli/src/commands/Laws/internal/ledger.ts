// What holds a ban's list of today's files: each file with the number of places in it that break the rule, kept in a
// JSON file of its own under `packages/tooling/tool/cli/ledgers/`. The number may only fall, and that is held by the
// code, not by a review: a file that gains a place is refused, so no new one goes in under a file already listed; a file
// that loses one is refused until its number is lowered, so it cannot gain it back later; a file at none comes off; an
// entry for a file that is not there is refused; and the ledger itself is compared with the same file at its base, so
// a number that rose or a file added is refused, whatever the same commit wrote.
//
// The base is where this branch left `main` (the merge base of HEAD and `origin/main`, else `main`). On the branch
// `main` it is what main was before the change being checked: in CI's run for a push, the commit the push moved main
// from (`LEDGER_BASE`, which CI sets to the push's `before`), so every commit of a push of several is in it; locally,
// `origin/main` when HEAD is ahead of it, else the commit before HEAD. A shallow checkout is refused, since its base
// may be missing and the comparison would pass in silence. On a branch whose base has no such ledger yet, nothing is
// compared.
//
// A file git sees renamed since the base is held at its old name's number: git sees a rename once both paths are
// staged (`git mv`, or `git add` of both), so an unstaged one reads as a file removed and one added. A file deleted and
// made again at the same path in one change is the same path to git, and keeps that path's number.
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo } from "../../../Repo.service.ts"

/** Each listed file, from the root, with the number of places in it that break the rule. */
export type Ledger = Readonly<Record<string, number>>

/** How a listed file stands against its number: as it is, gained a place, lost one, or clean. */
export type Standing = Data.TaggedEnum<{
  readonly Holds: {}
  readonly Grew: { readonly now: number; readonly held: number }
  readonly Fell: { readonly now: number; readonly held: number }
  readonly Clean: {}
}>

/** The cases of `Standing`. */
export const Standing = Data.taggedEnum<Standing>()

/**
 * How a file with `now` places stands against `ledger`; none when the ledger does not name it.
 *
 * @example standingOf({ "a.ts": 3 }, { file: "a.ts", now: 4 }) // O.some(Standing.Grew({ now: 4, held: 3 }))
 */
export const standingOf: {
  (at: { readonly file: string; readonly now: number }): (ledger: Ledger) => O.Option<Standing>
  (ledger: Ledger, at: { readonly file: string; readonly now: number }): O.Option<Standing>
} = dual(2, (ledger: Ledger, at: { readonly file: string; readonly now: number }): O.Option<Standing> =>
  O.map(R.get(ledger, at.file), (held): Standing => {
    if (at.now === 0) return Standing.Clean()
    if (at.now > held) return Standing.Grew({ now: at.now, held })
    if (at.now < held) return Standing.Fell({ now: at.now, held })
    return Standing.Holds()
  })
)

/** The files a ledger names, in order. */
export const ledgerFiles = (ledger: Ledger): ReadonlyArray<string> => A.sort(R.keys(ledger), Order.String)

/**
 * What a standing says, as the words after the file's name, for the list named `listName`; none when it holds.
 *
 * @example standingWords(Standing.Clean(), "dualListed") // O.some("is listed in dualListed but breaks the rule no more: take its line off")
 */
export const standingWords: {
  (listName: string): (standing: Standing) => O.Option<string>
  (standing: Standing, listName: string): O.Option<string>
} = dual(2, (standing: Standing, listName: string): O.Option<string> =>
  Standing.$match(standing, {
    Holds: () => O.none(),
    Clean: () => O.some(`is listed in ${listName} but breaks the rule no more: take its line off`),
    Grew: ({ held, now }) =>
      O.some(
        `breaks the rule in ${now} places, more than the ${held} ${listName} holds it to: a listed file may only lose places. Fix the new ones`
      ),
    Fell: ({ held, now }) =>
      O.some(
        `breaks the rule in ${now} places, fewer than the ${held} ${listName} holds it to: lower its number to ${now}`
      )
  })
)

/** Where the ledgers are, from the root. */
export const ledgersFolder = "packages/tooling/tool/cli/ledgers"

/** A ledger as its JSON file holds it: each file with a number of places, one at least. */
const LedgerJson = S.fromJsonString(S.Record(S.String, S.Int.check(S.isGreaterThanOrEqualTo(1))))

/**
 * Reads the ledger at `path` (from the root): the ledger, or a sentence that says why it could not be read.
 *
 * @category rules
 */
export const readLedger = Effect.fn("ledger.readLedger")(function* (path: string) {
  const repo = yield* Repo
  const full = repo.join(repo.root, path)
  if (!(yield* repo.exists(full))) return Result.fail(`${path} is not there: a ban's ledger is a file of its own`)
  const text = yield* repo.text(full)
  return O.match(S.decodeOption(LedgerJson)(text), {
    onNone: () =>
      Result.fail(`${path} is not a ledger: an object of files, each with a number of places, one at least`),
    onSome: (ledger) => Result.succeed<Ledger>(ledger)
  })
})

/** The commit `main` is at: `origin/main`, else `main`; none when neither is there. */
const mainCommit = Effect.fn("ledger.mainCommit")(function* () {
  const repo = yield* Repo
  const asked = yield* Effect.forEach(
    ["origin/main", "main"],
    (ref) => repo.run("git", ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]),
    { concurrency: 1 }
  )
  return A.findFirst(asked, (answer) => answer.code === 0).pipe(O.map((answer) => Str.trim(answer.stdout)))
})

/** One commit, by what git answers for a revision; none when it names none. */
const commitOf = Effect.fn("ledger.commitOf")(function* (revision: string) {
  const repo = yield* Repo
  const answer = yield* repo.run("git", ["rev-parse", "--verify", "--quiet", `${revision}^{commit}`])
  return answer.code === 0 ? O.some(Str.trim(answer.stdout)) : O.none<string>()
})

/**
 * The commit a ledger is compared with: where this branch left main (the merge base of HEAD and main), so a branch
 * cut before main lowered a number is not refused for main's later work; and on the branch `main` itself, the commit
 * before HEAD (its first parent), so a number raised in a push straight to main is seen.
 */
const baseCommit = Effect.fn("ledger.baseCommit")(function* (main: string) {
  const repo = yield* Repo
  const mergeBase = Effect.fn("ledger.mergeBase")(function* (other: string) {
    const merged = yield* repo.run("git", ["merge-base", "HEAD", other])
    return merged.code === 0 ? O.some(Str.trim(merged.stdout)) : O.none<string>()
  })
  const branch = yield* repo.run("git", ["symbolic-ref", "--quiet", "--short", "HEAD"])
  const onMain = branch.code === 0 && Str.trim(branch.stdout) === "main"
  const before = yield* pushBase()
  const pushedFrom = yield* O.match(before, { onNone: () => Effect.succeedNone, onSome: commitOf })
  if (O.isSome(pushedFrom)) return yield* mergeBase(pushedFrom.value)
  if (!onMain) return yield* mergeBase(main)
  const head = yield* commitOf("HEAD")
  // Locally on main: what origin/main holds, when HEAD is ahead of it; else the commit before HEAD.
  return O.exists(head, (commit) => commit === main) ? yield* commitOf("HEAD^1") : yield* mergeBase(main)
})

/**
 * The commit CI names for a push (`LEDGER_BASE`: the last commit of the branch whose run passed, else the push's
 * `before`); none in a pull request's run, locally, or for a push that made the branch (all zeros).
 */
const pushBase = Effect.fn("ledger.pushBase")(function* () {
  const named = yield* Config.String("LEDGER_BASE")
    .pipe(Config.option)
    .parse(ConfigProvider.fromEnv())
    .pipe(Effect.orElseSucceed(() => O.none<string>()))
  return O.filter(named, (commit) => Str.isNonEmpty(commit) && !/^0+$/.test(commit))
})

/**
 * Why the commit CI names for a push cannot be the base, when it cannot: not fetched, or not in HEAD's history (a
 * force push). Then nothing is compared with it, and the law says so rather than taking another base in silence.
 */
const pushBaseProblem = Effect.fn("ledger.pushBaseProblem")(function* (path: string) {
  const repo = yield* Repo
  const named = yield* pushBase()
  if (O.isNone(named)) return O.none<string>()
  const commit = yield* commitOf(named.value)
  if (O.isNone(commit)) {
    return O.some(
      `${path} could not be compared: LEDGER_BASE names ${named.value}, which is not in this checkout. Fetch it, so a number that rose since is seen`
    )
  }
  const ancestor = yield* repo.run("git", ["merge-base", "--is-ancestor", commit.value, "HEAD"])
  return ancestor.code === 0
    ? O.none<string>()
    : O.some(
        `${path} could not be compared: LEDGER_BASE names ${named.value}, which is not in HEAD's history (was the branch pushed with --force?). Compare it by hand against main, and run this again with LEDGER_BASE set to a commit HEAD holds`
      )
})

/** Each file renamed since `base`, by its name now, with the name it had there (git's own finding of a rename). */
const renamedSince = Effect.fn("ledger.renamedSince")(function* (base: string) {
  const repo = yield* Repo
  const answer = yield* repo.run("git", ["diff", "--name-status", "-M", "-z", base])
  const parts = A.filter(Str.split("\0")(answer.stdout), Str.isNonEmpty)
  // Records, read in turn: a status, then one path, or two for a rename (R) or a copy (C), the name it had first.
  const renames: Array<readonly [string, string]> = []
  let at = 0
  while (at < parts.length) {
    const status = O.getOrElse(A.get(parts, at), () => "")
    const two = Str.startsWith("R")(status) || Str.startsWith("C")(status)
    if (two && Str.startsWith("R")(status)) {
      const pair = O.zipWith(A.get(parts, at + 1), A.get(parts, at + 2), (from, to) => [to, from] as const)
      if (O.isSome(pair)) renames.push(pair.value)
    }
    at += two ? 3 : 2
  }
  return R.fromEntries(renames)
})

/**
 * What the ledger at `path`, as it is now (`now`), says against the files there are and against the same ledger on
 * `main`, each as one sentence: an entry for a file that is not there, a file `main` does not list, a number above
 * `main`'s, and why `main` could not be read.
 *
 * @category rules
 */
export const ledgerAgainst = Effect.fn("ledger.ledgerAgainst")(function* (input: {
  readonly path: string
  readonly now: Ledger
  readonly files: ReadonlyArray<string>
}) {
  const repo = yield* Repo
  const missing = A.map(
    A.filter(ledgerFiles(input.now), (file) => !A.contains(input.files, file)),
    (file) =>
      `${file}  is in ${input.path} but is not there: take its line off, so a new file at its path inherits nothing`
  )
  const main = yield* mainCommit()
  if (O.isNone(main)) {
    return A.append(
      missing,
      `${input.path} could not be compared with main: neither origin/main nor main is here. Fetch it (git fetch origin main), so a number that rose is seen`
    )
  }
  const shallow = yield* repo.run("git", ["rev-parse", "--is-shallow-repository"])
  if (Str.trim(shallow.stdout) === "true") {
    return A.append(
      missing,
      `${input.path} could not be compared with main: the checkout is shallow, so where this branch left main may be missing. Fetch main's history (git fetch --unshallow origin main), so a number that rose is seen`
    )
  }
  const unfit = yield* pushBaseProblem(input.path)
  if (O.isSome(unfit)) return A.append(missing, unfit.value)
  const base = yield* baseCommit(main.value)
  // HEAD with no main in its history and no parent of its own: there is nothing to compare with.
  if (O.isNone(base)) return missing
  const shown = yield* repo.run("git", ["show", `${base.value}:${input.path}`])
  // A main with no such ledger yet: the first one comes in whole, and nothing is compared.
  if (shown.code !== 0) return missing
  const before = S.decodeOption(LedgerJson)(shown.stdout)
  if (O.isNone(before)) return A.append(missing, `${input.path} on main is not a ledger, so nothing could be compared`)
  const renamed = yield* renamedSince(base.value)
  const moved = A.flatMap(ledgerFiles(input.now), (file) => {
    const now = O.getOrElse(R.get(input.now, file), () => 0)
    // A file renamed since then is held at what main held it under its old name.
    const was = O.getOrElse(R.get(renamed, file), () => file)
    return O.match(R.get(before.value, was), {
      onNone: () => [`${file}  is in ${input.path} but not on main: a ledger only loses files. Fix the file instead`],
      onSome: (held) =>
        now > held
          ? [`${file}  is held at ${now} in ${input.path}, above the ${held} main holds it to: a number only falls`]
          : []
    })
  })
  return A.appendAll(missing, moved)
})
