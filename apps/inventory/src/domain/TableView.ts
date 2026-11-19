import { Array as Arr, Option, Result, String as Str } from "effect"
import * as S from "effect/Schema"
import { nullAsNone } from "@inventory/kernel/Wire"
import { AnsweredBy } from "./Answer.ts"

// WHAT THE TABLE ASSISTANT MAY ASK OF A TABLE, AND NOTHING MORE. A person types what they want to see; a model (or the
// fixed rules) answers with a `ViewCommand`: sort, filter, search, show or hide a column, clear. The command changes
// the person's own view of a table, never stored data. The one thing not to break: every column and operator in an
// answer is checked against the catalog the request carried (`checkCommand`), and an answer that names anything else
// is refused whole, with a sentence, never applied in part.

const Text = (max: number) => S.String.check(S.isMaxLength(max))

/** The longest request a person can type, in characters. */
export const maxPrompt = 300

/** A column's id as the table names it, for example "unit". Checked against the request's catalog before use. */
export const ColumnId = S.String.check(S.isMinLength(1), S.isMaxLength(64)).annotate({
  description: "A column's id, exactly as the catalog names it"
})

/** What kind of value a column holds, which decides the comparisons it allows. */
export const ColumnType = S.Literals(["text", "number", "boolean", "select"]).annotate({
  description: "text is searched, number compared, boolean yes or no, select one of a fixed list of values"
})
/** The decoded value of `ColumnType`. */
export type ColumnType = typeof ColumnType.Type

/** Every comparison a filter may use. Which of them a column allows is `operatorsFor` its type. */
export const ViewOperator = S.Literals([
  "iLike",
  "notILike",
  "eq",
  "ne",
  "inArray",
  "notInArray",
  "lt",
  "lte",
  "gt",
  "gte",
  "isEmpty",
  "isNotEmpty"
]).annotate({
  description:
    "iLike: contains the text. notILike: does not contain it. eq/ne: is or is not. inArray/notInArray: is one of, or none of, the values. lt/lte/gt/gte: below, at most, above, at least. isEmpty/isNotEmpty: has no value, or has one"
})
/** The decoded value of `ViewOperator`. */
export type ViewOperator = typeof ViewOperator.Type

/**
 * The closed set of comparisons per type of column. A catalog may allow fewer for a column, never more: a boolean is
 * only ever "is yes" or "is no", and a list column is compared only with its own values.
 */
export const operatorsFor: Readonly<Record<ColumnType, ReadonlyArray<ViewOperator>>> = {
  text: ["iLike", "notILike", "eq", "ne"],
  number: ["eq", "ne", "lt", "lte", "gt", "gte", "isEmpty", "isNotEmpty"],
  boolean: ["eq"],
  select: ["inArray", "notInArray"]
}

/** One column of a table as the assistant may use it: what it is called, what it holds and what it allows. */
export const CatalogColumn = S.Struct({
  id: ColumnId,
  label: S.String.check(S.isMinLength(1), S.isMaxLength(80)).annotateKey({
    description: "The column's heading as the person reads it"
  }),
  type: ColumnType,
  sortable: S.Boolean.annotateKey({ description: "The table can be ordered by this column" }),
  hideable: S.Boolean.annotateKey({ description: "The person may hide this column" }),
  operators: S.Array(ViewOperator)
    .check(S.isMaxLength(12))
    .annotateKey({ description: "The comparisons a filter on this column may use; empty when it cannot be filtered" }),
  values: S.Array(Text(80))
    .check(S.isMaxLength(100))
    .annotateKey({ description: "For a select column, every value it can hold; empty otherwise" })
}).annotate({ identifier: "CatalogColumn", description: "One column of a table as the assistant may use it" })
/** The decoded value of `CatalogColumn`. */
export type CatalogColumn = typeof CatalogColumn.Type

/** Every column of one table the assistant may use. A second table adopts the assistant by giving its own. */
export const ColumnCatalog = S.Array(CatalogColumn)
  .check(S.isMinLength(1), S.isMaxLength(40))
  .annotate({ description: "Every column of the table the assistant may use" })
/** The decoded value of `ColumnCatalog`. */
export type ColumnCatalog = typeof ColumnCatalog.Type

