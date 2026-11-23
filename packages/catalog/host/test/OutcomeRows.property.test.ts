// What a confirm stores for each item of the file, and what the result reads back from it. Every plan the review can
// make is written: a row that is left out or already there with its reason, only a left-out row saying who left it
// out, and a row whose item was written with no reason and nobody. What is stored is read back as any version of the
// app wrote it, so a past import's result and its download of left-out rows still open.
import { describe, expect, it } from "@effect/vitest"
import { DecidedBy, maxReason, outcomeReasonOf, RowOutcome } from "@inventory/catalog-contract/Import"
import {
  OutcomeInsert,
  OutcomeRow,
  outcomeInsertOf,
  Part,
  clipped,
  StoredReason,
  RowNumber,
  storedOutcome
} from "@inventory/catalog-host/ImportRows"
import { maxSaid } from "@inventory/catalog-model/CellReading"
import { PlannedRow } from "@inventory/catalog-model/Confirm"
import { DisplayName } from "@inventory/kernel/Text"
import * as A from "effect/Array"
import * as Arbitrary from "effect/Arbitrary"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 300 } }

/**
 * A row of `importOutcome` as any version of the app may have written it: the table's own columns and checks, with a
 * reason of any form the result reads whole (a longer one is the last property's), and who decided and their name in
 * any combination the columns allow, drawn as Options and written as the columns hold them (`NULL` for none).
 */
const StoredByAnyVersion = S.Struct({
  rowNumber: RowNumber,
  part: Part,
  sku: S.String,
  name: S.String,
  outcome: S.Literals(["created", "updated", "already", "notImported", "takenBack"]),
  reason: S.Union([S.Literal(""), S.Literal("  "), S.String.check(S.isMaxLength(maxReason))]),
  decidedBy: S.OptionFromNullOr(S.Literals(["person", "nobody"])),
  decidedByName: S.OptionFromNullOr(S.Union([DisplayName, S.Literal(""), S.Literal(" "), S.String]))
})

/**
 * A name a person can read, as the result shows one: some character that is not a space, and at most 200. Written by
 * hand on purpose: it is the oracle for `DisplayName`, which the read under test uses, so it does not call it.
 */
const readable = (name: string): boolean => /\S/.test(name) && name.length <= 200

describe("the outcome rows a confirm stores", () => {
  it.effect.prop(
    "every planned row is written, with a reason exactly when its item is not, and a name exactly when a person left it out",
    [Arbitrary.schema(PlannedRow)],
    ([plan]) =>
      Effect.gen(function* () {
        const row = yield* S.encodeEffect(OutcomeInsert)(outcomeInsertOf(plan))
        expect([row.rowNumber, row.part, row.sku, row.name]).toEqual([plan.rowNumber, plan.part, plan.sku, plan.name])
        PlannedRow.match(plan, {
          ready: () => expect([row.status, row.reason, row.decidedBy]).toEqual(["ready", "", null]),
          update: () => expect([row.status, row.reason, row.decidedBy]).toEqual(["update", "", null]),
          already: (already) =>
            expect([row.status, row.reason, row.decidedBy]).toEqual(["already", already.reason, null]),
          notImported: (out) =>
            expect([row.status, row.reason, row.decidedBy, row.decidedByName]).toEqual([
              "notImported",
              out.reason,
              out.decidedBy.kind,
              DecidedBy.guards.person(out.decidedBy) ? out.decidedBy.name : null
            ])
        })
      }),
    runs
  )

  it.effect.prop(
    "a stored row of any version is read: its outcome and reason as stored, and a person named only by a name one can read",
    [Arbitrary.schema(StoredByAnyVersion)],
    ([stored]) =>
      Effect.gen(function* () {
        const columns = yield* S.encodeEffect(StoredByAnyVersion)(stored)
        const read = yield* S.decodeEffect(OutcomeRow)(columns)
        const shown = storedOutcome(read)
        expect([shown.outcome, shown.rowNumber, shown.sku, shown.name]).toEqual([
          stored.outcome,
          stored.rowNumber,
          stored.sku,
          stored.name
        ])
        expect(shown.part).toEqual(stored.part === 0 ? O.none() : O.some(stored.part))
        const hasReason = stored.outcome === "already" || stored.outcome === "notImported"
        expect(outcomeReasonOf(shown)).toEqual(hasReason ? O.some(stored.reason) : O.none())
        if (RowOutcome.guards.notImported(shown)) {
          const named = DecidedBy.guards.person(shown.decidedBy) ? O.some(shown.decidedBy.name) : O.none()
          const byAPerson = O.filter(stored.decidedBy, (who) => who === "person")
          expect(named).toEqual(O.flatMap(byAPerson, () => O.filter(stored.decidedByName, readable)))
        }
      }),
    runs
  )
})

