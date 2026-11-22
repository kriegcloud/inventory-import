// Which rows of a save that waited are written, and which were decided otherwise since (Benjamin, 2026-11-20: "Hold it,
// show both, ask"). A row that waited (its first save failed, it was kept across a reload, a closed tab kept it) names
// the decisions the sender knows the server may hold of it (`SaveRequest.over`). The one thing not to break: nothing is
// written unasked over what somebody else decided. Such a row is written only while what is stored of it is one of
// those as named, or is the stored decision one of those became, with only what the matches since took from that very
// decision removed. Which stored decision a match took from is read from what it recorded (the revision that decision
// was saved at, which a match never changes and every other save does), never worked out again from the items as they
// are now. A decision a colleague made or last saved since is never the sender's own and never what one she named
// became, whatever it reads, only one she named as it is: a save that sends exactly what is stored changes nothing of
// it but is his decision of the row too. Where the record does not say, the row is not written.
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import {
  type DecidedSince,
  decisionOf,
  hasKeep,
  RowDecision,
  type SavedDecisions,
  StoredChoice
} from "@inventory/catalog-contract/Decision"
import type { MatchTakeBack } from "@inventory/catalog-contract/Import"
import type { ColumnMove, MappingChoice } from "@inventory/catalog-contract/Mapping"
import { type Field, fields } from "@inventory/catalog-contract/Staged"
import { matchedAfter, withoutStaleDecisions } from "./Rematch.rules.ts"

/** For each row that waited, the decisions the server may hold of it; none for no decision. */
export type Over = Readonly<Record<string, ReadonlyArray<O.Option<RowDecision>>>>

/**
 * A save's `over` for the rows it sets or clears, and only those: a key that names no row of the save says nothing about
 * any decision, and is not read.
 *
 * @example overOfSave({ over: { "row-2": [O.none()], "row-9": [O.none()] }, set: { "row-2": decision }, clear: [] }) // { "row-2": [O.none()] }
 */
export const overOfSave = (save: {
  readonly over?: Over
  readonly set: SavedDecisions
  readonly clear: ReadonlyArray<string>
}): Over => {
  const cleared = HashSet.fromIterable(save.clear)
  return R.filter(save.over ?? {}, (_named, rowId) => R.has(save.set, rowId) || HashSet.has(cleared, rowId))
}

const sameDecision = S.toEquivalence(RowDecision)
const nothingSaid = decisionOf()
// A decision that says nothing (a row put back, or one a match took everything of) and no decision are the same.
const said = (decision: O.Option<RowDecision>): RowDecision => O.getOrElse(decision, () => nothingSaid)
const alike = (a: O.Option<RowDecision>, b: O.Option<RowDecision>): boolean => sameDecision(said(a), said(b))

/**
 * What the rows that waited are judged by: the draft's columns, the revision each row was decided on, what is stored
 * with who decided it (`deciders`, member ids) and the revision it was saved at, who last saved it, changed or not
 * (`lastSavedBy`, member ids; none when the row cannot say) and the revision that save was made on (`lastSavedOn`), who
 * sends the save (`sender`), and what each match recorded it took back (`takenBack`), kept for every match after
 * `takenBackFrom` and for none before.
 */
type Judging = {
  readonly choices: ReadonlyArray<MappingChoice>
  readonly moves: ReadonlyArray<ColumnMove>
  readonly madeOn: Readonly<Record<string, number>>
  readonly over: Over
  readonly stored: SavedDecisions
  readonly savedAt: Readonly<Record<string, number>>
  readonly deciders: Readonly<Record<string, string>>
  readonly lastSavedBy: Readonly<Record<string, string>>
  readonly lastSavedOn: Readonly<Record<string, number>>
  readonly sender: string
  readonly takenBack: ReadonlyArray<MatchTakeBack>
  readonly takenBackFrom: number
}

const otherFields = A.filter(fields, (field) => field !== "sku")
const keyOf = (field: string, rowId: string): string => `${field}:${rowId}`

/** A match's take-back of one row's Replace or Keep-stored: the revision it wrote, and which decision it took from. */
type Taken = { readonly at: number; readonly from: O.Option<number> }

