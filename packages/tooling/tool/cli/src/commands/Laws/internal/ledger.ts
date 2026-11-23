// What holds a ban's list of today's files: each file with the number of places in it that break the rule. The
// number may only fall. A file that gains a place is refused, so no new one goes in under a file already listed; a file
// that loses one is refused until its number is lowered, so it cannot gain it back later; a file at none comes off.
import * as A from "effect/Array"
import * as Data from "effect/Data"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"

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
