// THE INVENTORY ITEM. What the import brings in and the Items page lists: a SKU (the key a second import is matched
// by), a name, a category and a unit of measure from fixed lists, a unit cost in US dollars, stock numbers, two
// switches, tags, two dates, and two nested values (dimensions and up to three vendors). The one thing not to break:
// every value is read from the text as written (a cost from its digits as a decimal string, never through a float; a
// date only when it has one reading), never through a guess.
import { Array as Arr, BigDecimal, Option, String as Str, Tuple } from "effect"
import * as S from "effect/Schema"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { personName } from "../internal/Described.ts"
import { ItemId } from "../Catalog.id.ts"
import { Instant } from "@inventory/kernel/Text"
import { nullAsNone } from "@inventory/kernel/Wire"

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

/**
 * A cost in US dollars: a decimal in code, exact, and its shortest digits on the wire and in the database ("12.5",
 * never "12.50"), so two costs that are equal are stored as the same text. Never negative, at most four decimals and
 * twelve whole digits. Decision (C2) of the contexts brief.
 *
 * @example S.decodeSync(UnitCost)("12.50") // BigDecimal 12.5, encoded again as "12.5"
 */
export const UnitCost = S.String.check(S.isPattern(decimalPattern))
  .annotate({ examples: ["12.33"] })
  .pipe(
    S.decodeTo(
      S.BigDecimal.check(
        S.makeFilter((cost: BigDecimal.BigDecimal) => decimalPattern.test(BigDecimal.format(cost)), {
          expected: "a cost of 0 or more with up to 4 decimals and 12 whole digits"
        })
      ),
      SchemaTransformation.transform({
        decode: (digits: string) => BigDecimal.fromStringUnsafe(digits),
        encode: (cost: BigDecimal.BigDecimal) => BigDecimal.format(cost)
      })
    ),
    S.annotate({
      identifier: "UnitCost",
      description: "A cost in US dollars, as a decimal string read from the digits"
    }),
    // The wire side named too: where the document is written from the wire side alone, an unnamed one would be a
    // second, different copy of every schema that holds a cost.
    S.annotateEncoded({
      identifier: "UnitCost",
      description: "A cost in US dollars, as a decimal string read from the digits"
    })
  )
/** The decoded value of `UnitCost`. */
export type UnitCost = typeof UnitCost.Type

/**
 * A cost as its shortest digits: what the wire and the database hold.
 *
 * @example costDigits(BigDecimal.fromStringUnsafe("12.50")) // "12.5"
 */
export const costDigits = (cost: UnitCost): string => BigDecimal.format(cost)
const Count = S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(maxCount))
// A day written year-month-day that is on the calendar: 2024-02-30 and 2024-13-45 have the form and are no day. The
// import reads a file's dates through the same `isoDate`, so an edit cannot store a day a file could not.
// Hoisted: the schema below is evaluated before `isoDate` is defined.
function isCalendarDay(text: string): boolean {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  return (
    parts !== null && Option.isSome(isoDate({ year: Number(parts[1]), month: Number(parts[2]), day: Number(parts[3]) }))
  )
}
const IsoDate = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}$/),
  S.makeFilter((text: string) => isCalendarDay(text), {
    expected: "a day on the calendar, written year-month-day"
  })
)
const Measure = S.Finite.check(S.isGreaterThan(0))

/** An item's size: all three measurements together, each above zero, in centimetres or inches. */
export const Dimensions = S.Struct({
  length: Measure.annotate({ description: "Length, above zero", examples: [78.8] }).annotateKey({
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
  vendorSku: S.String.annotate({
    description: "The vendor's own code for the item; null for none",
    examples: ["TI-12311"]
  }).pipe(
    nullAsNone({ description: "The code the vendor sells the item under (the file's `vendor_sku`); null for none" })
  ),
  unitCost: UnitCost.annotateKey({
    description: "What one unit costs from this vendor, in US dollars, read from the digits (the file's `unit_cost`)",
    messageMissingKey: "Give the vendor's unit cost."
  }),
  leadTimeDays: Count.annotate({
    description: "Days from order to delivery; null when not given",
    examples: [54]
  }).pipe(
    nullAsNone({
      description: "How many days the vendor takes to deliver (the file's `lead_time_days`); null when not given"
    })
  ),
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

/** The three ways an item stands in the stock list. */
export const StockingKind = LiteralKit(["active", "inactive", "discontinued"]).annotate({
  identifier: "StockingKind",
  description: "In use, not in use, or no longer stocked since a day"
})

class Active extends S.Opaque<Active, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("active") }).annotate({ identifier: "Active", description: "The item is in use" })
) {}

class Inactive extends S.Opaque<Inactive, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("inactive") }).annotate({
    identifier: "Inactive",
    description: "The item is not in use, and nobody said it was discontinued"
  })
) {}

