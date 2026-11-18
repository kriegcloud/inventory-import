// THE INVENTORY ITEM. What the import brings in and the Items page lists: a SKU (the key a second import is matched
// by), a name, a category and a unit of measure from fixed lists, a unit cost in US dollars, stock numbers, two
// switches, tags, two dates, and two nested values (dimensions and up to three vendors). The one thing not to break:
// every value is read from the text as written (a cost from its digits as a decimal string, never through a float; a
// date only when it has one reading), never through a guess.
import { Array as Arr, Option, Record as Rec, Result, String as Str } from "effect"
import { instant, personName } from "./Described.ts"
import * as S from "effect/Schema"

/** The categories an item may be filed under: the list the category column is checked against. */
export const categories = ["raw-materials", "components", "finished-goods", "packaging", "supplies"] as const
/** A category from the list (`categories`). */
export const Category = S.Literals(categories).annotate({
  description: "The category an item is filed under",
  examples: ["packaging"]
})
/** The decoded value of `Category`. */
export type Category = typeof Category.Type

/** The units of measure an item may be counted in: the list the unit column is checked against. */
export const uoms = ["EA", "BX", "KG", "M", "L"] as const
/** A unit of measure from the list (`uoms`). */
export const Uom = S.Literals(uoms).annotate({
  description: "The unit of measure an item is counted in",
  examples: ["EA"]
})
/** The decoded value of `Uom`. */
export type Uom = typeof Uom.Type

/** The SKU's form: three capital letters, a hyphen, four digits. */
export const skuPattern = /^[A-Z]{3}-[0-9]{4}$/

/** A cost as stored: digits, with up to four decimals, no sign, no exponent. */
export const decimalPattern = /^\d{1,12}(?:\.\d{1,4})?$/

/** The most a stock number may be, so it stays an exact integer in JavaScript and SQLite. */
export const maxCount = 999_999_999_999

/** The longest name an item may have, after trimming. */
export const maxNameLength = 120

const Decimal = S.String.check(S.isPattern(decimalPattern))
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(maxCount))
const IsoDate = S.String.check(S.isPattern(/^\d{4}-\d{2}-\d{2}$/))
const Measure = S.Finite.check(S.isGreaterThan(0))

/** An item's size: all three measurements together, each above zero, in centimetres or inches. */
export const Dimensions = S.Struct({
  length: Measure.annotateKey({ description: "Length, above zero", examples: [78.8] }).annotateKey({
    description: "How long the item is, in `unit`",
    messageMissingKey: "Give the length: an item's three measurements come together."
  }),
  width: Measure.annotate({ description: "Width, above zero", examples: [56.9] }).annotateKey({
    description: "How wide the item is, in `unit`",
    messageMissingKey: "Give the width: an item's three measurements come together."
  }),
  height: Measure.annotate({ description: "Height, above zero", examples: [2.6] }).annotateKey({
    description: "How high the item is, in `unit`",
    messageMissingKey: "Give the height: an item's three measurements come together."
  }),
  unit: S.Literals(["cm", "in"])
    .annotate({ description: "cm or in; cm when the file does not say", examples: ["cm"] })
    .annotateKey({ description: "The unit all three measurements are in: centimetres or inches" })
}).annotate({ identifier: "Dimensions", description: "An item's size: three measurements together and their unit" })
/** The decoded value of `Dimensions`. */
export type Dimensions = typeof Dimensions.Type

/** One vendor an item can be bought from. At most three per item, at most one of them preferred. */
export const Vendor = S.Struct({
  vendorName: S.NonEmptyString.annotate({
    description: "The vendor's name",
    examples: ["Acme Industrial"]
  }).annotateKey({
    description: "Who the item is bought from (the file's `vendor_name`)",
    messageMissingKey: "Give the vendor's name."
  }),
  vendorSku: S.NullOr(S.String)
    .annotateKey({
      description: "The vendor's own code for the item; null for none",
      examples: ["TI-12311"]
    })
    .annotateKey({ description: "The code the vendor sells the item under (the file's `vendor_sku`); null for none" }),
  unitCost: Decimal.annotate({
    description: "The vendor's cost in US dollars, as a decimal string",
    examples: ["7.59"]
  }).annotateKey({
    description: "What one unit costs from this vendor, in US dollars, read from the digits (the file's `unit_cost`)",
    messageMissingKey: "Give the vendor's unit cost."
  }),
  leadTimeDays: S.NullOr(Count)
    .annotate({ description: "Days from order to delivery; null when not given", examples: [54] })
    .annotateKey({
      description: "How many days the vendor takes to deliver (the file's `lead_time_days`); null when not given"
    }),
  isPreferred: S.Boolean.annotate({
    description: "True for the one vendor the item is usually bought from",
    examples: [false]
  }).annotateKey({
    description:
      "Whether this is the vendor the item is usually bought from: at most one per item (the file's `is_preferred`)"
  })
}).annotate({ identifier: "Vendor", description: "One vendor an item can be bought from" })
/** The decoded value of `Vendor`. */
export type Vendor = typeof Vendor.Type

