import * as Str from "effect/String"

/**
 * Text that no longer shares memory with the XML it was cut from. A string taken from a parsed chunk can keep the
 * whole chunk alive; a cell's text is kept for as long as the workbook is, so it is copied.
 */
export const detached = (text: string): string => {
  if (text.length < 13) return text
  const copy = ` ${text}`
  return copy[0] === " " ? Str.substring(1)(copy) : text
}
