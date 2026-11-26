// Sutton's coverage table read against the module (PLAN, step 14): report 18 section 9, the table SPEC proposed with
// decisions 130 to 175's answers, read from the report's accepted text as gate 4 reads the decision log, never copied.
// What must not break: every name a "Placed as" cell gives is a term of the module, and a field the table gives no
// term, leaves unplaced or leaves for a later slice has no property named after it. Only names are read: that the
// term a field is placed on means what the field holds is the report's reading, which no test can see.
import type { Vocabulary } from "@beep/vocabulary/Model"
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import report from "../../../../explorations/erp-ontology/research/18-party-slice-terms.md?raw"

/** Report 18 as committed, the text the coverage is read from. */
export const coverageReport: string = report

/** The heading of the table's section, and the start of the next section, which ends it. */
const heading = "## 9. Sutton's slice-1 records, as answered"
const nextSection = "## "

/**
 * The words a "Placed as" cell may give that are no term of the module, each with why: Sutton's own field `kind` and
 * its two values, which choose the class `recordOf` points at (decision 125); Sutton's type `User` and field
 * `phoneNumber`, named where a placement is said of them; and this app's two ids, which the unplaced rows give as what
 * a criterion holds (decision 158). A dotted name (`User.id`, `readings.json`) is a Sutton field or a file.
 */
export const notTerms: ReadonlyArray<string> = [
  "kind",
  "individual",
  "company",
  "User",
  "phoneNumber",
  "MemberId",
  "UserId"
]

/**
 * A Sutton type that has no row for its record, with the type and field whose row makes it part of another: report 18
 * makes a `UserProfile` part of the `Member` through `OrganizationMember`'s `profile`.
 */
const parts: ReadonlyArray<readonly [part: string, type: string, field: string]> = [
  ["UserProfile", "OrganizationMember", "profile"]
]

/** One row of the table: its Sutton types, its field cell, the fields it names and its "Placed as" cell. */
type Row = readonly [types: ReadonlyArray<string>, field: string, fields: ReadonlyArray<string>, placedAs: string]

/** The names a cell gives in backticks, in order. */
const namesIn = (cell: string): ReadonlyArray<string> =>
  A.flatMap(A.fromIterable(Str.matchAll(/`([^`]+)`/g)(cell)), (found) => A.fromOption(A.get(found, 1)))

/** The lines of the table's section, or none when the heading is missing. */
const sectionLines = (text: string): ReadonlyArray<string> => {
  const lines = Str.split(text, /\r?\n/)
  return O.match(
    A.findFirstIndex(lines, (line) => line === heading),
    {
      onNone: () => [],
      onSome: (start) => A.takeWhile(A.drop(lines, start + 1), (line) => !Str.startsWith(nextSection)(line))
    }
  )
}

/**
 * The table's rows, each as its Sutton types, the field cell, the names it gives and the "Placed as" cell. A row is a
 * line that starts with a type in backticks; the header and its rule start otherwise.
 *
 * @example coverageRows(coverageReport)[1] // [["Company"], "`id`", ["id"], "`sourceId`"]
 */
export const coverageRows = (text: string): ReadonlyArray<Row> =>
  A.flatMap(
    A.filter(sectionLines(text), (line) => Str.startsWith("| `")(line)),
    (line: string) => {
      const cells = Str.split(Str.slice(2, -2)(line), " | ")
      return O.match(O.all([A.get(cells, 0), A.get(cells, 1), A.get(cells, 2)]), {
        onNone: () => [],
        onSome: ([types, field, placedAs]) =>
          A.length(cells) === 3 ? [[namesIn(types), field, namesIn(field), placedAs] as const] : []
      })
    }
  )

