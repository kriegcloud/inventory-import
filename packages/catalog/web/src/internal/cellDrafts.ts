// What a dimensions or vendors cell of the file holds, as the fields of the form that fixes it: read from whole JSON,
// or found piece by piece in a cell that was cut off, so the form opens with what the file says and never empty.
// The one thing not to break: nothing here decides a value; the domain's readers check what the form saves.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"

/** The cell's JSON, or nothing where it is not JSON (a cell cut off): then it is read piece by piece. */
const parsed = S.decodeUnknownOption(S.fromJsonString(S.Unknown))
const isObject = (value: unknown): value is Readonly<Record<string, unknown>> => P.isObject(value)

/** A number or text of a parsed cell as the text a field holds; nothing for anything else. */
const textOf = (value: unknown): string => (typeof value === "number" || typeof value === "string" ? `${value}` : "")

/** A number as JSON writes it, or the typed text itself when it is no number (the reader then says what is wrong). */
export const numberOrText = (text: string): number | string => {
  const trimmed = text.trim()
  return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed
}

export const DimensionsDraft = S.Struct({
  length: S.String.pipe(
    S.annotateKey({ description: "Length as typed or recovered from the file" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  width: S.String.pipe(
    S.annotateKey({ description: "Width as typed or recovered from the file" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  height: S.String.pipe(
    S.annotateKey({ description: "Height as typed or recovered from the file" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  unit: S.String.pipe(
    S.annotateKey({ description: "The dimensions unit; old cells naming none were read as cm" }),
    S.withConstructorDefault(Effect.succeed("cm"))
  )
}).annotate({ description: "The form fields recovered from a dimensions cell, including a cell cut short" })
export type DimensionsDraft = typeof DimensionsDraft.Type

const capture = (expression: RegExp, text: string): O.Option<string> =>
  O.flatMap(O.fromNullOr(expression.exec(text)), (found) => O.fromUndefinedOr(found[1]))

/**
 * Whatever of a dimensions cell can be read: the whole cell when it is JSON, else each measurement found in a cell
 * that was cut off.
 *
 * @example dimensionsDraft('{"length":31.2,"width":41.4,"un') // { length: "31.2", width: "41.4", height: "", unit: "cm" }
 */
export const dimensionsDraft = (text: string): DimensionsDraft =>
  O.match(O.filter(parsed(text), isObject), {
    onSome: (value) =>
      DimensionsDraft.make({
        length: textOf(value["length"]),
        width: textOf(value["width"]),
        height: textOf(value["height"]),
        unit: value["unit"] === "in" ? "in" : "cm"
      }),
    onNone: () => {
      let draft: DimensionsDraft = DimensionsDraft.make({})
      for (const key of Tuple.make("length", "width", "height")) {
        O.map(capture(new RegExp(`"${key}"\\s*:\\s*"?([^",}\\s]+)`), text), (value) => {
          draft = { ...draft, [key]: value }
        })
      }
      O.map(
        O.filter(capture(/"unit"\s*:\s*"?([^",}\s]+)/, text), (unit) => unit === "in"),
        (unit) => {
          draft = { ...draft, unit }
        }
      )
      return draft
    }
  })

export const VendorDraft = S.Struct({
  name: S.String.pipe(
    S.annotateKey({ description: "Vendor name in the form" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  sku: S.String.pipe(
    S.annotateKey({ description: "Vendor's SKU in the form" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  cost: S.String.pipe(
    S.annotateKey({ description: "Vendor's price in the form" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  lead: S.String.pipe(
    S.annotateKey({ description: "Lead time in the form" }),
    S.withConstructorDefault(Effect.succeed(""))
  ),
  preferred: S.Boolean.pipe(
    S.annotateKey({ description: "The file marks this vendor preferred" }),
    S.withConstructorDefault(Effect.succeed(false))
  )
}).annotate({ description: "A vendor recovered into its complete form, even when its file cell was cut short" })
export type VendorDraft = typeof VendorDraft.Type
export const emptyVendor = VendorDraft.make({})

const vendorDraft = (value: Readonly<Record<string, unknown>>): VendorDraft =>
  VendorDraft.make({
    name: textOf(value["vendor_name"]),
    sku: textOf(value["vendor_sku"]),
    cost: textOf(value["unit_cost"]),
    lead: textOf(value["lead_time_days"]),
    preferred: value["is_preferred"] === true
  })

/** Fields of one vendor recovered from a cell cut short; missing pieces keep their form's starting values. */
const vendorFound = (piece: string): VendorDraft => {
  let draft: VendorDraft = VendorDraft.make({
    preferred: /"is_preferred"\s*:\s*true/.test(piece)
  })
  O.map(capture(/"vendor_name"\s*:\s*"([^"]*)/, piece), (name) => {
    draft = { ...draft, name }
  })
  O.map(capture(/"vendor_sku"\s*:\s*"([^"]*)/, piece), (sku) => {
    draft = { ...draft, sku }
  })
  O.map(capture(/"unit_cost"\s*:\s*(-?\d+(?:\.\d+)?)/, piece), (cost) => {
    draft = { ...draft, cost: `${Number(cost)}` }
  })
  O.map(capture(/"lead_time_days"\s*:\s*(-?\d+(?:\.\d+)?)/, piece), (lead) => {
    draft = { ...draft, lead: `${Number(lead)}` }
  })
  return draft
}

/**
 * Whatever of a vendors cell can be read: every vendor of a cell that is JSON, else each vendor begun in a cell that
 * was cut off, with every field that is there (a value cut short is kept as far as it goes, for the person to finish).
 * At most three, and at most the first marked preferred stays so.
 *
 * @example vendorsDraft('[{"vendor_name":"Keystone Components","vendor_sku":"KE-615') // [{ name: "Keystone Components", sku: "KE-615", ... }]
 */
export const vendorsDraft = (text: string): ReadonlyArray<VendorDraft> => {
  const entries: ReadonlyArray<VendorDraft> = O.match(
    O.filter(parsed(text), (value): value is Array<unknown> => A.isArray(value)),
    {
      onSome: (values) => A.map(A.filter(values, isObject), vendorDraft),
      onNone: () =>
        A.map(A.drop(text.split("{"), 1), (piece) =>
          O.match(O.filter(parsed(`{${piece.replace(/[\],\s]*$/, "")}`), isObject), {
            onNone: () => vendorFound(piece),
            onSome: vendorDraft
          })
        )
    }
  )
  const vendors = A.take(
    A.filter(entries, (vendor) => vendor.name !== "" || vendor.sku !== ""),
    3
  )
  const preferred = vendors.findIndex((vendor) => vendor.preferred)
  return vendors.map((vendor, index) => ({ ...vendor, preferred: index === preferred }))
}
