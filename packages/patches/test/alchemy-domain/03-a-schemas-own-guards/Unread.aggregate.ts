// Five guards the prover cannot answer exactly, each asked by its own command. It has to say so of each: a rule that
// rests on the answer is "not read", never proved. Each was once read wrongly, and a false rule proved by it.
import * as Domain from "@alchemy.run/domain"
import { constFalse, constTrue } from "effect/Function"
import * as S from "effect/Schema"

/** A whole number, said as a check on a union: a check the prover applies to a number only, not to a union. */
export const WholeOrOne = S.Union([S.Finite, S.Literal(1)]).check(S.isInt())

/** A union told by a number. The library finds a case by the text the number turns into; the prover reads text only. */
export const Sized = S.Union([
  S.Struct({ size: S.Literal(1), held: S.Int }),
  S.Struct({ size: S.Literal(2), held: S.Int })
]).pipe(S.toTaggedUnion("size"))

/** The largest number below one. A division JavaScript rounds can be it where the exact quotient is not. */
export const JustBelowOne = S.Literal(0.9999999999999999)

/** A struct with no key: it allows a list, as it allows everything but `null` and `undefined`. */
export const Anything = S.Struct({})

/** A command's guard said yes or no: which command. */
export class Marked extends Domain.Event("Marked", { which: S.String }) {}

/** The guard said the other thing. */
export class NotMarked extends Domain.Rejection("NotMarked", {}) {}

/** Asks a check on a union of a number that need not be whole. */
export class AskUnion extends Domain.Command("AskUnion", {
  input: { markId: S.String, part: S.Finite },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks a union told by a number which case a value is. */
export class AskSize extends Domain.Command("AskSize", {
  input: { markId: S.String, size: S.Literals([1, 2]) },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks a union told by a number whether a value is one of some cases. */
export class AskEither extends Domain.Command("AskEither", {
  input: { markId: S.String, size: S.Literals([1, 2]) },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks whether a division is a literal. */
export class AskShare extends Domain.Command("AskShare", {
  input: { markId: S.String, of: S.Int },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks a struct with no key of a list. */
export class AskList extends Domain.Command("AskList", {
  input: { markId: S.String, list: S.Array(S.Int) },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** The last command whose guard marked it, or none. */
export class Mark extends Domain.Aggregate("Mark", {
  id: S.String,
  state: S.Struct({ which: S.String }),
  initial: { which: "" },
  invariants: {
    // Each is false of the real code: a half is no whole number, size 1 is a case, the rounded quotient is the
    // literal, and a list is allowed. Proving any of them is the fault this file is here to catch.
    NothingIsMarkedByItsUnion: (mark) => mark.which !== "union",
    NothingIsMarkedByItsSize: (mark) => mark.which !== "size",
    NothingIsMarkedByEither: (mark) => mark.which !== "either",
    NothingIsMarkedByItsShare: (mark) => mark.which !== "share",
    NothingIsMarkedByItsList: (mark) => mark.which !== "list"
  },
  commands: [AskUnion, AskSize, AskEither, AskShare, AskList],
  keyOf: (cmd: AskUnion | AskSize | AskEither | AskShare | AskList) => cmd.markId,
  decide: {
    AskUnion: (_mark, cmd) => (S.is(WholeOrOne)(cmd.part) ? NotMarked.make({}) : [Marked.make({ which: "union" })]),
    AskSize: (_mark, cmd) =>
      Sized.matchOrElse({ size: cmd.size, held: 0 }, { 1: constTrue }, constFalse)
        ? [Marked.make({ which: "size" })]
        : NotMarked.make({}),
    AskEither: (_mark, cmd) =>
      Sized.isAnyOf([1])({ size: cmd.size, held: 0 }) ? [Marked.make({ which: "either" })] : NotMarked.make({}),
    AskShare: (_mark, cmd) =>
      S.is(JustBelowOne)(cmd.of / 9007199254740991) ? [Marked.make({ which: "share" })] : NotMarked.make({}),
    AskList: (_mark, cmd) => (S.is(Anything)(cmd.list) ? [Marked.make({ which: "list" })] : NotMarked.make({}))
  },
  evolve: {
    Marked: (_mark, event) => ({ which: event.which })
  }
}) {}