// A long stored reason, as a version that quoted whole cells wrote it: one problem after another, in the sentences
// such a version wrote, written out here from them by hand: each field's label with the words it took after its
// cell. A quoted problem is one of those sentences with its cell in quotes; a named one names a vendor without
// quotes, and is never shortened. A cell is one to three pieces, each many times. A plain piece holds no quote: a
// character of one or two UTF-16 units, or text that starts with a space or a stop. A quoting piece holds a quote of
// the cell's own, as such a version wrote it: an inch mark, a quote inside or opening a word, a stop and a capital
// before one, or text that reads like the end of one sentence and the start of the next, or like a whole sentence.
const plainPieces = ["x", "é", "😀", " x", ".5", ", x", "; x", ": x", ")x", ". Grey", "x. Tags "] as const
const quotingPieces = [
  '12" ',
  'a"b',
  ' "w',
  '("',
  'pipe. Size 3/4" ',
  '. Tags " ',
  '. Name " ',
  '" is not one of ',
  '" has spaces around it. ',
  '" is below zero. Tags " B',
  '" has spaces around it. Name " ',
  '" is not one of the 5 categories. Category " ',
  '12" has spaces around it. ',
  '" has spaces around it. Category " B" is not one of the 5 categories. ',
  '. SKU " '
] as const
const pastSentences = {
  skuSpaces: ["SKU", " has spaces around it."],
  skuForm: ["SKU", " is not three capital letters, a hyphen and four digits, like BLT-0042."],
  nameSpaces: ["Name", " has spaces around it."],
  category: ["Category", " is not one of the 5 categories."],
  unit: ["Unit of measure", " is not one of EA, KG, M."],
  costBelowZero: ["Unit cost", " is below zero. A cost is 0 or more."],
  costDecimals: ["Unit cost", " has more than 4 decimals."],
  costDigits: ["Unit cost", " is not an amount in dollars written as digits."],
  quantityWhole: ["Quantity on hand", " is not a whole number."],
  quantityDigits: ["Quantity on hand", " is not a whole number written as digits."],
  reorderBelowZero: ["Reorder point", " is below zero."],
  active: ["Active", " is not true or false."],
  lotTracked: ["Lot tracked", " is not true or false."],
  tags: ["Tags", " are not lower case, each once."],
  receivedDay: ["First received", " is not a day on the calendar."],
  receivedDayWritten: ["First received", " is not a day on the calendar, written year-month-day."],
  discontinuedWritten: ["Discontinued on", " is not written as year-month-day."],
  dimensions: ["Dimensions has the unit", ", not cm or in."],
  unknown: ["Category", " is not a known category."]
} as const
const knownSentences = [
  "skuSpaces",
  "skuForm",
  "nameSpaces",
  "category",
  "unit",
  "costBelowZero",
  "costDecimals",
  "costDigits",
  "quantityWhole",
  "quantityDigits",
  "reorderBelowZero",
  "active",
  "lotTracked",
  "tags",
  "receivedDay",
  "receivedDayWritten",
  "discontinuedWritten",
  "dimensions"
] as const
const plainVendors = ["Acme", "Beta. Ltd", "Steel. Name"] as const
const quotingVendors = ['Acme "Big" Co', 'O"Neil. Grey "x'] as const
const vendorSentences = {
  noCost: ") has no unit cost.",
  belowZero: ") has the unit cost -1, not 0 or more with up to 4 decimals.",
  twoPreferred: ", Beta). An item has at most one."
} as const

const cellOf = <P extends string>(pieces: ReadonlyArray<P>) =>
  S.Array(
    S.Struct({ piece: S.Literals(pieces), times: S.Int.check(S.isBetween({ minimum: 1, maximum: 2000 })) })
  ).check(S.isMinLength(1), S.isMaxLength(3))