/**
 * What one item needs before it can be stored. A row of the file becomes this only when every value was read without
 * a doubt; the server decodes each row through it again before writing.
 */
export const ItemFields = S.Struct({
  sku: S.String.check(S.isPattern(skuPattern))
    .annotate({
      description: "The item's SKU, unique in its organization: three capitals, a hyphen, four digits",
      examples: ["SHH-9574"]
    })
    .annotateKey({
      description: "The code the item is known by. No two items of one organization share it, and it never changes",
      messageMissingKey: "Give the item's SKU: three capital letters, a hyphen and four digits, like SHH-9574."
    }),
  name: S.NonEmptyString.check(S.isMaxLength(maxNameLength)).annotate({
    description: "The item's name, 1 to 120 characters, trimmed",
    examples: ["Oak Foam Insert"]
  }),
  description: S.NullOr(S.String)
    .annotate({ description: "Free text; null for none", examples: ["Oak foam insert for general use."] })
    .annotateKey({ description: "What the item is, in a sentence or two; null when the file gives none" }),
  category: Category.annotateKey({
    description:
      "What kind of stock the item is: one of raw-materials, components, finished-goods, packaging, supplies",
    messageMissingKey: "Choose the category."
  }),
  uom: Uom.annotateKey({
    description: "The unit the item is counted and costed in: EA (each), BX (box), KG, M or L",
    messageMissingKey: "Choose the unit of measure."
  }),
  unitCost: Decimal.annotate({
    description: "The cost of one unit in US dollars, a decimal string read from the digits, up to 4 decimals",
    examples: ["12.33"]
  }),
  quantityOnHand: Count.annotate({
    description: "How many are in stock; 0 when the file gives none",
    examples: [3845]
  }),
  reorderPoint: S.NullOr(Count)
    .annotate({ description: "The stock level to reorder at; null for none", examples: [402] })
    .annotateKey({ description: "Reorder when the quantity on hand falls to this number; null when nobody set one" }),
  isActive: S.Boolean.annotate({ description: "Whether the item is in use; true when the file does not say" }),
  lotTracked: S.Boolean.annotate({
    description: "Whether stock is tracked by lot; false when the file does not say"
  }),
  tags: S.Array(S.String)
    .annotate({ description: "Lower-case tags, each once", examples: [["fragile"]] })
    .annotateKey({ description: "Words the item is filed under; the file writes them in one cell with | between" }),
  firstReceivedOn: S.NullOr(IsoDate)
    .annotate({ description: "ISO date first received; null for none", examples: ["2019-03-18"] })
    .annotateKey({ description: "The day the item first came into stock, as year-month-day; null when not known" }),
  discontinuedOn: S.NullOr(IsoDate)
    .annotate({
      description: "ISO date discontinued; null for none. An item with one is not active",
      examples: ["2024-06-19"]
    })
    .annotateKey({
      description:
        "The day the item stopped being stocked, as year-month-day; null while it is stocked. With a date, `isActive` must be false"
    }),
  dimensions: S.NullOr(Dimensions)
    .annotate({ description: "The item's size; null for none" })
    .annotateKey({ description: "The item's length, width and height with their unit, all together; null for none" }),
  vendors: S.Array(Vendor).check(S.isMaxLength(3)).annotate({ description: "Up to three vendors" }).annotateKey({
    description: "Who the item can be bought from: up to three, at most one of them preferred; empty for none"
  })
}).annotate({ identifier: "ItemFields", description: "What one item needs before it can be stored" })
/** The decoded value of `ItemFields`: what one item needs before it can be stored. */
export type ItemFields = typeof ItemFields.Type

