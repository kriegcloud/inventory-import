// The editor's form says what is wrong with a box before anything is sent. The limit that hurt: a description
// longer than an edit may hold was let through, and the browser then refused the edit without saying which box.
import { describe, expect, it } from "@effect/vitest"
import { ItemEdit, maxDescriptionLength } from "@inventory/catalog-contract/Item"
import { type ItemForm, readItemForm } from "@inventory/catalog-model/ItemEdit"
import * as Effect from "effect/Effect"
import * as Str from "effect/String"
import * as S from "effect/Schema"

const form: ItemForm = {
  name: "Steel Coil",
  description: "",
  category: "raw-materials",
  uom: "KG",
  unitCost: "15.47",
  quantityOnHand: "1952",
  reorderPoint: "",
  isActive: true,
  lotTracked: false,
  firstReceivedOn: "",
  discontinuedOn: ""
}

describe("the edit form", () => {
  it("names the description and its limit when it is too long, and reads one at the limit", () => {
    const tooLong = readItemForm({ form: { ...form, description: Str.repeat(33_000)("x") }, revision: 1 })
    expect(tooLong).toEqual({
      _tag: "Problems",
      problems: { description: "Description is 33,000 characters long. It can hold 32,767: shorten it." }
    })
    const atLimit = readItemForm({ form: { ...form, description: Str.repeat(maxDescriptionLength)("x") }, revision: 1 })
    expect(atLimit._tag).toBe("Edit")
  })

  it.effect("reads nothing the edit's own schema then refuses", () =>
    Effect.gen(function* () {
      const read = readItemForm({ form: { ...form, description: Str.repeat(maxDescriptionLength)("x") }, revision: 1 })
      if (read._tag !== "Edit") return yield* Effect.die("the form at its limits should read")
      // What the browser's client does before sending: encode the edit through the contract.
      const sent = yield* S.encodeEffect(ItemEdit)(read.edit)
      expect(sent.name).toBe("Steel Coil")
    })
  )
})