/** How a row places its fields: on terms, or with none for now and why, read from how its "Placed as" cell opens. */
const placementOf = (placedAs: string): string =>
  O.match(
    O.flatMap(Str.match(/^(?:as `[^`]+`: )?(no term|unplaced|later)/)(placedAs), (found) => A.get(found, 1)),
    { onNone: () => "placed", onSome: (kind) => kind }
  )

/** The schemes the paragraph after the table names, each as `Enum` is `Scheme`. */
const enumSchemes = (text: string): ReadonlyArray<string> => {
  const lines = sectionLines(text)
  const paragraph = A.takeWhile(
    A.drop(
      lines,
      O.match(A.findFirstIndex(lines, Str.startsWith("Enums:")), { onNone: () => A.length(lines), onSome: (at) => at })
    ),
    Str.isNonEmpty
  )
  return A.filter(A.flatMap(paragraph, namesIn), Str.endsWith("Scheme"))
}

/**
 * Each place the coverage table and the module disagree, as one sentence: a name a "Placed as" cell gives that is no
 * class, property, scheme or concept of the module; a field given no term, left unplaced or left for a later slice that
 * a property is named after; a Sutton type whose record names no class; a scheme the enums name that the module lacks;
 * and an excused word that is no longer in the table or has become a term. The text with no row is one fault, so a
 * moved heading can never read as a table that agrees.
 *
 * @example coverageFaults({ report: coverageReport, vocabulary }) // []
 */
export const coverageFaults = (input: {
  readonly report: string
  readonly vocabulary: Vocabulary
}): ReadonlyArray<string> => {
  const { report: text, vocabulary } = input
  const rows = coverageRows(text)
  const classes = HashSet.fromIterable(R.keys(vocabulary.classes))
  const properties = HashSet.fromIterable([
    ...R.keys(vocabulary.objectProperties),
    ...R.keys(vocabulary.datatypeProperties)
  ])
  const schemes = HashSet.fromIterable(R.keys(vocabulary.schemes))
  const concepts = A.flatMap(R.values(vocabulary.schemes), (scheme) => R.keys(scheme.concepts))
  const terms = HashSet.union(
    HashSet.union(classes, properties),
    HashSet.union(schemes, HashSet.fromIterable(concepts))
  )
  const isTerm = (name: string) => HashSet.has(terms, name)
  const placedNames = A.flatMap(rows, ([, , , placedAs]) => namesIn(placedAs))
  const classesOf = (placedAs: string) => A.filter(namesIn(placedAs), (name) => HashSet.has(classes, name))
  const recordClasses = (type: string) =>
    A.flatMap(
      A.filter(rows, (row) => A.contains(row[0], type) && Str.startsWith("the record")(row[1])),
      (row: Row) => classesOf(row[3])
    )
  const partClasses = (type: string) =>
    A.flatMap(
      A.filter(parts, (entry) => entry[0] === type),
      (entry: readonly [part: string, type: string, field: string]) =>
        A.flatMap(
          A.filter(rows, (row) => A.contains(row[0], entry[1]) && A.contains(row[2], entry[2])),
          (row: Row) => classesOf(row[3])
        )
    )
  const types = A.dedupe(A.flatMap(rows, ([names]) => names))
  return [
    ...(A.length(rows) === 0 ? [`report 18 section 9 holds no row of its table under "${heading}"`] : []),
    ...A.flatMap(rows, ([names, field, fields, placedAs]) => {
      const where = `${A.join(names, ", ")} ${field}`
      const kind = placementOf(placedAs)
      return [
        ...A.map(
          A.filter(
            namesIn(placedAs),
            (name) => !Str.includes(".")(name) && !A.contains(notTerms, name) && !isTerm(name)
          ),
          (name) => `${where}: ${name} is no term of the module`
        ),
        ...(kind === "placed"
          ? []
          : A.map(
              A.filter(fields, (name) => HashSet.has(properties, name)),
              (name) => `${where}: the table says ${kind}, and the module holds the property ${name}`
            ))
      ]
    }),
    ...A.map(
      A.filter(types, (type) => A.length(recordClasses(type)) === 0 && A.length(partClasses(type)) === 0),
      (type) => `${type}: no row names a class of the module for its record`
    ),
    ...A.map(
      A.filter(enumSchemes(text), (name) => !HashSet.has(schemes, name)),
      (name) => `the enums name ${name}, which is no scheme of the module`
    ),
    ...A.map(
      A.filter(notTerms, (name) => !A.contains(placedNames, name)),
      (name) => `the excused word ${name} is in no "Placed as" cell`
    ),
    ...A.map(A.filter(notTerms, isTerm), (name) => `the excused word ${name} is a term of the module`)
  ]
}
