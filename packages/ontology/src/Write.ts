/**
 * The writer (report 14 section 6.1; report 12 section 3.1): one projection becomes the exact bytes of one Turtle
 * file. It is the package's own, so that the bytes are its to fix; no library serializer writes a file.
 *
 * Do not break: the same projection gives the same text on every machine and on every run. UTF-8, LF, one final
 * newline, no trailing space; two comment lines; only the prefixes the file uses, sorted; subjects by section and,
 * within one, by IRI in code-point order; predicates in the projection's order, `rdf:type` written `a`; a name
 * written with its prefix where one leaves a plain local name, and as `<iri>` otherwise; the objects of one
 * predicate one a line, in the order of their N-Triples form, which is used to sort and never written; no blank node, no `@base`, and no date, host, path outside the repository or
 * commit anywhere. A boolean is written `true` or `false`, Turtle's own form (report 12 section 3.1, rule 8), and a
 * date-time with its datatype. A predicate the projection's order lacks, words that are not NFC, a boolean that is not
 * `true` or `false` and a date-time that is no `xsd:dateTime`, a day past its month's end included, are refused: nothing is written around them.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual, pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { byCodePoint, ObjectNode, objectLine, quoted, type Iri } from "./Graph.schema.ts"
import { $OntologyId } from "./internal/identity.ts"
import { term, type Projection } from "./Project.ts"

const $I = $OntologyId.create("Write")

/**
 * A projection the writer will not turn into a file, and why.
 *
 * @category errors
 */
export class WriteRefused extends S.TaggedError<WriteRefused, { readonly brand: unique symbol }>($I`WriteRefused`)(
  "WriteRefused",
  { reason: S.String.pipe(S.annotateKey({ description: "What the projection holds that is not written" })) },
  $I.annoteError<WriteRefused>("WriteRefused", { description: "A projection the writer will not turn into a file." })
) {}

/** A local name written after a prefix without escaping: a letter or `_`, then letters, digits, `_` and `-`. */
const isLocalName = (local: string): boolean => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(local)

/** A prefix Turtle reads before the colon. `_` is not one: `_:x` is a blank node. */
const isPrefixName = (prefix: string): boolean => /^[A-Za-z][A-Za-z0-9]*$/.test(prefix)

type Rendering = { readonly text: string; readonly prefix: O.Option<string> }

/** An IRI as the file writes it: `prefix:local` under the longest prefix that leaves a plain local name, else `<iri>`. */
const renderIri = (prefixes: ReadonlyArray<readonly [string, Iri]>, iri: Iri): Rendering =>
  O.match(
    A.findFirst(
      prefixes,
      ([, namespace]) => Str.startsWith(namespace)(iri) && isLocalName(Str.slice(namespace.length)(iri))
    ),
    {
      onNone: () => ({ text: `<${iri}>`, prefix: O.none() }),
      onSome: ([prefix, namespace]) => ({
        text: `${prefix}:${Str.slice(namespace.length)(iri)}`,
        prefix: O.some(prefix)
      })
    }
  )

const isNfc = (value: string): boolean => Str.normalize("NFC")(value) === value

/** The one spelling of each boolean the files write; XSD's `1` and `0` are refused, so a value has one text. */
const booleans: ReadonlyArray<string> = ["true", "false"]

/**
 * The shape of the lexical space of `xsd:dateTime` (XML Schema 1.1 part 2, section 3.3.7): a year of four digits or
 * more, the month, a day from 01 to 31, the time to the second with an optional fraction, or 24:00:00, and an optional
 * zone. A day alone is none. The day's fit to its month is {@link dayFits}'s, not this pattern's.
 */
