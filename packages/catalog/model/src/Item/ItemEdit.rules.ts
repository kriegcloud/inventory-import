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
import * as Data from "effect/Data"
import * as O from "effect/Option"
import * as R from "effect/Record"
import { readUnitCost, readCount, readDate } from "../Review/CellReading.rules.ts"
import { cellValue, isBlank } from "../Review/CellRules.rules.ts"
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
  // A box is read as a file's cell is, so its spaces come off where a cell's would.
  const name = cellValue(form.name)
  const description = cellValue(form.description)
  const cost = readUnitCost(form.unitCost)
  // None: the box holds something that cannot be read. Some(none): the box is empty, which an optional value may be.
  const optional = <A>(text: string, read: (text: string) => O.Option<A>): O.Option<O.Option<A>> =>
    isBlank(text) ? O.some(O.none()) : O.map(read(text), O.some)
  const quantity = isBlank(form.quantityOnHand) ? O.some(0) : readCount(form.quantityOnHand)
  const reorder = optional(form.reorderPoint, readCount)
  const received = optional(form.firstReceivedOn, readDate)
  const discontinued = optional(form.discontinuedOn, readDate)
  const found: ReadonlyArray<readonly [keyof ItemFormProblems, O.Option<string>]> = [
    [
      "name",
      name === ""
        ? O.some("Name is empty. Every item needs a name.")
        : name.length > maxNameLength
          ? O.some(`Name is longer than ${maxNameLength} characters. Shorten it.`)
          : O.none()
    ],
    [
      "description",
      // The one limit the edit's schema has that a box lets through: said here, with the number, before anything is sent.
      description.length > maxDescriptionLength
        ? O.some(
            `Description is ${count.format(description.length)} characters long. It can hold ${count.format(maxDescriptionLength)}: shorten it.`
          )
        : O.none()
    ],
    [
      "unitCost",
      O.isNone(cost)
        ? O.some("Unit cost is not an amount in dollars with up to 4 decimals. Write it as digits, for example 12.50.")
        : O.none()
    ],
    [
      "quantityOnHand",
      O.isNone(quantity)
        ? O.some("Quantity on hand is not a whole number. Write it as digits, for example 120.")
        : O.none()
    ],
    [
      "reorderPoint",
      O.isNone(reorder)
        ? O.some("Reorder point is not a whole number. Write it as digits, or leave it empty.")
        : O.none()
    ],
    [
      "firstReceivedOn",
      O.isNone(received)
        ? O.some("First received is not a date. Write it as year, month and day: 2026-03-04.")
        : O.none()
    ],
    [
      "discontinuedOn",
      O.isNone(discontinued)
        ? O.some("Discontinued on is not a date. Write it as year, month and day: 2026-03-04.")
        : O.none()
    ],
    [
      "isActive",
      form.isActive && !isBlank(form.discontinuedOn)
        ? O.some("A discontinued item cannot be active. Switch Active off, or clear the discontinued date.")
        : O.none()
    ]
  ]
  const problems = A.getSomes(A.map(found, ([field, message]) => O.map(message, (said) => [field, said] as const)))
  // Every box read: none when one of them could not be, and then its problem is among `problems`.
  const read = O.all({ cost, quantity, reorder, received, discontinued })
  if (A.isReadonlyArrayNonEmpty(problems) || O.isNone(read)) {
    return ItemFormReading.Problems({ problems: R.fromEntries(problems) })
  }
  return ItemFormReading.Edit({
    edit: {
      revision: input.revision,
      name,
      description: description === "" ? O.none() : O.some(description),
      category: form.category,
      uom: form.uom,
      unitCost: read.value.cost,
      quantityOnHand: read.value.quantity,
      reorderPoint: read.value.reorder,
      stocking: stockingOf({ isActive: form.isActive, discontinuedOn: read.value.discontinued }),
      lotTracked: form.lotTracked,
      firstReceivedOn: read.value.received
    }
  })
}
