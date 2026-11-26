// The workbooks the parity test reads: the fixtures, for the sheet the reader would pick and for every sheet a person
// could choose, and files built here from hand-written parts, each named for what it holds.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Stream from "effect/Stream"
import * as Zip from "effect/encoding/Zip"

const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships"
const office = "application/vnd.openxmlformats-officedocument.spreadsheetml"

/** A one-sheet workbook from hand-written parts: the sheet's XML, and a styles part whose style n is the nth code. */
export const workbookStart = { codes: A.empty<string>(), strings: `${head}<sst xmlns="${main}"/>` }
export const built = (input: {
  readonly sheet: string
  readonly codes: ReadonlyArray<string>
  readonly strings: string
}) => {
  const codes = input.codes
  const styles =
    `${head}<styleSheet xmlns="${main}"><numFmts count="${codes.length}">` +
    A.join(
      A.map(codes, (code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${code}"/>`),
      ""
    ) +
    `</numFmts><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders>` +
    `<cellXfs count="${codes.length + 1}"><xf numFmtId="0"/>` +
    A.join(
      A.map(codes, (_, i) => `<xf numFmtId="${164 + i}" applyNumberFormat="1"/>`),
      ""
    ) +
    "</cellXfs></styleSheet>"
  const types =
    `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="${office}.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="${office}.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="${office}.styles+xml"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${office}.sharedStrings+xml"/></Types>`
  const parts: ReadonlyArray<readonly [string, string]> = [
    ["[Content_Types].xml", types],
    [
      "_rels/.rels",
      `${head}<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    ],
    [
      "xl/workbook.xml",
      `${head}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets><sheet name="Items" sheetId="1" r:id="rId1"/></sheets></workbook>`
    ],
    [
      "xl/_rels/workbook.xml.rels",
      `${head}<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${rel}/styles" Target="styles.xml"/>` +
        `<Relationship Id="rId3" Type="${rel}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`
    ],
    ["xl/styles.xml", styles],
    ["xl/sharedStrings.xml", input.strings],
    ["xl/worksheets/sheet1.xml", input.sheet]
  ]
  return Stream.fromIterable(A.map(parts, ([path, text]) => Zip.file(path, text))).pipe(
    Stream.pipeThroughChannel(Zip.encode()),
    Stream.runCollect,
    Effect.map((chunks) => {
      const out = new Uint8Array(A.reduce(chunks, 0, (n, chunk) => n + chunk.length))
      let at = 0
      for (const chunk of chunks) {
        out.set(chunk, at)
        at += chunk.length
      }
      return out
    }),
    Effect.orDie
  )
}
const text = (ref: string, value: string) => `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
const bare = (value: string) => `<c t="inlineStr"><is><t>${value}</t></is></c>`
const header = `<row r="1">${text("A1", "SKU")}${text("B1", "Name")}${text("C1", "Quantity")}${text("D1", "Counted")}</row>`
const sheetOf = (rows: string, before: string) =>
  `${head}<worksheet xmlns="${main}">${before}<sheetData>${header}${rows}</sheetData></worksheet>`

const sharedFormulas =
  `<row r="2">${text("A2", "A-1")}${text("B2", "Bolt")}<c r="C2"><v>2</v></c><c r="D2"><f t="shared" ref="D2:D4" si="0">C2*$C$2+1</f><v>5</v></c></row>` +
  `<row r="3">${text("A3", "A-2")}${text("B3", "Nut")}<c r="C3"><v>3</v></c><c r="D3"><f t="shared" si="0"/><v>7</v></c></row>` +
  `<row r="4">${text("A4", "A-3")}${text("B4", "Washer")}<c r="C4"><v>4</v></c><c r="D4"><f t="shared" si="0"/><v>9</v></c></row>`

const textStrings =
  `${head}<sst xmlns="${main}"><si><t>plain</t></si>` +
  `<si><r><t>two </t></r><r><rPr><b/></rPr><t>runs</t></r><rPh sb="0" eb="1"><t>phonetic</t></rPh></si>` +
  `<si><t xml:space="preserve"> spaced </t></si><si><t>tab_x0009_bed</t></si></sst>`
const textRows =
  `<row r="2"><c r="A2" t="s"><v>0</v></c><c r="B2" t="s"><v>1</v></c><c r="C2" t="str"><f>A2&amp;"!"</f><v>plain!</v></c><c r="D2" t="s"><v>2</v></c></row>` +
  `<row r="3"><c r="A3" t="s"><v>3</v></c>${text("B3", "a &amp; b &lt;c&gt;")}<c r="C3" t="inlineStr"><is><r><t>rich </t></r><r><t>inline</t></r></is></c><c r="D3" t="b"><v>0</v></c></row>`

const formatCodes = ["yyyy-mm-dd", "h:mm:ss", "00000", "$#,##0.00", "0%", "m/d/yy h:mm", "d-mmm-yy"]
const formatRows = A.join(
  A.map(
    [59, 60, 61, 0.75, 46_085.604_166_666_66, 123, 1234.5, 0.5],
    (value, i) =>
      `<row r="${i + 2}">${text(`A${i + 2}`, `S-${i}`)}` +
      A.join(
        A.map(formatCodes, (_, style) => `<c r="${"BCDEFGH"[style]}${i + 2}" s="${style + 1}"><v>${value}</v></c>`),
        ""
      ) +
      "</row>"
  ),
  ""
)

const bareRows = `<row>${bare("A-1")}<c><v>1</v></c></row><row r="5" hidden="1">${text("A5", "A-2")}<c r="C5"><v>2</v></c></row>`
const prefixedCell = (ref: string, value: string) =>
  `<x:c r="${ref}" t="inlineStr"><x:is><x:t>${value}</x:t></x:is></x:c>`
const prefixed =
  `<?xml version="1.0"?><x:worksheet xmlns:x="${main}"><x:dimension ref="A1:B3"/><x:sheetData>` +
  `<x:row r="1">${prefixedCell("A1", "SKU")}${prefixedCell("B1", "Quantity")}</x:row>` +
  `<x:row r="2">${prefixedCell("A2", "A-1")}<x:c r="B2"><x:v>4</x:v></x:c></x:row>` +
  `<x:row r="3">${prefixedCell("A3", "A-2")}<x:c r="B3"><x:v>5</x:v></x:c></x:row>` +
  `</x:sheetData><x:mergeCells count="1"><x:mergeCell ref="A3:B3"/></x:mergeCells></x:worksheet>`

/** A workbook whose sheet declares rows 1 to 3 and holds rows 1 to 5. */
export const lyingExtent = built({
  ...workbookStart,
  sheet: sheetOf(
    A.join(
      A.map(
        [2, 3, 4, 5],
        (r) => `<row r="${r}">${text(`A${r}`, `A-${r}`)}${text(`B${r}`, "Bolt")}<c r="C${r}"><v>${r}</v></c></row>`
      ),
      ""
    ),
    '<dimension ref="A1:D3"/>'
  )
})

/** The fixtures every sheet of which is read. */
export const fixtureNames = [
  "date-1904.xlsx",
  "empty.xlsx",
  "libreoffice.xlsx",
  "messy.xlsx",
  "no-header.xlsx",
  "sheets.xlsx"
]

/** One workbook to read: its name, its bytes, and the sheet chosen (none for the reader's own pick). */
export interface XlsxCase {
  readonly name: string
  readonly bytes: Effect.Effect<Uint8Array>
  readonly sheet: O.Option<string>
}

/** The files built by hand, and a fixture cut short. `read` loads a fixture's bytes. */
export const builtCases = (read: (name: string) => Uint8Array): ReadonlyArray<XlsxCase> => [
  {
    name: "built-shared-formulas",
    bytes: built({ ...workbookStart, sheet: sheetOf(sharedFormulas, "") }),
    sheet: O.none()
  },
  {
    name: "built-text",
    bytes: built({ ...workbookStart, sheet: sheetOf(textRows, ""), strings: textStrings }),
    sheet: O.none()
  },
  {
    name: "built-formats",
    bytes: built({ ...workbookStart, sheet: sheetOf(formatRows, ""), codes: formatCodes }),
    sheet: O.none()
  },
  {
    name: "built-bare-references",
    bytes: built({ ...workbookStart, sheet: sheetOf(bareRows, '<cols><col min="2" max="2" hidden="1"/></cols>') }),
    sheet: O.none()
  },
  { name: "built-prefixed", bytes: built({ ...workbookStart, sheet: prefixed }), sheet: O.none() },
  { name: "cut-short", bytes: Effect.sync(() => read("messy.xlsx").subarray(0, 3000)), sheet: O.none() }
]
