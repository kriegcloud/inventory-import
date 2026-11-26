// One worksheet part, read event by event: its rows of cells, its merged ranges, its hidden columns and the extent
// it declares. A reader is fed the part's XML events and hands back each row as its end tag arrives, so a sheet of
// any length costs one row of memory until the caller keeps the rows. Nothing here trusts the file: a reference
// that cannot be read is placed after the one before it, and a value that cannot be read is kept as what was
// written and reported.
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Match from "effect/Match"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as Order from "effect/Order"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { MAX_COLUMN, MAX_ROW, XlsxAddress, XlsxRange } from "../XlsxAddress.schema.ts"
import {
  MAX_FORMULA_CHARS,
  XlsxBlank,
  XlsxBoolean,
  XlsxError,
  XlsxErrorCode,
  XlsxNumberFormat,
  holdsSomething,
  type XlsxDate,
  type XlsxNumber,
  type XlsxText,
  type XlsxUnreadable,
  type XlsxValue
} from "../XlsxCell.schema.ts"
import {
  BadAddress,
  DeclaredExtentWrong,
  FictitiousLeapDay,
  FormatNotShown,
  FormulaWithoutResult,
  LimitExceeded,
  RowOutOfOrder,
  UnknownStyle,
  UnreadableCell,
  XlsxWarning,
  type XlsxFatal,
  type XlsxLimit
} from "../XlsxDiagnostic.schema.ts"
import { MAX_SERIAL } from "../XlsxSerial.schema.ts"
import type { XlsxRow } from "../XlsxWorkbook.schema.ts"
import { stop, type Caps } from "./container.ts"
import { shifted } from "./formula.ts"
import { isTrue, localName, unescaped, type XmlEvent } from "./ooxml.ts"
import { serialOf } from "./serial.ts"
import { isXmlSafe } from "./text.ts"
import { detached, trusted } from "./trusted.ts"
import { styleOf, type StyleFormat } from "./workbookPart.ts"

/** A cell as a row holds it. */
export type ReadCell = XlsxRow["cells"][number]

/** A row as the reader hands it on: the fields of `XlsxRow`, already in rising column order. */
export interface ReadRow {
  readonly number: number
  readonly hidden: boolean
  readonly cells: ReadonlyArray<ReadCell>
}

/** What a sheet's XML says beside its rows. */
export interface SheetLayout {
  readonly declared: O.Option<XlsxRange>
  readonly merges: ReadonlyArray<XlsxRange>
  readonly hiddenColumns: ReadonlyArray<number>
  readonly rows: number
  readonly rowsWithValues: number
  readonly cellsWithValues: number
  readonly lastRow: O.Option<number>
  /** Whether a row came after a later one, so the rows are not in rising order as they were handed on. */
  readonly unordered: boolean
}

const none: ReadonlyArray<ReadRow> = []
/**
 * What the `t` attribute of a cell says it holds (ECMA-376 part 1, 18.18.11): a shared string, a formula's string,
 * a boolean, an error, an ISO date, inline text, or a number. A cell with no `t`, or one nobody knows, is a number.
 */
const CellType = LiteralKit(["s", "str", "b", "e", "d", "inlineStr", "n"])
type CellType = typeof CellType.Type

/** The cell types by the text a file writes for them. */
const cellTypes: Readonly<Record<string, CellType>> = {
  s: "s",
  str: "str",
  b: "b",
  e: "e",
  d: "d",
  inlineStr: "inlineStr",
  n: "n"
}

const numberText = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
const isoDate = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?Z?)?$/
const general: StyleFormat = { format: XlsxNumberFormat.general, dated: false, notShown: false }
const shortDate: StyleFormat = styleOf(XlsxNumberFormat.make({ id: 14, code: "m/d/yy" }))
const blank = XlsxBlank.make({})
const yes = XlsxBoolean.make({ value: true })
const no = XlsxBoolean.make({ value: false })

const letters: { readonly [letter: string]: number } = R.fromEntries(
  A.map(A.fromIterable("ABCDEFGHIJKLMNOPQRSTUVWXYZ"), (letter, index) => [letter, index + 1] as const)
)

/**
 * The 0-based column of a cell reference such as `B7`, or -1 when it is not one. Read for every cell of every
 * sheet, so it is a loop over the letters with no pattern and no allocation; the row comes from the row element.
 */
