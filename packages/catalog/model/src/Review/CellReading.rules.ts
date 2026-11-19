// How one cell of a file is read: a cost, a count, a day, a size, the vendors, the tags, and the other readings a
// cell may have. These keep their trims and case changes on purpose: here a trimmed or re-cased value is a proposal
// the person sees as before and after, never a silent decode.
/**
 * A cost written as plain digits ("12.33", "9.3", "4") as the decimal string an item stores, read from the digits and
 * never through a float: leading zeros and trailing decimal zeros dropped, so "012.50" and "12.5" are one cost. None
 * for anything else: a "$", a comma, a sign, a word or a fifth decimal is the review's to ask about.
 *
 * @example readDecimal("12.50") // O.some("12.5")
 * @example readDecimal("35,82") // O.none()
 */
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as O from "effect/Option"
import * as Str from "effect/String"
import {
  UnitCost,
  isoDate,
  categories,
  uoms,
  Dimensions,
  Vendor,
  ItemFields,
  costDigits,
  isActive,
  discontinuedOn
} from "@inventory/catalog-contract/Item"
import * as S from "effect/Schema"
import { Field } from "@inventory/catalog-contract/Staged"
export const readDecimal = (text: string): O.Option<string> => {
  const parts = /^(\d{1,12})(?:\.(\d{1,4}))?$/.exec(Str.trim(text))
  if (parts === null) return O.none()
  const whole = Str.replace(/^0+(?=\d)/, "")(parts[1] ?? "0")
  const fraction = Str.replace(/0+$/, "")(parts[2] ?? "")
  return O.some(fraction === "" ? whole : `${whole}.${fraction}`)
}

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
export const readDate = (text: string): O.Option<string> => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(Str.trim(text))
  if (parts === null) return O.none()
  return isoDate({ year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) })
}

/** Whether the text is one of the listed categories, exactly as listed. */
export const isCategory = (text: string): boolean => A.contains(categories as ReadonlyArray<string>, text)
/** Whether the text is one of the listed units of measure, exactly as listed. */
export const isUom = (text: string): boolean => A.contains(uoms as ReadonlyArray<string>, text)

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

// The dimensions cell as the file writes it: JSON with the brief's own keys. Each measurement may be missing here, so
// the review can say which one is, instead of only "not readable".
const DimensionsCell = S.fromJsonString(
  S.Struct({
    length: S.optionalKey(S.Finite),
    width: S.optionalKey(S.Finite),
    height: S.optionalKey(S.Finite),
    unit: S.optionalKey(S.String)
  })
)
const decodeDimensions = S.decodeUnknownOption(DimensionsCell)
const encodeDimensions = S.encodeOption(DimensionsCell)

// One vendor as the file writes it, in the brief's own keys. A cost is a JSON number there, or the same digits in
// quotes ("7.50"): both are read from the digits by `readDecimal`, so a quoted cost is not a cell "cut off".
const VendorCell = S.Struct({
  vendor_name: S.optionalKey(S.String),
  vendor_sku: S.String.pipe(S.NullOr, S.optionalKey),
  unit_cost: S.optionalKey(S.Union([S.Finite, S.String])),
  lead_time_days: S.Finite.pipe(S.NullOr, S.optionalKey),
  is_preferred: S.optionalKey(S.Boolean)
})
const VendorsCell = VendorCell.pipe(S.Array, S.fromJsonString)
const decodeVendors = S.decodeUnknownOption(VendorsCell)
const encodeVendors = S.encodeOption(VendorsCell)

/** A value of a cell that holds JSON: read, or the sentence that says what is wrong with it. */
type Read<A> = { readonly _tag: "ok"; readonly value: A } | { readonly _tag: "bad"; readonly message: string }
const ok = <A>(value: A): Read<A> => ({ _tag: "ok", value })
const bad = <A>(message: string): Read<A> => ({ _tag: "bad", message })

/**
 * The dimensions a cell holds: none for an empty cell, the three measurements and their unit, or what is wrong, in a
 * sentence that names the missing measurement.
 *
 * @example readDimensions('{"length":31.2,"width":41.4,"unit":"cm"}') // bad: "Dimensions has no height. ..."
 */
