// Workbooks built from hand-written parts, each named for what it holds. A test asks for one by name and gets its
// bytes; nothing binary is committed, so what a fixture holds can be read here.
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Zip from "effect/encoding/Zip"
import * as Stream from "effect/Stream"

const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
const strictMain = "http://purl.oclc.org/ooxml/spreadsheetml/main"
const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
const pkg = "http://schemas.openxmlformats.org/package/2006/relationships"
const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

/** One part of an archive: its path and its text. */
export type Part = readonly [path: string, text: string | Uint8Array]

/** Parts as one zip archive, in the order given. */
export const archive = (parts: ReadonlyArray<Part>): Effect.Effect<Uint8Array> =>
  Stream.fromIterable(A.map(parts, ([path, text]) => Zip.file(path, text))).pipe(
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

/** Workbook fixture inputs with absent XML parts represented as Options after decoding. */
export const Recipe = S.Struct({
  sheets: S.Array(
    S.Struct({
      name: S.String.annotateKey({ description: "The name recorded for the sheet" }),
      xml: S.String.annotateKey({ description: "The worksheet XML part as written" }),
      state: S.Literals(["hidden", "veryHidden"])
        .annotateKey({ description: "Hidden sheet state; left out for a visible sheet" })
        .pipe(S.OptionFromOptionalKey)
    }).annotateKey({ description: "One sheet and its worksheet XML" })
  ).annotateKey({ description: "Sheets in archive and workbook order" }),
  sharedStrings: S.String.annotateKey({ description: "Shared text XML part; left out when the archive has none" }).pipe(
    S.OptionFromOptionalKey
  ),
  styles: S.String.annotateKey({ description: "Styles XML part; left out when the archive has none" }).pipe(
    S.OptionFromOptionalKey
  ),
  workbookPr: S.String.annotateKey({
    description: "Workbook properties XML, including the explicit empty starting text"
  }),
  stringsFirst: S.Boolean.annotateKey({ description: "Whether the shared text part precedes worksheet parts" }),
  namespace: S.String.annotateKey({ description: "The workbook XML namespace" }),
  extra: S.Array(
    S.Tuple([
      S.String.annotateKey({ description: "The extra part path in the archive" }),
      S.Union([
        S.String.annotate({ description: "An extra text part" }),
        S.Uint8Array.annotate({ description: "An extra binary part" })
      ]).annotateKey({ description: "The exact text or bytes of the extra part" })
    ]).annotateKey({ description: "One extra archive part" })
  ).annotateKey({ description: "Additional parts in the requested order" })
}).annotate({ description: "Hand-built workbook XML parts and explicit archive ordering" })

/** A fixture recipe after its optional XML parts are decoded. */
export type Recipe = typeof Recipe.Type

/** The explicit fixture inputs before decoding at the builder boundary. */
export type RecipeInput = typeof Recipe.Encoded

/** Starting arguments for a workbook recipe; each caller spreads these before its chosen parts. */
export const recipeStart = {
  namespace: main,
  workbookPr: "",
  stringsFirst: false,
  extra: A.empty<Part>()
}

/** The parts of a hand-built workbook. */
export const partsOf = (input: RecipeInput): Effect.Effect<ReadonlyArray<Part>, S.SchemaError> =>
  Effect.map(S.decodeEffect(Recipe)(input), (recipe): ReadonlyArray<Part> => {
    const ns = recipe.namespace
    const sheets = A.map(recipe.sheets, (sheet, i): Part => [`xl/worksheets/sheet${i + 1}.xml`, sheet.xml])
    const strings: ReadonlyArray<Part> = O.match(recipe.sharedStrings, {
      onNone: A.empty,
      onSome: (text): ReadonlyArray<Part> => [["xl/sharedStrings.xml", text]]
    })
    const styles: ReadonlyArray<Part> = O.match(recipe.styles, {
      onNone: A.empty,
      onSome: (text): ReadonlyArray<Part> => [["xl/styles.xml", text]]
    })
    const workbook =
      `${head}<workbook xmlns="${ns}" xmlns:r="${rel}">${recipe.workbookPr}<sheets>` +
      A.join(
        A.map(recipe.sheets, (sheet, i) =>
          O.match(sheet.state, {
            onNone: () => `<sheet name="${sheet.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
            onSome: (state) => `<sheet name="${sheet.name}" sheetId="${i + 1}" state="${state}" r:id="rId${i + 1}"/>`
          })
        ),
        ""
      ) +
      "</sheets></workbook>"
    const sheetLinks = A.join(
      A.map(
        recipe.sheets,
        (_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
      ),
      ""
    )
    const withStrings = O.match(recipe.sharedStrings, {
      onNone: () => `${head}<Relationships xmlns="${pkg}">${sheetLinks}`,
      onSome: () =>
        `${head}<Relationships xmlns="${pkg}">${sheetLinks}<Relationship Id="rIdS" Type="${rel}/sharedStrings" Target="sharedStrings.xml"/>`
    })
    const links = O.match(recipe.styles, {
      onNone: () => `${withStrings}</Relationships>`,
      onSome: () => `${withStrings}<Relationship Id="rIdT" Type="${rel}/styles" Target="styles.xml"/></Relationships>`
    })
    return [
      ["[Content_Types].xml", `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`],
      [
        "_rels/.rels",
        `${head}<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`
      ],
      ["xl/_rels/workbook.xml.rels", links],
      ...(recipe.stringsFirst === true ? [...strings, ...sheets] : [...sheets, ...strings]),
      ["xl/workbook.xml", workbook],
      ...styles,
      ...recipe.extra
    ]
  })

/** A hand-built workbook as bytes. */
export const workbook = (recipe: RecipeInput): Effect.Effect<Uint8Array, S.SchemaError> =>
  Effect.flatMap(partsOf(recipe), archive)

/** A worksheet part around its rows. */
export const sheet = (rows: string): string => sheetWith({ ...sheetStart, rows })

/** Starting arguments for a worksheet wrapper, spread explicitly at each caller. */
export const sheetStart = { before: "", after: "", ns: main }

/** A worksheet part around its rows, with what comes before or after the sheet data, or another namespace. */
export const sheetWith = (value: { readonly rows: string } & typeof sheetStart): string =>
  `${head}<worksheet xmlns="${value.ns}">${value.before}<sheetData>${value.rows}</sheetData>${value.after}</worksheet>`

/** A shared text table from its entries, each already XML. */
export const strings = (entries: ReadonlyArray<string>): string =>
  `${head}<sst xmlns="${main}" count="${entries.length}">${A.join(
    A.map(entries, (entry) => `<si>${entry}</si>`),
    ""
  )}</sst>`

/** A styles part whose style 0 is General and whose style n is the nth code given. */
export const styles = (codes: ReadonlyArray<string>): string =>
  `${head}<styleSheet xmlns="${main}"><numFmts count="${codes.length}">` +
  A.join(
    A.map(codes, (code, i) => `<numFmt numFmtId="${164 + i}" formatCode="${code}"/>`),
    ""
  ) +
  `</numFmts><fonts count="1"><font/></fonts><fills count="1"><fill/></fills><borders count="1"><border/></borders>` +
  `<cellXfs count="${codes.length + 1}"><xf numFmtId="0"/>` +
  A.join(
    A.map(codes, (_, i) => `<xf numFmtId="${164 + i}"/>`),
    ""
  ) +
  "</cellXfs></styleSheet>"

/** The namespace a Strict workbook uses. */
export const strict = strictMain