const columnOf = (reference: string): number => {
  let column = 0
  let i = 0
  if (reference[0] === "$") i = 1
  const start = i
  while (i < reference.length) {
    const value = letters[reference[i] ?? ""]
    if (value === undefined) break
    column = column * 26 + value
    i += 1
  }
  if (i === start || i - start > 3 || column > MAX_COLUMN + 1) return -1
  if (reference[i] === "$") i += 1
  if (i >= reference.length) return -1
  for (let k = i; k < reference.length; k += 1) {
    const digit = reference[k] ?? ""
    if (digit < "0" || digit > "9") return -1
  }
  return column - 1
}

/**
 * Reads one worksheet part. Feed it the part's events with `push`; each call returns the rows that ended in it.
 * `failed` holds the finding that stopped the read, after which events are ignored.
 */
export class SheetReader {
  private readonly warningBuffer = MutableList.make<XlsxWarning>()
  private readonly failedRef = MutableRef.make<O.Option<XlsxFatal>>(O.none())

  private readonly depth = MutableRef.make(0)
  private readonly section = MutableRef.make("")
  private readonly declared = MutableRef.make<O.Option<XlsxRange>>(O.none())
  private readonly merges = MutableList.make<XlsxRange>()
  private readonly hiddenColumns = MutableList.make<number>()
  private readonly masters = MutableHashMap.empty<
    string,
    { readonly text: string; readonly column: number; readonly row: number }
  >()
  private readonly notShown = MutableHashMap.empty<string, number>()

  private readonly rowCount = MutableRef.make(0)
  private readonly rowsWithValues = MutableRef.make(0)
  private readonly cellsWithValues = MutableRef.make(0)
  private readonly lastRowWithValues = MutableRef.make(0)
  private readonly previousRow = MutableRef.make(0)
  private readonly unordered = MutableRef.make(false)
  private readonly firstColumn = MutableRef.make(Number.MAX_SAFE_INTEGER)
  private readonly lastColumn = MutableRef.make(-1)
  private readonly firstRow = MutableRef.make(0)

  private readonly inRow = MutableRef.make(false)
  private readonly rowNumber = MutableRef.make(0)
  private readonly rowHidden = MutableRef.make(false)
  private readonly cells = MutableList.make<ReadCell>()
  private readonly cellsSorted = MutableRef.make(true)
  private readonly lastCellColumn = MutableRef.make(-1)
  private readonly held = MutableRef.make(0)

  private readonly inCell = MutableRef.make(false)
  private readonly cellColumn = MutableRef.make(0)
  private readonly cellType = MutableRef.make<CellType>("n")
  private readonly cellStyle = MutableRef.make(-1)
  private readonly cellReference = MutableRef.make("")
  private readonly target = MutableRef.make<"" | "v" | "f" | "t">("")
  private readonly targetDepth = MutableRef.make(-1)
  private readonly skipDepth = MutableRef.make(-1)
  private readonly hasValue = MutableRef.make(false)
  private readonly valueText = MutableRef.make("")
  private readonly hasInline = MutableRef.make(false)
  private readonly inlineText = MutableRef.make("")
  private readonly hasFormula = MutableRef.make(false)
  private readonly formulaText = MutableRef.make("")
  private readonly formulaShared = MutableRef.make("")

  private readonly sheet: string
  private readonly path: string
  private readonly styles: ReadonlyArray<StyleFormat>
  private readonly strings: ReadonlyArray<string>
  private readonly date1904: boolean
  private readonly caps: Caps

  /** Findings accumulated so far, in file order. */
  get warnings(): ReadonlyArray<XlsxWarning> {
    return MutableList.toArray(this.warningBuffer)
  }

  /** The fatal finding that stopped the sheet, if any. */
  get failed(): O.Option<XlsxFatal> {
    return this.failedRef.current
  }

  constructor(input: {
    readonly sheet: string
    readonly path: string
    readonly styles: ReadonlyArray<StyleFormat>
    readonly strings: ReadonlyArray<string>
    readonly date1904: boolean
    readonly caps: Caps
  }) {
    this.sheet = input.sheet
    this.path = input.path
    this.styles = input.styles
    this.strings = input.strings
    this.date1904 = input.date1904
    this.caps = input.caps
  }

  /**
   * What each kind of event does, told by its case (built once: a sheet sends one per tag and per text): text goes into
   * the value being read, an element opened or closed moves the depth, and the rest of the XML says nothing of cells.
   */
  private readonly step = Match.typeTags<XmlEvent>()({
    Text: (event): ReadonlyArray<ReadRow> => this.text(event.text),
    StartElement: (event): ReadonlyArray<ReadRow> => this.opened(event.name, event.attributes),
    EndElement: (): ReadonlyArray<ReadRow> => this.closed(),
    Declaration: () => none,
    Doctype: () => none,
    Comment: () => none,
    ProcessingInstruction: () => none
  })

