// THE KEY A SKU IS COMPARED BY. Two rows are one item when their SKUs give the same key, in the file check and in the
// database's unique index. The key is never shown to the person as a fix: the SKU they typed is what is stored and
// shown. Its clean-up stays in code, on the defaults law's `exemptions` (Benjamin, 2026-11-23): every caller is pure
// code that needs the key at once, and a schema transformation would need `S.decodeSync`, which the type-check refuses.
import * as Str from "effect/String"

/**
 * The form of a SKU used to decide whether two rows are the same item: no spaces, upper case. "One item per SKU"
 * must hold for `blt-0042 ` and `BLT-0042`, so both the file check and the database's unique index compare this key,
 * never the text as typed.
 *
 * @example skuKey({ sku: "blt-0042 " }) // "BLT-0042"
 */
export const skuKey = (input: { readonly sku: string }): string => Str.toUpperCase(Str.replace(/\s+/g, "")(input.sku))
