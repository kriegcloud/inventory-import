import type { ReactNode } from "react"

/**
 * An identifier a person compares character by character (a SKU, a supplier's part number, a barcode), in the mono
 * face, whose 0 and O, 1, l and I never look alike. Names, quantities and prices stay in the text face.
 */
export function Code(props: { readonly children: ReactNode }) {
  return <span className="font-mono">{props.children}</span>
}
