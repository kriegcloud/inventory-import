// How the server turns a row of a staged file into items. The one thing a reader must not break: the screen
// reviews with the domain's `itemsOfRow` too, so this stays that function in the app. Change the function in
// src/domain/ItemImport.ts, never this default: a different one here would make the server and the screen
// disagree about which items a file holds. A test provides its own to try a file whose rows hold several.
import { Context } from "effect"
import { type ItemsOfRow as ItemsOfRowShape, itemsOfRow } from "../domain/ItemImport.ts"

/**
 * How a row of a staged file becomes items on the server: `itemsOfRow` from the domain unless a test provides
 * another, so the confirm writes exactly the items the review screen showed.
 */
export const ItemsOfRow = Context.Reference<ItemsOfRowShape>("takehome/server/ImportShape/ItemsOfRow", {
  defaultValue: () => itemsOfRow
})
