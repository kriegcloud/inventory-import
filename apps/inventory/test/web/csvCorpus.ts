// The CSV inputs the old and new readers are compared on: every CSV fixture, both samples, and generated text (stray
// quotes, quoted line breaks, a closing quote followed by text, an unclosed quote near the end, a semicolon file).
import * as A from "effect/Array"

const fixtures = ["quoted.csv", "ragged.csv", "semicolon-crlf.csv", "tab.csv", "utf8-bom.csv", "windows-1252.csv"]
const samples = ["items_clean.csv", "items_messy.csv"]

const lines = A.makeBy(400, (i) => {
  const name = i % 7 === 0 ? `"Bracket, ${i}"` : i % 11 === 0 ? `"Plate ""${i}"" thick"` : `Bolt ${i}`
  const description = i % 13 === 0 ? `"First line\r\nsecond line ${i}"` : i % 17 === 0 ? `"a\nb"` : "Zinc"
  const note = i % 97 === 0 ? `"12" long` : ""
  return `SKU-${i},${name},${description},Each,${note}`
})
const generated = `SKU,Name,Description,Unit,Note\r\n${A.join(lines, "\r\n")}\r\n`
const unclosed = `${generated}SKU-x,"Unclosed name,Zinc,Each,\r\nSKU-y,Bolt,Zinc,Each,\r\n`
const semicolons = `SKU;Name\n${A.join(
  A.makeBy(200, (i) => `S-${i};"Bolt; ${i}"`),
  "\n"
)}\n`
const strays = 'SKU,Name,Note\nA-1,ab"c,x\nA-2,"q"  ,y\n"A-3","r" s,"t"\n,,\n\n"",x,\n'

const encoder = new TextEncoder()

/** Each input by name, as bytes. `read` is `node:fs`'s `readFileSync`, passed in so this module stays portable. */
export const csvCorpus = (
  read: (url: URL) => Uint8Array
): ReadonlyArray<{ readonly name: string; readonly bytes: Uint8Array }> => [
  ...A.map(fixtures, (name) => ({
    name,
    bytes: read(new URL(`../fixtures/spreadsheet/${name}`, import.meta.url))
  })),
  ...A.map(samples, (name) => ({ name, bytes: read(new URL(`../../public/samples/${name}`, import.meta.url)) })),
  { name: "generated.csv", bytes: encoder.encode(generated) },
  { name: "unclosed.csv", bytes: encoder.encode(unclosed) },
  { name: "semicolons.csv", bytes: encoder.encode(semicolons) },
  { name: "strays.csv", bytes: encoder.encode(strays) }
]
