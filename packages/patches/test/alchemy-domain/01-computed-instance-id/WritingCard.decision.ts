// @effect-diagnostics newSchemaClass:off
// Writes a card, and makes one mistake on purpose: it writes over a card somebody else wrote, which breaks
// `Card.ACardKeepsItsAuthor`. The card's id is built from two fields of the command, which is what the patch is about.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import { Card, CardWritten } from "./Card.aggregate.ts"

/** Write a card of a board. */
export class WriteCard extends Domain.Command("WriteCard", {
  input: { boardId: S.String, cardId: S.String, by: S.String },
  events: [CardWritten],
  rejects: []
}) {}

/** The decision behind `WriteCard`, keyed by the board and the card together. */
export class WritingCard extends Domain.Decision(WriteCard, {
  reads: { card: Card },
  keyOf: (cmd: WriteCard) => ({ card: `${cmd.boardId}/${cmd.cardId}` }),
  decide: ({ card }, cmd) => [card.record(new CardWritten({ by: cmd.by }))]
}) {}