const dateTimeForm =
  /^-?(?:[1-9][0-9]{3,}|0[0-9]{3})-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]+)?|24:00:00(?:\.0+)?)(?:Z|[+-](?:(?:0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/

/** The year's digits, the month and the day of a text {@link dateTimeForm} accepts. */
const datePart = /^-?([0-9]{4,})-([0-9]{2})-([0-9]{2})T/

/** The days of each month of a common year, January first. */
const monthLengths: ReadonlyArray<number> = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Whether a year, given as its digits without a sign, is a leap year: a multiple of 4 that is not a multiple of 100,
 * or a multiple of 400. Its last four digits decide it, since 10000 is a multiple of 400, so a year of any length is
 * read exactly; the sign changes no multiple.
 */
const isLeapYear = (digits: string): boolean => {
  const year = Number(Str.takeRight(digits, 4))
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0)
}

/**
 * XML Schema 1.1 part 2, section 3.3.7.2, "Day-of-month Values": the day is not past the end of its month, 29
 * February in a leap year only. So `2026-02-30T00:00:00Z` and `2026-02-29T00:00:00Z` are outside the lexical space,
 * and `2024-02-29T00:00:00Z` is in it.
 */
const dayFits = (value: string): boolean =>
  O.exists(
    O.flatMap(Str.match(datePart)(value), (parts) => O.all([A.get(parts, 1), A.get(parts, 2), A.get(parts, 3)])),
    ([year, month, day]) =>
      O.exists(
        A.get(monthLengths, Number(month) - 1),
        (length) => Number(day) <= length || (month === "02" && Number(day) === 29 && isLeapYear(year))
      )
  )

/**
 * Why a literal's text is not one its datatype writes, or none when it is. The writer refuses such a literal, and the
 * lift asks the same before it states one, so the two refuse the same misreadings of a datatype. Whether the text is
 * NFC is the writer's check alone: a lifted literal that is not NFC is refused only when it is written.
 *
 * @example misread("2026-02-30T00:00:00Z", term("xsd", "dateTime")) // Some('is no xsd:dateTime: "2026-02-30T00:00:00Z"')
 */
export const misread: {
  (datatype: Iri): (value: string) => O.Option<string>
  (value: string, datatype: Iri): O.Option<string>
} = dual(2, (value: string, datatype: Iri): O.Option<string> => {
  if (datatype === term("xsd", "boolean") && !A.contains(booleans, value)) {
    return O.some(`is no boolean the files write: "${value}" is neither true nor false`)
  }
  if (datatype === term("xsd", "dateTime") && !(dateTimeForm.test(value) && dayFits(value))) {
    return O.some(`is no xsd:dateTime: "${value}"`)
  }
  return O.none()
})

/**
 * The file's text for one projection, or a refusal.
 *
 * @example writeTurtle(owlProjection(context, source)) // "# GENERATED by …\n# inventory-import ontology 0.1.0\n\n@prefix …"
 */
export const writeTurtle = Effect.fnUntraced(function* (projection: Projection) {
  const type = term("rdf", "type")
  const plain = term("xsd", "string")
  // Longest namespace first, so an IRI under two prefixes takes the nearer one.
  const prefixes = A.sort(
    R.toEntries(projection.prefixes),
    Order.mapInput(Order.flip(Order.Number), ([, namespace]: readonly [string, Iri]) => namespace.length)
  )
  const used: Array<string> = []
  const iri = (value: Iri): string => {
    const rendered = renderIri(prefixes, value)
    if (O.isSome(rendered.prefix)) {
      used.push(rendered.prefix.value)
    }
    return rendered.text
  }
  const object = (node: ObjectNode): string =>
    ObjectNode.match(node, {
      iri: (thing) => iri(thing.iri),
      literal: (value) => {
        if (value.datatype === plain) {
          return `"${quoted(value.value)}"`
        }
        // Checked below to be `true` or `false`, so the bare word is Turtle's boolean and nothing else.
        if (value.datatype === term("xsd", "boolean")) {
          return value.value
        }
        return `"${quoted(value.value)}"^^${iri(value.datatype)}`
      },
      text: (words) => `"${quoted(words.value)}"@${words.language}`
    })
  // A comment ends at a line break, so a header line that held one would be read as statements.
  for (const line of projection.header) {
    if (/[\n\r]/.test(line)) {
      return yield* WriteRefused.make({ reason: "a header line holds a line break" })
    }
  }
  for (const [prefix] of prefixes) {
    if (!isPrefixName(prefix)) {
      return yield* WriteRefused.make({
        reason: `${prefix} is no prefix Turtle reads: a letter, then letters and digits`
      })
    }
  }
  const blocks: Array<string> = []
  for (const section of projection.sections) {
    for (const triple of section) {
      if (!A.contains(projection.predicates, triple.predicate)) {
        return yield* WriteRefused.make({ reason: `${triple.predicate} is not a predicate this file writes` })
      }
      if (!ObjectNode.guards.iri(triple.object) && !isNfc(triple.object.value)) {
        return yield* WriteRefused.make({ reason: `a value of ${triple.subject} is not NFC` })
      }
      if (ObjectNode.guards.literal(triple.object)) {
        const wrong = misread(triple.object.value, triple.object.datatype)
        if (O.isSome(wrong)) {
          return yield* WriteRefused.make({ reason: `a value of ${triple.subject} ${wrong.value}` })
        }
      }
    }
    const subjects = A.sort(A.dedupe(A.map(section, (triple) => triple.subject)), byCodePoint)
    for (const subject of subjects) {
      const own = A.filter(section, (triple) => triple.subject === subject)
      const lines = A.getSomes(
        A.map(projection.predicates, (predicate) => {
          const objects = pipe(
            A.filter(own, (triple) => triple.predicate === predicate),
            A.map((triple) => triple.object),
            A.dedupeWith((self, that) => objectLine(self) === objectLine(that)),
            A.sort(Order.mapInput(byCodePoint, objectLine)),
            A.map(object)
          )
          return A.isReadonlyArrayNonEmpty(objects)
            ? O.some(`${predicate === type ? "a" : iri(predicate)} ${A.join(objects, " ,\n        ")}`)
            : O.none()
        })
      )
      blocks.push(`${iri(subject)} ${A.join(lines, " ;\n    ")} .`)
    }
  }
  const declared = A.map(
    A.sort(
      A.filter(R.toEntries(projection.prefixes), ([prefix]) => A.contains(used, prefix)),
      Order.mapInput(byCodePoint, ([prefix]: readonly [string, Iri]) => prefix)
    ),
    ([prefix, namespace]) => `@prefix ${prefix}: <${namespace}> .`
  )
  const header = A.map(projection.header, (line) => `# ${line}`)
  return `${A.join([A.join(header, "\n"), A.join(declared, "\n"), ...blocks], "\n\n")}\n`
})