/** Order the table by one column. It replaces the order the table had. */
export const SortChange = S.Struct({
  kind: S.Literal("sort"),
  column: ColumnId,
  direction: S.Literals(["asc", "desc"]).annotateKey({ description: "asc: A to Z, low to high. desc: the reverse" })
}).annotate({ description: "Order the table by one column, replacing the order it had" })

/** Keep only the rows whose column passes a comparison. It replaces any filter the column had. */
export const FilterChange = S.Struct({
  kind: S.Literal("filter"),
  column: ColumnId,
  operator: ViewOperator,
  values: S.Array(Text(200)).check(S.isMaxLength(50)).annotateKey({
    description:
      'What to compare with. One entry for text and number; "true" or "false" for boolean; one or more of the column\'s values for select; none for isEmpty and isNotEmpty'
  })
}).annotate({ description: "Keep only rows whose column passes a comparison, replacing any filter the column had" })

/** The longest text a search change may put in a table's search box, in characters. */
export const maxSearchText = 200

/**
 * Put words into the table's one search box, which finds each of them in any order. Only a table whose request
 * says it has a search box allows it.
 */
export const SearchChange = S.Struct({
  kind: S.Literal("search"),
  text: Text(maxSearchText).annotateKey({
    description:
      'The words to put in the search box, as the person would type them ("m8 washer"); empty to stop searching'
  })
}).annotate({ description: "Search the table: the words are found in any order, ignoring case and accents" })

/** Show or hide one column. */
export const ColumnChange = S.Struct({
  kind: S.Literals(["show", "hide"]),
  column: ColumnId
}).annotate({ description: "Show or hide one column" })

/** Put part of the view back as the table opens: its filters, its order, its search, its columns, or all of them. */
export const ClearChange = S.Struct({
  kind: S.Literal("clear"),
  what: S.Literals(["everything", "filters", "sorting", "search", "columns"])
}).annotate({ description: "Put part of the view back as the table opens" })

/** One change to a table's view. */
export const ViewChange = S.Union([SortChange, FilterChange, SearchChange, ColumnChange, ClearChange]).annotate({
  description: "One change to a table's view: sort, filter, search, show or hide a column, or clear"
})
/** The decoded value of `ViewChange`. */
export type ViewChange = typeof ViewChange.Type

/** The most changes one request can make. */
export const maxChanges = 12

/**
 * What a model answers to a request: the changes, in order, and in one sentence anything asked that they cannot do.
 * This Schema is what the model is shown and what its reply is decoded against.
 */
export const ViewCommand = S.Struct({
  changes: S.Array(ViewChange).check(S.isMaxLength(maxChanges)),
  cannot: Text(300).annotateKey({
    description:
      "In one plain sentence, what the person asked that these changes cannot do (a column the table does not have, grouping, charts, changing data). Empty when everything was done"
  })
}).annotate({ description: "The changes to make to the table's view, and what was asked that they cannot do" })
/** The decoded value of `ViewCommand`. */
export type ViewCommand = typeof ViewCommand.Type

/** A request the assistant could turn into changes, and who read it. */
export const ViewAnswer = S.Struct({
  changes: S.Array(ViewChange).annotateKey({
    description: "The changes to make to the view, in order; each was checked against the table's columns"
  }),
  // Who read the request: a model, or the rules with the reason no model did.
  answeredBy: AnsweredBy,
  note: S.String.pipe(
    nullAsNone({ description: "A sentence for the person about what was not done. Null when there is none" })
  )
}).annotate({ identifier: "ViewAnswer", description: "The changes a request asked for, and who read it" })
/** The decoded value of `ViewAnswer`. */
export type ViewAnswer = typeof ViewAnswer.Type

/** A request the assistant would not apply, said for the person. Nothing in the view changes. */
export const ViewRefusal = S.Struct({
  reason: S.String.annotateKey({ description: "What could not be done and what to try, for the person" }),
  // Who read the request: a model, or the rules with the reason no model did.
  answeredBy: AnsweredBy,
  note: S.String.pipe(
    nullAsNone({ description: "A sentence for the person about what was not done. Null when there is none" })
  )
}).annotate({ identifier: "ViewRefusal", description: "A request the assistant would not apply, said for the person" })
/** The decoded value of `ViewRefusal`. */
export type ViewRefusal = typeof ViewRefusal.Type

