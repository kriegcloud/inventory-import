// Guards the prover answers exactly where it once answered wrongly: a class told by its name, a whole number no
// further from nought than 2^53 - 1, a key that must be written, and `Schema.Void`. Every event and rejection here
// is built with `make`, which the prover reads as it reads `new`.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

/** A whole number as `Schema.isInt` means it: `Number.isSafeInteger`. */
export const Whole = S.Finite.check(S.isInt())

/** A pair whose second part may be `undefined` and must still be written. */
export const Pair = S.Struct({ first: S.Int, second: S.UndefinedOr(S.String) })

/** Anything at all. */
export const Whatever = S.Void.annotate({ description: "Anything at all" })

/** A command's guard said yes: which command. */
export class Marked extends Domain.Event("Marked", { which: S.String }) {}

/** A copy was made. */
export class Copied extends Domain.Event("Copied", { of: S.String }) {}

/** A copy was refused. It has the name of the event, and the library tells a class by its name. */
export class NotCopied extends Domain.Rejection("Copied", { of: S.String }) {}

/** The guard said no. */
export class NotMarked extends Domain.Rejection("NotMarked", {}) {}

/** The events of a mark, told by their `_tag`. */
export const MarkEvent = S.Union([Marked, Copied]).pipe(S.toTaggedUnion("_tag"))

/** Asks the event's guard of a rejection with the event's name. */
export class AskName extends Domain.Command("AskName", {
  input: { markId: S.String },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks whether a number past 2^53 - 1 is whole. */
export class AskWhole extends Domain.Command("AskWhole", {
  input: { markId: S.String, part: S.Finite },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks a pair of an object with its second part left out. */
export class AskPair extends Domain.Command("AskPair", {
  input: { markId: S.String, first: S.Int },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** Asks `Schema.Void` of a number. */
export class AskVoid extends Domain.Command("AskVoid", {
  input: { markId: S.String, first: S.Int },
  events: [Marked],
  rejects: [NotMarked]
}) {}

/** The last command whose guard marked it, or none. */
export class Exact extends Domain.Aggregate("Exact", {
  id: S.String,
  state: S.Struct({ which: S.String }),
  initial: { which: "" },
  invariants: {
    // Broken by the real code: the guard of `Copied` says yes to a rejection named "Copied".
    NothingIsMarkedByItsName: (mark) => mark.which !== "name",
    // Kept by the real code: no number past 2^53 - 1 is whole to `isInt`, written out or sent.
    NothingIsMarkedByItsWhole: (mark) => mark.which !== "whole",
    NothingIsMarkedByItsLargeWhole: (mark) => mark.which !== "large",
    // Kept: an object with its second part left out is no pair.
    NothingIsMarkedByItsPair: (mark) => mark.which !== "pair",
    // Kept: `Schema.Void` refuses nothing.
    NothingIsMarkedByItsVoid: (mark) => mark.which !== "void"
  },
  commands: [AskName, AskWhole, AskPair, AskVoid],
  keyOf: (cmd: AskName | AskWhole | AskPair | AskVoid) => cmd.markId,
  decide: {
    AskName: (_mark, cmd) =>
      MarkEvent.guards.Copied(NotCopied.make({ of: cmd.markId }))
        ? [Marked.make({ which: "name" })]
        : NotMarked.make({}),
    AskWhole: (_mark, cmd) =>
      S.is(Whole)(9007199254740992)
        ? [Marked.make({ which: "large" })]
        : S.is(Whole)(cmd.part) && cmd.part > 9007199254740991
          ? [Marked.make({ which: "whole" })]
          : NotMarked.make({}),
    AskPair: (_mark, cmd) => (S.is(Pair)({ first: cmd.first }) ? [Marked.make({ which: "pair" })] : NotMarked.make({})),
    AskVoid: (_mark, cmd) => (S.is(Whatever)(cmd.first) ? NotMarked.make({}) : [Marked.make({ which: "void" })])
  },
  evolve: {
    Marked: (_mark, event) => ({ which: event.which })
  }
}) {}