export const readDimensions = (text: string): Read<Dimensions | null> => {
  if (Str.trim(text) === "") return ok(null)
  const cell = decodeDimensions(text)
  if (O.isNone(cell)) {
    return bad("Dimensions cannot be read: the cell is cut off or is not length, width, height and unit.")
  }
  const { length, width, height, unit } = cell.value
  const missing = A.getSomes([
    length === undefined ? O.some("length") : O.none(),
    width === undefined ? O.some("width") : O.none(),
    height === undefined ? O.some("height") : O.none()
  ])
  if (length === undefined || width === undefined || height === undefined) {
    return bad(`Dimensions has no ${A.join(missing, " and no ")}. Give all three measurements together, or none.`)
  }
  if (length <= 0 || width <= 0 || height <= 0) return bad("Dimensions has a measurement that is not above zero.")
  if (unit !== undefined && unit !== "cm" && unit !== "in")
    return bad(`Dimensions has the unit "${unit}", not cm or in.`)
  return ok({ length, width, height, unit: unit === "in" ? "in" : "cm" })
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
    const name = Str.trim(vendor.vendor_name ?? "")
    if (name === "") return bad(`${place} has no name.`)
    if (vendor.unit_cost === undefined) return bad(`${place} (${name}) has no unit cost.`)
    const cost = readUnitCost(`${vendor.unit_cost}`)
    if (O.isNone(cost)) {
      return bad(`${place} (${name}) has the unit cost ${vendor.unit_cost}, not 0 or more with up to 4 decimals.`)
    }
    const lead = vendor.lead_time_days ?? null
    if (lead !== null && (!Number.isInteger(lead) || lead < 0)) {
      return bad(`${place} (${name}) has the lead time ${lead}, not a whole number of days.`)
    }
    return ok({
      vendorName: name,
      vendorSku: O.fromNullishOr(vendor.vendor_sku),
      unitCost: cost.value,
      leadTimeDays: O.fromNullOr(lead),
      isPreferred: vendor.is_preferred === true
    })
  })
  const wrong = A.findFirst(read, (entry) => entry._tag === "bad")
  if (O.isSome(wrong) && wrong.value._tag === "bad") return bad(wrong.value.message)
  return ok(A.flatMap(read, (entry) => (entry._tag === "ok" ? [entry.value] : [])))
}

/** The vendors cell again with only the vendor at `keep` preferred: one reading of a cell that marks several. */
export const withPreferred = (input: { readonly text: string; readonly keep: number }): O.Option<string> =>
  O.flatMap(decodeVendors(input.text), (cell) =>
    encodeVendors(A.map(cell, (vendor, index) => ({ ...vendor, is_preferred: index === input.keep })))
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
  description: O.getOrElse(item.description, () => ""),
  category: item.category,
  uom: item.uom,
  unitCost: costDigits(item.unitCost),
  quantityOnHand: `${item.quantityOnHand}`,
  reorderPoint: O.match(item.reorderPoint, { onNone: () => "", onSome: (point) => `${point}` }),
  isActive: `${isActive(item.stocking)}`,
  lotTracked: `${item.lotTracked}`,
  tags: A.join(item.tags, "|"),
  firstReceivedOn: O.getOrElse(item.firstReceivedOn, () => ""),
  discontinuedOn: O.getOrElse(discontinuedOn(item.stocking), () => ""),
  dimensions: O.getOrElse(O.flatMap(item.dimensions, encodeDimensions), () => ""),
  vendors:
    item.vendors.length === 0
      ? ""
      : O.getOrElse(
          encodeVendors(
            A.map(item.vendors, (vendor) => ({
              vendor_name: vendor.vendorName,
              ...O.match(vendor.vendorSku, { onNone: () => ({}), onSome: (vendor_sku) => ({ vendor_sku }) }),
              unit_cost: Number(costDigits(vendor.unitCost)),
              ...O.match(vendor.leadTimeDays, {
                onNone: () => ({}),
                onSome: (lead_time_days) => ({ lead_time_days })
              }),
              is_preferred: vendor.isPreferred
            }))
          ),
          () => ""
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
  const numeric = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/.exec(trimmed)
  if (numeric !== null) {
    const a = Number(numeric[1])
    const b = Number(numeric[2])
    const year = fullYear(numeric[3] ?? "")
    return {
      dayFirst: isoDate({ year, month: b, day: a }),
      monthFirst: a === b ? O.none() : isoDate({ year, month: a, day: b })
    }
  }
  const dayMonth = /^(\d{1,2})[\s-]+([a-z]+)\.?,?[\s-]+(\d{4})$/i.exec(trimmed)
  if (dayMonth !== null) {
    const day = isoDate({ year: Number(dayMonth[3]), month: monthOf(dayMonth[2] ?? ""), day: Number(dayMonth[1]) })
    return { dayFirst: day, monthFirst: O.none() }
  }
  const monthDay = /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/i.exec(trimmed)
  if (monthDay !== null) {
    const day = isoDate({ year: Number(monthDay[3]), month: monthOf(monthDay[1] ?? ""), day: Number(monthDay[2]) })
    return { dayFirst: day, monthFirst: O.none() }
  }
  return { dayFirst: O.none(), monthFirst: O.none() }
}

/** True for a date in numbers whose year has two digits ("13/04/98"): which century it means is a guess. */
export const twoDigitYear = (text: string): boolean => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2}$/.test(Str.trim(text))

/** Digits grouped in thousands by commas, with a point for decimals: "1,250" or "12,000.5". */
export const thousandsComma = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/
/** One comma between digits: "35,82" or "2,5". */
export const decimalComma = /^\d+,\d+$/