  /** Takes one event of the part and returns the rows that ended with it. */
  push(event: XmlEvent): ReadonlyArray<ReadRow> {
    return O.isSome(this.failed) ? none : this.step(event)
  }

  private text(text: string): ReadonlyArray<ReadRow> {
    if (this.target.current === "v") this.valueText.current += text
    else if (this.target.current === "t") this.inlineText.current += text
    else if (this.target.current === "f") this.formulaText.current += text
    return none
  }

  private opened(name: string, attributes: Readonly<Record<string, string>>): ReadonlyArray<ReadRow> {
    this.depth.current += 1
    this.start(localName(name), attributes)
    return none
  }

  private closed(): ReadonlyArray<ReadRow> {
    const depth = this.depth.current
    this.depth.current -= 1
    if (depth === this.targetDepth.current) {
      this.target.current = ""
      this.targetDepth.current = -1
      return none
    }
    if (depth === this.skipDepth.current) {
      this.skipDepth.current = -1
      return none
    }
    if (this.inCell.current && depth === 4) {
      this.endCell()
      return none
    }
    if (this.inRow.current && depth === 3) return this.endRow()
    if (depth === 2) this.section.current = ""
    return none
  }

  /** What the sheet's XML said beside its rows, once every event has been pushed. Adds the sheet's own findings. */
  finish(): SheetLayout {
    for (const [code, cells] of this.notShown) {
      this.warn(FormatNotShown.make({ sheet: this.sheet, code: Str.slice(0, 255)(code), cells }))
    }
    const found =
      this.lastRowWithValues.current === 0
        ? O.none()
        : O.some(
            XlsxRange.make({
              first: XlsxAddress.make({ column: this.firstColumn.current, row: this.firstRow.current }),
              last: XlsxAddress.make({ column: this.lastColumn.current, row: this.lastRowWithValues.current })
            })
          )
    if (O.isSome(this.declared.current) && O.isSome(found)) {
      const declared = this.declared.current.value
      if (!XlsxRange.contains(declared, found.value.first) || !XlsxRange.contains(declared, found.value.last)) {
        this.warn(DeclaredExtentWrong.make({ sheet: this.sheet, declared, found }))
      }
    }
    return {
      declared: this.declared.current,
      merges: MutableList.toArray(this.merges),
      hiddenColumns: MutableList.toArray(this.hiddenColumns),
      rows: this.rowCount.current,
      rowsWithValues: this.rowsWithValues.current,
      cellsWithValues: this.cellsWithValues.current,
      lastRow: this.lastRowWithValues.current === 0 ? O.none() : O.some(this.lastRowWithValues.current),
      unordered: this.unordered.current
    }
  }

  private warn(finding: XlsxWarning["finding"]): void {
    if (this.warningBuffer.length < 10_000) MutableList.append(this.warningBuffer, XlsxWarning.make({ finding }))
  }

  private fail(limit: XlsxLimit): void {
    this.failedRef.current = O.some(stop(LimitExceeded.make({ limit, path: Str.slice(0, 1024)(this.path) })))
  }

  private start(name: string, attributes: Readonly<Record<string, string>>): void {
    const depth = this.depth.current
    if (this.skipDepth.current !== -1) return
    if (depth === 2) {
      this.section.current = name
      if (name === "dimension") this.declared.current = XlsxRange.parse(attributes["ref"] ?? "")
      return
    }
    if (depth === 3) {
      if (this.section.current === "sheetData" && name === "row") this.startRow(attributes)
      else if (this.section.current === "mergeCells" && name === "mergeCell") {
        const range = XlsxRange.parse(attributes["ref"] ?? "")
        if (O.isSome(range)) MutableList.append(this.merges, range.value)
      } else if (this.section.current === "cols" && name === "col" && isTrue(attributes["hidden"])) {
        const first = Number(attributes["min"])
        const last = Math.min(Number(attributes["max"]), this.caps.columns)
        if (Number.isInteger(first) && Number.isInteger(last)) {
          for (let column = Math.max(first, 1); column <= last; column += 1)
            MutableList.append(this.hiddenColumns, column - 1)
        }
      }
      return
    }
    if (depth === 4 && this.inRow.current && name === "c") {
      this.startCell(attributes)
      return
    }
    if (!this.inCell.current) return
    if (depth === 5) {
      if (name === "v") {
        this.hasValue.current = true
        this.target.current = "v"
        this.targetDepth.current = depth
      } else if (name === "f") {
        this.hasFormula.current = true
        this.formulaShared.current = attributes["t"] === "shared" ? (attributes["si"] ?? "") : ""
        this.target.current = "f"
        this.targetDepth.current = depth
      } else if (name === "is") this.hasInline.current = true
      return
    }
    if (this.hasInline.current && this.target.current === "") {
      if (name === "rPh") this.skipDepth.current = depth
      else if (name === "t") {
        this.target.current = "t"
        this.targetDepth.current = depth
      }
    }
  }

