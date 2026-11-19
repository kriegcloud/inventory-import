/**
 * The review of a file of inventory items: one pure function that turns the staged table, the column choices and the
 * person's decisions into rows that are ready, need a decision, cannot be imported as written, are left out or are
 * already there. The screen and the commit both call `review`, so the server can never write a row the screen
 * refused. The one thing a reader must not break: nothing here changes a value without saying so. A different reading
 * of a cell is in force only through a decision the person made or, with `ruleFixes` set to "apply", through a
 * form-only rule with one reading (spaces, capitals, a "$", yes for true), which is listed as a change, counted in
 * `fixed` and undone by one decision.
 *
 * Each rule is one kind of problem (`problemKinds`), one check (`fault`) and at most one proposal (`proposeFor`).
 */
import {
  Field,
  StagedRow,
  StagedTable,
  fields,
  fieldLabels,
  requiredFields,
  StagedCell
} from "@inventory/catalog-contract/Staged"
import { Confidence, Change, typedChange, acceptedProposal, appliedByRule } from "@inventory/catalog-contract/Change"
import { RowId } from "@inventory/catalog-contract/Ids"
import {
  ItemFields,
  skuPattern,
  maxNameLength,
  skuKey,
  categories,
  uoms,
  stockingOf,
  unitsToDecimal,
  decimalUnits,
  Vendor
} from "@inventory/catalog-contract/Item"
import { ColumnMatch, UnusedColumn, MappingChoice, matchedColumn } from "@inventory/catalog-contract/Mapping"
import { Array as Arr, HashMap, HashSet, Option, Record as Rec, String as Str } from "effect"
import {
  canonicalTags,
  readDate,
  readDecimal,
  dateReadings,
  readVendors,
  readCount,
  readDimensions,
  readUnitCost,
  itemText,
  isUom,
  isCategory,
  categoryKey,
  booleanWord,
  twoDigitYear,
  thousandsComma,
  decimalComma,
  tagsOf,
  categoryStem,
  withPreferred
} from "./CellReading.rules.ts"
import { Suggestion, suggestionFits } from "@inventory/catalog-contract/Suggestion"
import { matchColumns, shownText, totalRowNumbers } from "./Mapping.rules.ts"
import {
  rowId,
  RowDecision,
  decisionOf,
  SavedDecisions,
  isLeftOut,
  hasKeep
} from "@inventory/catalog-contract/Decision"

/** Fields read from a cell's stored text, not from what Excel shows: a cost from the digits, a date cell as ISO. */
const storedTextFields: ReadonlyArray<Field> = ["unitCost", "firstReceivedOn", "discontinuedOn"]

/**
 * The text of a cell as the review reads it. A cost is read from the stored digits, so a cost Excel shows as
 * "$3.65" but stores as 3.6549 is held, not rounded, and a date cell from its stored date (ISO), whatever format
 * Excel shows it in. Everything else is what the person sees: a SKU stored as 123 with a five-digit format is
 * "00123". Spaces round a value are kept: trimming them is a proposal.
 */