const vendorSentence = S.Literals(["noCost", "belowZero", "twoPreferred"])
/** Past reasons whose only quotes are their cells': each opens a cell after a label or closes it before its words. */
const PlainProblem = S.Union([
  S.Struct({ kind: S.tag("quoted"), sentence: S.Literals(knownSentences), cell: cellOf(plainPieces) }),
  S.Struct({ kind: S.tag("named"), vendor: S.Literals(plainVendors), sentence: vendorSentence })
]).pipe(S.toTaggedUnion("kind"))
/** Past reasons of any form: quotes inside cells and in vendors' names, and a sentence no version wrote. */
const AnyProblem = S.Union([
  S.Struct({
    kind: S.tag("quoted"),
    sentence: S.Literals([...knownSentences, "unknown"]),
    cell: cellOf([...plainPieces, ...quotingPieces])
  }),
  S.Struct({ kind: S.tag("named"), vendor: S.Literals([...plainVendors, ...quotingVendors]), sentence: vendorSentence })
]).pipe(S.toTaggedUnion("kind"))
type AnyProblem = typeof AnyProblem.Type

const Unquoted = S.Struct({
  character: S.Literals(["x", "é", "😀"]),
  times: S.Int.check(S.isBetween({ minimum: 4001, maximum: 6000 }))
})

const readReason = S.decodeEffect(StoredReason)
const thousands = new Intl.NumberFormat("en-US")

/** As many whole copies of `character` as fit in `units` UTF-16 units. */
const copiesWithin: {
  (units: number): (character: string) => string
  (character: string, units: number): string
} = dual(2, (character: string, units: number): string => Str.repeat(Math.floor(units / character.length))(character))

/** The whole characters from the start that fit in `units` UTF-16 units, worked out character by character. */
const firstUnits: {
  (units: number): (text: string) => string
  (text: string, units: number): string
} = dual(
  2,
  (text: string, units: number): string =>
    A.reduce(A.fromIterable(text), { kept: "", full: false }, (cut, character) =>
      cut.full || cut.kept.length + character.length > units
        ? { kept: cut.kept, full: true }
        : { kept: `${cut.kept}${character}`, full: false }
    ).kept
)

/** A cell as the review says one: whole, or its first 80 units, "…" and its length. */
const saidByHand = (cell: string): string =>
  cell.length > maxSaid ? `"${firstUnits(cell, maxSaid)}…" (${thousands.format(cell.length)} characters)` : `"${cell}"`

/** A problem as a past version wrote it, its cell whole or said as the review says one. */
const written = (problem: AnyProblem, cut: boolean): string =>
  AnyProblem.match(problem, {
    quoted: (quoted) => {
      const cell = A.join(
        A.map(quoted.cell, (part) => Str.repeat(part.times)(part.piece)),
        ""
      )
      const [label, after] = pastSentences[quoted.sentence]
      return `${label} ${cut ? saidByHand(cell) : `"${cell}"`}${after}`
    },
    named: (named) =>
      named.sentence === "twoPreferred"
        ? `2 vendors are marked preferred (${named.vendor}${vendorSentences[named.sentence]}`
        : `Vendor ${named.sentence === "noCost" ? 1 : 2} (${named.vendor}${vendorSentences[named.sentence]}`
  })
const reasonOf = (problems: ReadonlyArray<AnyProblem>, cut: boolean): string =>
  A.join(
    A.map(problems, (problem) => written(problem, cut)),
    " "
  )

// The pairing read before, kept as the oracle a new reading must never fall below: quotes paired by where they stand,
// a cell running to the last closing quote before the next quote that only opens.
const pairing = /(?<=^|[\s(])"((?:(?!(?<=[\s(])"(?![\s.,;:)]|$))[\s\S])*)"(?=[\s.,;:)]|$)/

/** A reason read with its cells where `separator` puts them, each said, and cut; one that fits reads as it is. */
const readAt: {
  (separator: string | RegExp): (reason: string) => string
  (reason: string, separator: string | RegExp): string
} = dual(2, (reason: string, separator: string | RegExp): string =>
  reason.length <= maxReason
    ? reason
    : clipped(
        A.join(
          A.map(Str.split(reason, separator), (part, index) => (index % 2 === 1 ? saidByHand(part) : part)),
          ""
        ),
        maxReason
      )
)

/**
 * Every place in the reason whose character a reading shows, in a cell or out of one, quotes aside: a part of the
 * split starts after the parts before it and one quote for each, a cell shows its first characters after its opening
 * quote, and nothing past the cut is shown.
 */