// Every take-back of a Replace or Keep-stored on a field other than the SKU, by field and row, with the revision the
// decision it was taken from was saved at: none on an entry stored before that was kept.
const takenByRow = (entries: ReadonlyArray<MatchTakeBack>): Readonly<Record<string, ReadonlyArray<Taken>>> =>
  A.groupBy(
    A.flatMap(entries, (entry) =>
      A.map(entry.rows, (rowId) => ({
        key: keyOf(entry.field, rowId),
        at: entry.revision,
        from: entry.saved === undefined ? O.none<number>() : R.get(entry.saved, rowId)
      }))
    ),
    (one) => one.key
  )

/**
 * Whether what is stored of a row was last saved by somebody else, or by nobody the row can name, on or after the
 * revision the row was made on (`made`): then it is never the sender's, whatever it reads, and the row is not written.
 * "After" includes the revision itself. A save is recorded on the revision the draft was at when it came: one that
 * changed something moved the draft on by one, so a screen at a later revision is from after it; one that changed
 * nothing left the draft where it was, so a screen at that same revision may have been read before it, and the sender
 * never saw that her colleague decided the row. Taking the same revision as after can only name a row that could have
 * been written, and so ask her; taking it as before could write over his decision unasked.
 */
const savedSinceByAnother = (input: Judging, rowId: string, made: number): boolean =>
  R.has(input.stored, rowId) &&
  !O.exists(R.get(input.lastSavedBy, rowId), (by) => by === input.sender) &&
  !O.exists(R.get(input.lastSavedOn, rowId), (on) => on < made)

/** The part a take-back names, by kind and the field it rests on; a Replace or Keep-stored and a keep of one of two by kind alone. */
const partKey = (kind: MatchTakeBack["kind"], field: string): string =>
  kind === "accept" || kind === "undo" ? `${kind}:${field}` : kind

/**
 * The parts a decision lost to the matches (`applied` as it was stored, `left` as they left it), by the key a take-back
 * of each names: the accepts and undone fixes by field, the Replace or Keep-stored, the keep of one of two.
 */
const partsTaken = (applied: RowDecision, left: RowDecision): ReadonlyArray<string> => [
  ...A.map(
    A.filter(applied.accepted, (field) => !A.contains(left.accepted, field)),
    (field) => partKey("accept", field)
  ),
  ...A.map(
    A.filter(applied.reverted, (field) => !A.contains(left.reverted, field)),
    (field) => partKey("undo", field)
  ),
  ...(hasKeep(applied) && !hasKeep(left) ? [partKey("twin", "sku")] : []),
  ...(!StoredChoice.guards.undecided(applied.stored) && StoredChoice.guards.undecided(left.stored)
    ? [partKey("stored", "sku")]
    : [])
]