/** An item as stored for one organization. */
export const StoredItem = S.Struct({
  id: S.String.annotate({ description: "The item's id, given when the import created it" }),
  ...ItemFields.fields,
  createdAt: instant("When the import created the item"),
  createdBy: personName("Who confirmed the import that created the item"),
  revision: S.Int.annotate({
    description:
      "1 as the import created it, one more after each change. An edit names the revision it was made on, and a " +
      "take-back of the import removes only items still at 1",
    examples: [1]
  })
}).annotate({ identifier: "StoredItem", description: "An item as stored for one organization" })
/** The decoded value of `StoredItem`: an item as stored for one organization. */
export type StoredItem = typeof StoredItem.Type

/** The item itself, without what storing it added (id, who, when, revision): what a file's row is compared with. */
export const fieldsOf = (item: StoredItem): ItemFields => {
  const { id: _id, createdAt: _at, createdBy: _by, revision: _revision, ...fields } = item
  return fields
}

/**
 * What a person sends to change one item by hand: the plain values it should have afterwards, and the revision they
 * saw. The SKU is not among them (it is the item's identity), nor are tags, dimensions and vendors, which only an
 * import writes. An edit made on an older revision is refused instead of overwriting a change the person did not see.
 */
export const ItemEdit = S.Struct({
  revision: S.Int.check(S.isGreaterThanOrEqualTo(1))
    .annotate({ description: "The revision the person was looking at when they made the change", examples: [1] })
    .annotateKey({ messageMissingKey: "Send the revision of the item the change was made on." }),
  name: ItemFields.fields.name.annotateKey({ messageMissingKey: "Give the item a name." }),
  description: S.NullOr(S.String.check(S.isMaxLength(32767)))
    .annotate({ description: "Free text about the item; null for none" })
    .annotateKey({ messageMissingKey: "Give a description, or null for none." }),
  category: Category.annotateKey({ messageMissingKey: "Choose the category." }),
  uom: Uom.annotateKey({ messageMissingKey: "Choose the unit of measure." }),
  unitCost: ItemFields.fields.unitCost.annotateKey({ messageMissingKey: "Give the unit cost." }),
  quantityOnHand: ItemFields.fields.quantityOnHand.annotateKey({ messageMissingKey: "Give the quantity on hand." }),
  reorderPoint: ItemFields.fields.reorderPoint.annotateKey({
    messageMissingKey: "Give the reorder point, or null for none."
  }),
  isActive: S.Boolean.annotate({ description: "Whether the item is in use" }).annotateKey({
    messageMissingKey: "Say whether the item is active."
  }),
  lotTracked: S.Boolean.annotate({ description: "Whether stock is tracked by lot" }).annotateKey({
    messageMissingKey: "Say whether the item is lot tracked."
  }),
  firstReceivedOn: ItemFields.fields.firstReceivedOn.annotateKey({
    messageMissingKey: "Give the first received date, or null for none."
  }),
  discontinuedOn: ItemFields.fields.discontinuedOn.annotateKey({
    messageMissingKey: "Give the discontinued date, or null for none."
  })
}).annotate({
  identifier: "ItemEdit",
  description: "The plain values one item should have after an edit, and the revision it was made on"
})
/** The decoded value of `ItemEdit`: what a person sends to change one item. */
export type ItemEdit = typeof ItemEdit.Type

/**
 * What is wrong with an edit that its Schema cannot say, as a sentence for the person, or null when it may be
 * written: a name of only spaces, a date that is not a day on the calendar (2024-13-45), or an item that would be
 * discontinued and active at once. The import refuses the same three, so an edit cannot store what a file could not.
 *
 * @example editProblem({ ...edit, discontinuedOn: "2024-06-19", isActive: true })
 * // "A discontinued item is not active. Clear the discontinued date, or mark the item not active."
 */
export const editProblem = (edit: ItemEdit): string | null => {
  const badDate = (label: string, date: string | null): string | null =>
    date === null || Option.isSome(readDate(date))
      ? null
      : `${label} "${date}" is not a day on the calendar, written year-month-day.`
  if (Str.trim(edit.name) === "") return "Name is empty. Every item needs a name."
  return (
    badDate("First received", edit.firstReceivedOn) ??
    badDate("Discontinued on", edit.discontinuedOn) ??
    (edit.discontinuedOn !== null && edit.isActive
      ? "A discontinued item is not active. Clear the discontinued date, or mark the item not active."
      : null)
  )
}