class Discontinued extends S.Opaque<Discontinued, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("discontinued"),
    on: IsoDate.annotate({ description: "ISO date discontinued", examples: ["2024-06-19"] }).pipe(
      S.annotateKey({ description: "The day the item stopped being stocked, as year-month-day" })
    )
  }).annotate({ identifier: "Discontinued", description: "The item stopped being stocked on a day; it is not in use" })
) {}

/**
 * Whether an item is in use: active, not active, or discontinued on a day. One value where there were two (an
 * active flag beside a discontinued date), so "discontinued and active" cannot be said: an item with a
 * discontinued date is not active. Stored as the two columns it replaces; `stockingOf` reads them.
 */
export const Stocking = StockingKind.mapMembers(() => Tuple.make(Active, Inactive, Discontinued)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "Stocking", description: "Whether the item is in use, and since when it is not stocked" })
)
/** The decoded value of `Stocking`. */
export type Stocking = typeof Stocking.Type

/** In use. */
export const active: Stocking = Active.make({})
/** Not in use, with no discontinued date. */
export const inactive: Stocking = Inactive.make({})
/** No longer stocked since `on` (year-month-day). */
export const discontinued = (on: string): Stocking => Discontinued.make({ on })

/**
 * The stocking the two stored values say: discontinued when there is a date, else active or not as the flag says.
 *
 * @example stockingOf({ isActive: false, discontinuedOn: Option.some("2024-06-19") }).kind // "discontinued"
 */
export const stockingOf = (stored: {
  readonly isActive: boolean
  readonly discontinuedOn: Option.Option<string>
}): Stocking =>
  Option.match(stored.discontinuedOn, {
    onNone: () => (stored.isActive ? active : inactive),
    onSome: discontinued
  })

/** True when the item is in use. */
export const isActive = (stocking: Stocking): boolean => stocking.kind === "active"

/** The day the item stopped being stocked, when it did. */
export const discontinuedOn = (stocking: Stocking): Option.Option<string> =>
  stocking.kind === "discontinued" ? Option.some(stocking.on) : Option.none()

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
  name: S.NonEmptyString.check(
    S.isMaxLength(maxNameLength),
    // A name of only spaces is no name.
    S.isPattern(/\S/, { expected: "a name with at least one character that is not a space" })
  ).annotateKey({
    description: "The item's name, 1 to 120 characters, trimmed",
    examples: ["Oak Foam Insert"]
  }),
  description: S.String.annotate({
    description: "Free text; null for none",
    examples: ["Oak foam insert for general use."]
  }).pipe(nullAsNone({ description: "What the item is, in a sentence or two; null when the file gives none" })),
  category: Category.annotateKey({
    description:
      "What kind of stock the item is: one of raw-materials, components, finished-goods, packaging, supplies",
    messageMissingKey: "Choose the category."
  }),
  uom: Uom.annotateKey({
    description: "The unit the item is counted and costed in: EA (each), BX (box), KG, M or L",
    messageMissingKey: "Choose the unit of measure."
  }),
  unitCost: UnitCost.annotateKey({
    description: "The cost of one unit in US dollars, a decimal string read from the digits, up to 4 decimals"
  }),
  quantityOnHand: Count.annotateKey({
    description: "How many are in stock; 0 when the file gives none",
    examples: [3845]
  }),
  reorderPoint: Count.annotate({ description: "The stock level to reorder at; null for none", examples: [402] }).pipe(
    nullAsNone({ description: "Reorder when the quantity on hand falls to this number; null when nobody set one" })
  ),
  // Whether the item is in use; active when the file does not say.
  stocking: Stocking,
  lotTracked: S.Boolean.annotateKey({
    description: "Whether stock is tracked by lot; false when the file does not say"
  }),
  tags: S.Array(S.String)
    .annotate({ description: "Lower-case tags, each once", examples: [["fragile"]] })
    .annotateKey({ description: "Words the item is filed under; the file writes them in one cell with | between" }),
  firstReceivedOn: IsoDate.annotate({
    description: "ISO date first received; null for none",
    examples: ["2019-03-18"]
  }).pipe(
    nullAsNone({ description: "The day the item first came into stock, as year-month-day; null when not known" })
  ),
  dimensions: Dimensions.pipe(
    nullAsNone({ description: "The item's length, width and height with their unit, all together; null for none" })
  ),
  vendors: S.Array(Vendor).check(S.isMaxLength(3)).annotate({ description: "Up to three vendors" }).annotateKey({
    description: "Who the item can be bought from: up to three, at most one of them preferred; empty for none"
  })
}).annotate({ identifier: "ItemFields", description: "What one item needs before it can be stored" })
/** The decoded value of `ItemFields`: what one item needs before it can be stored. */
export type ItemFields = typeof ItemFields.Type

