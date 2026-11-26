// How one cell of a file is read: a cost, a count, a day, a size, the vendors, the tags, and the other readings a
// cell may have. These keep their trims and case changes on purpose: here a trimmed or re-cased value is a proposal
// the person sees as before and after, never a silent decode.
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as Data from "effect/Data"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as Str from "effect/String"
import {
  UnitCost,
  isoDate,
  Category,
  Uom,
  Dimensions,
  Vendor,
  ItemFields,
  costDigits,
  isActive,
  discontinuedOn
} from "@inventory/catalog-contract/Item"
import * as S from "effect/Schema"
import { Field } from "@inventory/catalog-contract/Staged"

/**
 * The text of an empty cell, and of a cell its row ends before: a row of a CSV may stop short of the last column, and
 * what it leaves out reads as empty, as a spreadsheet shows it. It is also the text of a value an item leaves out.
 */
export const emptyText = ""

/**
 * The text a pattern's group found, or none for a group the text left out (an optional part, as the decimals of
 * "12"): a regular expression's match holds `undefined` there, read here once as an Option.
 *
 * @example groupAt("12".match(/^(\d+)(?:\.(\d+))?$/)!, 2) // O.none()
 */
const groupAt = (found: RegExpMatchArray, index: number): O.Option<string> => O.fromUndefinedOr(found[index])

/**
 * A value an item may leave out, as the text a file's cell holds: its text, or an empty cell.
 *
 * @example asCellText(O.none()) // ""
 */
const asCellText = (value: O.Option<string>): string => O.match(value, { onNone: () => emptyText, onSome: identity })

/**
 * A cost written as plain digits ("12.33", "9.3", "4") as the decimal string an item stores, read from the digits and
 * never through a float: leading zeros and trailing decimal zeros dropped, so "012.50" and "12.5" are one cost. None
 * for anything else: a "$", a comma, a sign, a word or a fifth decimal is the review's to ask about.
 *
 * @example readDecimal("12.50") // O.some("12.5")
 * @example readDecimal("35,82") // O.none()
 */
export const readDecimal = (text: string): O.Option<string> =>
  O.flatMap(Str.match(/^(\d{1,12})(?:\.(\d{1,4}))?$/)(Str.trim(text)), (parts) =>
    O.map(groupAt(parts, 1), (digits) => {
      const whole = Str.replace(/^0+(?=\d)/, "")(digits)
      const fraction = O.filter(O.map(groupAt(parts, 2), Str.replace(/0+$/, "")), Str.isNonEmpty)
      return O.match(fraction, { onNone: () => whole, onSome: (decimals) => `${whole}.${decimals}` })
    })
  )

/**
 * The cost a cell of digits says, or none: `readDecimal`, as the decimal the item holds.
 *
 * @example readUnitCost("12.50") // O.some(BigDecimal 12.5)
 */
export const readUnitCost = (text: string): O.Option<UnitCost> => O.map(readDecimal(text), BigDecimal.fromStringUnsafe)

/**
 * A whole number written as plain digits ("120"), or none. A comma or a point is never read here: "1,200" and
 * "12.5" are the review's to ask about.
 *
 * @example readCount("120") // O.some(120)
 * @example readCount("12.5") // O.none()
 */
export const readCount = (text: string): O.Option<number> => {
  const trimmed = Str.trim(text)
  return /^\d{1,12}$/.test(trimmed) ? O.some(Number(trimmed)) : O.none()
}

/**
 * A date written as an ISO date ("2026-03-04"), or none. Any other way of writing a date is read by the review, which
 * proposes the ISO date and, when the text has two readings (03/04/2026), asks which one.
 *
 * @example readDate("2026-03-04") // O.some("2026-03-04")
 * @example readDate("03/04/2026") // O.none()
 */
export const readDate = (text: string): O.Option<string> =>
  O.flatMap(Str.match(/^(\d{4})-(\d{2})-(\d{2})$/)(Str.trim(text)), (parts) =>
    O.flatMap(O.all([groupAt(parts, 1), groupAt(parts, 2), groupAt(parts, 3)]), ([year, month, day]) =>
      isoDate({ year: Number(year), month: Number(month), day: Number(day) })
    )
  )

