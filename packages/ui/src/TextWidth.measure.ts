// How wide a piece of text is drawn, in pixels, without putting it on the page: a column can then be made wide
// enough for what it has to show before the table is laid out. Measured on a canvas, which touches no element and
// forces no layout pass. Until the app's faces have loaded the browser measures its fallback face, which is a
// little narrower; callers leave a few pixels of room.

import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"

type FontFamilies = { sans: string; mono: string }

// The outer Option distinguishes not initialized from a browser that has no 2D context.
let context: O.Option<O.Option<CanvasRenderingContext2D>> = O.none()
let families: O.Option<FontFamilies> = O.none()

const canvasContext = (): O.Option<CanvasRenderingContext2D> =>
  O.match(context, {
    onSome: (held) => held,
    onNone: () => {
      const read = O.fromNullishOr(document.createElement("canvas").getContext("2d"))
      context = O.some(read)
      return read
    }
  })

const fontFamilies = (): FontFamilies =>
  O.match(families, {
    onSome: (held) => held,
    onNone: () => {
      const style = getComputedStyle(document.documentElement)
      const read = {
        sans: style.getPropertyValue("--font-sans") || "sans-serif",
        mono: style.getPropertyValue("--font-mono") || "monospace"
      }
      families = O.some(read)
      return read
    }
  })
const cache = MutableHashMap.empty<string, number>()

/** The table's text size (`--text-table` in `index.css`), in pixels. */
const tableTextSize = 13

/**
 * The width of `text` in the table's face: the text face, or the mono face a SKU is set in; `medium` is the weight
 * a proposed value's chip uses. The same text is measured once.
 */
export const textWidth = (text: string, options: { medium: boolean; mono: boolean }): number => {
  const medium = options.medium
  const mono = options.mono
  const key = `${medium ? "m" : "r"}${mono ? "c" : "t"}${text}`
  return O.match(MutableHashMap.get(cache, key), {
    onSome: (known) => known,
    onNone: () =>
      O.match(canvasContext(), {
        onNone: () => text.length * 7.5,
        onSome: (context) => {
          const families = fontFamilies()
          context.font = `${medium ? 500 : 400} ${tableTextSize}px ${mono ? families.mono : families.sans}`
          const width = context.measureText(text).width
          MutableHashMap.set(cache, key, width)
          return width
        }
      })
  })
}