/** The outcome of a request: changes to apply, or a refusal. Answered with 200 either way. */
export const ViewOutcome = S.Result(ViewAnswer, ViewRefusal).annotate({
  description: "The changes to apply to the view, or why none will be applied"
})
/** The decoded value of `ViewOutcome`. */
export type ViewOutcome = typeof ViewOutcome.Type

const nothing = "so nothing was changed."
const quoted = (text: string) => `“${text}”`

const findColumn = (columns: ColumnCatalog, id: string) => Arr.findFirst(columns, (column) => column.id === id)

const isNumber = (text: string) => Option.isSome(Str.match(/^-?\d+(\.\d+)?$/)(Str.trim(text)))

/**
 * Checks a command against the catalog the request carried and returns the changes to apply, with each list value
 * spelled as the table spells it. One unknown column, operator or value refuses the whole command with a sentence:
 * a view changed in part without saying so would be worse than one not changed.
 *
 * @example
 * checkCommand({ changes: [{ kind: "hide", column: "vendor" }], columns, searchable: false })
 * // Result.fail("The answer named a column this table does not have (“vendor”), so nothing was changed.")
 */
export const checkCommand = (input: {
  readonly changes: ReadonlyArray<ViewChange>
  readonly columns: ColumnCatalog
  readonly searchable: boolean
}): Result.Result<ReadonlyArray<ViewChange>, string> => {
  const checked: Array<ViewChange> = []
  for (const change of input.changes) {
    if (change.kind === "clear") {
      checked.push(change)
      continue
    }
    if (change.kind === "search") {
      if (!input.searchable)
        return Result.fail(`This table has no search box; ask for a filter on a column instead, ${nothing}`)
      const text = Str.trim(change.text)
      if (text.length > maxSearchText) {
        return Result.fail(`A search can be at most ${maxSearchText} characters, ${nothing}`)
      }
      checked.push({ kind: "search", text })
      continue
    }
    const found = findColumn(input.columns, change.column)
    if (Option.isNone(found)) {
      return Result.fail(`The answer named a column this table does not have (${quoted(change.column)}), ${nothing}`)
    }
    const column = found.value
    if (change.kind === "sort") {
      if (!column.sortable) return Result.fail(`The table cannot be ordered by ${column.label}, ${nothing}`)
      checked.push(change)
      continue
    }
    if (change.kind !== "filter") {
      if (change.kind === "hide" && !column.hideable) return Result.fail(`${column.label} is always shown, ${nothing}`)
      checked.push(change)
      continue
    }
    const allowed =
      Arr.contains(column.operators, change.operator) && Arr.contains(operatorsFor[column.type], change.operator)
    if (!allowed) {
      return Result.fail(`${column.label} cannot be compared that way (${quoted(change.operator)}), ${nothing}`)
    }
    const needsNone = change.operator === "isEmpty" || change.operator === "isNotEmpty"
    if (needsNone) {
      checked.push({ ...change, values: [] })
      continue
    }
    if (change.values.length === 0)
      return Result.fail(`The filter on ${column.label} had nothing to compare with, ${nothing}`)
    if (column.type === "select") {
      const spelled: Array<string> = []
      for (const value of change.values) {
        const match = Arr.findFirst(
          column.values,
          (known) => Str.toLowerCase(known) === Str.toLowerCase(Str.trim(value))
        )
        if (Option.isNone(match)) {
          return Result.fail(`${quoted(value)} is not one of the values of ${column.label}, ${nothing}`)
        }
        spelled.push(match.value)
      }
      checked.push({ ...change, values: Arr.dedupe(spelled) })
      continue
    }
    const first = Str.trim(change.values[0] ?? "")
    if (column.type === "boolean" && first !== "true" && first !== "false") {
      return Result.fail(`${column.label} is yes or no, and the answer said ${quoted(first)}, ${nothing}`)
    }
    if (column.type === "number" && !isNumber(first)) {
      return Result.fail(`${column.label} is a number, and the answer said ${quoted(first)}, ${nothing}`)
    }
    checked.push({ ...change, values: [first] })
  }
  return Result.succeed(checked)
}