  private startRow(attributes: Readonly<Record<string, string>>): void {
    const written = attributes["r"]
    let number = this.previousRow.current + 1
    if (written !== undefined) {
      const parsed = Number(written)
      if (Number.isInteger(parsed) && parsed >= 1) number = parsed
      else
        this.warn(
          BadAddress.make({ sheet: this.sheet, row: Math.min(number, MAX_ROW), raw: Str.slice(0, 255)(written) })
        )
    }
    this.rowCount.current += 1
    if (number > MAX_ROW || this.rowCount.current > this.caps.rows) {
      this.fail("rows")
      return
    }
    if (number <= this.previousRow.current) {
      this.unordered.current = true
      this.warn(RowOutOfOrder.make({ sheet: this.sheet, row: number }))
    } else this.previousRow.current = number
    this.inRow.current = true
    this.rowNumber.current = number
    this.rowHidden.current = isTrue(attributes["hidden"])
    MutableList.clear(this.cells)
    this.cellsSorted.current = true
    this.lastCellColumn.current = -1
    this.held.current = 0
  }

  private endRow(): ReadonlyArray<ReadRow> {
    this.inRow.current = false
    if (O.isSome(this.failed)) return none
    const cells = MutableList.toArray(this.cells)
    if (this.held.current > 0) {
      this.rowsWithValues.current += 1
      this.cellsWithValues.current += this.held.current
      if (this.firstRow.current === 0 || this.rowNumber.current < this.firstRow.current)
        this.firstRow.current = this.rowNumber.current
      if (this.rowNumber.current > this.lastRowWithValues.current)
        this.lastRowWithValues.current = this.rowNumber.current
    }
    return [
      {
        number: this.rowNumber.current,
        hidden: this.rowHidden.current,
        cells: this.cellsSorted.current
          ? cells
          : A.sort(
              cells,
              Order.mapInput(Order.Number, (cell: ReadCell) => cell.column)
            )
      }
    ]
  }

  private startCell(attributes: Readonly<Record<string, string>>): void {
    const written = attributes["r"]
    let column = this.lastCellColumn.current + 1
    if (written !== undefined) {
      const parsed = columnOf(written)
      if (parsed >= 0) column = parsed
      else
        this.warn(BadAddress.make({ sheet: this.sheet, row: this.rowNumber.current, raw: Str.slice(0, 255)(written) }))
    }
    if (column >= this.caps.columns) {
      this.fail("columns")
      return
    }
    this.inCell.current = true
    this.cellColumn.current = column
    this.cellReference.current = written ?? ""
    this.cellType.current = O.getOrElse(R.get(cellTypes, attributes["t"] ?? "n"), (): CellType => "n")
    const style = attributes["s"]
    this.cellStyle.current = style === undefined ? -1 : Number(style)
    this.hasValue.current = false
    this.valueText.current = ""
    this.hasInline.current = false
    this.inlineText.current = ""
    this.hasFormula.current = false
    this.formulaText.current = ""
    this.formulaShared.current = ""
  }

  private styleFormat(address: () => XlsxAddress): StyleFormat {
    if (this.cellStyle.current === -1) return this.styles[0] ?? general
    const style = this.styles[this.cellStyle.current]
    if (style !== undefined) return style
    if (this.styles.length > 0 || this.cellStyle.current !== 0) {
      this.warn(
        UnknownStyle.make({
          sheet: this.sheet,
          address: address(),
          style: Number.isInteger(this.cellStyle.current) && this.cellStyle.current >= 0 ? this.cellStyle.current : 0
        })
      )
    }
    return general
  }