const shownAt: {
  (separator: string | RegExp): (reason: string) => ReadonlyArray<number>
  (reason: string, separator: string | RegExp): ReadonlyArray<number>
} = dual(2, (reason: string, separator: string | RegExp): ReadonlyArray<number> => {
  const parts = Str.split(reason, separator)
  const shown = A.map(parts, (part, index) => (index % 2 === 1 ? saidByHand(part) : part))
  const whole = A.join(shown, "")
  const reach = whole.length <= maxReason ? whole.length : clipped(whole, maxReason).length - 1
  const inReason = A.scan(parts, 0, (at, part) => at + part.length + 1)
  const inRead = A.scan(shown, 0, (at, part) => at + part.length)
  return A.flatMap(A.zip(parts, A.zip(inReason, inRead)), ([part, [at, from]], index) => {
    const count =
      index % 2 === 1
        ? Math.min(firstUnits(part, maxSaid).length, reach - from - 1)
        : Math.min(part.length, reach - from)
    return count > 0
      ? A.map(
          A.filter(A.range(0, count - 1), (step) => !Str.startsWith('"', step)(part)),
          (step) => at + step
        )
      : []
  })
})

/** Each field's problem once, as every version wrote a reason: a quoted problem whose label came before is left out. */
const eachFieldOnce = (problems: ReadonlyArray<AnyProblem>): ReadonlyArray<AnyProblem> =>
  A.dedupeWith(problems, (one, other) =>
    AnyProblem.match(one, {
      quoted: (first) =>
        AnyProblem.match(other, {
          quoted: (second) => pastSentences[first.sentence][0] === pastSentences[second.sentence][0],
          named: () => false
        }),
      named: () => false
    })
  )

