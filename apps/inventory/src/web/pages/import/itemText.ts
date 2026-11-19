import { parse } from "../../ui-kit/Json.codec.ts"
// How an item's values read on screen, in one place: the Items table, the editor and the review show a cost, the
// dimensions and the vendors the same way. The one thing not to break: nothing here decides anything. Text that is
// not what the field expects comes back as the file has it, so the person sees what is wrong with it.

/**
 * A unit cost as money, from its digits and never through a float: at least two decimals, at most the four an item
 * may have. Text that is not a plain amount stays as it is.
 *
 * @example costText("4.5") // "$4.50"
 * @example costText("1234.0125") // "$1,234.0125"
 * @example costText("TBD") // "TBD"
 */
export const costText = (text: string): string => {
  const parts = /^(\d+)(?:\.(\d{1,4}))?$/.exec(text.trim())
  if (parts === null) return text
  const dollars = (parts[1] ?? "0").replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+$)/g, ",")
  const decimals = (parts[2] ?? "").replace(/0+$/, "").padEnd(2, "0")
  return `$${dollars}.${decimals}`
}

/**
 * A whole-number count with thousands separators, as the Items table shows a quantity. Text that is not a plain whole
 * number stays as it is, so the person sees what is wrong with it.
 *
 * @example countText("3911") // "3,911"
 * @example countText("12.5") // "12.5"
 */
export const countText = (text: string): string =>
  /^\d+$/.test(text.trim())
    ? text
        .trim()
        .replace(/^0+(?=\d)/, "")
        .replace(/\B(?=(\d{3})+$)/g, ",")
    : text

/**
 * A sum of money to the cent, rounded half up from its digits and never through a float: a stock value, which is a
 * total and not a price. Text that is not a plain amount stays as it is.
 *
 * @example totalText("40259038.2675") // "$40,259,038.27"
 */
export const totalText = (text: string): string => {
  const parts = /^(\d+)(?:\.(\d+))?$/.exec(text.trim())
  if (parts === null) return text
  const decimals = (parts[2] ?? "").padEnd(3, "0")
  const cents = BigInt(`${parts[1] ?? "0"}${decimals.slice(0, 2)}`) + (Number(decimals[2]) >= 5 ? 1n : 0n)
  const digits = cents.toString().padStart(3, "0")
  return `$${digits.slice(0, -2).replace(/\B(?=(\d{3})+$)/g, ",")}.${digits.slice(-2)}`
}

/** An item's dimensions as stored: three measurements and their unit. */
export type DimensionsShown = {
  readonly length: number
  readonly width: number
  readonly height: number
  readonly unit: string
}

/**
 * Dimensions in one line, length by width by height with the unit once.
 *
 * @example dimensionsText({ length: 78.8, width: 56.9, height: 2.6, unit: "cm" }) // "78.8 × 56.9 × 2.6 cm"
 */
export const dimensionsText = (dimensions: DimensionsShown): string =>
  `${dimensions.length} × ${dimensions.width} × ${dimensions.height} ${dimensions.unit}`

/** What a vendor line needs to be summed up: its name and whether it is the preferred one. */
export type VendorShown = { readonly name: string; readonly preferred: boolean }

/**
 * An item's vendors in one line: how many, and the preferred one's name. A file's cell that marks more than one
 * preferred names each, so the question about it reads true.
 *
 * @example vendorsText([{ name: "Acme Industrial", preferred: false }, { name: "Summit Polymers", preferred: true }])
 * // "2 · Summit Polymers preferred"
 * @example vendorsText([{ name: "Acme Industrial", preferred: false }]) // "1 · none preferred"
 * @example vendorsText([{ name: "Ridgeline Metals", preferred: true }, { name: "Acme Industrial", preferred: true }])
 * // "2 · Ridgeline Metals and Acme Industrial preferred"
 */
export const vendorsText = (vendors: ReadonlyArray<VendorShown>): string => {
  const preferred = vendors.filter((vendor) => vendor.preferred).map((vendor) => vendor.name)
  const names =
    preferred.length <= 2 ? preferred.join(" and ") : `${preferred.slice(0, -1).join(", ")} and ${preferred.at(-1)}`
  return `${vendors.length} · ${preferred.length === 0 ? "none preferred" : `${names} preferred`}`
}

const parsed = (text: string): unknown => {
  try {
    return parse(text) as unknown
  } catch {
    return undefined
  }
}

const isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * A file's dimensions cell (JSON in one cell) as the Items table shows dimensions. A cell that is not three numbers
 * stays as the file has it.
 *
 * @example dimensionsCellText('{"length":97.4,"width":6.9,"height":4.4,"unit":"cm"}') // "97.4 × 6.9 × 4.4 cm"
 */
export const dimensionsCellText = (text: string): string => {
  const value = parsed(text)
  if (!isObject(value)) return text
  const { length, width, height, unit } = value
  if (typeof length !== "number" || typeof width !== "number" || typeof height !== "number") return text
  return dimensionsText({ length, width, height, unit: typeof unit === "string" ? unit : "cm" })
}

/**
 * A file's vendors cell (a JSON list in one cell) as the Items table shows vendors. A cell that was cut off says so,
 * with the vendors it names; any other cell that is not a list of named vendors stays as the file has it.
 *
 * @example vendorsCellText('[{"vendor_name":"Acme Industrial","unit_cost":3.35,"is_preferred":true}]')
 * // "1 · Acme Industrial preferred"
 * @example vendorsCellText('[{"vendor_name":"Keystone Components","vendor_sku":"KE-61') // "Cut off · Keystone Components"
 */
export const vendorsCellText = (text: string): string => {
  const value = parsed(text)
  if (!Array.isArray(value)) {
    const names = [...text.matchAll(/"vendor_name"\s*:\s*"([^"]+)"/g)].map((found) => found[1] ?? "")
    return text.trimStart().startsWith("[") && names.length > 0 ? `Cut off · ${names.join(", ")}` : text
  }
  const vendors: Array<VendorShown> = []
  for (const entry of value as ReadonlyArray<unknown>) {
    if (!isObject(entry) || typeof entry["vendor_name"] !== "string") return text
    vendors.push({ name: entry["vendor_name"], preferred: entry["is_preferred"] === true })
  }
  return vendors.length === 0 ? text : vendorsText(vendors)
}

/**
 * A file's tags cell (values separated by |) with a comma between them.
 *
 * @example tagsCellText("fragile|oversize") // "fragile, oversize"
 */
export const tagsCellText = (text: string): string =>
  text
    .split("|")
    .map((tag) => tag.trim())
    .filter((tag) => tag !== "")
    .join(", ")