/** Whether the text is one of the listed categories, exactly as listed. */
export const isCategory = S.is(Category)
/** Whether the text is one of the listed units of measure, exactly as listed. */
export const isUom = S.is(Uom)

/** A category as people write it, reduced to the list's own form: lower case, hyphens for spaces and underscores. */
export const categoryKey = (text: string): string => Str.replace(/[\s_]+/g, "-")(Str.toLowerCase(Str.trim(text)))
/** A category without its hyphens and its plural s, so "Finished Good" meets "finished-goods". */
export const categoryStem = (text: string): string => Str.replace(/s$/, "")(Str.replaceAll("-", "")(categoryKey(text)))

const trueWords: ReadonlyArray<string> = ["true", "yes", "y", "1", "t"]
const falseWords: ReadonlyArray<string> = ["false", "no", "n", "0", "f"]

/** "true" or "false" for a word that can only mean one of them ("Yes", "Y", "1", "TRUE"), or none. */
export const booleanWord = (text: string): O.Option<"true" | "false"> => {
  const key = Str.toLowerCase(Str.trim(text))
  return A.contains(trueWords, key)
    ? O.some("true" as const)
    : A.contains(falseWords, key)
      ? O.some("false" as const)
      : O.none()
}

/**
 * Tags as an item stores them, in one cell: split at "|", trimmed, lower case, each once, empty ones dropped.
 *
 * @example canonicalTags("Metal|metal| METAL") // "metal"
 */
export const canonicalTags = (text: string): string =>
  A.join(
    A.dedupe(
      A.filter(
        A.map(Str.split("|")(text), (tag) => Str.toLowerCase(Str.trim(tag))),
        (tag) => tag !== ""
      )
    ),
    "|"
  )

/** The tags a cell lists, split at "|", the empty ones dropped. */
export const tagsOf = (text: string): ReadonlyArray<string> => A.filter(Str.split("|")(text), (tag) => tag !== "")

// The dimensions cell as the file writes it: JSON with the brief's own keys. Each measurement may be missing here, an
// Option once decoded, so the review can say which one is, instead of only "not readable".
const DimensionsCell = S.fromJsonString(
  S.Struct({
    length: S.OptionFromOptionalKey(S.Finite),
    width: S.OptionFromOptionalKey(S.Finite),
    height: S.OptionFromOptionalKey(S.Finite),
    unit: S.OptionFromOptionalKey(S.String)
  })
)
const decodeDimensions = S.decodeUnknownOption(DimensionsCell)
const encodeDimensions = S.encodeOption(DimensionsCell)

// One vendor as the file writes it, in the brief's own keys. A cost is a JSON number there, or the same digits in
// quotes ("7.50"): both are read from the digits by `readDecimal`, so a quoted cost is not a cell "cut off". A name or
// a cost left out is an Option once decoded. A vendor SKU and a lead time keep null apart from a key left out, because
// `withPreferred` gives the cell back as it was written but for the one flag it changes.
const VendorCell = S.Struct({
  vendor_name: S.OptionFromOptionalKey(S.String),
  vendor_sku: S.String.pipe(S.NullOr, S.OptionFromOptionalKey),
  unit_cost: S.OptionFromOptionalKey(S.Union([S.Finite, S.String])),
  lead_time_days: S.Finite.pipe(S.NullOr, S.OptionFromOptionalKey),
  is_preferred: S.OptionFromOptionalKey(S.Boolean)
})
const VendorsCell = VendorCell.pipe(S.Array, S.fromJsonString)
const decodeVendors = S.decodeUnknownOption(VendorsCell)
const encodeVendors = S.encodeOption(VendorsCell)

/** A value of a cell that holds JSON: read (`ok`), or the sentence that says what is wrong with it (`bad`). */
export type Read<A> = Data.TaggedEnum<{
  ok: { readonly value: A }
  bad: { readonly message: string }
}>