describe("a stored reason longer than the result reads", () => {
  it.effect.prop(
    "whose every quote opens a cell after a label or closes it before its words, each field named once, keeps every problem's sentence whole, each long cell said",
    [Arbitrary.schema(S.Array(PlainProblem).check(S.isMinLength(1), S.isMaxLength(5)))],
    ([drawn]) =>
      Effect.gen(function* () {
        const problems = eachFieldOnce(drawn)
        const stored = reasonOf(problems, false)
        const read = yield* readReason(stored)
        expect(read).toBe(stored.length <= maxReason ? stored : reasonOf(problems, true))
      }),
    { arbitrary: { runs: 300 } }
  )

  it.effect.prop(
    "of any form, shows every character the reading before it showed",
    [Arbitrary.schema(S.Array(AnyProblem).check(S.isMinLength(1), S.isMaxLength(5)))],
    ([problems]) =>
      Effect.gen(function* () {
        const stored = reasonOf(problems, false)
        const read = yield* readReason(stored)
        const before = readAt(stored, pairing)
        const readShows = HashSet.fromIterable(read === before ? shownAt(stored, pairing) : shownAt(stored, '"'))
        // The read is one of the two readings, and it shows every character of the reason the pairing showed, in a
        // cell or out of one.
        expect([
          read.length <= maxReason,
          read === before || read === readAt(stored, '"'),
          A.filter(shownAt(stored, pairing), (at) => !HashSet.has(readShows, at))
        ]).toEqual([true, true, []])
      }),
    { arbitrary: { runs: 500 } }
  )

  // Each reason here has a cell whose own text reads as sentences, or cells the pairing ran together and said whole:
  // read exactly, a problem the pairing showed would be cut off, a label would be named twice, or a cell would be
  // read with words that only another label takes.
  const x = Str.repeat(5000)("x")
  const longCategory = `Category "${Str.repeat(6000)("y")}" is not one of the 5 categories.`
  it.effect.each([
    `Name " A" has spaces around it. Category " B" is not one of the 5 categories. ${x}. Name " C " has spaces around it. Category "Widgets" is not one of the 5 categories.`,
    `Name " A" has spaces around it. Category  is not one of the 5 categories. ${x}. Name " B " has spaces around it. Category "Widgets" is not one of the 5 categories.`,
    `Name " A" has spaces around it. Category " B" is not one of the 5 categories. ${x}. SKU " C " has spaces around it. Unit of measure "XX" is not one of EA, KG, M.`,
    `Name " A" has spaces around it. ${x}. Name " B " has spaces around it.`,
    `Name " A" has spaces around it. ${Str.repeat(1000)("x")}. Name " B " has spaces around it. ${longCategory}`,
    `Name "${Str.repeat(100)("x")}" is below zero. Tags " y" has spaces around it. ${longCategory}`,
    `Category " ${Str.repeat(3000)("y")}" is not one of the 5 categories. Unit of measure " zz" is not one of EA, KG. Vendor 1 (${Str.repeat(3763)("v")}) has no unit cost. SKU "a" has spaces around it. Name " bb" has spaces around it. Tags " q" are not lower case, each once.`,
    `SKU "a" has spaces around it. First received " ${Str.repeat(3000)("B")}" is not a day on the calendar. ${Str.repeat(3783)("z")}. Category "c" is not one of them. Tags " d" are not lower case, each once. Active " e" is not true or false.`,
    `SKU "${Str.repeat(3000)("A")}" has spaces around it. Name " ${Str.repeat(3000)("B")}" has spaces around it. ${Str.repeat(3720)("z")}. Vendor 1 (Acme) has no unit cost.`
  ])("whose cell reads as sentences, reads as the pairing did: %#", (stored) =>
    Effect.gen(function* () {
      const read = yield* readReason(stored)
      expect(read).toBe(readAt(stored, pairing))
    })
  )

  // Each reason here is cut within a character or two of a cell's edge, where the pairing runs cells together that
  // the exact reading keeps apart: so the exact reading is taken or not on one character, of the cut, of a cell's
  // first characters or of the text between cells. A long run of one character fills the reason up to the cut.
  const atTheCut = (fill: number, unit: string, category: number, tags: string, name: string) =>
    ` ${Str.repeat(fill)("z")}. Unit of measure "${unit}" is not one of the 5 categories. Category "${Str.repeat(category)(" y")}" is not one of EA. Tags "${tags}" are not lower case, each once. Name "${name}" has spaces around it.`
  it.effect.each([atTheCut(3816, "😀", 26, "😀", "(((")])(
    "cut where a character more of it would show past the cut, reads as the pairing did: %#",
    (stored) =>
      Effect.gen(function* () {
        const read = yield* readReason(stored)
        expect(read).toBe(readAt(stored, pairing))
      })
  )
  it.effect.each([
    atTheCut(3724, "(((", 60, "(((", ""),
    atTheCut(3823, "y", 26, "y", " y"),
    atTheCut(3841, " y", 12, " y", "y"),
    `${Str.repeat(3807)("q")}. Unit of measure "😀" is not one of EA. Tags " ${Str.repeat(23)("y")}😀" are not lower case, each once. SKU "(((${Str.repeat(23)("😀")}" has spaces around it. Name " 😀" has spaces around it.`
  ])("cut where it shows all the pairing showed, to the character, is read exactly: %#", (stored) =>
    Effect.gen(function* () {
      const read = yield* readReason(stored)
      expect([read, read === readAt(stored, pairing)]).toEqual([readAt(stored, '"'), false])
    })
  )

  it.effect("whose next cell starts with a space, is read exactly where the pairing ran the two cells into one", () =>
    Effect.gen(function* () {
      const [sku, name] = [Str.repeat(3000)("a"), ` ${Str.repeat(3000)("b")}`]
      const stored = `SKU "${sku}" has spaces around it. Name "${name}" has spaces around it.`
      const read = yield* readReason(stored)
      expect(read).toBe(`SKU ${saidByHand(sku)} has spaces around it. Name ${saidByHand(name)} has spaces around it.`)
    })
  )

  // The bound is wall time, so it is far above what the reading needs (a few milliseconds) and far below what a
  // reading slower than linear took on these reasons (a second or more each, five of them at least 6 s): a loaded CI
  // runner, or a run with nothing warmed up before it, stays inside it.
  it.live("reads the reasons that cost a pairing most, quotes everywhere, in linear time: under 1,000 ms for all", () =>
    Effect.gen(function* () {
      const cell = (piece: string) => Str.repeat(Math.floor(32_767 / piece.length))(piece)
      const reasons = [
        `Category "${cell(' "w')}. A" is not one of the 5 categories.`,
        `Name "${cell('("')}x. A" has spaces around it.`,
        A.join(
          A.map(
            [' "w', '("', ". A", '12" ', ' "w'],
            (piece) => `Category "${cell(piece)}" is not one of the 5 categories.`
          ),
          " "
        ),
        A.join(
          A.makeBy(40, () => `Name "${cell('12" ')}N" has spaces around it.`),
          " "
        ),
        Str.repeat(1_000_000)('"'),
        Str.repeat(10_000)('. Name "')
      ]
      const [took, read] = yield* Effect.timed(
        Effect.forEach(reasons, (reason) => readReason(reason), { concurrency: 1 })
      )
      expect(A.every(read, (reason) => reason.length <= maxReason)).toBe(true)
      expect(Duration.toMillis(took)).toBeLessThan(1000)
    })
  )

  it.effect.prop(
    "with no quoted value to shorten, is cut at its end to the length the result reads",
    [Arbitrary.schema(Unquoted)],
    ([unquoted]) =>
      Effect.gen(function* () {
        const read = yield* readReason(Str.repeat(unquoted.times)(unquoted.character))
        expect(read).toBe(`${copiesWithin(unquoted.character, maxReason - 1)}…`)
      }),
    { arbitrary: { runs: 50 } }
  )
})