// THE FIXED RULES. They read the plain cases with no model: "find the steel brackets", "sort by name descending",
// "hide the note", "show Added", "only Each", "only items we count" and "only preferred" (a yes-or-no column), "clear".
// Anything else is refused with a sentence that says what they read, so the person knows what to type without the model.

/** What the rules read, said to the person when they cannot read a request. */
export const rulesRead =
  "Without the model the assistant reads “find …”, “sort by …”, “hide …”, “show …”, “only …” and “clear”, joined by “and”."

const clean = (text: string) => Str.trim(Str.replace(/[.!?]+$/, "")(Str.trim(Str.toLowerCase(text))))

const columnNamed = (columns: ColumnCatalog, words: string): Option.Option<CatalogColumn> => {
  const wanted = clean(Str.replace(/^the\s+/, "")(Str.replace(/\s+column$/, "")(words)))
  const plain = Str.replace(/s$/, "")(wanted)
  return Arr.findFirst(columns, (column) => {
    const label = Str.toLowerCase(column.label)
    const id = Str.toLowerCase(column.id)
    return label === wanted || id === wanted || label === plain || id === plain
  })
}

/** Whether a column's heading or id is these words: "Preferred", "Preferred?", "Preferred vendor" for "preferred". */
const headedBy = (column: CatalogColumn, words: string): boolean => {
  const label = Str.replace(/[?:]+$/, "")(Str.toLowerCase(column.label))
  const id = Str.toLowerCase(column.id)
  return label === words || id === words || Str.startsWith(`${words} `)(label)
}

const yesWords = ["yes", "true", "y"]

/**
 * "only preferred", "only the preferred ones", "only not preferred", "non-preferred": a yes-or-no column named by its
 * heading (or its heading's first words), kept to its yes rows or, after "not" or "non", its no rows. A list column
 * whose values are Yes and No reads the same way. None when no such column has that name.
 *
 * @example flagNamed(columns, "preferred") // Option.some({ kind: "filter", column: "preferred", operator: "eq", values: ["true"] })
 */
const flagNamed = (columns: ColumnCatalog, words: string): Option.Option<ViewChange> => {
  const negated = Option.isSome(Str.match(/^(?:not |non-|non )/)(words))
  const rest = Str.replace(/^(?:the )?(?:not |non-|non )?(?:the )?/, "")(words)
  // A noun after the name is the rows themselves ("preferred ones", "preferred links"): the name is what is left.
  const names = Arr.dedupe([rest, Str.replace(/\s+\w+$/, "")(rest), Str.replace(/s$/, "")(rest)])
  for (const name of names) {
    if (name === "") continue
    const flag = Arr.findFirst(
      columns,
      (column) => column.type === "boolean" && Arr.contains(column.operators, "eq") && headedBy(column, name)
    )
    if (Option.isSome(flag)) {
      return Option.some({
        kind: "filter",
        column: flag.value.id,
        operator: "eq",
        values: [negated ? "false" : "true"]
      })
    }
    const listed = Arr.findFirst(
      columns,
      (column) =>
        column.type === "select" &&
        Arr.contains(column.operators, "inArray") &&
        headedBy(column, name) &&
        Arr.some(column.values, (value) => Arr.contains(yesWords, Str.toLowerCase(value)))
    )
    if (Option.isSome(listed)) {
      const yes = Arr.filter(listed.value.values, (value) => Arr.contains(yesWords, Str.toLowerCase(value)))
      return Option.some({
        kind: "filter",
        column: listed.value.id,
        operator: negated ? "notInArray" : "inArray",
        values: yes
      })
    }
  }
  return Option.none()
}

const descending = /\s+(descending|desc|reversed|in reverse|high to low|largest first|z to a|newest first)$/
const ascending = /\s+(ascending|asc|low to high|smallest first|a to z|oldest first)$/

