// What a dimensions or vendors cell of the file holds, as the fields of the form that fixes it: read from whole JSON,
// or found piece by piece in a cell that was cut off, so the form opens with what the file says and never empty.
// The one thing not to break: nothing here decides a value; the domain's readers check what the form saves.
import { parse } from "../../lib/json.ts"

const parsed = (text: string): unknown => {
  try {
    return parse(text)
  } catch {
    return undefined
  }
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** A number or text of a parsed cell as the text a field holds; nothing for anything else. */
const textOf = (value: unknown): string => (typeof value === "number" || typeof value === "string" ? `${value}` : "")

/** A number as JSON writes it, or the typed text itself when it is no number (the reader then says what is wrong). */
export const numberOrText = (text: string): number | string => {
  const trimmed = text.trim()
  return trimmed !== "" && Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed
}

export type DimensionsDraft = { length: string; width: string; height: string; unit: string }

/**
 * Whatever of a dimensions cell can be read: the whole cell when it is JSON, else each measurement found in a cell
 * that was cut off.
 *
 * @example dimensionsDraft('{"length":31.2,"width":41.4,"un') // { length: "31.2", width: "41.4", height: "", unit: "cm" }
 */
export const dimensionsDraft = (text: string): DimensionsDraft => {
  const value = parsed(text)
  const found = (key: string): string =>
    isObject(value) ? textOf(value[key]) : (new RegExp(`"${key}"\\s*:\\s*"?([^",}\\s]+)`).exec(text)?.[1] ?? "")
  const unit = found("unit")
  return { length: found("length"), width: found("width"), height: found("height"), unit: unit === "in" ? "in" : "cm" }
}

export type VendorDraft = { name: string; sku: string; cost: string; lead: string; preferred: boolean }

export const emptyVendor: VendorDraft = { name: "", sku: "", cost: "", lead: "", preferred: false }

const vendorDraft = (value: Readonly<Record<string, unknown>>): VendorDraft => ({
  name: textOf(value["vendor_name"]),
  sku: textOf(value["vendor_sku"]),
  cost: textOf(value["unit_cost"]),
  lead: textOf(value["lead_time_days"]),
  preferred: value["is_preferred"] === true
})

/** The fields of one vendor found in a piece of a cell that was cut off: each key whose value is there, whole or cut. */
const vendorFound = (piece: string): Readonly<Record<string, unknown>> => {
  const text = (key: string): string | undefined => new RegExp(`"${key}"\\s*:\\s*"([^"]*)`).exec(piece)?.[1]
  const number = (key: string): number | undefined => {
    const found = new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(piece)?.[1]
    return found === undefined ? undefined : Number(found)
  }
  return {
    vendor_name: text("vendor_name"),
    vendor_sku: text("vendor_sku"),
    unit_cost: number("unit_cost"),
    lead_time_days: number("lead_time_days"),
    is_preferred: /"is_preferred"\s*:\s*true/.test(piece)
  }
}

/**
 * Whatever of a vendors cell can be read: every vendor of a cell that is JSON, else each vendor begun in a cell that
 * was cut off, with every field that is there (a value cut short is kept as far as it goes, for the person to finish).
 * At most three, and at most the first marked preferred stays so.
 *
 * @example vendorsDraft('[{"vendor_name":"Keystone Components","vendor_sku":"KE-615') // [{ name: "Keystone Components", sku: "KE-615", ... }]
 */
export const vendorsDraft = (text: string): ReadonlyArray<VendorDraft> => {
  const value = parsed(text)
  const entries: ReadonlyArray<unknown> = Array.isArray(value)
    ? (value as ReadonlyArray<unknown>)
    : text
        .split("{")
        .slice(1)
        .map((piece) => parsed(`{${piece.replace(/[\],\s]*$/, "")}`) ?? vendorFound(piece))
  const vendors = entries
    .filter(isObject)
    .map(vendorDraft)
    .filter((vendor) => vendor.name !== "" || vendor.sku !== "")
    .slice(0, 3)
  const preferred = vendors.findIndex((vendor) => vendor.preferred)
  return vendors.map((vendor, index) => ({ ...vendor, preferred: index === preferred }))
}
