// How wide a piece of text is drawn, in pixels, without putting it on the page: a column can then be made wide
// enough for what it has to show before the table is laid out. Measured on a canvas, which touches no element and
// forces no layout pass. Until the app's faces have loaded the browser measures its fallback face, which is a
// little narrower; callers leave a few pixels of room.

import { MutableHashMap, Option } from "effect"

let context: CanvasRenderingContext2D | null | undefined
let families: { sans: string; mono: string } | undefined
const cache = MutableHashMap.empty<string, number>()

/** The table's text size (`--text-table` in `index.css`), in pixels. */
const tableTextSize = 13

/**
 * The width of `text` in the table's face: the text face, or the mono face a SKU is set in; `medium` is the weight
 * a proposed value's chip uses. The same text is measured once.
 */
export const textWidth = (text: string, options?: { medium?: boolean; mono?: boolean }): number => {
  const medium = options?.medium === true
  const mono = options?.mono === true
  const key = `${medium ? "m" : "r"}${mono ? "c" : "t"}${text}`
  const known = Option.getOrUndefined(MutableHashMap.get(cache, key))
  if (known !== undefined) return known
  if (context === undefined) context = document.createElement("canvas").getContext("2d")
  if (context === null) return text.length * 7.5
  if (families === undefined) {
    const style = getComputedStyle(document.documentElement)
    families = {
      sans: style.getPropertyValue("--font-sans") || "sans-serif",
      mono: style.getPropertyValue("--font-mono") || "monospace"
    }
  }
  context.font = `${medium ? 500 : 400} ${tableTextSize}px ${mono ? families.mono : families.sans}`
  const width = context.measureText(text).width
  MutableHashMap.set(cache, key, width)
  return width
}