/**
 * A cost written as plain digits ("12.33", "9.3", "4") as the decimal string an item stores, read from the digits and
 * never through a float: leading zeros and trailing decimal zeros dropped, so "012.50" and "12.5" are one cost. None
 * for anything else: a "$", a comma, a sign, a word or a fifth decimal is the review's to ask about.
 *
 * @example readDecimal("12.50") // Option.some("12.5")
 * @example readDecimal("35,82") // Option.none()
 */
export const readDecimal = (text: string): Option.Option<string> => {
  const parts = /^(\d{1,12})(?:\.(\d{1,4}))?$/.exec(Str.trim(text))
  if (parts === null) return Option.none()
  const whole = Str.replace(/^0+(?=\d)/, "")(parts[1] ?? "0")
  const fraction = Str.replace(/0+$/, "")(parts[2] ?? "")
  return Option.some(fraction === "" ? whole : `${whole}.${fraction}`)
}

/**
 * A cost as ten-thousandths of a dollar, exact, for adding costs up without a float.
 *
 * @example decimalUnits("12.5") // 125000n
 */
export const decimalUnits = (decimal: string): bigint => {
  const [whole = "0", fraction = ""] = Str.split(".")(decimal)
  return BigInt(`${whole}${Str.slice(0, 4)(`${fraction}0000`)}`)
}

/**
 * Ten-thousandths of a dollar as dollars with at least two decimals ("48.6", exact) for a total on screen.
 *
 * @example unitsToDecimal(125000n) // "12.50"
 */
export const unitsToDecimal = (units: bigint): string => {
  const whole = units / 10000n
  const fraction = Str.padStart(4, "0")(`${units % 10000n}`)
  const trimmed = Str.replace(/0{1,2}$/, "")(fraction)
  return `${whole}.${trimmed}`
}

/**
 * A whole number written as plain digits ("120"), or none. A comma or a point is never read here: "1,200" and
 * "12.5" are the review's to ask about.
 *
 * @example readCount("120") // Option.some(120)
 * @example readCount("12.5") // Option.none()
 */
export const readCount = (text: string): Option.Option<number> => {
  const trimmed = Str.trim(text)
  return /^\d{1,12}$/.test(trimmed) ? Option.some(Number(trimmed)) : Option.none()
}

const daysIn = (year: number, month: number): number =>
  month === 2
    ? year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
      ? 29
      : 28
    : Arr.contains([4, 6, 9, 11], month)
      ? 30
      : 31

/**
 * The ISO date for a year, month and day, or none when there is no such day.
 *
 * @example isoDate({ year: 2026, month: 3, day: 4 }) // Option.some("2026-03-04")
 * @example isoDate({ year: 2026, month: 2, day: 30 }) // Option.none()
 */
export const isoDate = (input: { readonly year: number; readonly month: number; readonly day: number }) => {
  const { year, month, day } = input
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) {
    return Option.none<string>()
  }
  return Option.some(`${year}-${Str.padStart(2, "0")(`${month}`)}-${Str.padStart(2, "0")(`${day}`)}`)
}

/**
 * A date written as an ISO date ("2026-03-04"), or none. Any other way of writing a date is read by the review, which
 * proposes the ISO date and, when the text has two readings (03/04/2026), asks which one.
 *
 * @example readDate("2026-03-04") // Option.some("2026-03-04")
 * @example readDate("03/04/2026") // Option.none()
 */
export const readDate = (text: string): Option.Option<string> => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(Str.trim(text))
  if (parts === null) return Option.none()
  return isoDate({ year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) })
}

/** The edit form as the person filled it in: the text of each box, and the choices as they are. */
export type ItemForm = {
  readonly name: string
  readonly description: string
  readonly category: Category
  readonly uom: Uom
  readonly unitCost: string
  readonly quantityOnHand: string
  readonly reorderPoint: string
  readonly isActive: boolean
  readonly lotTracked: boolean
  readonly firstReceivedOn: string
  readonly discontinuedOn: string
}