const readClause = (clause: string, columns: ColumnCatalog): Option.Option<ViewChange> => {
  if (/^(clear|reset)( all| everything| the view| it)?$/.test(clause) || /^show (all|everything)$/.test(clause)) {
    return Option.some({ kind: "clear", what: "everything" })
  }
  const clearPart = Str.match(/^(?:clear|reset) (?:the )?(filters?|sort|sorting|order|search|columns)$/)(clause)
  if (Option.isSome(clearPart)) {
    const part = clearPart.value[1] ?? ""
    return Option.some({
      kind: "clear",
      what: Str.startsWith("filter")(part)
        ? "filters"
        : part === "search"
          ? "search"
          : part === "columns"
            ? "columns"
            : "sorting"
    })
  }
  // "Find the steel brackets", "search for gaskets", "look for BRK-04": the words after go into the table's search box,
  // which matches each of them in any order. A table without a search box refuses it in `checkCommand`.
  const find = Str.match(/^(?:find|search(?: for)?|look for|look up)\s+(?:(?:all|every)\s+)?(?:the\s+)?(.+)$/)(clause)
  if (Option.isSome(find)) return Option.some({ kind: "search", text: find.value[1] ?? "" })
  const sort = Str.match(/^(?:sort|order)(?: it| them| the items| items| the rows| rows| the table)? by (.+)$/)(clause)
  if (Option.isSome(sort)) {
    const rest = sort.value[1] ?? ""
    const desc = descending.test(rest)
    const named = Str.replace(ascending, "")(Str.replace(descending, "")(rest))
    return Option.map(
      Option.filter(columnNamed(columns, named), (column) => column.sortable),
      (column): ViewChange => ({ kind: "sort", column: column.id, direction: desc ? "desc" : "asc" })
    )
  }
  const hide = Str.match(/^hide (.+)$/)(clause)
  if (Option.isSome(hide)) {
    return Option.map(
      Option.filter(columnNamed(columns, hide.value[1] ?? ""), (column) => column.hideable),
      (column): ViewChange => ({ kind: "hide", column: column.id })
    )
  }
  const show = Str.match(/^show (.+)$/)(clause)
  if (Option.isSome(show)) {
    const column = columnNamed(columns, show.value[1] ?? "")
    if (Option.isSome(column)) return Option.some({ kind: "show", column: column.value.id })
  }
  const weDo = Str.match(/^(?:show |list )?(?:only )?(?:the )?(?:items|rows) (?:that )?we (\w+)$/)(clause)
  const only = Str.match(/^(?:show |keep )?(?:only|just) (.+)$/)(clause)
  const wanted = Option.isSome(weDo) ? (weDo.value[1] ?? "") : Option.isSome(only) ? (only.value[1] ?? "") : ""
  if (wanted === "") return Option.none()
  const flag = flagNamed(columns, wanted)
  if (Option.isSome(flag)) return Option.some(flag.value)
  const valued = Arr.findFirst(
    columns,
    (column) =>
      column.type === "select" &&
      Arr.contains(column.operators, "inArray") &&
      Arr.some(column.values, (value) => Str.toLowerCase(value) === wanted)
  )
  return Option.map(valued, (column): ViewChange => ({
    kind: "filter",
    column: column.id,
    operator: "inArray",
    values: Arr.filter(column.values, (value) => Str.toLowerCase(value) === wanted)
  }))
}

/**
 * Reads a request with the fixed rules: each part joined by "and", a comma or "then" must be one they read, or the
 * whole request is refused with the part they could not read. The answer goes through `checkCommand` like a model's.
 *
 * @example
 * readByRules({ prompt: "Sort by name descending and hide note", columns })
 * // Result.succeed([{ kind: "sort", column: "name", direction: "desc" }, { kind: "hide", column: "note" }])
 */
export const readByRules = (input: {
  readonly prompt: string
  readonly columns: ColumnCatalog
}): Result.Result<ReadonlyArray<ViewChange>, string> => {
  const clauses = Arr.filter(
    Arr.map(Str.split(/\s*(?:,|;|\band then\b|\bthen\b|\band\b)\s*/)(clean(input.prompt)), clean),
    (clause) => clause !== ""
  )
  if (clauses.length === 0) return Result.fail(`Type what you want to see. ${rulesRead}`)
  const changes: Array<ViewChange> = []
  for (const clause of clauses) {
    const read = readClause(clause, input.columns)
    if (Option.isNone(read)) return Result.fail(`The rules could not read ${quoted(clause)}.`)
    changes.push(read.value)
  }
  return Result.succeed(changes)
}