/** A value of a cell that holds JSON, read. */
export type ReadOk<A> = Data.TaggedEnum.Value<Read<A>, "ok">

interface ReadOfAny extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: Read<this["A"]>
}

/** The constructors, guards and matcher of `Read`. */
export const Read = Data.taggedEnum<ReadOfAny>()

// Taken out of the enum once: every cell of a file that holds JSON is read through these.
const { bad: makeBad, ok: makeOk } = Read
const isOk = Read.$is("ok")
const ok = <A>(value: A): Read<A> => makeOk({ value })
const bad = <A>(message: string): Read<A> => makeBad({ message })

/**
 * True when a cell was read: its value is there, and no sentence. Read by its case, so the review and the forms tell
 * a reading apart the one way.
 *
 * @example wasRead(readDimensions('{"length":31.2,"width":41.4,"height":2,"unit":"cm"}')) // true
 */
export const wasRead = <A>(read: Read<A>): read is ReadOk<A> => isOk(read)

/** The most characters of a value a sentence says back. A longer one is cut there, and its length said. */
export const maxSaid = 80

/** A count as a sentence says it: "5,000". */
export const wholeNumber = new Intl.NumberFormat("en-US")

/**
 * A value as a sentence says it back, in two parts: the text, whole or cut to its first `maxSaid` characters with
 * "…", and after it how long the whole value is, empty when nothing was cut. A reason names the value without
 * carrying it: a cell of thousands of characters would otherwise make a reason no store can write. Characters are
 * counted as a store counts them (UTF-16 units, as `Schema.isMaxLength` does), and the cut never leaves half of a
 * character that takes two.
 *
 * @example saidParts("BLT-0042") // { text: "BLT-0042", length: "" }
 * @example saidParts("x".repeat(5000)) // { text: "xxxx…xxxx…", length: " (5,000 characters)" }
 */
export const saidParts = (value: string): { readonly text: string; readonly length: string } => {
  if (value.length <= maxSaid) return { text: value, length: "" }
  const head = Str.takeLeft(maxSaid)(value)
  // A character past U+FFFF is two units, the first from D800 to DBFF: one left alone at the cut is dropped.
  const whole = /[\uD800-\uDBFF]$/.test(head) ? Str.takeLeft(maxSaid - 1)(value) : head
  return { text: `${whole}…`, length: ` (${wholeNumber.format(value.length)} characters)` }
}

/**
 * A value in quotes, as a sentence says it back: a long one cut, with its length after the closing quote.
 *
 * @example said("12 boxes") // '"12 boxes"'
 * @example said("x".repeat(5000)) // '"xxxx…xxxx…" (5,000 characters)'
 */
export const said = (value: string): string => {
  const parts = saidParts(value)
  return `"${parts.text}"${parts.length}`
}

/** A value with no quotes around it, as a sentence names a SKU or a vendor: a long one cut, with its length. */
export const named = (value: string): string => {
  const parts = saidParts(value)
  return `${parts.text}${parts.length}`
}

/**
 * The dimensions a cell holds: none for an empty cell, the three measurements and their unit, or what is wrong, in a
 * sentence that names the missing measurement.
 *
 * @example readDimensions('{"length":31.2,"width":41.4,"unit":"cm"}') // bad: "Dimensions has no height. ..."
 */
