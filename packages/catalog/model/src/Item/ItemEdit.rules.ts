// The editor's form for one item, read into an edit or into a sentence per box that cannot be read. The same
// readers the import uses on a file's cells, so an edit cannot store what a file could not.
/** The edit form as the person filled it in: the text of each box, and the choices as they are. */
import {
  Category,
  Uom,
  ItemEdit,
  maxDescriptionLength,
  maxNameLength,
  stockingOf
} from "@inventory/catalog-contract/Item"
import * as A from "effect/Array"
import * as BigDecimal from "effect/BigDecimal"
import * as Data from "effect/Data"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { readUnitCost, readCount, readDate } from "../Review/CellReading.rules.ts"
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
    | "name"
    | "description"
    | "unitCost"
    | "quantityOnHand"
    | "reorderPoint"
    | "firstReceivedOn"
    | "discontinuedOn"
    | "isActive",
    string
  >
>

/**
 * What reading the edit form gives: the edit to send, or every problem in it. A tagged enum, so the screen and the
 * tests tell the two apart with its own `$match` and `$is`, and build either with its constructor.
 */
export type ItemFormReading = Data.TaggedEnum<{
  Edit: { readonly edit: ItemEdit }
  Problems: { readonly problems: ItemFormProblems }
}>

/** The constructors, guards and matcher of `ItemFormReading`. */
export const ItemFormReading = Data.taggedEnum<ItemFormReading>()

const count = new Intl.NumberFormat("en-US")

/**
 * Reads the edit form into the values an item is stored with, or every problem in it at once, each a sentence that
 * says what to change. A cost is read from the digits, as an import reads it; empty optional boxes are none.
 *
 * @example readItemForm({ form: { ...form, unitCost: "3.65555" }, revision: 1 })
 * // ItemFormReading.Problems({ problems: { unitCost: "Unit cost is not an amount ..." } })
 */
export const readItemForm = (input: { readonly form: ItemForm; readonly revision: number }): ItemFormReading => {
  const { form } = input
  const name = Str.trim(form.name)
  const description = Str.trim(form.description)
  const cost = readUnitCost(form.unitCost)
  // None: the box holds something that cannot be read. Some(none): the box is empty, which an optional value may be.
  const optional = <A>(text: string, read: (text: string) => O.Option<A>): O.Option<O.Option<A>> =>
    Str.trim(text) === "" ? O.some(O.none()) : O.map(read(text), O.some)
  const quantity = Str.trim(form.quantityOnHand) === "" ? O.some(0) : readCount(form.quantityOnHand)
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
      "description",
      // The one limit the edit's schema has that a box lets through: said here, with the number, before anything is sent.
      description.length > maxDescriptionLength
        ? `Description is ${count.format(description.length)} characters long. It can hold ${count.format(maxDescriptionLength)}: shorten it.`
        : undefined
    ],
    [
      "unitCost",
      O.isNone(cost)
        ? "Unit cost is not an amount in dollars with up to 4 decimals. Write it as digits, for example 12.50."
        : undefined
    ],
    [
      "quantityOnHand",
      O.isNone(quantity) ? "Quantity on hand is not a whole number. Write it as digits, for example 120." : undefined
    ],
    [
      "reorderPoint",
      O.isNone(reorder) ? "Reorder point is not a whole number. Write it as digits, or leave it empty." : undefined
    ],
    [
      "firstReceivedOn",
      O.isNone(received) ? "First received is not a date. Write it as year, month and day: 2026-03-04." : undefined
    ],
    [
      "discontinuedOn",
      O.isNone(discontinued) ? "Discontinued on is not a date. Write it as year, month and day: 2026-03-04." : undefined
    ],
    [
      "isActive",
      form.isActive && Str.trim(form.discontinuedOn) !== ""
        ? "A discontinued item cannot be active. Switch Active off, or clear the discontinued date."
        : undefined
    ]
  ]
  const problems = A.filterMap(found, ([field, message]) =>
    message === undefined ? Result.failVoid : Result.succeed([field, message] as const)
  )
  if (A.isReadonlyArrayNonEmpty(problems)) return ItemFormReading.Problems({ problems: R.fromEntries(problems) })
  return ItemFormReading.Edit({
    edit: {
      revision: input.revision,
      name,
      description: description === "" ? O.none() : O.some(description),
      category: form.category,
      uom: form.uom,
      unitCost: O.getOrElse(cost, () => BigDecimal.fromBigInt(0n)),
      quantityOnHand: O.getOrElse(quantity, () => 0),
      reorderPoint: O.flatten(reorder),
      stocking: stockingOf({ isActive: form.isActive, discontinuedOn: O.flatten(discontinued) }),
      lotTracked: form.lotTracked,
      firstReceivedOn: O.flatten(received)
    }
  })
}
