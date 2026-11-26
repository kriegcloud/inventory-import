// The only CSV parser in the package: a push machine. `push(state, chunk)` reads one chunk and returns the next state
// with the records and findings the chunk completed; `end(state)` flushes the last record. Splitting the input
// anywhere gives the same records and findings (the chunk-invariance law in Csv.property.test.ts). Inside one chunk
// the state lives in local variables, for speed; a `MachineState` value is built only at the chunk's end. Engine code
// never imports the `Csv` facade: it returns findings as schema values and the facade decides what fails.
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import {
  CsvDiagnostic,
  LimitExceeded,
  MixedTerminators,
  RaggedRecord,
  StrayQuote,
  TextAfterClosingQuote,
  UnterminatedQuote,
  CsvTextLimit
} from "../CsvDiagnostic.schema.ts"
import {
  applyTrim,
  judgeQuote,
  judgeRagged,
  CsvBlankLineRule,
  CsvReadOptions,
  CsvQuoteRule,
  CsvRaggedRule,
  CsvTrimRule
} from "../CsvOptions.schema.ts"
import { CsvIndex, CsvRecordEnd, CsvTextSpan } from "../CsvPosition.schema.ts"
import { CsvCell, CsvRecord } from "../CsvTable.schema.ts"
import { $CsvId } from "./identity.ts"

const $I = $CsvId.create("internal/machine")

// ── the state between chunks, as schemas ─────────────────────────────────────────────────────────────────────────────

/** Where the machine is inside a record. */
export class FieldStart extends S.Opaque<FieldStart, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("fieldStart") }).pipe($I.annoteSchema("FieldStart", { description: "Before a field" }))
) {}
/** Inside a field that did not start with a quote. */
export class Unquoted extends S.Opaque<Unquoted, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("unquoted") }).pipe($I.annoteSchema("Unquoted", { description: "Inside an unquoted field" }))
) {}
/** Inside a quoted field. */
export class Quoted extends S.Opaque<Quoted, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("quoted") }).pipe($I.annoteSchema("Quoted", { description: "Inside a quoted field" }))
) {}
/** Just after a quote inside a quoted field: it closes the field or starts a doubled quote. */
export class QuoteInQuoted extends S.Opaque<QuoteInQuoted, { readonly brand: unique symbol }>()(
  S.Struct({ mode: S.tag("quoteInQuoted") }).pipe(
    $I.annoteSchema("QuoteInQuoted", { description: "Just after a quote inside a quoted field" })
  )
) {}
/** Spaces after a closing quote; a delimiter or line break next drops them (papaparse's rule). */
export class AfterQuoteSpaces extends S.Opaque<AfterQuoteSpaces, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("afterQuoteSpaces"),
    spaces: CsvIndex.pipe(S.annotateKey({ description: "Spaces seen after the closing quote" }))
  }).pipe($I.annoteSchema("AfterQuoteSpaces", { description: "Spaces after a closing quote" }))
) {}

/** Where the machine is inside a record. */
const Mode = LiteralKit(["fieldStart", "unquoted", "quoted", "quoteInQuoted", "afterQuoteSpaces"])
export const MachineMode = Mode.mapMembers(() =>
  Tuple.make(FieldStart, Unquoted, Quoted, QuoteInQuoted, AfterQuoteSpaces)
).pipe(S.toTaggedUnion("mode"), $I.annoteSchema("MachineMode", { description: "Where the machine is in a record" }))
export type MachineMode = typeof MachineMode.Type