export const readDimensions = (text: string): Read<O.Option<Dimensions>> => {
  if (Str.trim(text) === "") return ok(O.none())
  const cell = decodeDimensions(text)
  if (O.isNone(cell)) {
    return bad("Dimensions cannot be read: the cell is cut off or is not length, width, height and unit.")
  }
  const { length, width, height, unit } = cell.value
  const measured = O.all({ length, width, height })
  if (O.isNone(measured)) {
    const missing = A.filter(["length", "width", "height"] as const, (key) => O.isNone(cell.value[key]))
    return bad(`Dimensions has no ${A.join(missing, " and no ")}. Give all three measurements together, or none.`)
  }
  const sizes = measured.value
  if (sizes.length <= 0 || sizes.width <= 0 || sizes.height <= 0) {
    return bad("Dimensions has a measurement that is not above zero.")
  }
  // A cell that names no unit is read in centimetres, as before the unit was a column of its own.
  return O.match(unit, {
    onNone: () => ok(O.some({ ...sizes, unit: "cm" as const })),
    onSome: (written) =>
      written === "cm" || written === "in"
        ? ok(O.some({ ...sizes, unit: written }))
        : bad(`Dimensions has the unit ${said(written)}, not cm or in.`)
  })
}

/**
 * The vendors a cell holds: none for an empty cell, up to three with a name and a cost each, or what is wrong, in a
 * sentence. More than one preferred vendor is read here and asked about by the review (`preferredCount`).
 */
export const readVendors = (text: string): Read<ReadonlyArray<Vendor>> => {
  if (Str.trim(text) === "") return ok([])
  const cell = decodeVendors(text)
  if (O.isNone(cell)) return bad("Vendors cannot be read: the cell is cut off or is not a list of vendors.")
  if (cell.value.length > 3) return bad(`Vendors lists ${cell.value.length} vendors. An item has at most 3.`)
  const read = A.map(cell.value, (vendor, index): Read<Vendor> => {
    const place = `Vendor ${index + 1}`
    const given = O.filter(O.map(vendor.vendor_name, Str.trim), Str.isNonEmpty)
    if (O.isNone(given)) return bad(`${place} has no name.`)
    const name = given.value
    const written = vendor.unit_cost
    if (O.isNone(written)) return bad(`${place} (${named(name)}) has no unit cost.`)
    const cost = readUnitCost(`${written.value}`)
    if (O.isNone(cost)) {
      return bad(
        `${place} (${named(name)}) has the unit cost ${named(`${written.value}`)}, not 0 or more with up to 4 decimals.`
      )
    }
    const lead = O.flatMap(vendor.lead_time_days, O.fromNullOr)
    const wrongLead = O.filter(lead, (days) => !Number.isInteger(days) || days < 0)
    if (O.isSome(wrongLead)) {
      return bad(`${place} (${named(name)}) has the lead time ${wrongLead.value}, not a whole number of days.`)
    }
    return ok({
      vendorName: name,
      vendorSku: O.flatMap(vendor.vendor_sku, O.fromNullOr),
      unitCost: cost.value,
      leadTimeDays: lead,
      isPreferred: O.contains(vendor.is_preferred, true)
    })
  })
  const wrong = A.findFirst(read, Read.$match({ ok: () => O.none<string>(), bad: ({ message }) => O.some(message) }))
  if (O.isSome(wrong)) return bad(wrong.value)
  return ok(A.flatMap(read, Read.$match({ ok: ({ value }) => [value], bad: () => [] })))
}

/** The vendors cell again with only the vendor at `keep` preferred: one reading of a cell that marks several. */
export const withPreferred = (input: { readonly text: string; readonly keep: number }): O.Option<string> =>
  O.flatMap(decodeVendors(input.text), (cell) =>
    encodeVendors(A.map(cell, (vendor, index) => ({ ...vendor, is_preferred: O.some(index === input.keep) })))
  )

/**
 * An item's values as the text a file's cells would hold, field by field: what a stored item is compared with a row
 * in, and shown beside it.
 *
 * @example itemText(item).tags // "fragile|imported"
 */
