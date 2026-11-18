// Three kinds of field the contract has many of, each described once: a moment, the name of who did something, and
// the sentence an error carries. Annotation only: all three are plain strings on the wire and nothing is checked
// beyond that, so a stored value written before a rule existed still decodes.
import * as S from "effect/Schema"

/**
 * A moment the server recorded, as text. The server writes every one with `DateTime.formatIso`, so the document
 * says `date-time`; the format is stated, not enforced.
 *
 * @example instant("When the import created the item")
 */
export const instant = (what: string) =>
  S.String.annotate({
    description: `${what}, as an ISO 8601 instant in UTC`,
    format: "date-time",
    examples: ["2026-03-02T09:30:00.000Z"]
  })

/**
 * The name of the member who did something, copied when they did it so the line still reads right after they are
 * renamed or removed. For the screen only: people are told apart by id, and no rule compares this.
 *
 * @example personName("Who confirmed the import")
 */
export const personName = (what: string) =>
  S.String.annotate({
    description: `${what}: the member's name as it was then, for the screen. Not an id`,
    examples: ["Marcus Oyelaran"]
  })

/**
 * The sentence every error of the contract carries. Written for the person, so a screen can show it as it is; it
 * never repeats what the request sent.
 */
export const reasonForPerson = S.String.annotate({
  description: "What happened and what to do, in words for the person. A screen can show it as it is"
})