const cellText = (field: Field, cell: StagedCell | undefined): string => {
  const text = cell === undefined ? "" : Arr.contains(storedTextFields, field) ? cell.text : (cell.shown ?? cell.text)
  // A cell holding only spaces is an empty cell: the screen then says "Empty" instead of showing nothing.
  return Str.trim(text) === "" ? "" : text
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`

/** Maps and keeps the values that exist. Effect 4's `Arr.filterMap` takes a Result, not an Option. */
const keepSome = <A, B>(list: ReadonlyArray<A>, f: (a: A, index: number) => Option.Option<B>): Array<B> =>
  Arr.getSomes(Arr.map(list, f))

const preferredOf = (vendors: ReadonlyArray<Vendor>): ReadonlyArray<Vendor> =>
  Arr.filter(vendors, (vendor) => vendor.isPreferred)

/**
 * Whether the rules' form-only fixes (spaces round a SKU or a name, "bx" for BX, a "$" before a cost, yes for true,
 * a date written out, tags in capitals, a category in capitals) wait for the person ("propose") or arrive in force,
 * listed and undoable ("apply"). One line to switch: the review screen and the server both read it.
 */
export const ruleFixes: "propose" | "apply" = "apply"

/**
 * Where an item is, as a sentence names it after "row": the row's number, and the file's word for the item when
 * the row holds several. A row that is one item reads as it always did.
 *
 * @example
 * rowPlace({ rowNumber: 8 }) // "8"
 * rowPlace({ rowNumber: 8, label: "Feb" }) // "8 · Feb"
 */
export const rowPlace = (input: { readonly rowNumber: number; readonly label?: string | null | undefined }): string =>
  input.label === undefined || input.label === null || input.label === ""
    ? `${input.rowNumber}`
    : `${input.rowNumber} · ${input.label}`

/**
 * One item a row of the file holds: which of the row's items it is, the file's own word for it, and its values
 * by field. A row that is one item has part 0 and no label.
 */
export type RowItem = {
  /** 0 when the row is one item; 1, 2, ... for each of several, in the row's own order. */
  readonly part: number
  /** The value that tells the row's items apart, in the file's words ("Feb", a lot number); null for part 0. */
  readonly label: string | null
  /** The item's values by field, read from the row. */
  readonly file: Readonly<Record<Field, string>>
}

/**
 * How one row of the file becomes items: given the row as staged and its values by field as the columns read
 * them, the items it holds. A file with a quantity column per month, or a row that lists two lots, returns one
 * item per month or lot (parts 1, 2, ...). A row that holds none returns nothing and is still one entry, part 0,
 * with the reason its values give: never dropped.
 */
export type ItemsOfRow = (input: {
  readonly row: StagedRow
  readonly file: Readonly<Record<Field, string>>
}) => ReadonlyArray<RowItem>

/** The example's file: each row is one item. */
export const oneItemPerRow: ItemsOfRow = ({ file }) => [{ part: 0, label: null, file }]

/**
 * How this project's files turn rows into items. One line to change, like `ruleFixes`: the review screen and the
 * server both review with it (the server through `ItemsOfRow` in `packages/catalog/model/src/Review/ItemsOfRow.context.ts`, which defaults to it).
 */
export const itemsOfRow: ItemsOfRow = oneItemPerRow

/**
 * The kinds of problem a row can have. The label is the tag on screen: one or two words, because every kind with
 * rows is a filter above the table and the screen has a budget of words. The full sentence is `Problem.message`.
 * `tone` is the kind's usual one; each problem carries its own (`Problem.tone`), since a SKU in lower case is a
 * decision and a SKU "ab-12" is a blocker.
 */
export const problemKinds = [
  { id: "missing", label: "Missing", tone: "blocker" },
  { id: "column", label: "No column", tone: "blocker" },
  { id: "stored", label: "SKU in use", tone: "blocker" },
  { id: "sku", label: "SKU", tone: "blocker" },
  { id: "name", label: "Name", tone: "blocker" },
  { id: "category", label: "Category", tone: "blocker" },
  { id: "uom", label: "Unit", tone: "blocker" },
  { id: "cost", label: "Cost", tone: "blocker" },
  { id: "number", label: "Number", tone: "blocker" },
  { id: "dimensions", label: "Dimensions", tone: "blocker" },
  { id: "vendors", label: "Vendors", tone: "blocker" },
  { id: "boolean", label: "True or false", tone: "decision" },
  { id: "date", label: "Date", tone: "decision" },
  { id: "discontinued", label: "Discontinued", tone: "decision" },
  { id: "tags", label: "Tags", tone: "decision" },
  { id: "spaces", label: "Spaces", tone: "decision" },
  { id: "changed", label: "Stored differs", tone: "decision" },
  { id: "clash", label: "SKU clash", tone: "decision" },
  { id: "duplicate", label: "Copy", tone: "decision" }
] as const
/** The id of one kind of problem (`problemKinds`): what a row's problem is filed under on the screen and in the API. */
export type ProblemKindId = (typeof problemKinds)[number]["id"]

/** A change to one cell that a rule proposes, with who proposes it, how sure it is and the evidence. */
export type Proposal = {
  readonly field: Field
  /** The kind of problem this change settles. */
  readonly kind: ProblemKindId
  readonly to: string
  /** Who proposes it: a fixed rule, or a language model whose suggestion the guard checked and stored. */
  readonly by: "rule" | "model"
  /**
   * The id of the stored suggestion behind it (`Suggestion.id`), when it came from one. Such a proposal is a guess
   * at a value the file does not hold: it never changes the row's outcome until the person accepts it.
   */
  readonly suggestionId?: string
  /**
   * True when the change is one of form only and has one reading: another way of writing the same value. Only these
   * are in force without the person (with `ruleFixes` "apply"), and only these are "safe" to take all at once.
   */
  readonly lossless: boolean
  /** high: form only, one reading. medium: a likely reading to accept or reject. low: a question, nothing preselected. */
  readonly confidence: Confidence
  /** One sentence of evidence, with counts from the file's rows. */
  readonly basis: string
  /** The other values the person may pick when the proposal is a question (`confidence` low). */
  readonly alternatives: ReadonlyArray<string>
  /**
   * Words for `to` and then each of `alternatives`, in that order, when the values do not speak for themselves
   * ("2024-04-06 (month first)", "Acme Industrial preferred"); empty when they do.
   */
  readonly labels: ReadonlyArray<string>
  /**
   * The field each pick writes, for `to` and then each of `alternatives`, in that order, when a question's readings
   * are not all values of `field`: a row discontinued yet active is settled by Active false or by an empty
   * Discontinued on. Empty when every pick is a value of `field`.
   */
  readonly targets: ReadonlyArray<Field>
  /** Changes of one kind share a group, so one accept can settle them all. */
  readonly group: string
}

/** Why a row is not ready, in words for the person. */
export type Problem = {
  readonly kind: ProblemKindId
  /** blocker: only a typed or chosen value settles it (Cannot import). decision: there is a proposal or a choice to take. */
  readonly tone: "blocker" | "decision"
  readonly field: Field | null
  /** A full sentence naming the column and the value: the reason in the not-imported file. */
  readonly message: string
  /** What the edit button says when typing is the only honest option. */
  readonly ask: string | null
  /** The values the field may take, when it is one of a list (a category, a unit, true or false); empty otherwise. */
  readonly choices: ReadonlyArray<string>
  /** A few words beside the tag ("also row 31"). */
  readonly note: string | null
  readonly proposal: Proposal | null
  /** The ids (`rowId`) of the other rows that share this row's SKU. */
  readonly rivals: ReadonlyArray<string>
}

/** Where a row stands. The four counts add up to the rows of the file. `needs` splits into decision and cannot (`RowOutcome`). */
export type RowStatus = "ready" | "needs" | "out" | "already"

/**
 * The outcome of a row in the brief's words: Ready, Needs a decision (a proposal or a choice is open), Cannot import
 * (a value must be typed first), left out by the person, or already there. A row with both kinds of problem cannot
 * be imported: offering a fix beside a blocker does not change that.
 */
export type RowOutcome = "ready" | "decision" | "cannot" | "out" | "already"

/** One field where the stored item and the file's row say different things, each as the text a cell would hold. */
export type StoredDifference = { readonly field: Field; readonly stored: string; readonly file: string }

/** One item of the file as the review reads it: a row of the file, or one of the items a row holds. */
export type ReviewedRow = {
  /** Excel's number of the row it came from, never offset: two items of one row share it. */
  readonly rowNumber: number
  /** Which of its row's items it is, when the row holds several (1, 2, ...); absent for a row that is one item. */
  readonly part?: number
  /** The file's word for it among its row's items, when the row holds several. */
  readonly partLabel?: string
  /** `rowId` of its row and part: what decisions, rivals and outcomes are keyed on. */
  readonly id: RowId
  /** The file's text by field. */
  readonly file: Readonly<Record<Field, string>>
  /** The values after the rules' fixes and the person's decisions: what would be imported. */
  readonly values: Readonly<Record<Field, string>>
  /** Every proposal for this row, whether or not it is in force. */
  readonly proposals: ReadonlyArray<Proposal>
  /** What is still open, values that need a real decision first, then the form-only fixes. */
  readonly problems: ReadonlyArray<Problem>
  readonly status: RowStatus
  /** `status` with `needs` told apart: a decision to take, or a value to type. */
  readonly outcome: RowOutcome
  readonly kept: boolean
  /** Every value that differs from the file: applied by a rule, accepted or typed by the person. */
  readonly changes: ReadonlyArray<Change>
  /** The item this row becomes; null unless it is ready. */
  readonly item: ItemFields | null
  /** True when the row is ready and replaces a stored item with the same SKU, as the person chose. */
  readonly update: boolean
  /** Where the stored item with this SKU differs from the row; empty unless it is stored with other values. */
  readonly stored: ReadonlyArray<StoredDifference>
  /** Why it would not be imported, as its first problem says it; null when ready. */
  readonly reason: string | null
  /**
   * Every reason it would not be imported, one sentence per problem, the first being `reason`; empty when ready. A
   * row with two problems (two preferred vendors, and a SKU another row has) names both: the not-imported rows
   * store these joined, and the screen shows them all or says how many more there are.
   */
  readonly reasons: ReadonlyArray<string>
}

/** A quantity added up in one unit of measure: totals never add different units. */
export type UnitTotal = { readonly unit: string; readonly quantity: number }

/** The whole review of one file. */
export type Review = {
  readonly mapping: ReadonlyArray<ColumnMatch>
  /** The file's columns no field reads ("Internal Notes"), each with how many rows hold a value. Never stored. */
  readonly unusedColumns: ReadonlyArray<UnusedColumn>
  readonly rows: ReadonlyArray<ReviewedRow>
  /** Rows the file uses to add itself up. A check, never an item. */
  readonly totalRows: ReadonlyArray<number>
  readonly counts: {
    /** Items reviewed: one per row of the file. ready + needs + out + already add up to it. */
    readonly rows: number
    /** Rows of the file behind them, total rows not counted. */
    readonly fileRows: number
    readonly ready: number
    /** decision + cannot. */
    readonly needs: number
    /** Rows that wait for a proposal or a choice to be taken: Needs a decision. */
    readonly decision: number
    /** Rows that wait for a typed value: Cannot import. */
    readonly cannot: number
    readonly out: number
    readonly already: number
    /** Ready rows that replace a stored item, as the person chose; counted in `ready` too. */
    readonly updates: number
  }
  /**
   * What the form-only rules changed without the person ("fixed for you"): how many rows, and how many cells, among
   * the rows not left out and not already there. Each is listed in its row's `changes` with `how` "applied by a rule".
   */
  readonly fixed: { readonly rows: number; readonly cells: number }
  readonly sums: {
    /** Unit cost times quantity on hand over every row whose two values read, in US dollars as a decimal string. */
    readonly fileStockValue: string
    /** The same over the rows that would be imported. */
    readonly readyStockValue: string
    /** The quantities on hand of the rows that would be imported, one total per unit of measure. */
    readonly readyQuantities: ReadonlyArray<UnitTotal>
  }
}

type DateField = "firstReceivedOn" | "discontinuedOn"
const isDateField = (field: Field): field is DateField => field === "firstReceivedOn" || field === "discontinuedOn"
const isCountField = (field: Field): field is "quantityOnHand" | "reorderPoint" =>
  field === "quantityOnHand" || field === "reorderPoint"
const isBooleanField = (field: Field): field is "isActive" | "lotTracked" =>
  field === "isActive" || field === "lotTracked"

/**
 * What a typed value is stored as. A person who types "bx" means BX and one who types "yes" means true, so their own
 * typing is read through the same word lists; a value from the file is changed only through a proposal that says so.
 */
const canonical = (field: Field, text: string): string => {
  const trimmed = Str.trim(text)
  if (field === "description") return text
  if (field === "sku") return skuPattern.test(Str.toUpperCase(trimmed)) ? Str.toUpperCase(trimmed) : trimmed
  if (field === "uom") return isUom(Str.toUpperCase(trimmed)) ? Str.toUpperCase(trimmed) : trimmed
  if (field === "category") return isCategory(categoryKey(trimmed)) ? categoryKey(trimmed) : trimmed
  if (isBooleanField(field)) return Option.getOrElse(booleanWord(trimmed), () => trimmed)
  if (field === "tags") return canonicalTags(trimmed)
  return trimmed
}

/** True when the row says it is discontinued and active at once: a date that reads, and Active true or left empty. */
const discontinuedYetActive = (values: Readonly<Record<Field, string>>): boolean =>
  Option.isSome(readDate(values.discontinuedOn)) && (Str.trim(values.isActive) === "" || values.isActive === "true")

/**
 * The fixed rules' form-only reading of one cell that does not read as written, or none: spaces round a SKU or a
 * name, a listed unit or category in other capitals, a "$" before a cost, a word that can only mean true or false,
 * tags in capitals or repeated, a date written out with one reading. Each says the same thing in the form an item
 * stores, and has no second reading.
 *
 * @example ruleFor({ field: "uom", text: "bx" }) // Some({ to: "BX", rule: "the same unit in capitals" })
 */
export const ruleFor = (input: {
  readonly field: Field
  readonly text: string
}): Option.Option<{ readonly to: string; readonly rule: string }> => {
  const { field, text } = input
  const trimmed = Str.trim(text)
  if (trimmed === "") return Option.none()
  if (field === "sku") {
    return text !== trimmed && skuPattern.test(trimmed)
      ? Option.some({ to: trimmed, rule: "spaces around the value" })
      : Option.none()
  }
  if (field === "name") {
    return text !== trimmed && trimmed.length <= maxNameLength
      ? Option.some({ to: trimmed, rule: "spaces around the value" })
      : Option.none()
  }
  if (field === "uom") {
    const upper = Str.toUpperCase(trimmed)
    return !isUom(text) && isUom(upper) ? Option.some({ to: upper, rule: "the same unit in capitals" }) : Option.none()
  }
  if (field === "category") {
    const key = categoryKey(text)
    return !isCategory(text) && isCategory(key)
      ? Option.some({ to: key, rule: "the same category in the list's own form" })
      : Option.none()
  }
  if (field === "unitCost") {
    const bare = Str.trim(Str.replace(/^\$/, "")(trimmed))
    return Str.startsWith("$")(trimmed) && Option.isSome(readDecimal(bare))
      ? Option.some({ to: bare, rule: "the same amount without the $" })
      : Option.none()
  }
  if (isBooleanField(field)) {
    return text === "true" || text === "false"
      ? Option.none()
      : Option.map(booleanWord(text), (to) => ({ to, rule: `a usual way to write ${to}` }))
  }
  if (field === "tags") {
    const to = canonicalTags(text)
    return to !== text && to !== "" ? Option.some({ to, rule: "lower case, each tag once" }) : Option.none()
  }
  // A year written with two digits is a guess at the century: never a form-only fix, and never proposed at all.
  if (isDateField(field) && Option.isNone(readDate(text)) && !twoDigitYear(text)) {
    const { dayFirst, monthFirst } = dateReadings(text)
    if (Option.isSome(dayFirst) && Option.isNone(monthFirst)) {
      return Option.some({ to: dayFirst.value, rule: "the same date written year-month-day" })
    }
    if (Option.isNone(dayFirst) && Option.isSome(monthFirst)) {
      return Option.some({ to: monthFirst.value, rule: "the same date written year-month-day" })
    }
  }
  return Option.none()
}

/** One item of the file before any decision: where it is, and its values by field. */
type FileRow = {
  readonly rowNumber: number
  readonly part: number
  readonly label: string | null
  readonly id: RowId
  /** Its position among the file's items, so "the first one kept" follows the file's order. */
  readonly order: number
  readonly file: Readonly<Record<Field, string>>
}

/** What the review knows about the file before any decision: the items by field, and counts to quote as evidence. */
type Context = {
  readonly mapping: ReadonlyArray<ColumnMatch>
  readonly rows: ReadonlyArray<FileRow>
  /** Rows of the file the items come from, total rows not counted. */
  readonly fileRows: number
  /** The item the organization already has under this SKU key, if any. A hash lookup: a file can hold 50,000 rows. */
  readonly storedOf: (key: string) => Option.Option<ItemFields>
  /** How many rows have exactly this text in this field. */
  readonly countOf: (field: Field, text: string) => number
  /** How many rows have a value in this field at all. */
  readonly filledOf: (field: Field) => number
  /** How each date column's own rows settle "03/04": rows that can only be day first, and only month first. */
  readonly dateOrder: Readonly<Record<DateField, { readonly dayFirst: number; readonly monthFirst: number }>>
  /** How many costs write a point for decimals ("12.33"): evidence that a lone comma is a decimal one. */
  readonly pointCosts: number
  /** The stored suggestions for this import: each answers only where no rule does. */
  readonly suggestions: ReadonlyArray<Suggestion>
}

const makeContext = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly storedItems: ReadonlyArray<ItemFields>
  readonly itemsOf?: ItemsOfRow | undefined
  readonly suggestions?: ReadonlyArray<Suggestion> | undefined
}): Context & { readonly totals: ReadonlyArray<StagedRow>; readonly unusedColumns: ReadonlyArray<UnusedColumn> } => {
  const mapping = matchColumns(input)
  const columnOf = (field: Field): number | null =>
    Option.getOrNull(
      Option.map(
        Option.flatMap(
          Arr.findFirst(mapping, (match) => match.field === field),
          matchedColumn
        ),
        (column) => column.index
      )
    )
  const totalNumbers = totalRowNumbers({ table: input.table, skuColumn: columnOf("sku") })
  const columns = Rec.fromEntries(Arr.map(fields, (field) => [field, columnOf(field)] as const))
  const read = (row: StagedRow): Readonly<Record<Field, string>> =>
    Rec.fromEntries(
      Arr.map(fields, (field) => {
        const column = columns[field]
        return [field, column === null || column === undefined ? "" : cellText(field, row.cells[column])] as const
      })
    ) as Record<Field, string>
  const itemsOf = input.itemsOf ?? itemsOfRow
  const fileRows = Arr.filter(input.table.rows, (row) => !Arr.contains(totalNumbers, row.rowNumber))
  // Each row of the file is behind at least one item: a row that holds none is one entry, part 0, never dropped.
  const parts = Arr.flatMap(fileRows, (row) => {
    const file = read(row)
    const found = itemsOf({ row, file })
    const held: ReadonlyArray<RowItem> = found.length > 0 ? found : [{ part: 0, label: null, file }]
    return Arr.map(held, (item) => ({ row, item }))
  })
  const rows = Arr.map(parts, ({ row, item }, order): FileRow => ({
    rowNumber: row.rowNumber,
    part: item.part,
    label: item.part === 0 ? null : item.label,
    id: rowId({ rowNumber: row.rowNumber, part: item.part }),
    order,
    file: item.file
  }))
  // Counted once per field and text, so evidence for 5,000 rows is not 5,000 passes over the file.
  const tallies = Rec.fromEntries(
    Arr.map(fields, (field) => [field, Arr.groupBy(rows, (row) => `v:${row.file[field]}`)] as const)
  )
  const countOf = (field: Field, text: string): number =>
    Option.getOrElse(
      Option.map(
        Option.flatMap(Rec.get(tallies, field), (tally) => Rec.get(tally, `v:${text}`)),
        (group) => group.length
      ),
      () => 0
    )
  const filledOf = (field: Field): number => rows.length - countOf(field, "")
  const orderOf = (field: DateField) => {
    // Only dates written in numbers say which comes first: "Jun 19, 2024" has one reading and settles nothing.
    const readings = Arr.map(
      Arr.filter(rows, (row) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(Str.trim(row.file[field]))),
      (row) => dateReadings(row.file[field])
    )
    return {
      dayFirst: Arr.filter(readings, (r) => Option.isSome(r.dayFirst) && Option.isNone(r.monthFirst)).length,
      monthFirst: Arr.filter(readings, (r) => Option.isNone(r.dayFirst) && Option.isSome(r.monthFirst)).length
    }
  }
  const used = keepSome(mapping, (match) => Option.map(matchedColumn(match), (column) => column.index))
  const stored = HashMap.fromIterable(Arr.map(input.storedItems, (item) => [skuKey(item), item] as const))
  return {
    mapping,
    rows,
    fileRows: fileRows.length,
    storedOf: (key) => HashMap.get(stored, key),
    countOf,
    filledOf,
    dateOrder: { firstReceivedOn: orderOf("firstReceivedOn"), discontinuedOn: orderOf("discontinuedOn") },
    pointCosts: Arr.filter(rows, (row) => /^\d+\.\d+$/.test(Str.trim(row.file.unitCost))).length,
    suggestions: input.suggestions ?? [],
    totals: Arr.filter(input.table.rows, (row) => Arr.contains(totalNumbers, row.rowNumber)),
    unusedColumns: Arr.map(
      Arr.filter(input.table.columns, (column) => !Arr.contains(used, column.index)),
      (column) => ({
        ...column,
        filled: Arr.filter(fileRows, (row) => Str.trim(shownText(row.cells[column.index])) !== "").length
      })
    )
  }
}

const quoted = (text: string): string => (text === "" ? "An empty cell" : `"${text}"`)

const proposal = (
  parts: Omit<Proposal, "by" | "alternatives" | "labels" | "targets"> & {
    readonly alternatives?: ReadonlyArray<string>
    readonly labels?: ReadonlyArray<string>
    readonly targets?: ReadonlyArray<Field>
  }
): Proposal => ({
  ...parts,
  by: "rule",
  alternatives: parts.alternatives ?? [],
  labels: parts.labels ?? [],
  targets: parts.targets ?? []
})

/** The kind a form-only fix is filed under, by its field. */
const ruleKind = (field: Field): ProblemKindId =>
  field === "sku" || field === "name"
    ? "spaces"
    : field === "uom"
      ? "uom"
      : field === "category"
        ? "category"
        : field === "unitCost"
          ? "cost"
          : field === "tags"
            ? "tags"
            : isBooleanField(field)
              ? "boolean"
              : "date"

/**
 * The one proposal for a field of a row, or none, read from the file's own values. Every `basis` is counted from the
 * file's rows. Confidence says what it is: high, a form-only fix with one reading (in force unless undone); medium, a
 * likely reading to accept or reject; low, a question with the other reading in `alternatives` and nothing
 * preselected, unless the column's own rows settle it, and then the whole column is one medium proposal.
 */
const proposeFor = (ctx: Context, row: FileRow, field: Field): Option.Option<Proposal> =>
  Option.orElse(proposeByRule(ctx, row, field), () => proposeStored(ctx, row, field))

/**
 * The stored suggestion for a field of a row as a proposal, where no rule answers: only for the exact cell it was
 * made for, and only while it still fits the row (`suggestionFits`). Never lossless, so it is in force only once
 * the person accepts it, and its group is the row's own, so one accept settles one row.
 */
const proposeStored = (ctx: Context, row: FileRow, field: Field): Option.Option<Proposal> =>
  Option.map(
    Arr.findLast(
      ctx.suggestions,
      // A row's suggestion for this very cell: a column's is offered beside the review, not on a row.
      (s): s is Exclude<Suggestion, { readonly kind: "column" }> =>
        s.kind !== "column" &&
        s.kind === field &&
        s.rowId === row.id &&
        s.from === row.file[field] &&
        suggestionFits({ kind: s.kind, to: s.to, file: row.file })
    ),
    (s): Proposal => ({
      field,
      kind: s.kind === "name" ? "missing" : "category",
      to: s.to,
      by: s.by.kind,
      suggestionId: s.id,
      lossless: false,
      confidence: s.confidence,
      basis: s.basis,
      alternatives: [],
      labels: [],
      targets: [],
      group: `${field}:suggested:${row.id}`
    })
  )

const proposeByRule = (ctx: Context, row: FileRow, field: Field): Option.Option<Proposal> => {
  const text = row.file[field]
  const trimmed = Str.trim(text)
  const label = fieldLabels[field]
  const rows = plural(ctx.countOf(field, text), "row", "rows")
  const rule = ruleFor({ field, text })
  if (Option.isSome(rule)) {
    const { to } = rule.value
    const others = plural(ctx.countOf(field, to), "row says", "rows say")
    const basis =
      field === "sku" || field === "name"
        ? `${quoted(text)} has spaces around it on ${rows}; the text itself is kept.`
        : isDateField(field)
          ? `${quoted(trimmed)} on ${rows} is ${to} written another way; it has no other reading.`
          : field === "tags"
            ? `${quoted(trimmed)} on ${rows} becomes "${to}": tags are lower case, each once.`
            : field === "unitCost"
              ? `${quoted(trimmed)} on ${rows} carries a "$"; costs are in US dollars already, and ${plural(ctx.pointCosts, "row writes", "rows write")} the digits alone.`
              : `${quoted(trimmed)} on ${rows}; ${others} ${to}.`
    return Option.some(
      proposal({
        field,
        kind: ruleKind(field),
        to,
        lossless: true,
        confidence: "high",
        basis,
        group: isDateField(field) || field === "tags" || field === "unitCost" ? `${field}:form` : `${field}:${to}:form`
      })
    )
  }
  if (trimmed === "" && field !== "isActive") return Option.none()
  if (field === "sku") {
    const upper = Str.toUpperCase(trimmed)
    if (!skuPattern.test(trimmed) && skuPattern.test(upper)) {
      const also = ctx.countOf("sku", upper)
      return Option.some(
        proposal({
          field,
          kind: "sku",
          to: upper,
          lossless: false,
          confidence: "medium",
          basis: `"${trimmed}" is ${upper} in capitals, the form a SKU has${also > 0 ? `; ${plural(also, "other row already has", "other rows already have")} ${upper}, so the two would then share it` : ""}.`,
          group: "sku:capitals"
        })
      )
    }
  }
  if (field === "category" && !isCategory(text)) {
    const near = Arr.findFirst(categories, (category) => categoryStem(category) === categoryStem(text))
    if (Option.isSome(near)) {
      return Option.some(
        proposal({
          field,
          kind: "category",
          to: near.value,
          lossless: false,
          confidence: "medium",
          basis: `"${trimmed}" on ${rows} is close to ${near.value}, one of the ${categories.length} categories; ${plural(ctx.countOf(field, near.value), "row says", "rows say")} ${near.value}.`,
          group: `category:${near.value}:near`
        })
      )
    }
  }
  if (field === "unitCost" && Option.isNone(readDecimal(text))) {
    const bare = Str.trim(Str.replace(/^\$/, "")(trimmed))
    if (thousandsComma.test(bare)) {
      const digits = Str.replaceAll(",", "")(bare)
      const asDecimal = Str.replace(",", ".")(bare)
      const once = Str.split(",")(bare).length === 2 && !Str.includes(".")(bare)
      if (once && Option.isSome(readDecimal(asDecimal))) {
        return Option.some(
          proposal({
            field,
            kind: "cost",
            to: digits,
            lossless: false,
            confidence: "low",
            basis: `"${trimmed}" is ${digits} with a comma between thousands or ${asDecimal} with a decimal comma; the file does not say which.`,
            alternatives: [asDecimal],
            group: `unitCost:ask:${trimmed}`
          })
        )
      }
      if (Option.isSome(readDecimal(digits))) {
        return Option.some(
          proposal({
            field,
            kind: "cost",
            to: digits,
            lossless: false,
            confidence: "medium",
            basis: `"${trimmed}" reads as ${digits} with a comma between thousands.`,
            group: "unitCost:thousands"
          })
        )
      }
    }
    if (decimalComma.test(bare)) {
      const asDecimal = Str.replace(",", ".")(bare)
      if (Option.isSome(readDecimal(asDecimal))) {
        return Option.some(
          proposal({
            field,
            kind: "cost",
            to: asDecimal,
            lossless: false,
            confidence: "medium",
            basis: `"${trimmed}" reads as ${asDecimal} with a decimal comma: a comma between thousands is followed by three digits. ${plural(ctx.pointCosts, "cost", "costs")} of ${ctx.filledOf(field)} in this file write a point.`,
            group: "unitCost:decimal-comma"
          })
        )
      }
    }
  }
  if (isCountField(field) && /^\d{1,3}(?:,\d{3})+$/.test(trimmed)) {
    const digits = Str.replaceAll(",", "")(trimmed)
    return Option.some(
      proposal({
        field,
        kind: "number",
        to: digits,
        lossless: false,
        confidence: "medium",
        basis: `"${trimmed}" on ${rows} reads as ${digits} with a comma between thousands: ${Str.toLowerCase(label)} is a whole number, so the comma is not a decimal one.`,
        group: `${field}:thousands`
      })
    )
  }
  if (isBooleanField(field) && trimmed !== "" && text !== "true" && text !== "false") {
    return Option.some(
      proposal({
        field,
        kind: "boolean",
        to: "true",
        lossless: false,
        confidence: "low",
        basis: `"${trimmed}" on ${rows} is neither true nor false; ${plural(ctx.countOf(field, "true"), "row says", "rows say")} true and ${ctx.countOf(field, "false")} false. Only you know which this is.`,
        alternatives: ["false"],
        group: `${field}:ask:${trimmed}`
      })
    )
  }
  if (isDateField(field) && trimmed !== "" && Option.isNone(readDate(text))) {
    const { dayFirst, monthFirst } = dateReadings(text)
    // A year written with two digits is never proposed: which century it means is the person's to say.
    if (twoDigitYear(text)) return Option.none()
    if (Option.isSome(dayFirst) && Option.isSome(monthFirst)) {
      const { dayFirst: byDay, monthFirst: byMonth } = ctx.dateOrder[field]
      // The column's own rows settle the order only when they all point one way.
      if (byDay > 0 && byMonth === 0) {
        return Option.some(
          proposal({
            field,
            kind: "date",
            to: dayFirst.value,
            lossless: false,
            confidence: "medium",
            basis: `${plural(byDay, "date in this column can", "dates in this column can")} only be day first (as 13/04), and none can only be month first.`,
            group: `${field}:day-first`
          })
        )
      }
      if (byMonth > 0 && byDay === 0) {
        return Option.some(
          proposal({
            field,
            kind: "date",
            to: monthFirst.value,
            lossless: false,
            confidence: "medium",
            basis: `${plural(byMonth, "date in this column can", "dates in this column can")} only be month first (as 04/13), and none can only be day first.`,
            group: `${field}:month-first`
          })
        )
      }
      return Option.some(
        proposal({
          field,
          kind: "date",
          to: monthFirst.value,
          lossless: false,
          confidence: "low",
          basis: `"${trimmed}" is ${monthFirst.value} with the month first or ${dayFirst.value} with the day first, and no other date in this column says which.`,
          alternatives: [dayFirst.value],
          labels: [`${monthFirst.value} (month first)`, `${dayFirst.value} (day first)`],
          group: `${field}:ask:${trimmed}`
        })
      )
    }
  }
  // Discontinued and active at once: one question on the row, asked on Active, with two ways out and neither taken
  // for the person. The second reading is a value of another cell (an empty Discontinued on), so `targets` names it.
  if (field === "isActive" && discontinuedYetActive(row.file)) {
    const date = Str.trim(row.file.discontinuedOn)
    return Option.some(
      proposal({
        field,
        kind: "discontinued",
        to: "false",
        lossless: false,
        confidence: "low",
        basis: `The row is discontinued on ${date} and ${trimmed === "" ? "says nothing about Active, which means true" : "active"}; a discontinued item is not active. Either it is not active, or it has no discontinued date.`,
        alternatives: [""],
        labels: ["Not active", "No discontinued date"],
        targets: ["isActive", "discontinuedOn"],
        group: `discontinued:ask:${row.id}`
      })
    )
  }
  if (field === "vendors") {
    const read = readVendors(text)
    if (read._tag === "ok") {
      const preferred = preferredOf(read.value)
      if (preferred.length > 1) {
        const picks = keepSome(read.value, (vendor, index) =>
          vendor.isPreferred
            ? Option.map(withPreferred({ text, keep: index }), (to) => ({
                to,
                label: `${vendor.vendorName} preferred`
              }))
            : Option.none()
        )
        const head = picks[0]
        if (head !== undefined) {
          return Option.some(
            proposal({
              field,
              kind: "vendors",
              to: head.to,
              lossless: false,
              confidence: "low",
              basis: `${preferred.length} vendors are marked preferred (${Arr.join(
                Arr.map(preferred, (vendor) => vendor.vendorName),
                ", "
              )}); an item has at most one.`,
              alternatives: Arr.map(Arr.drop(picks, 1), (pick) => pick.to),
              labels: Arr.map(picks, (pick) => pick.label),
              group: `vendors:preferred:${row.id}`
            })
          )
        }
      }
    }
  }
  return Option.none()
}

type Wrong = {
  readonly kind: ProblemKindId
  readonly message: string
  readonly ask: string | null
  readonly choices?: ReadonlyArray<string>
}

/** What is wrong with one value of a row, with no proposal attached yet. Undefined when it reads as an item stores it. */
const fault = (ctx: Context, field: Field, values: Readonly<Record<Field, string>>): Wrong | undefined => {
  const text = values[field]
  const label = fieldLabels[field]
  const lower = Str.toLowerCase(label)
  // What the edit button names: "SKU" keeps its capitals.
  const asked = field === "sku" ? label : lower
  const hasColumn = Arr.some(ctx.mapping, (match) => match.field === field && Option.isSome(matchedColumn(match)))
  const empty = Str.trim(text) === ""
  const required = Arr.contains(requiredFields, field)
  if (!hasColumn && required && empty) {
    return { kind: "column", message: `The file has no column for ${label}.`, ask: `Type the ${asked}` }
  }
  if (empty && required) return { kind: "missing", message: `${label} is empty.`, ask: `Type the ${asked}` }
  // One problem for the row, filed on Active: the two cells contradict each other, and that is one question.
  if (field === "isActive" && (empty || text === "true") && discontinuedYetActive(values)) {
    return {
      kind: "discontinued",
      message: `Discontinued on ${Str.trim(values.discontinuedOn)}, yet Active is ${empty ? "empty, which means true" : "true"}. A discontinued item is not active.`,
      ask: "Choose not active",
      choices: ["true", "false"]
    }
  }
  if (empty) return undefined
  if (field === "sku") {
    if (skuPattern.test(text)) return undefined
    return text !== Str.trim(text) && skuPattern.test(Str.trim(text))
      ? { kind: "spaces", message: `SKU "${text}" has spaces around it.`, ask: null }
      : {
          kind: "sku",
          message: `SKU "${Str.trim(text)}" is not three capital letters, a hyphen and four digits, like BLT-0042.`,
          ask: "Type the SKU"
        }
  }
  if (field === "name") {
    if (text !== Str.trim(text)) return { kind: "spaces", message: `Name "${text}" has spaces around it.`, ask: null }
    return text.length > maxNameLength
      ? {
          kind: "name",
          message: `Name is ${text.length} characters long. A name has at most ${maxNameLength}.`,
          ask: "Shorten the name"
        }
      : undefined
  }
  if (field === "category") {
    return isCategory(text)
      ? undefined
      : {
          kind: "category",
          message: `Category "${text}" is not one of the ${categories.length} categories.`,
          ask: "Pick a category",
          choices: categories
        }
  }
  if (field === "uom") {
    return isUom(text)
      ? undefined
      : {
          kind: "uom",
          message: `Unit of measure "${text}" is not one of ${Arr.join(uoms, ", ")}.`,
          ask: "Pick a unit",
          choices: uoms
        }
  }
  if (field === "unitCost") {
    if (Option.isSome(readDecimal(text))) return undefined
    const shown = Str.trim(text)
    return {
      kind: "cost",
      message: /^-\s*\$?[\d.,]+$/.test(shown)
        ? `Unit cost "${shown}" is below zero. A cost is 0 or more.`
        : /^\$?\d+\.\d{5,}$/.test(shown)
          ? `Unit cost "${shown}" has more than 4 decimals.`
          : `Unit cost "${shown}" is not an amount in dollars written as digits.`,
      ask: "Type the unit cost"
    }
  }
  if (isCountField(field)) {
    if (Option.isSome(readCount(text))) return undefined
    const shown = Str.trim(text)
    return {
      kind: "number",
      message: /^\d+\.\d+$/.test(shown)
        ? `${label} "${shown}" is not a whole number.`
        : /^-\d/.test(shown)
          ? `${label} "${shown}" is below zero.`
          : `${label} "${shown}" is not a whole number written as digits.`,
      ask: `Type the ${lower}`
    }
  }
  if (isBooleanField(field)) {
    return text === "true" || text === "false"
      ? undefined
      : {
          kind: "boolean",
          message: `${label} "${Str.trim(text)}" is not true or false.`,
          ask: "Choose true or false",
          choices: ["true", "false"]
        }
  }
  if (field === "tags") {
    // A cell of separators only ("|") holds no tag: it is empty, not badly written.
    return canonicalTags(text) === text || canonicalTags(text) === ""
      ? undefined
      : { kind: "tags", message: `Tags "${text}" are not lower case, each once.`, ask: "Type the tags" }
  }
  if (isDateField(field)) {
    return Option.isSome(readDate(text))
      ? undefined
      : {
          kind: "date",
          message: /^\d{4}-\d{2}-\d{2}$/.test(Str.trim(text))
            ? `${label} "${Str.trim(text)}" is not a day on the calendar.`
            : twoDigitYear(text)
              ? `${label} “${Str.trim(text)}” has a two-digit year; type it as year-month-day.`
              : `${label} "${Str.trim(text)}" is not written as year-month-day.`,
          ask: "Type the date"
        }
  }
  if (field === "dimensions") {
    const read = readDimensions(text)
    return read._tag === "ok"
      ? undefined
      : { kind: "dimensions", message: read.message, ask: "Correct the dimensions, or clear them" }
  }
  if (field === "vendors") {
    const read = readVendors(text)
    if (read._tag === "bad") {
      return { kind: "vendors", message: read.message, ask: "Correct the vendors, or clear them" }
    }
    const preferred = preferredOf(read.value)
    return preferred.length > 1
      ? {
          kind: "vendors",
          message: `${preferred.length} vendors are marked preferred (${Arr.join(
            Arr.map(preferred, (vendor) => vendor.vendorName),
            ", "
          )}). An item has at most one.`,
          ask: "Choose the preferred vendor"
        }
      : undefined
  }
  return undefined
}

const emptyDecision: RowDecision = decisionOf()

/** Whether a proposal is in force for a row: the person accepted it, or it is a form-only rule fix nobody undid. */
const inForce = (proposed: Proposal, decision: RowDecision): boolean =>
  Arr.contains(decision.accepted, proposed.field) ||
  (proposed.lossless && !Arr.contains(decision.reverted, proposed.field))

const typedValue = (decision: RowDecision, field: Field): Option.Option<string> => Rec.get(decision.edits, field)

type Rival = { readonly id: string; readonly place: string; readonly same: boolean }

const sameValues = (a: Readonly<Record<Field, string>>, b: Readonly<Record<Field, string>>): boolean =>
  Arr.every(fields, (field) => Str.trim(a[field]) === Str.trim(b[field]))

/** Kinds that are a choice between things the screen already shows, even with no proposal attached. */
const choiceKinds: ReadonlyArray<ProblemKindId> = ["clash", "duplicate", "changed", "discontinued"]

// A stored suggestion beside a blocker does not change the row's outcome: a name nobody typed is still missing, and
// the row is counted under Cannot import with the suggestion offered beside it, until the person accepts it.
const toneOf = (kind: ProblemKindId, proposed: Proposal | null): "blocker" | "decision" =>
  (proposed !== null && proposed.suggestionId === undefined) || Arr.contains(choiceKinds, kind) ? "decision" : "blocker"

/**
 * The problems of one row given the values it would be imported with. A value that still reads as the file has it
 * carries its proposal; a value the person typed does not. Values only the person can give come first, then the
 * choices (a stored item that differs, a repeated SKU), the form-only fixes last, so the screen asks for the thing
 * only the person knows before the one-click ones.
 */
const problemsOf = (
  ctx: Context,
  row: FileRow,
  values: Readonly<Record<Field, string>>,
  rivals: ReadonlyArray<Rival>,
  changed: Problem | null
): ReadonlyArray<Problem> => {
  const found = keepSome(fields, (field): Option.Option<Problem> => {
    const wrong = fault(ctx, field, values)
    if (wrong === undefined) return Option.none()
    const proposed =
      values[field] === row.file[field]
        ? Option.getOrNull(Option.filter(proposeFor(ctx, row, field), (p) => p.kind === wrong.kind))
        : null
    return Option.some({
      kind: wrong.kind,
      tone: toneOf(wrong.kind, proposed),
      field,
      message: wrong.message,
      ask: wrong.ask,
      choices: wrong.choices ?? [],
      note: null,
      proposal: proposed,
      rivals: []
    })
  })
  const key = skuKey({ sku: values.sku })
  const taken: ReadonlyArray<Problem> =
    key !== "" && Option.isSome(ctx.storedOf(key)) && skuKey({ sku: row.file.sku }) !== key
      ? [
          {
            kind: "stored",
            tone: "blocker",
            field: "sku",
            message: `SKU ${Str.trim(values.sku)} is already there: an item your organization has uses it.`,
            ask: "Type another SKU",
            choices: [],
            note: null,
            proposal: null,
            rivals: []
          }
        ]
      : []
  const ids = Arr.map(rivals, (rival) => rival.id)
  const where = Arr.join(
    Arr.map(rivals, (rival) => rival.place),
    ", "
  )
  // Rows that agree in every field are copies; rows that share only the SKU are two items clashing over it.
  const copies = Arr.every(rivals, (rival) => rival.same)
  const twice: ReadonlyArray<Problem> =
    rivals.length === 0
      ? []
      : [
          {
            kind: copies ? "duplicate" : "clash",
            tone: "decision",
            field: "sku",
            message: copies
              ? `This row is a copy of row ${where}.`
              : `SKU ${Str.toUpperCase(Str.trim(values.sku))} is also on row ${where} with different values. Keep one row, or leave one out.`,
            ask: "Type another SKU",
            choices: [],
            note: `${copies ? "copy of" : "also"} row ${where}`,
            proposal: null,
            rivals: ids
          }
        ]
  const safe = (problem: Problem): boolean => problem.proposal !== null && problem.proposal.lossless
  return [
    ...Arr.filter(found, (p) => !safe(p)),
    ...taken,
    ...(changed === null ? [] : [changed]),
    ...twice,
    ...Arr.filter(found, safe)
  ]
}

/**
 * The item a row's values make, or null when one of them does not read. Empty optional cells take the brief's
 * defaults: quantity on hand 0, active true, lot tracked false.
 */
const toItem = (values: Readonly<Record<Field, string>>): ItemFields | null => {
  const blank = (field: Field): boolean => Str.trim(values[field]) === ""
  const category = Arr.findFirst(categories, (candidate) => candidate === values.category)
  const uom = Arr.findFirst(uoms, (candidate) => candidate === values.uom)
  const cost = readUnitCost(values.unitCost)
  const quantity = blank("quantityOnHand") ? Option.some(0) : readCount(values.quantityOnHand)
  const reorder = blank("reorderPoint") ? Option.some(null) : readCount(values.reorderPoint)
  const flag = (field: "isActive" | "lotTracked", byDefault: boolean): Option.Option<boolean> =>
    blank(field)
      ? Option.some(byDefault)
      : values[field] === "true"
        ? Option.some(true)
        : values[field] === "false"
          ? Option.some(false)
          : Option.none()
  const active = flag("isActive", true)
  const lot = flag("lotTracked", false)
  const date = (field: DateField): Option.Option<string | null> =>
    blank(field) ? Option.some(null) : readDate(values[field])
  const received = date("firstReceivedOn")
  const discontinued = date("discontinuedOn")
  const dimensions = readDimensions(values.dimensions)
  const vendors = readVendors(values.vendors)
  if (
    !skuPattern.test(values.sku) ||
    values.name === "" ||
    values.name !== Str.trim(values.name) ||
    values.name.length > maxNameLength ||
    Option.isNone(category) ||
    Option.isNone(uom) ||
    Option.isNone(cost) ||
    Option.isNone(quantity) ||
    Option.isNone(reorder) ||
    Option.isNone(active) ||
    Option.isNone(lot) ||
    Option.isNone(received) ||
    Option.isNone(discontinued) ||
    dimensions._tag === "bad" ||
    vendors._tag === "bad" ||
    preferredOf(vendors.value).length > 1 ||
    (canonicalTags(values.tags) !== values.tags && canonicalTags(values.tags) !== "") ||
    (discontinued.value !== null && active.value)
  ) {
    return null
  }
  return {
    sku: values.sku,
    name: values.name,
    description: blank("description") ? Option.none() : Option.some(values.description),
    category: category.value,
    uom: uom.value,
    unitCost: cost.value,
    quantityOnHand: quantity.value,
    reorderPoint: Option.fromNullOr(reorder.value),
    stocking: stockingOf({ isActive: active.value, discontinuedOn: Option.fromNullOr(discontinued.value) }),
    lotTracked: lot.value,
    tags: tagsOf(values.tags),
    firstReceivedOn: Option.fromNullOr(received.value),
    dimensions: Option.fromNullOr(dimensions.value),
    vendors: vendors.value
  }
}

/** Where a stored item and the file's row differ, field by field, as cell text. */
const differences = (stored: ItemFields, item: ItemFields): ReadonlyArray<StoredDifference> => {
  const was = itemText(stored)
  const now = itemText(item)
  return keepSome(fields, (field) =>
    was[field] === now[field] ? Option.none() : Option.some({ field, stored: was[field], file: now[field] })
  )
}

/** Unit cost times quantity on hand over the rows where both read, in ten-thousandths of a dollar. */
const stockValue = (rows: ReadonlyArray<ReviewedRow>): string =>
  unitsToDecimal(
    Arr.reduce(rows, 0n, (total, row) => {
      const cost = readUnitCost(row.values.unitCost)
      const quantity =
        Str.trim(row.values.quantityOnHand) === "" ? Option.some(0) : readCount(row.values.quantityOnHand)
      return Option.isSome(cost) && Option.isSome(quantity)
        ? total + decimalUnits(cost.value) * BigInt(quantity.value)
        : total
    })
  )

/**
 * Reviews the file. Every row lands in exactly one of four places and the counts add up to the rows. A row is ready
 * only when every value reads exactly as an item stores it, through the file's own text, a form-only rule fix nobody
 * undid, or a decision the person made. Two rows with one SKU are both held until the person keeps one. A row whose
 * SKU is stored is already there when it says what is stored; when it says something else it waits for the person to
 * keep the stored item or replace it, and nothing stored changes without that.
 */
export const review = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly decisions: SavedDecisions
  /** The organization's items that share a SKU with a row of the file (or with a SKU the person typed). */
  readonly storedItems: ReadonlyArray<ItemFields>
  /**
   * The ids (`rowId`) of rows an earlier confirm of this same import created. They are already there, whatever
   * their SKU.
   */
  readonly createdIds?: ReadonlyArray<string>
  /** How a row becomes items; `itemsOfRow` when not given. */
  readonly itemsOf?: ItemsOfRow
  /**
   * The import's stored suggestions (`ImportView.suggestions`). Each becomes a proposal on its row that waits for
   * the person; the screen and the server pass the same list, so both see the same proposals.
   */
  readonly suggestions?: ReadonlyArray<Suggestion>
}): Review => {
  const ctx = makeContext(input)
  const created = HashSet.fromIterable(input.createdIds ?? [])
  const decisionOf = (row: FileRow): RowDecision =>
    Option.getOrElse(Rec.get(input.decisions, rowId(row)), () => emptyDecision)

  const first = Arr.map(ctx.rows, (row) => {
    const decision = decisionOf(row)
    const proposals = keepSome(fields, (field) => proposeFor(ctx, row, field))
    const changes: Array<Change> = []
    const values = Rec.fromEntries(
      Arr.map(fields, (field) => {
        const typed = typedValue(decision, field)
        const proposed = Arr.findFirst(proposals, (p) => p.field === field)
        const text = row.file[field]
        if (Option.isSome(typed)) {
          const to = canonical(field, typed.value)
          if (to !== text) {
            changes.push(typedChange({ field, from: text, to }))
          }
          return [field, to] as const
        }
        if (Option.isSome(proposed) && inForce(proposed.value, decision)) {
          const p = proposed.value
          const accepted = Arr.contains(decision.accepted, field)
          const proposal = { field, from: text, to: p.to, basis: p.basis, confidence: p.confidence }
          // In force without an accept only when it is a form-only rule's fix: `inForce` says so.
          changes.push(accepted ? acceptedProposal({ ...proposal, source: p.by }) : appliedByRule(proposal))
          return [field, p.to] as const
        }
        return [field, text] as const
      })
    ) as Record<Field, string>
    const key = skuKey({ sku: values.sku })
    const mine = HashSet.has(created, row.id)
    // The file's own SKU is stored. Compared by key, so a SKU whose spaces were trimmed is still the file's SKU.
    const storedItem =
      !mine && key !== "" && skuKey({ sku: row.file.sku }) === key ? ctx.storedOf(key) : Option.none<ItemFields>()
    const item = toItem(values)
    // It differs only when the row reads as an item and that item says something else than what is stored. A row
    // that does not read yet is not compared and is not "already there": it keeps its own problems, and once it
    // reads it is skipped (it says what is stored) or asks (it says something else).
    const stored = Option.isSome(storedItem) && item !== null ? differences(storedItem.value, item) : []
    const differs = stored.length > 0
    const replace = differs && decision.stored.kind === "replace"
    const already =
      mine || (Option.isSome(storedItem) && item !== null && (!differs || decision.stored.kind === "keep"))
    return {
      row,
      decision,
      proposals,
      values,
      changes,
      key,
      item,
      stored,
      differs,
      replace,
      already,
      mine,
      keptStored: differs && decision.stored.kind === "keep",
      out: isLeftOut(decision)
    }
  })

  // One item per SKU: rows that share a key are rivals, whatever the person has done to them so far.
  const groups = Arr.groupBy(
    Arr.filter(first, (entry) => entry.key !== "" && !entry.already),
    (entry) => `sku:${entry.key}`
  )
  const rows = Arr.map(first, (entry): ReviewedRow => {
    const twins = Arr.filter(
      Option.getOrElse(Rec.get(groups, `sku:${entry.key}`), () => []),
      (other) => other.row.id !== entry.row.id
    )
    const live = Arr.filter(twins, (other) => !other.out)
    // Kept wins over a twin still in the file only for the first row the person kept.
    const keptFirst =
      hasKeep(entry.decision) &&
      !Arr.some(live, (other) => hasKeep(other.decision) && other.row.order < entry.row.order)
    const sku = Str.trim(entry.values.sku)
    const changed: Problem | null =
      entry.differs && entry.decision.stored.kind === "undecided"
        ? {
            kind: "changed",
            tone: "decision",
            field: "sku",
            message: `SKU ${sku} is already there with other values (${Arr.join(
              Arr.map(entry.stored, (difference) => fieldLabels[difference.field]),
              ", "
            )}). Keep the stored item, or replace it with this row.`,
            ask: null,
            choices: ["keep", "replace"],
            note: `${plural(entry.stored.length, "value differs", "values differ")}`,
            proposal: null,
            rivals: []
          }
        : null
    const all = problemsOf(
      ctx,
      entry.row,
      entry.values,
      entry.already
        ? []
        : Arr.map(twins, (other) => ({
            id: other.row.id,
            place: rowPlace(other.row),
            same: sameValues(entry.values, other.values)
          })),
      changed
    )
    const twice = (problem: Problem): boolean => problem.kind === "duplicate" || problem.kind === "clash"
    const problems = Arr.filter(all, (problem) => !twice(problem) || !(live.length === 0 || keptFirst))
    const open: RowStatus = entry.out ? "out" : entry.already ? "already" : problems.length > 0 ? "needs" : "ready"
    const item = open === "ready" ? entry.item : null
    const status: RowStatus = open === "ready" && item === null ? "needs" : open
    const head = problems[0]
    const reason =
      status === "out"
        ? "You left this row out."
        : status === "already"
          ? entry.mine
            ? "This row was imported from this file earlier."
            : entry.keptStored
              ? `SKU ${sku} is already there with other values. You kept the stored item.`
              : `SKU ${sku} is already there. It is skipped, not changed.`
          : head !== undefined
            ? head.message
            : item === null
              ? "A value could not be read."
              : null
    const shown = status === "needs" ? problems : []
    return {
      rowNumber: entry.row.rowNumber,
      ...(entry.row.part === 0 ? {} : { part: entry.row.part }),
      ...(entry.row.label === null ? {} : { partLabel: entry.row.label }),
      id: entry.row.id,
      file: entry.row.file,
      values: entry.values,
      proposals: entry.proposals,
      problems: shown,
      status,
      outcome:
        status !== "needs"
          ? status
          : shown.length === 0 || Arr.some(shown, (problem) => problem.tone === "blocker")
            ? "cannot"
            : "decision",
      kept: hasKeep(entry.decision),
      changes: entry.changes,
      item,
      update: status === "ready" && entry.replace,
      stored: entry.stored,
      reason,
      // Every problem of a row that waits, in the order the screen asks them: a row with two names both.
      reasons:
        status === "needs" && problems.length > 0
          ? Arr.dedupe(Arr.map(problems, (problem) => problem.message))
          : reason === null
            ? []
            : [reason]
    }
  })

  const count = (status: RowStatus): number => Arr.filter(rows, (row) => row.status === status).length
  const outcome = (wanted: RowOutcome): number => Arr.filter(rows, (row) => row.outcome === wanted).length
  const ready = Arr.filter(rows, (row) => row.status === "ready")
  const readyItems = keepSome(ready, (row) => Option.fromNullishOr(row.item))
  const readyQuantities = keepSome(uoms, (unit): Option.Option<UnitTotal> => {
    const inUnit = Arr.filter(readyItems, (item) => item.uom === unit)
    return inUnit.length === 0
      ? Option.none()
      : Option.some({ unit, quantity: Arr.reduce(inUnit, 0, (total, item) => total + item.quantityOnHand) })
  })
  const byRule = Arr.map(
    Arr.filter(rows, (row) => row.status === "ready" || row.status === "needs"),
    (row) => Arr.filter(row.changes, (change) => change.how === "appliedByRule").length
  )

  return {
    mapping: ctx.mapping,
    unusedColumns: ctx.unusedColumns,
    rows,
    totalRows: Arr.map(ctx.totals, (row) => row.rowNumber),
    counts: {
      rows: rows.length,
      fileRows: ctx.fileRows,
      ready: count("ready"),
      needs: count("needs"),
      decision: outcome("decision"),
      cannot: outcome("cannot"),
      out: count("out"),
      already: count("already"),
      updates: Arr.filter(rows, (row) => row.update).length
    },
    fixed: {
      rows: Arr.filter(byRule, (cells) => cells > 0).length,
      cells: Arr.reduce(byRule, 0, (total, cells) => total + cells)
    },
    sums: {
      fileStockValue: stockValue(rows),
      readyStockValue: stockValue(ready),
      readyQuantities
    }
  }
}

/**
 * The first open problem of a row for the values on screen, with its proposal when the value is still the file's.
 * The review screen calls this after the person types a value, so the next thing wrong with the row shows at once.
 * It sees one row: a SKU typed to match another row's is caught by `review` on the next pass and by the commit.
 */
export const recheckRow = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly storedItems: ReadonlyArray<ItemFields>
  readonly itemsOf?: ItemsOfRow
  readonly suggestions?: ReadonlyArray<Suggestion>
}): ((row: { readonly id: string; readonly values: Readonly<Record<string, string>> }) => Problem | undefined) => {
  const ctx = makeContext(input)
  // Keyed by plain text: the screen asks by the key its region holds for the row.
  const byId: Readonly<Record<string, (typeof ctx.rows)[number]>> = Rec.fromEntries(
    Arr.map(ctx.rows, (row) => [row.id, row] as const)
  )
  const byKey = Arr.groupBy(
    Arr.filter(ctx.rows, (row) => skuKey({ sku: row.file.sku }) !== ""),
    (row) => `sku:${skuKey({ sku: row.file.sku })}`
  )
  return (row) => {
    const known = Rec.get(byId, row.id)
    if (Option.isNone(known)) return undefined
    const values = Rec.fromEntries(
      Arr.map(fields, (field) => {
        const text = Option.getOrElse(Rec.get(row.values, field), () => "")
        return [field, text === known.value.file[field] ? text : canonical(field, text)] as const
      })
    ) as Record<Field, string>
    const rivals = Arr.map(
      Arr.filter(
        Option.getOrElse(Rec.get(byKey, `sku:${skuKey({ sku: values.sku })}`), () => []),
        (other) => other.id !== row.id
      ),
      (other) => ({ id: other.id, place: rowPlace(other), same: sameValues(values, other.file) })
    )
    return problemsOf(ctx, known.value, values, rivals, null)[0]
  }
}

/**
 * The draft a new import starts with. With `ruleFixes` "propose" every lossless rule fix is held back, so nothing
 * from the file is changed until the person takes it; with "apply" the draft is empty and the fixes are in force.
 *
 * @example
 * // A file whose row 18 has a form-only rule fix for its unit ("bx"): the fix is held back for the person.
 * firstDecisions({ table, choices: [], mode: "propose" }) // { "row-18": decisionOf({ reverted: ["uom"] }) }
 * firstDecisions({ table, choices: [], mode: "apply" }) // {}
 */
export const firstDecisions = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly mode: "propose" | "apply"
  readonly itemsOf?: ItemsOfRow
}): SavedDecisions => {
  if (input.mode === "apply") return {}
  const current = review({ ...input, decisions: {}, storedItems: [] })
  return Rec.fromEntries(
    keepSome(current.rows, (row) => {
      const safe = Arr.map(
        Arr.filter(row.proposals, (proposal) => proposal.lossless),
        (proposal) => proposal.field
      )
      return safe.length === 0 ? Option.none() : Option.some([row.id, decisionOf({ reverted: safe })] as const)
    })
  )
}

/**
 * Carries a draft over a change of columns: a lossless fix that did not exist before is held
 * back the same way the first draft holds them, and what the person already decided is kept as it is.
 */
export const carryDecisions = (input: {
  readonly table: StagedTable
  readonly choices: ReadonlyArray<MappingChoice>
  readonly decisions: SavedDecisions
  readonly mode: "propose" | "apply"
  readonly itemsOf?: ItemsOfRow
}): SavedDecisions => {
  const fresh = firstDecisions(input)
  const kept = input.decisions
  const merged = Arr.map(Arr.dedupe([...Rec.keys(fresh), ...Rec.keys(kept)]), (id) => {
    const before = Option.getOrElse(Rec.get(kept, id), () => emptyDecision)
    const held = Option.getOrElse(Rec.get(fresh, id), () => emptyDecision).reverted
    const reverted = Arr.dedupe([
      ...before.reverted,
      ...Arr.filter(held, (field) => !Arr.contains(before.accepted, field))
    ])
    return [id, { ...before, reverted }] as const
  })
  return Rec.fromEntries(merged)
}

/**
 * Takes back acceptances that no longer mean what the person agreed to. An accept is stored as the field's name,
 * so when the proposal behind a field can change (its column was matched again) the accept must go, or a different
 * value would arrive as "accepted". Returns only the rows whose decision changed.
 *
 * @example
 * // Row 24's unit proposal came from a column that was just matched again: the accept of it goes.
 * dropAccepted({ decisions: { "row-24": decisionOf({ accepted: ["uom"] }) }, rows, drop: (p) => p.field === "uom" })
 * // { "row-24": decisionOf() }
 */
export const dropAccepted = (input: {
  readonly decisions: SavedDecisions
  readonly rows: ReadonlyArray<ReviewedRow>
  readonly drop: (proposal: Proposal) => boolean
}): SavedDecisions =>
  Rec.fromEntries(
    keepSome(input.rows, (row) => {
      const decision = Rec.get(input.decisions, row.id)
      if (Option.isNone(decision)) return Option.none()
      const accepted = decision.value.accepted
      const kept = Arr.filter(accepted, (field) =>
        Arr.some(row.proposals, (proposal) => proposal.field === field && !input.drop(proposal))
      )
      if (kept.length === accepted.length) return Option.none()
      return Option.some([row.id, { ...decision.value, accepted: kept }] as const)
    })
  )
