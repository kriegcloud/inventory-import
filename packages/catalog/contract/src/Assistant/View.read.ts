import * as S from "effect/Schema"
import { AnsweredBy } from "../Answer/AnsweredBy.read.ts"
import { nullAsNone } from "@inventory/kernel/Wire"
import { LiteralKit } from "@beep/schema/LiteralKit"
import { Tuple } from "effect"

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
  kind: S.tag("sort"),
  column: ColumnId,
  direction: S.Literals(["asc", "desc"]).annotateKey({ description: "asc: A to Z, low to high. desc: the reverse" })
}).annotate({ description: "Order the table by one column, replacing the order it had" })

/** Keep only the rows whose column passes a comparison. It replaces any filter the column had. */
export const FilterChange = S.Struct({
  kind: S.tag("filter"),
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
  kind: S.tag("search"),
  text: Text(maxSearchText).annotateKey({
    description:
      'The words to put in the search box, as the person would type them ("m8 washer"); empty to stop searching'
  })
}).annotate({ description: "Search the table: the words are found in any order, ignoring case and accents" })

/** Show one column the view had hidden. */
export const ShowChange = S.Struct({
  kind: S.tag("show"),
  column: ColumnId
}).annotate({ description: "Show one column" })

/** Hide one column. A column the table always shows cannot be hidden: `checkCommand` refuses it. */
export const HideChange = S.Struct({
  kind: S.tag("hide"),
  column: ColumnId
}).annotate({ description: "Hide one column" })

/** Put part of the view back as the table opens: its filters, its order, its search, its columns, or all of them. */
export const ClearChange = S.Struct({
  kind: S.tag("clear"),
  what: S.Literals(["everything", "filters", "sorting", "search", "columns"])
}).annotate({ description: "Put part of the view back as the table opens" })

/** The six changes a view can take. */
export const ViewChangeKind = LiteralKit(["sort", "filter", "search", "show", "hide", "clear"]).annotate({
  description: "What a change to a view does: sort, filter, search, show a column, hide a column, or clear"
})
/** The decoded value of `ViewChangeKind`. */
export type ViewChangeKind = typeof ViewChangeKind.Type

/** One change to a table's view, by `kind`. */
export const ViewChange = ViewChangeKind.mapMembers(() =>
  Tuple.make(SortChange, FilterChange, SearchChange, ShowChange, HideChange, ClearChange)
).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({
    description: "One change to a table's view: sort, filter, search, show or hide a column, or clear"
  })
)
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