/** An item as stored for one organization. */
export const StoredItem = S.Struct({
  id: ItemId.annotateKey({ description: "The item's id, given when the import created it" }),
  ...ItemFields.fields,
  createdAt: Instant.pipe(S.annotateKey({ description: "When the import created the item" })),
  createdBy: personName("Who confirmed the import that created the item"),
  revision: S.Int.annotateKey({
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
 * What an item cannot be is refused by this schema, as a 400 that names the field: a name of only spaces, a day that
 * is not on the calendar, and (through `Stocking`) discontinued and active at once.
 */
export const ItemEdit = S.Struct({
  revision: S.Int.check(S.isGreaterThanOrEqualTo(1)).annotateKey({
    description: "The revision the person was looking at when they made the change",
    examples: [1],
    messageMissingKey: "Send the revision of the item the change was made on."
  }),
  name: ItemFields.fields.name.annotateKey({ messageMissingKey: "Give the item a name." }),
  description: S.String.check(S.isMaxLength(32767)).pipe(
    nullAsNone({
      description: "Free text about the item; null for none",
      messageMissingKey: "Give a description, or null for none."
    })
  ),
  category: Category.annotateKey({ messageMissingKey: "Choose the category." }),
  uom: Uom.annotateKey({ messageMissingKey: "Choose the unit of measure." }),
  unitCost: ItemFields.fields.unitCost.annotateKey({ messageMissingKey: "Give the unit cost." }),
  quantityOnHand: ItemFields.fields.quantityOnHand.annotateKey({ messageMissingKey: "Give the quantity on hand." }),
  reorderPoint: ItemFields.fields.reorderPoint.annotateKey({
    messageMissingKey: "Give the reorder point, or null for none."
  }),
  stocking: Stocking.annotateKey({
    description: "Whether the item is in use: active, inactive, or discontinued on a day",
    messageMissingKey: "Say whether the item is active, inactive or discontinued on a day."
  }),
  lotTracked: S.Boolean.annotateKey({
    description: "Whether stock is tracked by lot",
    messageMissingKey: "Say whether the item is lot tracked."
  }),
  firstReceivedOn: ItemFields.fields.firstReceivedOn.annotateKey({
    messageMissingKey: "Give the first received date, or null for none."
  })
}).annotate({
  identifier: "ItemEdit",
  description: "The plain values one item should have after an edit, and the revision it was made on"
})
/** The decoded value of `ItemEdit`: what a person sends to change one item. */
export type ItemEdit = typeof ItemEdit.Type

/**
 * A cost as ten-thousandths of a dollar, exact, for adding costs up without a float.
 *
 * @example decimalUnits(BigDecimal.fromStringUnsafe("12.5")) // 125000n
 */
export const decimalUnits = (cost: UnitCost): bigint => BigDecimal.scale(cost, 4).value

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
 * The form of a SKU used to decide whether two rows are the same item: no spaces, upper case. "One item per SKU"
 * must hold for `blt-0042 ` and `BLT-0042`, so both the file check and the database's unique index compare this key,
 * never the text as typed.
 *
 * @example skuKey({ sku: "blt-0042 " }) // "BLT-0042"
 */
export const skuKey = (input: { readonly sku: string }): string => Str.toUpperCase(Str.replace(/\s+/g, "")(input.sku))