  private endCell(): void {
    this.inCell.current = false
    if (O.isSome(this.failed)) return
    const column = this.cellColumn.current
    const row = this.rowNumber.current
    const address = (): XlsxAddress => XlsxAddress.make({ column, row })
    let formula: O.Option<string> = O.none()
    if (this.hasFormula.current) {
      let text = this.formulaText.current
      if (this.formulaShared.current !== "") {
        if (text !== "") MutableHashMap.set(this.masters, this.formulaShared.current, { text, column, row })
        else {
          const master = MutableHashMap.get(this.masters, this.formulaShared.current)
          if (O.isSome(master)) {
            text = shifted({
              formula: master.value.text,
              columns: column - master.value.column,
              rows: row - master.value.row
            })
          }
        }
      }
      if (text.length > MAX_FORMULA_CHARS * 4) {
        this.fail("cellChars")
        return
      }
      formula = O.some(text.length <= MAX_FORMULA_CHARS && isXmlSafe(text) ? text : "")
    }
    let style = this.styleFormat(address)
    let value: XlsxValue = blank
    const raw = this.hasInline.current ? this.inlineText.current : this.valueText.current
    if (raw.length > this.caps.cellChars) {
      this.fail("cellChars")
      return
    }
    const unreadable = (reason: UnreadableCell["reason"]): XlsxValue => {
      this.warn(UnreadableCell.make({ sheet: this.sheet, address: address(), reason }))
      const written = unescaped(raw)
      return trusted<XlsxUnreadable>({
        kind: "Unreadable",
        raw: detached(S.is(XlsxErrorCode)(written) ? `'${written}` : written)
      })
    }
    if (this.cellType.current === "inlineStr") {
      if (this.hasInline.current) value = trusted<XlsxText>({ kind: "Text", text: detached(unescaped(raw)) })
    } else if (this.hasValue.current || this.hasInline.current) {
      value = CellType.matchOrElse(
        this.cellType.current,
        {
          s: () => {
            const index = Number(Str.trim(raw))
            const text = Number.isInteger(index) && index >= 0 ? this.strings[index] : undefined
            return text === undefined ? unreadable("sharedString") : trusted<XlsxText>({ kind: "Text", text })
          },
          str: () => trusted<XlsxText>({ kind: "Text", text: detached(unescaped(raw)) }),
          b: () => {
            const text = Str.toLowerCase(Str.trim(raw))
            return text === "1" || text === "true" ? yes : text === "0" || text === "false" ? no : unreadable("boolean")
          },
          e: (): XlsxValue => (S.is(XlsxErrorCode)(raw) ? XlsxError.make({ code: raw }) : unreadable("errorCode")),
          d: () => {
            const found = isoDate.exec(Str.trim(raw))
            const serial =
              found === null
                ? undefined
                : serialOf({
                    parts: {
                      year: Number(found[1]),
                      month: Number(found[2]),
                      day: Number(found[3]),
                      hour: Number(found[4] ?? "0"),
                      minute: Number(found[5] ?? "0"),
                      second: Number(found[6] ?? "0")
                    },
                    date1904: this.date1904
                  })
            if (serial === undefined || serial > MAX_SERIAL) return unreadable("date")
            if (!style.dated) style = shortDate
            return trusted<XlsxDate>({ kind: "Date", serial })
          }
        },
        // A number, which is also what a cell of no type or of a type nobody knows holds.
        () => {
          const text = Str.trim(raw)
          if (text === "") return blank
          const number = numberText.test(text) ? Number(text) : Number.NaN
          if (!Number.isFinite(number)) return unreadable("number")
          return style.dated && number >= 0 && number <= MAX_SERIAL
            ? trusted<XlsxDate>({ kind: "Date", serial: number })
            : trusted<XlsxNumber>({ kind: "Number", value: number })
        }
      )
    }
    if (value.kind === "Blank") {
      if (O.isNone(formula)) return
      this.warn(FormulaWithoutResult.make({ sheet: this.sheet, address: address() }))
    } else if (value.kind === "Date") {
      if (!this.date1904 && Math.floor(value.serial) === 60) {
        this.warn(FictitiousLeapDay.make({ sheet: this.sheet, address: address() }))
      }
      if (style.notShown) this.countNotShown(style.format.code)
    } else if (value.kind === "Number" && style.notShown && !style.dated) this.countNotShown(style.format.code)
    if (column <= this.lastCellColumn.current) {
      for (const cell of MutableList.toArray(this.cells)) {
        if (cell.column === column) {
          this.warn(BadAddress.make({ sheet: this.sheet, row, raw: Str.slice(0, 255)(this.cellReference.current) }))
          return
        }
      }
      this.cellsSorted.current = false
    } else this.lastCellColumn.current = column
    if (holdsSomething(value)) {
      this.held.current += 1
      if (column < this.firstColumn.current) this.firstColumn.current = column
      if (column > this.lastColumn.current) this.lastColumn.current = column
    }
    MutableList.append(this.cells, { column, value, formula, format: style.format })
  }

  private countNotShown(code: string): void {
    MutableHashMap.set(this.notShown, code, O.getOrElse(MutableHashMap.get(this.notShown, code), () => 0) + 1)
  }
}

/** A read row as the `XlsxRow` it is. */
export const toRow = (row: ReadRow): XlsxRow => trusted<XlsxRow>(row)
