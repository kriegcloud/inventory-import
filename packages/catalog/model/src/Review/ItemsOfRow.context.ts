// How a row of a staged file becomes items where the confirm runs. The one thing a reader must not break: the
// screen reviews with `itemsOfRow` too, so this default stays that function. Change the function in
// `Review.rules.ts`, never this default: a different one here would make the server and the screen disagree about
// which items a file holds. A test provides its own to try a file whose rows hold several.
import { Context } from "effect"
import { type ItemsOfRow as ItemsOfRowShape, itemsOfRow } from "./Review.rules.ts"

/**
 * How a row of a staged file becomes items on the server: `itemsOfRow` unless a test provides another, so the
 * confirm writes exactly the items the review screen showed.
 */
export const ItemsOfRow = Context.Reference<ItemsOfRowShape>("@inventory/catalog-model/Review/ItemsOfRow", {
  defaultValue: () => itemsOfRow
})