export const itemText = (item: ItemFields): Readonly<Record<Field, string>> => ({
  sku: item.sku,
  name: item.name,
  description: asCellText(item.description),
  category: item.category,
  uom: item.uom,
  unitCost: costDigits(item.unitCost),
  quantityOnHand: `${item.quantityOnHand}`,
  reorderPoint: asCellText(O.map(item.reorderPoint, (point) => `${point}`)),
  isActive: `${isActive(item.stocking)}`,
  lotTracked: `${item.lotTracked}`,
  tags: A.join(item.tags, "|"),
  firstReceivedOn: asCellText(item.firstReceivedOn),
  discontinuedOn: asCellText(discontinuedOn(item.stocking)),
  dimensions: asCellText(
    O.flatMap(item.dimensions, (sizes) =>
      encodeDimensions({
        length: O.some(sizes.length),
        width: O.some(sizes.width),
        height: O.some(sizes.height),
        unit: O.some(sizes.unit)
      })
    )
  ),
  vendors:
    item.vendors.length === 0
      ? emptyText
      : asCellText(
          encodeVendors(
            A.map(item.vendors, (vendor) => ({
              vendor_name: O.some(vendor.vendorName),
              vendor_sku: vendor.vendorSku,
              unit_cost: O.some(Number(costDigits(vendor.unitCost))),
              lead_time_days: vendor.leadTimeDays,
              is_preferred: O.some(vendor.isPreferred)
            }))
          )
        )
})

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]

const monthOf = (word: string): number => {
  const at = A.findFirstIndex(monthNames, (name) => Str.startsWith(name)(Str.toLowerCase(word)))
  return O.isSome(at) && word.length >= 3 ? at.value + 1 : 0
}

const fullYear = (text: string): number => (text.length === 2 ? 2000 + Number(text) : Number(text))

/**
 * The readings of a date written another way than year-month-day: one for "4 Mar 2026", "Jun 19, 2024" or
 * "13/04/2026", two for "03/04/2026" (day first, then month first), none for text that is not a date. A two-digit
 * year is read as 20xx.
 *
 * @example dateReadings("13/04/2026") // { dayFirst: Some("2026-04-13"), monthFirst: None }
 * @example dateReadings("03/04/2026") // { dayFirst: Some("2026-04-03"), monthFirst: Some("2026-03-04") }
 */
export const dateReadings = (
  text: string
): { readonly dayFirst: O.Option<string>; readonly monthFirst: O.Option<string> } => {
  const trimmed = Str.trim(text)
  const numeric = O.flatMap(Str.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/)(trimmed), (parts) =>
    O.all([groupAt(parts, 1), groupAt(parts, 2), groupAt(parts, 3)])
  )
  if (O.isSome(numeric)) {
    const [first, second, yearText] = numeric.value
    const a = Number(first)
    const b = Number(second)
    const year = fullYear(yearText)
    return {
      dayFirst: isoDate({ year, month: b, day: a }),
      monthFirst: a === b ? O.none() : isoDate({ year, month: a, day: b })
    }
  }
  const dayMonth = O.flatMap(Str.match(/^(\d{1,2})[\s-]+([a-z]+)\.?,?[\s-]+(\d{4})$/i)(trimmed), (parts) =>
    O.all([groupAt(parts, 1), groupAt(parts, 2), groupAt(parts, 3)])
  )
  if (O.isSome(dayMonth)) {
    const [day, month, year] = dayMonth.value
    return { dayFirst: isoDate({ year: Number(year), month: monthOf(month), day: Number(day) }), monthFirst: O.none() }
  }
  const monthDay = O.flatMap(Str.match(/^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i)(trimmed), (parts) =>
    O.all([groupAt(parts, 1), groupAt(parts, 2), groupAt(parts, 3)])
  )
  if (O.isSome(monthDay)) {
    const [month, day, year] = monthDay.value
    return { dayFirst: isoDate({ year: Number(year), month: monthOf(month), day: Number(day) }), monthFirst: O.none() }
  }
  return { dayFirst: O.none(), monthFirst: O.none() }
}

/** True for a date in numbers whose year has two digits ("13/04/98"): which century it means is a guess. */
export const twoDigitYear = (text: string): boolean => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2}$/.test(Str.trim(text))

/** Digits grouped in thousands by commas, with a point for decimals: "1,250" or "12,000.5". */
export const thousandsComma = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/
/** One comma between digits: "35,82" or "2,5". */
export const decimalComma = /^\d+,\d+$/
