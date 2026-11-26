// The item editor's complete state and the form it opens: a closed editor holds no optional pieces.
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { Category, Uom, StoredItem, costDigits, discontinuedOn, isActive } from "@inventory/catalog-contract/Item"

/** Text fields of an edit form, including the blank starting value of each optional box. */
export const EditorForm = S.Struct({
  name: S.String.annotateKey({ description: "The name as typed" }),
  category: Category.annotateKey({ description: "The category selected in the form" }),
  uom: Uom.annotateKey({ description: "The unit selected in the form" }),
  unitCost: S.String.annotateKey({ description: "The unit cost as typed" }),
  quantityOnHand: S.String.annotateKey({ description: "The quantity as typed" }),
  isActive: S.Boolean.annotateKey({ description: "The active choice" }),
  lotTracked: S.Boolean.annotateKey({ description: "The lot tracking choice" }),
  description: S.String.pipe(
    S.annotateKey({ description: "The description, blank when the item has none" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  reorderPoint: S.String.pipe(
    S.annotateKey({ description: "The reorder point, blank when the item has none" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  firstReceivedOn: S.String.pipe(
    S.annotateKey({ description: "The received date, blank when the item has none" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  discontinuedOn: S.String.pipe(
    S.annotateKey({ description: "The discontinued date, blank when the item has none" }),
    S.withConstructorDefault(Effect.succeed(""))
  )
}).annotate({ description: "The text and choices in one item's edit form" })

export type EditorForm = typeof EditorForm.Type

/** Opens a complete form from a stored item without replacing any entered value. */
export const formOf = (item: StoredItem): EditorForm => {
  const initial = EditorForm.make({
    name: item.name,
    category: item.category,
    uom: item.uom,
    unitCost: costDigits(item.unitCost),
    quantityOnHand: `${item.quantityOnHand}`,
    isActive: isActive(item.stocking),
    lotTracked: item.lotTracked
  })
  const described = O.match(item.description, {
    onNone: () => initial,
    onSome: (description) => ({ ...initial, description })
  })
  const reordered = O.match(item.reorderPoint, {
    onNone: () => described,
    onSome: (point) => ({ ...described, reorderPoint: `${point}` })
  })
  const received = O.match(item.firstReceivedOn, {
    onNone: () => reordered,
    onSome: (firstReceivedOn) => ({ ...reordered, firstReceivedOn })
  })
  return O.match(discontinuedOn(item.stocking), {
    onNone: () => received,
    onSome: (discontinuedOn) => ({ ...received, discontinuedOn })
  })
}

export const EditorState = S.TaggedUnion({
  Closed: {},
  Open: {
    base: StoredItem.annotateKey({ description: "The item and revision this form edits" }),
    form: EditorForm.annotateKey({ description: "All fields as entered" }),
    problems: S.Record(S.String, S.String).annotateKey({ description: "Reasons to repair fields before saving" }),
    notice: S.Option(S.String).annotateKey({ description: "Why another person changed the item before this save" })
  }
}).annotate({ description: "An item editor is closed, or open with its required item and typed form" })
export type EditorState = typeof EditorState.Type
export type OpenEditor = Extract<EditorState, { readonly _tag: "Open" }>
