// What holds a ban's list of today's files: each file with the number of places in it that break the rule, kept in a
// JSON file of its own under `packages/tooling/tool/cli/ledgers/`. The number may only fall, and that is held by the
// code, not by a review: a file that gains a place is refused, so no new one goes in under a file already listed; a file
// that loses one is refused until its number is lowered, so it cannot gain it back later; a file at none comes off; an
// entry for a file that is not there is refused, so a new file at its path inherits nothing; and the ledger itself is
// compared with the same file on `main` (`origin/main`, else `main`), so a number that rose there or a file added there
// is refused, whatever the same commit wrote. On a branch whose `main` has no such ledger yet, nothing is compared, and
// the law says so.
import * as A from "effect/Array"
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
  const shown = yield* repo.run("git", ["show", `${main.value}:${input.path}`])
  // A main with no such ledger yet: the first one comes in whole, and nothing is compared.
  if (shown.code !== 0) return missing
  const before = S.decodeOption(LedgerJson)(shown.stdout)
  if (O.isNone(before)) return A.append(missing, `${input.path} on main is not a ledger, so nothing could be compared`)
  const moved = A.flatMap(ledgerFiles(input.now), (file) => {
    const now = O.getOrElse(R.get(input.now, file), () => 0)
    return O.match(R.get(before.value, file), {
      onNone: () => [`${file}  is in ${input.path} but not on main: a ledger only loses files. Fix the file instead`],
      onSome: (held) =>
        now > held
          ? [`${file}  is held at ${now} in ${input.path}, above the ${held} main holds it to: a number only falls`]
          : []
    })
  })
  return A.appendAll(missing, moved)
})
