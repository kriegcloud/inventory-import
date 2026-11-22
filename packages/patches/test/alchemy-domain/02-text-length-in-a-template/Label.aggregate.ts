// @effect-diagnostics newSchemaClass:off
// A label that keeps its text with the text's length written in front of it: the length of a text, turned into text
// inside a template, which is what the patch is about. One rule holds and one is broken on purpose, by the text "x".
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"

/** A label was sealed: its text's length, a colon, its text. */
export class Sealed extends Domain.Event("Sealed", { sealed: S.String }) {}

/** Seal a label with a text. */
export class Seal extends Domain.Command("Seal", {
  input: { labelId: S.String, text: S.String },
  events: [Sealed],
  rejects: []
}) {}

/** One label and what it was last sealed with. */
export class Label extends Domain.Aggregate("Label", {
  id: S.String,
  state: S.Struct({ sealed: S.String }),
  initial: { sealed: "0:" },
  invariants: {
    ALabelIsNeverEmpty: (label) => label.sealed !== "",
    ALabelIsNeverOneX: (label) => label.sealed !== "1:x"
  },
  commands: [Seal],
  keyOf: (cmd) => cmd.labelId,
  decide: {
    Seal: (_label, cmd) => [new Sealed({ sealed: `${cmd.text.length}:${cmd.text}` })]
  },
  evolve: {
    Sealed: (_label, event) => ({ sealed: event.sealed })
  }
}) {}
