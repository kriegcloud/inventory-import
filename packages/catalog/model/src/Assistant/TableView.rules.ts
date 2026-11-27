import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import {
  ColumnCatalog,
  ViewChange,
  maxSearchText,
  operatorsFor,
  CatalogColumn
} from "@inventory/catalog-contract/TableView"
import { dual } from "effect/Function"
// WHAT THE TABLE ASSISTANT MAY ASK OF A TABLE, AND NOTHING MORE. A person types what they want to see; a model (or the
// fixed rules) answers with a `ViewCommand`: sort, filter, search, show or hide a column, clear. The command changes
// the person's own view of a table, never stored data. The one thing not to break: every column and operator in an
// answer is checked against the catalog the request carried (`checkCommand`), and an answer that names anything else
// is refused whole, with a sentence, never applied in part.

const nothing = "so nothing was changed."
const quoted = (text: string) => `“${text}”`

const findColumn = (columns: ColumnCatalog, id: string) => A.findFirst(columns, (column) => column.id === id)

const isNumber = (text: string) => O.isSome(Str.match(/^-?\d+(\.\d+)?$/)(Str.trim(text)))

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
    if (ViewChange.guards.clear(change)) {
      checked.push(change)
      continue
    }
    if (ViewChange.guards.search(change)) {
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
    if (O.isNone(found)) {
      return Result.fail(`The answer named a column this table does not have (${quoted(change.column)}), ${nothing}`)
    }
    const column = found.value
    if (ViewChange.guards.sort(change)) {
      if (!column.sortable) return Result.fail(`The table cannot be ordered by ${column.label}, ${nothing}`)
      checked.push(change)
      continue
    }
    if (!ViewChange.guards.filter(change)) {
      if (ViewChange.guards.hide(change) && !column.hideable) {
        return Result.fail(`${column.label} is always shown, ${nothing}`)
      }
      checked.push(change)
      continue
    }
    const allowed =
      A.contains(column.operators, change.operator) && A.contains(operatorsFor[column.type], change.operator)
    if (!allowed) {
      return Result.fail(`${column.label} cannot be compared that way (${quoted(change.operator)}), ${nothing}`)
    }
    const needsNone = change.operator === "isEmpty" || change.operator === "isNotEmpty"
    if (needsNone) {
      checked.push({ ...change, values: [] })
      continue
    }
    const head = A.head(change.values)
    if (O.isNone(head)) return Result.fail(`The filter on ${column.label} had nothing to compare with, ${nothing}`)
    if (column.type === "select") {
      const spelled: Array<string> = []
      for (const value of change.values) {
        const match = A.findFirst(column.values, (known) => Str.toLowerCase(known) === Str.toLowerCase(Str.trim(value)))
        if (O.isNone(match)) {
          return Result.fail(`${quoted(value)} is not one of the values of ${column.label}, ${nothing}`)
        }
        spelled.push(match.value)
      }
      checked.push({ ...change, values: A.dedupe(spelled) })
      continue
    }
    const first = Str.trim(head.value)
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

const columnNamed = (columns: ColumnCatalog, words: string): O.Option<CatalogColumn> => {
  const wanted = clean(Str.replace(/^the\s+/, "")(Str.replace(/\s+column$/, "")(words)))
  const plain = Str.replace(/s$/, "")(wanted)
  return A.findFirst(columns, (column) => {
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
 * @example flagNamed(columns, "preferred") // O.some({ kind: "filter", column: "preferred", operator: "eq", values: ["true"] })
 */
const flagNamed = (columns: ColumnCatalog, words: string): O.Option<ViewChange> => {
  const negated = O.isSome(Str.match(/^(?:not |non-|non )/)(words))
  const rest = Str.replace(/^(?:the )?(?:not |non-|non )?(?:the )?/, "")(words)
  // A noun after the name is the rows themselves ("preferred ones", "preferred links"): the name is what is left.
  const names = A.dedupe([rest, Str.replace(/\s+\w+$/, "")(rest), Str.replace(/s$/, "")(rest)])
  for (const name of names) {
    if (name === "") continue
    const flag = A.findFirst(
      columns,
      (column) => column.type === "boolean" && A.contains(column.operators, "eq") && headedBy(column, name)
    )
    if (O.isSome(flag)) {
      return O.some({
        kind: "filter",
        column: flag.value.id,
        operator: "eq",
        values: [negated ? "false" : "true"]
      })
    }
    const listed = A.findFirst(
      columns,
      (column) =>
        column.type === "select" &&
        A.contains(column.operators, "inArray") &&
        headedBy(column, name) &&
        A.some(column.values, (value) => A.contains(yesWords, Str.toLowerCase(value)))
    )
    if (O.isSome(listed)) {
      const yes = A.filter(listed.value.values, (value) => A.contains(yesWords, Str.toLowerCase(value)))
      return O.some({
        kind: "filter",
        column: listed.value.id,
        operator: negated ? "notInArray" : "inArray",
        values: yes
      })
    }
  }
  return O.none()
}

const descending = /\s+(descending|desc|reversed|in reverse|high to low|largest first|z to a|newest first)$/
const ascending = /\s+(ascending|asc|low to high|smallest first|a to z|oldest first)$/

/**
 * The text a pattern's first group found in a clause, or none when the clause does not match it.
 *
 * @example groupOf(/^hide (.+)$/)("hide the note") // O.some("the note")
 */
const groupOf =
  (pattern: RegExp) =>
    (clause: string): O.Option<string> =>
      O.flatMap(Str.match(pattern)(clause), (found) => O.fromUndefinedOr(found[1]))

const readClause: {
  (clause: string, columns: ColumnCatalog): O.Option<ViewChange>,
  (columns: ColumnCatalog): (clause: string) => O.Option<ViewChange>
} = dual(2, (clause: string, columns: ColumnCatalog): O.Option<ViewChange> => {
  if (/^(clear|reset)( all| everything| the view| it)?$/.test(clause) || /^show (all|everything)$/.test(clause)) {
    return O.some({ kind: "clear", what: "everything" })
  }
  const clearPart = groupOf(/^(?:clear|reset) (?:the )?(filters?|sort|sorting|order|search|columns)$/)(clause)
  if (O.isSome(clearPart)) {
    const part = clearPart.value
    return O.some({
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
  const find = groupOf(/^(?:find|search(?: for)?|look for|look up)\s+(?:(?:all|every)\s+)?(?:the\s+)?(.+)$/)(clause)
  if (O.isSome(find)) return O.some({ kind: "search", text: find.value })
  const sort = groupOf(/^(?:sort|order)(?: it| them| the items| items| the rows| rows| the table)? by (.+)$/)(clause)
  if (O.isSome(sort)) {
    const rest = sort.value
    const desc = descending.test(rest)
    const named = Str.replace(ascending, "")(Str.replace(descending, "")(rest))
    return O.map(
      O.filter(columnNamed(columns, named), (column) => column.sortable),
      (column): ViewChange => ({ kind: "sort", column: column.id, direction: desc ? "desc" : "asc" })
    )
  }
  const hide = groupOf(/^hide (.+)$/)(clause)
  if (O.isSome(hide)) {
    return O.map(
      O.filter(columnNamed(columns, hide.value), (column) => column.hideable),
      (column): ViewChange => ({ kind: "hide", column: column.id })
    )
  }
  const show = groupOf(/^show (.+)$/)(clause)
  if (O.isSome(show)) {
    const column = columnNamed(columns, show.value)
    if (O.isSome(column)) return O.some({ kind: "show", column: column.value.id })
  }
  const asked = O.orElse(
    groupOf(/^(?:show |list )?(?:only )?(?:the )?(?:items|rows) (?:that )?we (\w+)$/)(clause),
    () => groupOf(/^(?:show |keep )?(?:only|just) (.+)$/)(clause)
  )
  if (O.isNone(asked)) return O.none()
  const wanted = asked.value
  const flag = flagNamed(columns, wanted)
  if (O.isSome(flag)) return O.some(flag.value)
  const valued = A.findFirst(
    columns,
    (column) =>
      column.type === "select" &&
      A.contains(column.operators, "inArray") &&
      A.some(column.values, (value) => Str.toLowerCase(value) === wanted)
  )
  return O.map(valued, (column): ViewChange => ({
    kind: "filter",
    column: column.id,
    operator: "inArray",
    values: A.filter(column.values, (value) => Str.toLowerCase(value) === wanted)
  }))
})

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
  const clauses = A.filter(
    A.map(Str.split(/\s*(?:,|;|\band then\b|\bthen\b|\band\b)\s*/)(clean(input.prompt)), clean),
    (clause) => clause !== ""
  )
  if (A.isReadonlyArrayEmpty(clauses)) return Result.fail(`Type what you want to see. ${rulesRead}`)
  const changes = A.empty<ViewChange>()
  for (const clause of clauses) {
    const read = readClause(clause, input.columns)
    if (O.isNone(read)) return Result.fail(`The rules could not read ${quoted(clause)}.`)
    changes.push(read.value)
  }
  return Result.succeed(changes)
}
