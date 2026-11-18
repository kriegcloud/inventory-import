/**
 * What can be wrong with a file as a whole, so that it cannot be read or staged: one shape for the browser's reader
 * and for any server step that stages a file, so the screen says it the same way wherever it was found. The rule
 * this file protects: a problem in the person's file is data the screen shows (what is wrong, then what to do), never
 * a request error. A server step that stages a file answers 200 with a `StagingOutcome`, what it made or a
 * `FileProblem`; request errors stay for what is not the person's file (not signed in, not allowed, an upload that is
 * gone, the server broke).
 */
import { Schema } from "effect"
import { dual } from "effect/Function"

/**
 * The ways a file can be wrong as a whole. `wrongType`: not a .csv or .xlsx, whatever its name says. `empty`: no
 * values, or column names with no rows under them. `noHeaderRow`: no row reads as column names. `tooLarge`: over a
 * limit (bytes, rows, columns, or a cell too long to store). `unreadable`: damaged, cut short, or locked with a
 * password. `incomplete`: part of it did not reach the server whole.
 */
export const FileProblemKind = Schema.Literals([
  "wrongType",
  "empty",
  "noHeaderRow",
  "tooLarge",
  "unreadable",
  "incomplete"
]).annotate({ description: "Which way the file is wrong as a whole" })
/** The decoded value of `FileProblemKind`: which way the file is wrong as a whole. */
export type FileProblemKind = typeof FileProblemKind.Type

/**
 * A file that cannot be staged, said for the person: what is wrong, naming the file, and what to do about it. Data,
 * not an error: the reader fails with it in the browser, and a server step answers it as the failure of a
 * `StagingOutcome`.
 */
export class FileProblem extends Schema.TaggedClass<FileProblem, { readonly brand: unique symbol }>()(
  "FileProblem",
  {
    kind: FileProblemKind,
    fileName: Schema.String.annotate({ description: "The file's name, as the person chose it" }),
    problem: Schema.String.annotate({ description: "What is wrong with the file, in a sentence that names it" }),
    todo: Schema.String.annotate({ description: "What the person can do about it, in a sentence" })
  },
  { description: "A file that cannot be staged, said for the person: what is wrong, and what to do about it" }
) {}

// The wire side named, so the OpenAPI document holds the shape once as a `FileProblem` component, referenced from
// every staging step. Annotation only.
const namedFileProblem = FileProblem.pipe(
  Schema.annotateEncoded({
    identifier: "FileProblem",
    description: "A file that cannot be staged, said for the person: what is wrong, and what to do about it"
  })
)

/**
 * The outcome of a staging step: what the step made, or what is wrong with the file. Answered with 200 either way,
 * so a problem in the file reaches the screen as data and never as a request error. The handler returns
 * `Result.succeed(made)` or `Result.fail(fileProblem.noRows({ fileName }))`; the endpoint's `error` keeps only what
 * is not the file (`Forbidden`, a missing upload). On the page, `Effect.flatMap(answer, Effect.fromResult)` turns the
 * problem into the call's failure, and `sayError` says it.
 *
 * @example
 * HttpApiEndpoint.post("beginUpload", "/uploads", { payload: UploadHead, success: StagingOutcome(UploadId), error: Forbidden })
 * // 200 {"_tag":"Failure","failure":{"_tag":"FileProblem","kind":"empty","fileName":"items.csv","problem":"...","todo":"..."}}
 */
export const StagingOutcome = <S extends Schema.Top>(success: S) =>
  Schema.Result(success, namedFileProblem).annotate({
    description: "What the staging step made, or what is wrong with the file (a FileProblem)"
  })

/**
 * The heading the screen gives each kind of problem, with what a row of the file is called on that screen (`noun`,
 * "items", "invoices"); the sentences under it are the problem's own. The word belongs to the screen that asks for
 * the file, never to this file.
 *
 * @example fileProblemTitle("empty", "invoices") // "This file has no invoices"
 * @example pipe("empty", fileProblemTitle("items")) // "This file has no items"
 */
export const fileProblemTitle: {
  (noun: string): (kind: FileProblemKind) => string
  (kind: FileProblemKind, noun: string): string
} = dual(2, (kind: FileProblemKind, noun: string): string =>
  kind === "empty" ? `This file has no ${noun}` : fileProblemTitles[kind]
)

/** The headings with no screen's noun: "rows" stands for what a row is. */
export const fileProblemTitles: Readonly<Record<FileProblemKind, string>> = {
  wrongType: "This file is not a spreadsheet",
  empty: "This file has no rows",
  noHeaderRow: "No column names found",
  tooLarge: "This file is too large",
  unreadable: "This file could not be read",
  incomplete: "The file did not arrive whole"
}

const quoted = (fileName: string): string => `"${fileName}"`
const megabytes = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const again = "Choose the file again."

/**
 * Each problem with its words, made in one place so the browser's reader and the server's staging word a kind the
 * same way.
 *
 * @example fileProblem.notASpreadsheet({ fileName: "stock.csv", is: "a PDF" }).problem
 * // '"stock.csv" is not a spreadsheet: it is a PDF.'
 */