const point = CsvIndex
/** The machine's state between chunks. */
export class MachineState extends S.Opaque<MachineState, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: MachineMode.pipe(
      S.annotateKey({ description: "Where the machine is inside a record" }),
      S.withConstructorDefault(Effect.sync(() => FieldStart.make({})))
    ),
    cells: S.Array(CsvCell).pipe(
      S.annotateKey({ description: "The current record's finished cells" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    quoted: S.Array(S.Boolean).pipe(
      S.annotateKey({ description: "Whether each finished cell was quoted" }),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    field: CsvCell.pipe(
      S.annotateKey({ description: "The current cell's text so far" }),
      S.withConstructorDefault(Effect.succeed(""))
    ),
    fieldQuoted: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the current cell started with a quote" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    content: S.Boolean.pipe(
      S.annotateKey({ description: "Whether the current record has consumed any character" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    held: S.Boolean.pipe(
      S.annotateKey({ description: "A record ended at a carriage return and waits to see if a line feed follows" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    crInQuotes: S.Boolean.pipe(
      S.annotateKey({ description: "The last character was a carriage return inside quotes" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    offset: point.pipe(S.annotateKey({ description: "Units consumed" }), S.withConstructorDefault(Effect.succeed(0))),
    line: point.pipe(S.annotateKey({ description: "Current line" }), S.withConstructorDefault(Effect.succeed(0))),
    character: point.pipe(
      S.annotateKey({ description: "Current character in the line" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    recordOffset: point.pipe(
      S.annotateKey({ description: "Where the current record started" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    recordLine: point.pipe(
      S.annotateKey({ description: "Line of the current record's start" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    recordCharacter: point.pipe(
      S.annotateKey({ description: "Character of the current record's start" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    quoteOffset: point.pipe(
      S.annotateKey({ description: "Where the open quote is" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    quoteLine: point.pipe(
      S.annotateKey({ description: "Line of the open quote" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    quoteCharacter: point.pipe(
      S.annotateKey({ description: "Character of the open quote" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    record: point.pipe(
      S.annotateKey({ description: "0-based number of the current record" }),
      S.withConstructorDefault(Effect.succeed(0))
    ),
    emitted: point.pipe(S.annotateKey({ description: "Records emitted" }), S.withConstructorDefault(Effect.succeed(0))),
    width: S.Option(CsvIndex).pipe(
      S.annotateKey({ description: "Cells in the first record" }),
      S.withConstructorDefault(Effect.succeedNone)
    ),
    firstEnd: S.Option(CsvRecordEnd).pipe(
      S.annotateKey({ description: "How the first record with a line break ended" }),
      S.withConstructorDefault(Effect.succeedNone)
    ),
    mixedReported: S.Boolean.pipe(
      S.annotateKey({ description: "Whether mixed terminators were reported" }),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    stopped: S.Boolean.pipe(
      S.annotateKey({ description: "A fatal finding stopped the read" }),
      S.withConstructorDefault(Effect.succeed(false))
    )
  }).pipe($I.annoteSchema("MachineState", { description: "The parser's state between chunks" }))
) {
  /** A fresh read. */
  static readonly initial: MachineState = MachineState.make({})
}

/** A record as the machine emits it: cells, per-cell quoting and how it ended, so a lossless document can follow. */
export class RawRecord extends S.Opaque<RawRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    cells: CsvRecord.pipe(S.annotateKey({ description: "The cells" })),
    quoted: S.NonEmptyArray(S.Boolean).pipe(S.annotateKey({ description: "Whether each cell was quoted" })),
    record: CsvIndex.pipe(S.annotateKey({ description: "0-based record number" })),
    span: CsvTextSpan.pipe(S.annotateKey({ description: "Where the record is" })),
    end: CsvRecordEnd.pipe(S.annotateKey({ description: "How the record ended" }))
  }).pipe($I.annoteSchema("RawRecord", { description: "A record as the machine emits it" }))
) {}

/** The rules the machine reads by. */
export class MachineConfig extends S.Opaque<
  MachineConfig,
  {
    readonly brand: unique symbol
  }
>()(
  S.Struct({
    delimiter: S.String,
    quotes: CsvQuoteRule,
    ragged: CsvRaggedRule,
    blankLines: CsvBlankLineRule,
    trim: CsvTrimRule,
    limits: CsvReadOptions.fields.limits
  })
) {}

/** What one step produced. */
export interface Step {
  readonly state: MachineState
  readonly records: ReadonlyArray<RawRecord>
  readonly diagnostics: ReadonlyArray<CsvDiagnostic>
}

// ── the machine ──────────────────────────────────────────────────────────────────────────────────────────────────────

type Mode = typeof Mode.Type

/** The working references and append-only buffers for one chunk. */
class Run {
  readonly mode: MutableRef.MutableRef<Mode>
  readonly spaces: MutableRef.MutableRef<number>
  readonly field: MutableRef.MutableRef<string>
  readonly fieldQuoted: MutableRef.MutableRef<boolean>
  readonly content: MutableRef.MutableRef<boolean>
  readonly held: MutableRef.MutableRef<boolean>
  readonly crInQuotes: MutableRef.MutableRef<boolean>
  readonly offset: MutableRef.MutableRef<number>
  readonly line: MutableRef.MutableRef<number>
  readonly character: MutableRef.MutableRef<number>
  readonly recordOffset: MutableRef.MutableRef<number>
  readonly recordLine: MutableRef.MutableRef<number>
  readonly recordCharacter: MutableRef.MutableRef<number>
  readonly quoteOffset: MutableRef.MutableRef<number>
  readonly quoteLine: MutableRef.MutableRef<number>
  readonly quoteCharacter: MutableRef.MutableRef<number>
  readonly record: MutableRef.MutableRef<number>
  readonly emitted: MutableRef.MutableRef<number>
  readonly width: MutableRef.MutableRef<O.Option<number>>
  readonly firstEnd: MutableRef.MutableRef<O.Option<CsvRecordEnd>>
  readonly mixedReported: MutableRef.MutableRef<boolean>
  readonly stopped: MutableRef.MutableRef<boolean>
  readonly cells = MutableList.make<string>()
  readonly quoted = MutableList.make<boolean>()
  readonly records = MutableList.make<RawRecord>()
  readonly diagnostics = MutableList.make<CsvDiagnostic>()

  readonly config: MachineConfig

  constructor(state: MachineState, config: MachineConfig) {
    this.config = config
    this.mode = MutableRef.make<Mode>(state.mode.mode)
    this.spaces = MutableRef.make<number>(state.mode.mode === "afterQuoteSpaces" ? state.mode.spaces : 0)
    MutableList.appendAll(this.cells, state.cells)
    MutableList.appendAll(this.quoted, state.quoted)
    this.field = MutableRef.make<string>(state.field)
    this.fieldQuoted = MutableRef.make<boolean>(state.fieldQuoted)
    this.content = MutableRef.make<boolean>(state.content)
    this.held = MutableRef.make<boolean>(state.held)
    this.crInQuotes = MutableRef.make<boolean>(state.crInQuotes)
    this.offset = MutableRef.make<number>(state.offset)
    this.line = MutableRef.make<number>(state.line)
    this.character = MutableRef.make<number>(state.character)
    this.recordOffset = MutableRef.make<number>(state.recordOffset)
    this.recordLine = MutableRef.make<number>(state.recordLine)
    this.recordCharacter = MutableRef.make<number>(state.recordCharacter)
    this.quoteOffset = MutableRef.make<number>(state.quoteOffset)
    this.quoteLine = MutableRef.make<number>(state.quoteLine)
    this.quoteCharacter = MutableRef.make<number>(state.quoteCharacter)
    this.record = MutableRef.make<number>(state.record)
    this.emitted = MutableRef.make<number>(state.emitted)
    this.width = MutableRef.make<O.Option<number>>(state.width)
    this.firstEnd = MutableRef.make<O.Option<CsvRecordEnd>>(state.firstEnd)
    this.mixedReported = MutableRef.make<boolean>(state.mixedReported)
    this.stopped = MutableRef.make<boolean>(state.stopped)
  }

  snapshot(): Step {
    const mode: MachineMode =
      this.mode.current === "afterQuoteSpaces"
        ? AfterQuoteSpaces.make({ spaces: this.spaces.current })
        : MachineMode.cases[this.mode.current].make({})
    return {
      state: MachineState.make({
        mode,
        cells: MutableList.toArray(this.cells),
        quoted: MutableList.toArray(this.quoted),
        field: this.field.current,
        fieldQuoted: this.fieldQuoted.current,
        content: this.content.current,
        held: this.held.current,
        crInQuotes: this.crInQuotes.current,
        offset: this.offset.current,
        line: this.line.current,
        character: this.character.current,
        recordOffset: this.recordOffset.current,
        recordLine: this.recordLine.current,
        recordCharacter: this.recordCharacter.current,
        quoteOffset: this.quoteOffset.current,
        quoteLine: this.quoteLine.current,
        quoteCharacter: this.quoteCharacter.current,
        record: this.record.current,
        emitted: this.emitted.current,
        width: this.width.current,
        firstEnd: this.firstEnd.current,
        mixedReported: this.mixedReported.current,
        stopped: this.stopped.current
      }),
      records: MutableList.toArray(this.records),
      diagnostics: MutableList.toArray(this.diagnostics)
    }
  }

  span(offset: number, length: number, line: number, character: number): CsvTextSpan {
    return CsvTextSpan.make({ offset, length, line, character })
  }

  here(length: number): CsvTextSpan {
    return this.span(this.offset.current, length, this.line.current, this.character.current)
  }

  report(diagnostic: CsvDiagnostic): void {
    MutableList.append(this.diagnostics, diagnostic)
    if (diagnostic.severity === "fatal") this.stopped.current = true
  }

  limit(limit: CsvTextLimit, maximum: number, at: CsvTextSpan): void {
    this.report(CsvDiagnostic.cases.fatal.make({ finding: LimitExceeded.make({ limit, maximum, at }) }))
  }

  /** Moves past one consumed unit that is not a line break. */
  advance(units: number): void {
    this.offset.current += units
    this.character.current += units
  }

  /** Moves past a line break of `units` units. */
  breakLine(units: number): void {
    this.offset.current += units
    this.line.current += 1
    this.character.current = 0
  }

  checkField(): void {
    const { maxFieldLength, maxRecordLength } = this.config.limits
    if (this.field.current.length > maxFieldLength) this.limit("fieldLength", maxFieldLength, this.here(0))
    else if (this.offset.current - this.recordOffset.current > maxRecordLength)
      this.limit("recordLength", maxRecordLength, this.here(0))
  }

  endField(): void {
    const cell = applyTrim(this.config.trim, this.field.current, this.fieldQuoted.current)
    MutableList.append(this.cells, cell)
    MutableList.append(this.quoted, this.fieldQuoted.current)
    this.field.current = ""
    this.fieldQuoted.current = false
    this.mode.current = "fieldStart"
    this.spaces.current = 0
    const { maxFieldsPerRecord } = this.config.limits
    if (this.cells.length > maxFieldsPerRecord) this.limit("fieldsPerRecord", maxFieldsPerRecord, this.here(0))
    else this.checkField()
  }

  /** Finishes the current record's last field and emits the record with how it ended. */
  endRecord(end: CsvRecordEnd): void {
    if (this.mode.current !== "fieldStart" || this.cells.length === 0 || this.content.current) this.endField()
    if (this.stopped.current) return
    const cells = MutableList.takeAll(this.cells)
    const quoted = MutableList.takeAll(this.quoted)
    const recordIndex = this.record.current
    const span = this.span(
      this.recordOffset.current,
      this.offset.current - this.recordOffset.current,
      this.recordLine.current,
      this.recordCharacter.current
    )
    this.content.current = false
    this.record.current += 1
    if (end !== "EndOfInput") {
      O.match(this.firstEnd.current, {
        onNone: () => {
          this.firstEnd.current = O.some(end)
        },
        onSome: (first) => {
          if (first !== end && !this.mixedReported.current) {
            this.mixedReported.current = true
            this.report(
              CsvDiagnostic.cases.warning.make({
                finding: MixedTerminators.make({ at: span, first, other: end })
              })
            )
          }
        }
      })
    }
    const blank = cells.length === 1 && cells[0] === "" && quoted[0] === false
    if (blank && this.config.blankLines === "skip") return
    const [head, ...rest] = cells
    const [quotedHead, ...quotedRest] = quoted
    if (head === undefined || quotedHead === undefined) return
    const record: [string, ...Array<string>] = [head, ...rest]
    const flags: [boolean, ...Array<boolean>] = [quotedHead, ...quotedRest]
    O.match(this.width.current, {
      onNone: () => {
        this.width.current = O.some(record.length)
      },
      onSome: (width) => {
        if (record.length !== width) {
          this.report(
            judgeRagged(
              this.config.ragged,
              RaggedRecord.make({ at: span, record: recordIndex, expected: width, actual: record.length })
            )
          )
          if (this.config.ragged === "pad") {
            while (record.length < width) {
              record.push("")
              flags.push(false)
            }
          }
        }
      }
    })
    if (this.stopped.current) return
    this.emitted.current += 1
    const { maxRecords } = this.config.limits
    if (this.emitted.current > maxRecords) {
      this.limit("records", maxRecords, span)
      return
    }
    MutableList.append(this.records, RawRecord.make({ cells: record, quoted: flags, record: recordIndex, span, end }))
  }

  startRecordIfNeeded(): void {
    if (!this.content.current) {
      this.content.current = true
      this.recordOffset.current = this.offset.current
      this.recordLine.current = this.line.current
      this.recordCharacter.current = this.character.current
    }
  }

  quoteFinding(kind: "stray" | "after"): void {
    const at = this.here(1)
    const field = this.cells.length
    const finding =
      kind === "stray"
        ? StrayQuote.make({ at, record: this.record.current, field })
        : TextAfterClosingQuote.make({ at, record: this.record.current, field })
    this.report(judgeQuote(this.config.quotes, finding))
  }

  /** Releases a record held at a carriage return, now that the next unit is known not to be a line feed. */
  releaseHeld(lineFeedFollows: boolean): void {
    if (!this.held.current) return
    this.held.current = false
    if (lineFeedFollows) {
      // The CR was already counted as a line break; the LF joins it.
      this.offset.current += 1
      this.endRecord("CRLF")
    } else {
      this.endRecord("CR")
    }
  }

  push(text: string): void {
    const length = text.length
    let i = 0
    while (i < length && !this.stopped.current) {
      if (this.held.current) {
        if (text[i] === "\n") {
          this.releaseHeld(true)
          i += 1
          continue
        }
        this.releaseHeld(false)
        if (this.stopped.current) break
      }
      i = this.step(this.mode.current)(text, i)
    }
  }

  /**
   * The step each mode takes at `text[i]`: it reads what it can and answers where the next step starts. A step that
   * answers `i` itself has changed the mode, or stopped the run, and the same unit is read again.
   */
  private readonly step = Mode.match({
    fieldStart: () => this.plainStep,
    unquoted: () => this.plainStep,
    quoted: () => this.quotedStep,
    quoteInQuoted: () => this.closingQuoteStep,
    afterQuoteSpaces: () => this.afterSpacesStep
  })

  /** At the start of a field, or inside one written without quotes. */
  private readonly plainStep = (text: string, i: number): number => {
    const delimiter = this.config.delimiter
    const length = text.length
    const c = text[i]
    if (c === "\r" || c === "\n") {
      if (this.mode.current === "fieldStart" && !this.content.current) {
        // A blank line: a record of one empty cell.
        this.startRecordIfNeeded()
      }
      if (c === "\r") {
        this.breakLine(1)
        this.held.current = true
      } else {
        this.breakLine(1)
        this.endRecord("LF")
      }
      return i + 1
    }
    this.startRecordIfNeeded()
    if (c === delimiter) {
      this.endField()
      this.advance(1)
      return i + 1
    }
    if (c === '"' && this.mode.current === "fieldStart") {
      this.mode.current = "quoted"
      this.fieldQuoted.current = true
      this.quoteOffset.current = this.offset.current
      this.quoteLine.current = this.line.current
      this.quoteCharacter.current = this.character.current
      this.advance(1)
      return i + 1
    }
    if (c === '"') {
      this.quoteFinding("stray")
      if (this.stopped.current) return i
      this.field.current += '"'
      this.advance(1)
      return i + 1
    }
    // A run of ordinary characters.
    this.mode.current = "unquoted"
    let j = i + 1
    while (j < length) {
      const d = text[j]
      if (d === delimiter || d === '"' || d === "\r" || d === "\n") break
      j += 1
    }
    this.field.current += Str.slice(i, j)(text)
    this.advance(j - i)
    this.checkField()
    return j
  }

  /** Inside quotes: everything up to the next quote is the field's text, line breaks included. */
  private readonly quotedStep = (text: string, i: number): number => {
    const length = text.length
    if (text[i] === '"') {
      this.mode.current = "quoteInQuoted"
      this.advance(1)
      return i + 1
    }
    let j = i
    while (j < length) {
      const d = text[j]
      if (d === '"') break
      if (d === "\r") {
        this.line.current += 1
        this.character.current = 0
        this.offset.current += 1
        this.crInQuotes.current = true
      } else if (d === "\n") {
        if (!this.crInQuotes.current) {
          this.line.current += 1
        }
        this.character.current = 0
        this.offset.current += 1
        this.crInQuotes.current = false
      } else {
        this.crInQuotes.current = false
        this.advance(1)
      }
      j += 1
    }
    this.field.current += Str.slice(i, j)(text)
    this.checkField()
    return j
  }

  /** Just after a quote inside quotes: a second quote is a quote in the text, anything else closes the field. */
  private readonly closingQuoteStep = (text: string, i: number): number => {
    const c = text[i]
    this.crInQuotes.current = false
    if (c === '"') {
      this.field.current += '"'
      this.mode.current = "quoted"
      this.advance(1)
      return i + 1
    }
    if (c === this.config.delimiter) {
      this.endField()
      this.advance(1)
      return i + 1
    }
    if (c === "\r" || c === "\n") {
      this.mode.current = "unquoted"
      return i
    }
    if (c === " ") {
      this.mode.current = "afterQuoteSpaces"
      this.spaces.current = 1
      this.advance(1)
      return i + 1
    }
    this.quoteFinding("after")
    if (this.stopped.current) return i
    this.field.current += '"'
    this.mode.current = "quoted"
    return i
  }

  /** Spaces after a closing quote: a delimiter or a line break next drops them. */
  private readonly afterSpacesStep = (text: string, i: number): number => {
    const delimiter = this.config.delimiter
    const c = text[i]
    if (c === " ") {
      this.spaces.current += 1
      this.advance(1)
      return i + 1
    }
    if (c === delimiter || c === "\r" || c === "\n") {
      if (this.config.quotes === "strict") {
        this.quoteFinding("after")
        return i
      }
      if (c === delimiter) {
        this.endField()
        this.advance(1)
        return i + 1
      }
      this.mode.current = "unquoted"
      return i
    }
    this.quoteFinding("after")
    if (this.stopped.current) return i
    this.field.current += `"${Str.repeat(this.spaces.current)(" ")}`
    this.spaces.current = 0
    if (c !== '"') {
      this.mode.current = "quoted"
      return i
    }
    this.mode.current = "quoteInQuoted"
    this.advance(1)
    return i + 1
  }

  end(): void {
    if (this.stopped.current) return
    if (this.held.current) {
      this.releaseHeld(false)
      return
    }
    if (this.mode.current === "quoted") {
      const at = this.span(this.quoteOffset.current, 1, this.quoteLine.current, this.quoteCharacter.current)
      this.report(
        CsvDiagnostic.cases.fatal.make({
          finding: UnterminatedQuote.make({ at, record: this.record.current, field: this.cells.length })
        })
      )
      return
    }
    if (this.mode.current === "afterQuoteSpaces" && this.config.quotes === "strict") {
      this.quoteFinding("after")
      return
    }
    if (this.content.current) this.endRecord("EndOfInput")
  }
}

/** Reads one chunk. */
export const push: {
  (chunk: string, config: MachineConfig): (state: MachineState) => Step
  (state: MachineState, chunk: string, config: MachineConfig): Step
} = dual(3, (state: MachineState, chunk: string, config: MachineConfig): Step => {
  const run = new Run(state, config)
  run.push(chunk)
  return run.snapshot()
})

/** Flushes the last record at the end of the input. */
export const end: {
  (config: MachineConfig): (state: MachineState) => Step
  (state: MachineState, config: MachineConfig): Step
} = dual(2, (state: MachineState, config: MachineConfig): Step => {
  const run = new Run(state, config)
  run.end()
  return run.snapshot()
})