const sameKeys = (a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean => {
  const one = HashSet.fromIterable(a)
  const other = HashSet.fromIterable(b)
  return HashSet.isSubset(one, other) && HashSet.isSubset(other, one)
}

/**
 * The revision what is stored of a row was saved at, when it can be one of the decisions the sender named: the sender's
 * own, or what the server held when her screen was at the row's revision (`made`; saved at or before it, and not
 * before revisions were kept: 0 says nothing of when). A colleague's decision saved after the row's revision is none of
 * them, whatever it reads, and so is a row with nothing stored.
 */
const namedAsStored = (input: Judging, rowId: string, made: number): O.Option<number> =>
  O.filter(
    R.get(input.savedAt, rowId),
    (saved) => O.exists(R.get(input.deciders, rowId), (by) => by === input.sender) || (saved >= 1 && saved <= made)
  )

/**
 * What a decision named became when it was saved at `saved`: as named, when that is at or before the row's revision
 * (the server held it then); when the sender's own save landed after it, as that save applied it, by the rule a save
 * made on the row's revision applies: what her save did not apply of her own decision is hers too, and is judged from
 * the revision her save was stored at, never from the items as they are now. The Replace or Keep-stored across a match
 * of another field rests on how the row compared with the items then, which is not kept: both readings are hers, kept
 * and taken. Only matches before the save count.
 */
const asSaved = (
  input: Judging,
  row: { readonly rowId: string; readonly made: number; readonly saved: number },
  decision: RowDecision
): ReadonlyArray<RowDecision> => {
  if (row.saved <= row.made) return [decision]
  const before = {
    choices: A.filter(input.choices, (choice) => choice.at < row.saved),
    moves: A.filter(input.moves, (move) => move.at < row.saved)
  }
  const stale = matchedAfter(before)(row.made)
  const moved = A.filter(otherFields, (field) => stale(field))
  const judged = (changed: ReadonlyArray<Field>) =>
    R.get(
      withoutStaleDecisions({
        ...before,
        madeOn: { [row.rowId]: row.made },
        set: { [row.rowId]: decision },
        changed: A.map(changed, (field) => ({ rowId: row.rowId, field }))
      }).applied,
      row.rowId
    )
  return A.getSomes([judged([]), judged(moved)])
}

/**
 * A decision as the matches since `made` left it, the decision stored saved at `saved`: the parts no comparison
 * decides (accepts and undone fixes of a field matched again, and with the SKU matched again every Replace, Keep-stored
 * and keep of one of two) by the rule the match applied, and a Replace or a Keep-stored across a match of another field
 * only where a match after `made` recorded it took that row's back from this very decision. And only when the decision
 * is the one the matches took from, as far as their record tells: every part they recorded taking from the row (by
 * field and kind) is a part of it, and every part the rule takes of it they recorded taking. None when the record does
 * not say: a take-back of the row that does not say it was taken from this decision (an entry stored before that was
 * kept), a match whose take-backs are not kept (at or before `takenBackFrom`), or an entry that names only its first
 * rows and not this one.
 */
const leftByMatches = (
  input: Judging,
  record: {
    readonly taken: Readonly<Record<string, ReadonlyArray<Taken>>>
    readonly partial: ReadonlyArray<MatchTakeBack>
    readonly all: ReadonlyArray<MatchTakeBack>
  },
  row: { readonly rowId: string; readonly made: number; readonly saved: number },
  decision: RowDecision
): O.Option<RowDecision> => {
  const { rowId, made, saved } = row
  const stale = matchedAfter(input)(made)
  const asked = !StoredChoice.guards.undecided(decision.stored) && !stale("sku")
  const moved: ReadonlyArray<Field> = asked ? A.filter(otherFields, (field) => stale(field)) : []
  const after = (field: Field): ReadonlyArray<Taken> =>
    A.filter(
      O.getOrElse(R.get(record.taken, keyOf(field, rowId)), (): ReadonlyArray<Taken> => []),
      (taken) => taken.at > made
    )
  const unsure = A.some(moved, (field) =>
    A.some(after(field), (taken) => !O.exists(taken.from, (from) => from === saved))
  )
  const changed = A.filter(moved, (field) => A.isReadonlyArrayNonEmpty(after(field)))
  const matchesAfter = (field: Field): ReadonlyArray<number> => [
    ...A.map(
      A.filter(input.moves, (move) => move.field === field && move.at > made),
      (move) => move.at
    ),
    ...A.map(
      A.filter(input.choices, (choice) => choice.field === field && choice.at > made),
      (choice) => choice.at
    )
  ]
  // Every match after `takenBackFrom` kept a move (migration 0006 set it to each draft's revision, past every match
  // made before moves were kept), so a match is recorded exactly when it is after it.
  const unknown =
    unsure ||
    (changed.length === 0 &&
      (A.some(moved, (field) => A.some(matchesAfter(field), (at) => at <= input.takenBackFrom)) ||
        A.some(record.partial, (entry) => entry.revision > made && A.contains(moved, entry.field))))
  if (unknown) return O.none()
  const left = R.get(
    withoutStaleDecisions({
      choices: input.choices,
      moves: input.moves,
      madeOn: { [rowId]: made },
      set: { [rowId]: decision },
      changed: A.map(changed, (field) => ({ rowId, field }))
    }).applied,
    rowId
  )
  // The decision the matches took from was this one: each part a match recorded it took from the row is a part of it,
  // and each part the rule takes of it was recorded taken. A part the record does not hold (a match whose take-backs
  // are not kept, an entry that names only its first rows) is not known taken, and the row is not written.
  if (hiddenIn(record.all, rowId, made)) return O.none()
  const recorded = A.map(
    A.filter(record.all, (entry) => entry.revision > made && A.contains(entry.rows, rowId)),
    (entry) => partKey(entry.kind, entry.field)
  )
  return O.filter(left, (after) => sameKeys(partsTaken(decision, after), recorded))
}

/** Whether a match after `made` took something back of the row, as far as its entries name rows. */
const takenAfter = (entries: ReadonlyArray<MatchTakeBack>, rowId: string, made: number): boolean =>
  A.some(entries, (entry) => entry.revision > made && A.contains(entry.rows, rowId))

/** Whether a match after `made` may have taken something back of the row that its entry does not name by row. */
const hiddenIn = (entries: ReadonlyArray<MatchTakeBack>, rowId: string, made: number): boolean =>
  A.some(entries, (entry) => entry.revision > made && entry.count > entry.rows.length && !A.contains(entry.rows, rowId))

/**
 * The rows that waited and were decided otherwise since, each with what is stored of it (none for nothing said): not to
 * be written. A row is written when what is stored of it is one of the decisions it names as named, as somebody saved it
 * and no match took a part of it since, or is already what the save leaves (`left`): the same save sent again after a
 * lost answer finds its own; or when what is stored is the decision one of those became (the one the server held at
 * the row's revision, or the sender's own saved since, as her save applied it) with exactly the parts each match since
 * recorded it took from that decision removed. A decision somebody else last saved on or after the row's revision, even
 * by sending exactly what was stored, is never the sender's and never what one she named became: it is written over
 * only as named or as the save leaves. Nothing here asks the file's review, so it costs the same however many
 * decisions a row names.
 *
 * The limit of the record: a match records which decision it took from (the revision it was saved at) and the field
 * and kind of each part it took, not the part itself. A Replace and a Keep-stored are one kind, so a named Keep-stored
 * and a stored Replace, the match having taken the stored choice of either, read the same: a sender who names the
 * other one is taken at her word. A client that names what its screen held and what it sent never does so.
 *
 * @example
 * // Row 12 waits over no decision; Marcus has left it out since. Row 3's Replace went with the SKU's match: nobody's.
 * decidedSince({ choices, moves, madeOn, over: { "row-12": [O.none()], "row-3": [O.some(replace)] }, stored: { "row-12": out, "row-3": nothing }, savedAt, deciders, sender: "mem_dana", takenBack, takenBackFrom: 0, left })
 * // [{ rowId: "row-12", theirs: O.some(out) }]
 */
export const decidedSince = (
  input: Judging & { readonly left: (rowId: string) => O.Option<RowDecision> }
): ReadonlyArray<DecidedSince> => {
  const kept = A.filter(input.takenBack, (entry) => entry.kind === "stored" && entry.field !== "sku")
  const record = {
    taken: takenByRow(kept),
    partial: A.filter(kept, (entry) => entry.count > entry.rows.length),
    all: input.takenBack
  }
  return A.getSomes(
    A.map(R.toEntries(input.over), ([rowId, named]) => {
      const stored = R.get(input.stored, rowId)
      const made = O.getOrElse(R.get(input.madeOn, rowId), () => 0)
      const theirs = O.some({ rowId, theirs: O.filter(stored, (decision) => !sameDecision(decision, nothingSaid)) })
      // What is stored is as somebody last saved it, no match since having taken a part of it: then, and only then, it
      // is a decision a person made, and can be named as it reads. A save that changed nothing counts: the person who
      // sent it decided the row as it then read.
      const lastSaved = O.isSome(R.get(input.lastSavedBy, rowId)) ? R.get(input.lastSavedOn, rowId) : O.none<number>()
      const since = Math.max(
        made,
        O.getOrElse(R.get(input.savedAt, rowId), () => 0),
        O.getOrElse(lastSaved, () => 0)
      )
      const asItWasSaved = !takenAfter(input.takenBack, rowId, since) && !hiddenIn(input.takenBack, rowId, since)
      const became = (saved: number): boolean =>
        A.some(A.getSomes(named), (one) =>
          A.some(asSaved(input, { rowId, made, saved }, one), (applied) =>
            O.exists(leftByMatches(input, record, { rowId, made: Math.max(made, saved), saved }, applied), (left) =>
              alike(stored, O.some(left))
            )
          )
        )
      // A decision somebody else last saved since the row was made is never the sender's own and never what one she
      // named became, whatever it reads: only as named, or as what her save leaves.
      const known =
        alike(stored, input.left(rowId)) ||
        (asItWasSaved && A.some(named, (one) => alike(stored, one))) ||
        (!savedSinceByAnother(input, rowId, made) && O.exists(namedAsStored(input, rowId, made), became))
      return known ? O.none<DecidedSince>() : theirs
    })
  )
}