export const fileProblem = {
  /** Neither CSV nor .xlsx: `is` says what it is ("a PDF"), `todo` what to do when choosing again is not enough. */
  notASpreadsheet: (input: { readonly fileName: string; readonly is: string; readonly todo?: string }) =>
    FileProblem.make({
      kind: "wrongType",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} is not a spreadsheet: it is ${input.is}.`,
      todo: input.todo ?? "Choose a .csv or .xlsx file."
    }),
  /** An Excel 97-2003 workbook: no reader here handles it, and Excel converts it in two clicks. */
  oldExcel: (input: { readonly fileName: string }) =>
    FileProblem.make({
      kind: "wrongType",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} is an Excel 97-2003 workbook (.xls), which cannot be read here.`,
      todo: 'Open it in Excel, choose File > Save As, save it as "Excel Workbook (.xlsx)" or "CSV UTF-8", and choose the new file.'
    }),
  /** Locked with a password. Only the person can remove it; the reader never asks for it. */
  protectedWorkbook: (input: { readonly fileName: string }) =>
    FileProblem.make({
      kind: "unreadable",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} is protected with a password, so it cannot be read.`,
      todo: "Open it in Excel, remove the password (File > Info > Protect Workbook > Encrypt with Password, then clear it), save, and choose it again."
    }),
  /**
   * Damaged, cut short or broken mid-way. `why` follows "could not be read" and says how, when the reader can tell
   * (`": it looks damaged or incomplete"`, `" past row 12: a quote (\") there is never closed, ..."`).
   */
  unreadable: (input: { readonly fileName: string; readonly why: string; readonly todo?: string }) =>
    FileProblem.make({
      kind: "unreadable",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} could not be read${input.why}.`,
      todo: input.todo ?? "Open it in Excel and save it again, or save it as CSV UTF-8."
    }),
  /**
   * No values at all: a file of no bytes (no `where`), or nothing in the place read (`where`: "in the file",
   * `in the sheet "Empty"`, "on any sheet").
   */
  noValues: (input: { readonly fileName: string; readonly where?: string }) =>
    FileProblem.make({
      kind: "empty",
      fileName: input.fileName,
      problem:
        input.where === undefined
          ? `${quoted(input.fileName)} is empty.`
          : `${quoted(input.fileName)} has no values ${input.where}.`,
      todo: "Choose the file that holds the rows to import."
    }),
  /** Column names and nothing under them. */
  noRows: (input: { readonly fileName: string }) =>
    FileProblem.make({
      kind: "empty",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} has column names but no rows under them.`,
      todo: "Choose the file that holds the rows to import."
    }),
  /** No row of the first `rows` reads as column names (words in two or more cells), in the file or one `sheet` of it. */
  noHeaderRow: (input: { readonly fileName: string; readonly rows: number; readonly sheet?: string }) =>
    FileProblem.make({
      kind: "noHeaderRow",
      fileName: input.fileName,
      problem: `No row of column names was found in the first ${input.rows} rows of ${input.sheet === undefined ? "" : `the sheet "${input.sheet}" of `}${quoted(input.fileName)}.`,
      todo: "Put the column names in one row above the data and choose the file again."
    }),
  /** Over the size the reader takes for its format, before anything is parsed. */
  tooManyBytes: (input: {
    readonly fileName: string
    readonly bytes: number
    readonly limitBytes: number
    readonly what: string
  }) =>
    FileProblem.make({
      kind: "tooLarge",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} is ${megabytes(input.bytes)}, and ${input.what} over ${megabytes(input.limitBytes)} cannot be read here.`,
      todo: "Split it into smaller files, or delete sheets and columns that are not needed, and choose it again."
    }),
  /** More rows than one import takes. */
  tooManyRows: (input: { readonly fileName: string; readonly rows: number; readonly limit: number }) =>
    FileProblem.make({
      kind: "tooLarge",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} has ${input.rows} rows. Up to ${input.limit} can be imported at a time.`,
      todo: "Split the file and import the parts."
    }),
  /** More columns than an item list has any use for. */
  tooManyColumns: (input: { readonly fileName: string; readonly columns: number }) =>
    FileProblem.make({
      kind: "tooLarge",
      fileName: input.fileName,
      problem: `${quoted(input.fileName)} has ${input.columns} columns.`,
      todo: "Delete the ones that are not about items and choose it again."
    }),
  /** A piece of rows, or the column names and notes, too long for one stored value. */
  tooLong: (input: { readonly fileName: string; readonly part: "cells" | "headings" }) =>
    FileProblem.make({
      kind: "tooLarge",
      fileName: input.fileName,
      problem:
        input.part === "cells"
          ? `${quoted(input.fileName)} has cells too long to store.`
          : `${quoted(input.fileName)} has notes or headings too long to store.`,
      todo:
        input.part === "cells"
          ? "Shorten the longest descriptions and choose it again."
          : "Shorten the column names and choose it again."
    }),
  /** The pieces that reached the server do not make the whole file. */
  incomplete: (input: { readonly fileName: string; readonly how: "missing" | "order" | "unsent" }) =>
    FileProblem.make({
      kind: "incomplete",
      fileName: input.fileName,
      problem:
        input.how === "order"
          ? `The rows of ${quoted(input.fileName)} arrived out of order.`
          : input.how === "missing"
            ? `Part of ${quoted(input.fileName)} did not reach the server.`
            : `${quoted(input.fileName)} could not be sent.`,
      todo: again
    })
}