/** A field of the edit form that can hold a problem, and the sentence that says what to do about it. */
export type ItemFormProblems = Partial<
  Record<
    "name" | "unitCost" | "quantityOnHand" | "reorderPoint" | "firstReceivedOn" | "discontinuedOn" | "isActive",
    string
  >
>

/**
 * Reads the edit form into the values an item is stored with, or every problem in it at once, each a sentence that
 * says what to change. A cost is read from the digits, as an import reads it; empty optional boxes are none.
 *
 * @example readItemForm({ form: { ...form, unitCost: "3.65555" }, revision: 1 })
 * // { _tag: "Problems", problems: { unitCost: "Unit cost is not an amount ..." } }
 */
export const readItemForm = (input: {
  readonly form: ItemForm
  readonly revision: number
}):
  | { readonly _tag: "Edit"; readonly edit: ItemEdit }
  | { readonly _tag: "Problems"; readonly problems: ItemFormProblems } => {
  const { form } = input
  const name = Str.trim(form.name)
  const description = Str.trim(form.description)
  const cost = readDecimal(form.unitCost)
  const optional = <A>(text: string, read: (text: string) => Option.Option<A>): Option.Option<A | null> =>
    Str.trim(text) === "" ? Option.some(null) : read(text)
  const quantity = Str.trim(form.quantityOnHand) === "" ? Option.some(0) : readCount(form.quantityOnHand)
  const reorder = optional(form.reorderPoint, readCount)
  const received = optional(form.firstReceivedOn, readDate)
  const discontinued = optional(form.discontinuedOn, readDate)
  const found: ReadonlyArray<readonly [keyof ItemFormProblems, string | undefined]> = [
    [
      "name",
      name === ""
        ? "Name is empty. Every item needs a name."
        : name.length > maxNameLength
          ? `Name is longer than ${maxNameLength} characters. Shorten it.`
          : undefined
    ],
    [
      "unitCost",
      Option.isNone(cost)
        ? "Unit cost is not an amount in dollars with up to 4 decimals. Write it as digits, for example 12.50."
        : undefined
    ],
    [
      "quantityOnHand",
      Option.isNone(quantity)
        ? "Quantity on hand is not a whole number. Write it as digits, for example 120."
        : undefined
    ],
    [
      "reorderPoint",
      Option.isNone(reorder) ? "Reorder point is not a whole number. Write it as digits, or leave it empty." : undefined
    ],
    [
      "firstReceivedOn",
      Option.isNone(received) ? "First received is not a date. Write it as year, month and day: 2026-03-04." : undefined
    ],
    [
      "discontinuedOn",
      Option.isNone(discontinued)
        ? "Discontinued on is not a date. Write it as year, month and day: 2026-03-04."
        : undefined
    ],
    [
      "isActive",
      form.isActive && Str.trim(form.discontinuedOn) !== ""
        ? "A discontinued item cannot be active. Switch Active off, or clear the discontinued date."
        : undefined
    ]
  ]
  const problems = Arr.filterMap(found, ([field, message]) =>
    message === undefined ? Result.failVoid : Result.succeed([field, message] as const)
  )
  if (Arr.isReadonlyArrayNonEmpty(problems)) return { _tag: "Problems", problems: Rec.fromEntries(problems) }
  return {
    _tag: "Edit",
    edit: {
      revision: input.revision,
      name,
      description: description === "" ? null : description,
      category: form.category,
      uom: form.uom,
      unitCost: Option.getOrElse(cost, () => "0"),
      quantityOnHand: Option.getOrElse(quantity, () => 0),
      reorderPoint: Option.getOrNull(reorder),
      isActive: form.isActive,
      lotTracked: form.lotTracked,
      firstReceivedOn: Option.getOrNull(received),
      discontinuedOn: Option.getOrNull(discontinued)
    }
  }
}

/**
 * The form of a SKU used to decide whether two rows are the same item: no spaces, upper case. "One item per SKU"
 * must hold for `blt-0042 ` and `BLT-0042`, so both the file check and the database's unique index compare this key,
 * never the text as typed.
 *
 * @example skuKey({ sku: "blt-0042 " }) // "BLT-0042"
 */
export const skuKey = (input: { readonly sku: string }): string => Str.toUpperCase(Str.replace(/\s+/g, "")(input.sku))
