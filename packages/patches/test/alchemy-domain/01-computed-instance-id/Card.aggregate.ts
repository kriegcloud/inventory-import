// @effect-diagnostics newSchemaClass:off
// A card that keeps who wrote it. It has no command of its own: the decision beside it records on it.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

/** A card was written by this person. */
export class CardWritten extends Domain.Event("CardWritten", { by: S.String }) {}

/** One card: who wrote it, or nobody yet. */
export class Card extends Domain.Aggregate("Card", {
  id: S.String,
  state: S.Struct({ by: S.String }),
  initial: { by: "" },
  transitions: {
    ACardKeepsItsAuthor: ({ before, after }) => before.by === "" || after.by === before.by
  },
  events: [CardWritten],
  evolve: {
    CardWritten: (_card, event) => ({ by: event.by })
  }
}) {}
