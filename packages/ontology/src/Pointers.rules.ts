/**
 * Gate 5, record pointers on the AST (report 14 section 6.5): rules P1 to P13 over the enrolled schemas, read through
 * `@beep/vocabulary/Pointer`'s reader and compared with the decoded vocabulary. Each broken rule is one `PointerFinding`,
 * data that names the rule, the enrolment entry and the field; nothing here fails or throws.
 *
 * Do not break: the rules read only their arguments. The marks are read from the schemas' ASTs, never from source
 * text, and a field's mark only from its key annotations (section 3.1), so a field whose schema is itself an enrolled
 * record is not taken for pointed. P13 is the one rule that says a mark is the right one; P1 to P12 say it is well
 * formed.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import {
  fieldsOf,
  MarkReading,
  readKeyMark,
  readMarks,
  readSchemaMark,
  type FieldMark,
  type LiftPathRead
} from "@beep/vocabulary/Pointer"
import { ParentLink, RangeTarget, type Vocabulary } from "@beep/vocabulary/Model"
import * as A from "effect/Array"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import { $OntologyId } from "./internal/identity.ts"

const $I = $OntologyId.create("Pointers")

// ---------------------------------------------------------------------------------------------------------------
// The enrolment list
// ---------------------------------------------------------------------------------------------------------------

const EntryKind = LiteralKit(["record", "scheme", "collection"])

const entryFields = {
  file: S.String.check(S.isMinLength(1), S.isMaxLength(200)).pipe(
    S.annotateKey({ description: "The source file of the export, from the repository's root" })
  ),
  export: S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]{0,63}$/)).pipe(
    S.annotateKey({ description: "The exported name of the schema" })
  )
} as const

/** An enrolled record: a struct, or a class over one, that points at a class of the vocabulary. */
export class RecordEntry extends S.Opaque<RecordEntry, { readonly brand: unique symbol }>()(
  S.Struct({ ...entryFields, as: S.tag("record") }).pipe(
    $I.annoteSchema("RecordEntry", { description: "An enrolled record that points at one class" })
  )
) {}

/** An enrolled union of literals that points at a concept scheme. */
export class SchemeEntry extends S.Opaque<SchemeEntry, { readonly brand: unique symbol }>()(
  S.Struct({ ...entryFields, as: S.tag("scheme") }).pipe(
    $I.annoteSchema("SchemeEntry", { description: "An enrolled union of literals that points at one scheme" })
  )
) {}

/** An enrolled collection: an array of one variant of an enrolled record, carrying no mark of its own. */
export class CollectionEntry extends S.Opaque<CollectionEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    ...entryFields,
    as: S.tag("collection"),
    of: S.String.check(S.isPattern(/^[^#]+#[A-Z][A-Za-z0-9]{0,63}\.[a-zA-Z]{1,32}$/)).pipe(
      S.annotateKey({ description: "The element, as file#Export.variant" })
    )
  }).pipe($I.annoteSchema("CollectionEntry", { description: "An enrolled array of one record's variant" }))
) {}

/** One entry of `enrolment.json`. */
export const EnrolmentEntry = EntryKind.mapMembers(() => Tuple.make(RecordEntry, SchemeEntry, CollectionEntry)).pipe(
  S.toTaggedUnion("as"),
  $I.annoteSchema("EnrolmentEntry", { description: "One enrolled export and what it is enrolled as" })
)
/** Runtime type of {@link EnrolmentEntry}. */
export type EnrolmentEntry = typeof EnrolmentEntry.Type

/** The committed enrolment list, in the order it is written. */
export const Enrolment = S.Array(EnrolmentEntry.annotateKey({ description: "One enrolled export" })).pipe(
  $I.annoteSchema("Enrolment", { description: "Every export gate 5 reads, and what each is enrolled as" })
)
/** Runtime type of {@link Enrolment}. */
export type Enrolment = typeof Enrolment.Type

/**
 * The key an entry is known by in `Enrolled.ts` and in every finding: `file#export`.
 *
 * @example entryKey(entry) // "packages/kernel/src/Member.schema.ts#Member"
 */
export const entryKey = (entry: EnrolmentEntry): string => `${entry.file}#${entry.export}`

// ---------------------------------------------------------------------------------------------------------------
// The finding
// ---------------------------------------------------------------------------------------------------------------

/** The rules gate 5 runs, by their names in report 14 section 6.5. */
export const PointerRule = LiteralKit([
  "P1",
  "P2",
  "P3",
  "P4",
  "P5",
  "P6",
  "P7",
  "P8",
  "P9",
  "P10",
  "P11",
  "P12",
  "P13"
]).pipe($I.annoteSchema("PointerRule", { description: "A rule of gate 5" }))
/** Runtime type of {@link PointerRule}. */
export type PointerRule = typeof PointerRule.Type

/** One broken rule: the entry (`file#export`, or `vocabulary` for P11) and the field or property it names, if any. */
export class PointerFinding extends S.Opaque<PointerFinding, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: PointerRule.pipe(S.annotateKey({ description: "The rule that is broken" })),
    entry: S.String.pipe(S.annotateKey({ description: "The enrolment entry, file#export, or vocabulary" })),
    field: S.Option(S.String).pipe(S.annotateKey({ description: "The field, or for P11 the property, it names" })),
    detail: S.String.pipe(S.annotateKey({ description: "What is wrong, in one sentence" }))
  }).pipe($I.annoteSchema("PointerFinding", { description: "One broken rule of gate 5" }))
) {}

/** One row of P13's table: the mark section 3 gives one field of one enrolled record, as the reader reads it. */
export class Placement extends S.Opaque<Placement, { readonly brand: unique symbol }>()(
  S.Struct({
    entry: S.String.pipe(S.annotateKey({ description: "The record's file#export" })),
    field: S.String.pipe(S.annotateKey({ description: "The field's name" })),
    mark: MarkReading.pipe(S.annotateKey({ description: "The mark the field must carry" }))
  }).pipe($I.annoteSchema("Placement", { description: "The mark one field of an enrolled record must carry" }))
) {}

/**
 * What gate 5 reads: the decoded vocabulary and the prefix its CURIEs carry, the class whose instances are tenants
 * (P6), the slices a position may be deferred to (P9), the enrolment list, the schemas `Enrolled.ts` maps it to, the
 * variants of each enrolled `Model.Class`, and P13's table.
 */
export type PointerInput = {
  readonly vocabulary: Vocabulary
  readonly prefix: string
  readonly tenant: string
  readonly slices: ReadonlyArray<string>
  readonly enrolment: Enrolment
  readonly enrolled: Readonly<Record<string, S.Top>>
  readonly variants: Readonly<Record<string, Readonly<Record<string, S.Top>>>>
  readonly placements: ReadonlyArray<Placement>
}

const finding = (rule: PointerRule, entry: string, field: O.Option<string>, detail: string): PointerFinding =>
  PointerFinding.make({ rule, entry, field, detail })

const sameMark = S.toEquivalence(MarkReading)

// ---------------------------------------------------------------------------------------------------------------
// Reading the vocabulary
// ---------------------------------------------------------------------------------------------------------------

type Property =
  | {
      readonly kind: "object"
      readonly key: string
      readonly domain: O.Option<string>
      readonly range: RangeTarget
    }
  | { readonly kind: "datatype"; readonly key: string; readonly domain: O.Option<string> }

/** A CURIE's local name when it carries the vocabulary's prefix. */
const localOf =
  (prefix: string) =>
  (curie: string): O.Option<string> =>
    Str.startsWith(`${prefix}:`)(curie) ? O.some(Str.slice(Str.length(prefix) + 1)(curie)) : O.none()

const classOf = (vocabulary: Vocabulary, local: string): O.Option<string> =>
  R.has(vocabulary.classes, local) ? O.some(local) : O.none()

const schemeOf = (vocabulary: Vocabulary, local: string): O.Option<string> =>
  R.has(vocabulary.schemes, local) ? O.some(local) : O.none()

const propertyOf = (vocabulary: Vocabulary, local: string): O.Option<Property> =>
  O.orElse(
    O.map(R.get(vocabulary.objectProperties, local), (term): Property => ({
      kind: "object",
      key: local,
      domain: term.domain,
      range: term.range
    })),
    () =>
      O.map(R.get(vocabulary.datatypeProperties, local), (term): Property => ({
        kind: "datatype",
        key: local,
        domain: term.domain
      }))
  )

/** A class and its local ancestors, nearest first; a cycle stops at the class seen twice. */
const lineage = (vocabulary: Vocabulary, key: string, seen: ReadonlyArray<string> = []): ReadonlyArray<string> => {
  if (A.contains(seen, key)) {
    return seen
  }
  const next = [...seen, key]
  return O.match(R.get(vocabulary.classes, key), {
    onNone: () => next,
    onSome: (term) => (ParentLink.guards.local(term.parent) ? lineage(vocabulary, term.parent.key, next) : next)
  })
}

/** Whether `domain` is absent or names `key` or one of its ancestors. */
const domainFits = (vocabulary: Vocabulary, domain: O.Option<string>, key: string): boolean =>
  O.match(domain, { onNone: () => true, onSome: (named) => A.contains(lineage(vocabulary, key), named) })

/** A concept's scheme and notation from its local name, `<SchemeKey>-<notation>`, when the scheme has it. */
const conceptOf = (
  vocabulary: Vocabulary,
  local: string
): O.Option<{ readonly scheme: string; readonly notation: string }> =>
  O.flatMap(Str.match(/^([A-Z][A-Za-z0-9]{0,57}Scheme)-(.+)$/)(local), (parts) =>
    O.flatMap(O.fromUndefinedOr(parts[1]), (scheme) =>
      O.flatMap(O.fromUndefinedOr(parts[2]), (notation) =>
        O.flatMap(R.get(vocabulary.schemes, scheme), (term) =>
          R.has(term.concepts, notation) ? O.some({ scheme, notation }) : O.none()
        )
      )
    )
  )

// ---------------------------------------------------------------------------------------------------------------
// Reading a schema
// ---------------------------------------------------------------------------------------------------------------

/** One field's name and node, in declaration order, read through the same `fieldsOf` as `readMarks`. */
type FieldNode = { readonly name: string; readonly ast: SchemaAST.AST }

const fieldNodes = (ast: SchemaAST.AST): ReadonlyArray<FieldNode> =>
  A.map(
    O.getOrElse(fieldsOf(ast), () => []),
    (signature): FieldNode => ({
      name: P.isString(signature.name) ? signature.name : String(signature.name),
      ast: signature.type
    })
  )

/** The string literals a union of literals allows, or none when the node is something else. */
const literalsOf = (ast: SchemaAST.AST): O.Option<ReadonlyArray<string>> => {
  if (!SchemaAST.isUnion(ast)) {
    return O.none()
  }
  const literals = A.getSomes(
    A.map(ast.types, (member) =>
      SchemaAST.isLiteral(member) && P.isString(member.literal) ? O.some(member.literal) : O.none()
    )
  )
  return literals.length === ast.types.length && literals.length > 0 ? O.some(literals) : O.none()
}

/** The term a node's own schema annotations point at, when they point at one. */
const schemaTermOf = (ast: SchemaAST.AST): O.Option<string> => {
  const mark = readSchemaMark(ast)
  return MarkReading.guards.term(mark) ? O.some(mark.term) : O.none()
}

const fieldMarks = (ast: SchemaAST.AST): ReadonlyArray<FieldMark> => O.getOrElse(readMarks(ast).fields, () => [])

// ---------------------------------------------------------------------------------------------------------------
// The rules on one record
// ---------------------------------------------------------------------------------------------------------------

/**
 * Where a mark that does not decode is reported: under the rule whose wording governs what its key holds. A malformed
 * `term` is still exactly one key, so P3 (one of the three keys) holds; it names no class and no property, which is
 * what P5 ("any other term on a field names a property ...") refuses. A malformed `path` breaks P7, a malformed
 * `noTerm` P9.
 */
const MarkKeyRule: Readonly<Record<"term" | "path" | "noTerm", PointerRule>> = { term: "P5", path: "P7", noTerm: "P9" }

type Context = PointerInput & { readonly local: (curie: string) => O.Option<string> }

/** P8 on one node: a node pointing at a scheme allows only notations of it. */
const notationFindings = (
  context: Context,
  entry: string,
  field: O.Option<string>,
  ast: SchemaAST.AST
): ReadonlyArray<PointerFinding> =>
  O.match(O.flatMap(schemaTermOf(ast), context.local), {
    onNone: () => [],
    onSome: (local) =>
      O.match(R.get(context.vocabulary.schemes, local), {
        onNone: () => [],
        onSome: (scheme) =>
          O.match(literalsOf(ast), {
            onNone: () => [
              finding("P8", entry, field, `${local} is pointed at by a schema that is no union of literals`)
            ],
            onSome: (literals) =>
              A.map(
                A.filter(literals, (literal) => !R.has(scheme.concepts, literal)),
                (literal) => finding("P8", entry, field, `"${literal}" is no notation of ${local}`)
              )
          })
      })
  })

/** P7 on one path: section 4.3's rule, read from the record's class down the path. */
const pathFindings = (
  context: Context,
  entry: string,
  record: string,
  field: FieldNode,
  path: LiftPathRead
): ReadonlyArray<PointerFinding> => {
  const { vocabulary } = context
  const at = O.some(field.name)
  const bad = (detail: string) => finding("P7", entry, at, detail)
  const nodeSteps = A.dropRight(path, 1)
  const found: Array<PointerFinding> = []
  if (nodeSteps.length > 1) {
    found.push(bad("a path takes one node step at most"))
  }
  let parent = record
  for (const step of A.filter(path, (_, index) => index < nodeSteps.length)) {
    const stepNode = "node" in step ? step.node : ""
    const reverse = "reverse" in step && step.reverse === true
    const fixed = "fixed" in step ? step.fixed : []
    const node = O.flatMap(context.local(stepNode), (local) => classOf(vocabulary, local))
    const property = O.flatMap(context.local(step.property), (local) => propertyOf(vocabulary, local))
    if (O.isNone(node)) {
      found.push(bad(`${stepNode} is no class`))
      continue
    }
    if (O.isNone(property) || property.value.kind !== "object") {
      found.push(bad(`${step.property} is no object property`))
      parent = node.value
      continue
    }
    // Section 4.3: the side of the triple that is the created node names its class exactly and is declared; only the
    // parent's side may name an ancestor. With `reverse` the node is the subject: the domain is the node's class and
    // the range the parent's class or an ancestor. Without it the node is the object, the same rule turned round.
    const linking = property.value
    const rangeClass = RangeTarget.guards.class(linking.range) ? O.some(linking.range.key) : O.none<string>()
    const nodeSide = reverse ? linking.domain : rangeClass
    const parentSide = reverse ? rangeClass : linking.domain
    const nodeSideName = reverse ? "domain" : "range"
    const parentSideName = reverse ? "range" : "domain"
    if (!(O.isSome(nodeSide) && nodeSide.value === node.value)) {
      found.push(bad(`${step.property}'s ${nodeSideName} is not ${node.value}, the class of the node it makes`))
    }
    if (!(O.isSome(parentSide) && A.contains(lineage(vocabulary, parent), parentSide.value))) {
      found.push(bad(`${step.property}'s ${parentSideName} is neither ${parent} nor an ancestor of it`))
    }
    for (const fix of fixed) {
      const fixProperty = O.flatMap(context.local(fix.property), (local) => propertyOf(vocabulary, local))
      const concept = O.flatMap(context.local(fix.concept), (local) => conceptOf(vocabulary, local))
      if (O.isNone(concept)) {
        found.push(bad(`${fix.concept} is no concept of the vocabulary`))
      } else if (O.isNone(fixProperty) || fixProperty.value.kind !== "object") {
        found.push(bad(`${fix.property} is no object property`))
      } else {
        const fixing = fixProperty.value
        if (!(O.isSome(fixing.domain) && fixing.domain.value === node.value)) {
          found.push(bad(`${fix.property}'s domain is not ${node.value}, the class of the node it fixes`))
        }
        if (!(RangeTarget.guards.scheme(fixing.range) && fixing.range.key === concept.value.scheme)) {
          found.push(bad(`${fix.property}'s range is not ${concept.value.scheme}`))
        }
      }
    }
    parent = node.value
  }
  // The reader decodes only a path that ends in one value step, so the last step is that step.
  const lastStep = A.last(path)
  if (O.isNone(lastStep)) {
    return [...found, bad("the path has no value step")]
  }
  const last = lastStep.value
  const value = O.flatMap(context.local(last.property), (local) => propertyOf(vocabulary, local))
  if (O.isNone(value)) {
    return [...found, bad(`${last.property} is no property`)]
  }
  const property = value.value
  if (!domainFits(vocabulary, property.domain, parent)) {
    found.push(bad(`${last.property}'s domain does not fit ${parent}`))
  }
  const literals = literalsOf(field.ast)
  const pointed = O.flatMap(O.flatMap(schemaTermOf(field.ast), context.local), (local) => schemeOf(vocabulary, local))
  if (property.kind === "datatype") {
    // Case (a): a literal of the datatype, from a field that is no union of literals.
    if (O.isSome(literals)) {
      found.push(bad(`${last.property} is a datatype property, fed by a union of literals`))
    }
    return found
  }
  const caseHolds = RangeTarget.match(property.range, {
    // Case (b): the field points at the property's scheme.
    scheme: (range) => O.isSome(pointed) && pointed.value === range.key,
    // Case (c): the field points at a scheme whose concept for every literal it allows is also a C.
    class: (range) =>
      O.isSome(pointed) &&
      O.isSome(literals) &&
      A.every(literals.value, (literal) =>
        O.match(
          O.flatMap(R.get(vocabulary.schemes, pointed.value), (scheme) => R.get(scheme.concepts, literal)),
          {
            onNone: () => false,
            onSome: (concept) => O.isSome(concept.alsoInstanceOf) && concept.alsoInstanceOf.value === range.key
          }
        )
      )
  })
  if (!caseHolds) {
    found.push(bad(`the value step ${last.property} fits none of section 4.3's cases (a), (b) and (c)`))
  }
  return found
}

/** P2 to P9 on one record entry. */
const recordFindings = (context: Context, entry: string, schema: S.Top): ReadonlyArray<PointerFinding> => {
  const { vocabulary } = context
  const none = O.none<string>()
  const own = O.flatMap(O.flatMap(schemaTermOf(schema.ast), context.local), (local) => classOf(vocabulary, local))
  if (O.isNone(own)) {
    return [finding("P2", entry, none, "the record's schema annotations name no class of the vocabulary")]
  }
  const record = own.value
  const nodes = fieldNodes(schema.ast)
  if (nodes.length === 0) {
    return [finding("P2", entry, none, "the record has no fields: it is no struct and no class over one")]
  }
  const found: Array<PointerFinding> = []
  const subjects: Array<string> = []
  const tenants: Array<string> = []
  for (const field of nodes) {
    const at = O.some(field.name)
    const mark = readKeyMark(field.ast)
    found.push(...notationFindings(context, entry, at, field.ast))
    MarkReading.match(mark, {
      none: () => {
        found.push(finding("P3", entry, at, "the field carries no mark"))
      },
      several: (several) => {
        found.push(finding("P3", entry, at, `the field carries ${several.keys.length} marks`))
      },
      malformed: (malformed) => {
        const rule = MarkKeyRule[malformed.key]
        found.push(finding(rule, entry, at, `the ${malformed.key} mark is not well formed`))
      },
      noTerm: (noTerm) => {
        if ("slice" in noTerm.noTerm && !A.contains(context.slices, noTerm.noTerm.slice)) {
          found.push(finding("P9", entry, at, `deferred to ${noTerm.noTerm.slice}, which is no slice`))
        }
      },
      path: (path) => {
        found.push(...pathFindings(context, entry, record, field, path.path))
      },
      term: (term) => {
        const local = context.local(term.term)
        if (O.isSome(local) && local.value === record) {
          subjects.push(field.name)
          return
        }
        const property = O.flatMap(local, (key) => propertyOf(vocabulary, key))
        if (O.isNone(property)) {
          found.push(finding("P5", entry, at, `${term.term} is neither the record's class nor a property`))
          return
        }
        if (!domainFits(vocabulary, property.value.domain, record)) {
          found.push(finding("P5", entry, at, `${term.term}'s domain does not fit ${record}`))
        }
        const named = property.value
        if (named.kind === "object" && RangeTarget.guards.class(named.range) && named.range.key === context.tenant) {
          tenants.push(field.name)
        }
      }
    })
  }
  if (subjects.length !== 1) {
    found.push(
      finding(
        "P4",
        entry,
        none,
        `${subjects.length} fields name the record's class; exactly one must: ${A.join(subjects, ", ")}`
      )
    )
  }
  if (tenants.length > 1) {
    found.push(
      finding("P6", entry, none, `fields ${A.join(tenants, ", ")} each name a property ranging over the tenant`)
    )
  }
  return found
}

/** The six variants of a `Model.Class`, by the names `Model` gives them. */
const variantNames = ["select", "insert", "update", "json", "jsonCreate", "jsonUpdate"] as const

/** A schema's own six variants, when it has all six as schema members, as a `Model.Class` does; none otherwise. */
const ownVariants = (schema: S.Top): O.Option<ReadonlyArray<readonly [string, S.Top]>> => {
  const found = A.getSomes(
    A.map(variantNames, (name) =>
      P.hasProperty(schema, name) && S.isSchema(schema[name]) ? O.some([name, schema[name]] as const) : O.none()
    )
  )
  return found.length === variantNames.length ? O.some(found) : O.none()
}

/** P10 on one variant: its fields carry the marks of the class's fields of the same name. */
const variantMarkFindings = (
  entry: string,
  own: ReadonlyArray<FieldMark>,
  variant: string,
  variantSchema: S.Top
): ReadonlyArray<PointerFinding> =>
  A.flatMap(fieldMarks(variantSchema.ast), (field) =>
    O.match(
      A.findFirst(own, (classField) => classField.name === field.name),
      {
        onNone: () => [finding("P10", entry, O.some(field.name), `the ${variant} variant has a field the class lacks`)],
        onSome: (classField) =>
          sameMark(classField.mark, field.mark)
            ? []
            : [finding("P10", entry, O.some(field.name), `the ${variant} variant's mark differs from the class's`)]
      }
    )
  )

/**
 * P10: a record with the six variants of a `Model.Class` has its variants table in `Enrolled.ts`, the table holds
 * exactly the six and each is the class's own, and every field of each variant carries the class's mark. A table
 * given for a schema that has no such variants is refused too, so the rule cannot be skipped by a table left out or
 * misplaced.
 */
const variantFindings = (
  entry: string,
  schema: S.Top,
  table: O.Option<Readonly<Record<string, S.Top>>>
): ReadonlyArray<PointerFinding> => {
  const none = O.none<string>()
  const own = ownVariants(schema)
  if (O.isNone(own)) {
    return O.isSome(table)
      ? [finding("P10", entry, none, "Enrolled.ts maps variants for a schema that is no class")]
      : []
  }
  if (O.isNone(table)) {
    return [finding("P10", entry, none, "the class has six variants and Enrolled.ts maps none of them")]
  }
  const keys = R.keys(table.value)
  const sameKeys = keys.length === variantNames.length && A.every(variantNames, (name) => A.contains(keys, name))
  const listed = sameKeys ? [] : [finding("P10", entry, none, `Enrolled.ts maps ${A.join(keys, ", ")}, not the six`)]
  const foreign = A.flatMap(own.value, ([name, variant]) =>
    O.match(R.get(table.value, name), {
      onNone: () => [],
      onSome: (mapped) =>
        mapped === variant ? [] : [finding("P10", entry, none, `Enrolled.ts's ${name} is not the class's own variant`)]
    })
  )
  const classFields = fieldMarks(schema.ast)
  const marks = A.flatMap(own.value, ([name, variant]) => variantMarkFindings(entry, classFields, name, variant))
  return [...listed, ...foreign, ...marks]
}

/** P13: every field carries the mark the table gives it, and the table names no field the record lacks. */
const placementFindings = (
  entry: string,
  schema: S.Top,
  placements: ReadonlyArray<Placement>
): ReadonlyArray<PointerFinding> => {
  const read = fieldMarks(schema.ast)
  const rows = A.filter(placements, (row) => row.entry === entry)
  const differs = A.flatMap(read, (field) =>
    O.match(
      A.findFirst(rows, (row) => row.field === field.name),
      {
        onNone: () => [finding("P13", entry, O.some(field.name), "the table gives this field no mark")],
        onSome: (row) =>
          sameMark(row.mark, field.mark)
            ? []
            : [finding("P13", entry, O.some(field.name), "the field's mark is not the one section 3 gives it")]
      }
    )
  )
  const missing = A.flatMap(rows, (row) =>
    A.some(read, (field) => field.name === row.field)
      ? []
      : [finding("P13", entry, O.some(row.field), "the table names a field the record does not have")]
  )
  return [...differs, ...missing]
}

/** Every property a mark of `schema`'s fields names: a field's term, and each property of a path. */
const marksNamed = (schema: S.Top): ReadonlyArray<string> =>
  A.flatMap(fieldMarks(schema.ast), (field) =>
    MarkReading.match(field.mark, {
      none: () => [],
      several: () => [],
      malformed: () => [],
      noTerm: () => [],
      term: (term) => [term.term],
      path: (path) =>
        A.flatMap(path.path, (step) => [
          ...("fixed" in step ? A.map(step.fixed, (fix) => fix.property) : []),
          step.property
        ])
    })
  )

const propertiesNamed = (context: Context, schema: S.Top): ReadonlyArray<string> =>
  pipe(
    marksNamed(schema),
    A.map((curie) => context.local(curie)),
    A.getSomes
  )

/** P12: the collection is an array whose one element is the named variant itself. */
const collectionFindings = (context: Context, entry: CollectionEntry, schema: S.Top): ReadonlyArray<PointerFinding> => {
  const key = entryKey(entry)
  const dot = Str.lastIndexOf(".")(entry.of)
  // The element is resolved from the class's own variants, not from Enrolled.ts's table, which only P10 reads.
  const element = O.flatMap(dot, (index) =>
    O.flatMap(R.get(context.enrolled, Str.slice(0, index)(entry.of)), (owner) =>
      O.flatMap(ownVariants(owner), (own) =>
        O.map(
          A.findFirst(own, ([name]) => name === Str.slice(index + 1)(entry.of)),
          ([, variant]) => variant
        )
      )
    )
  )
  if (O.isNone(element)) {
    return [finding("P1", key, O.none(), `${entry.of} names no variant of an enrolled class`)]
  }
  const ast = schema.ast
  const holds =
    SchemaAST.isArrays(ast) &&
    ast.elements.length === 0 &&
    ast.rest.length === 1 &&
    O.match(A.head(ast.rest), { onNone: () => false, onSome: (rest) => rest === element.value.ast })
  return holds ? [] : [finding("P12", key, O.none(), `the collection is not an array of ${entry.of} itself`)]
}

// ---------------------------------------------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------------------------------------------

/**
 * Runs P1 to P13 and returns every finding: none when every enrolled schema is marked as section 3 says.
 *
 * @example pointerFindings({ vocabulary, prefix: "inv", tenant: "Tenant", slices: ["party"], ... }) // []
 */
export const pointerFindings = (input: PointerInput): ReadonlyArray<PointerFinding> => {
  const context: Context = { ...input, local: localOf(input.prefix) }
  const keys = A.map(input.enrolment, entryKey)
  const listed = R.keys(input.enrolled)
  const p1 = [
    ...A.map(A.difference(keys, listed), (key) =>
      finding("P1", key, O.none(), "enrolment.json lists it, Enrolled.ts does not")
    ),
    ...A.map(A.difference(listed, keys), (key) =>
      finding("P1", key, O.none(), "Enrolled.ts maps it, enrolment.json does not")
    ),
    ...A.map(
      A.filter(A.dedupe(keys), (key) => A.filter(keys, (other) => other === key).length > 1),
      (key) => finding("P1", key, O.none(), "enrolment.json lists it twice")
    )
  ]
  const perEntry = A.flatMap(input.enrolment, (entry) => {
    const key = entryKey(entry)
    return O.match(R.get(input.enrolled, key), {
      onNone: () => [],
      onSome: (schema) =>
        EnrolmentEntry.match(entry, {
          record: () => [
            ...recordFindings(context, key, schema),
            ...variantFindings(key, schema, R.get(input.variants, key)),
            ...placementFindings(key, schema, input.placements)
          ],
          scheme: () => {
            const pointed = O.flatMap(O.flatMap(schemaTermOf(schema.ast), context.local), (local) =>
              schemeOf(input.vocabulary, local)
            )
            if (O.isNone(pointed) || O.isNone(literalsOf(schema.ast))) {
              return [finding("P2", key, O.none(), "the schema is no union of literals pointing at a scheme")]
            }
            return notationFindings(context, key, O.none(), schema.ast)
          },
          collection: (collection) => collectionFindings(context, collection, schema)
        })
    })
  })
  const records = A.getSomes(
    A.map(A.filter(input.enrolment, EnrolmentEntry.guards.record), (entry) => R.get(input.enrolled, entryKey(entry)))
  )
  const used = A.flatMap(records, (schema) => propertiesNamed(context, schema))
  const properties = [
    ...A.map(R.toEntries(input.vocabulary.objectProperties), ([key, term]) => [key, term.evidence] as const),
    ...A.map(R.toEntries(input.vocabulary.datatypeProperties), ([key, term]) => [key, term.evidence] as const)
  ]
  const p11 = A.map(
    A.filter(properties, ([key, evidence]) => !A.contains(used, key) && O.isNone(evidence)),
    ([key]) =>
      finding("P11", "vocabulary", O.some(key), "no mark of an enrolled record names it, and it states no evidence")
  )
  const recordKeys = A.map(A.filter(input.enrolment, EnrolmentEntry.guards.record), entryKey)
  const strayRows = A.map(
    A.filter(input.placements, (row) => !A.contains(recordKeys, row.entry)),
    (row) => finding("P13", row.entry, O.some(row.field), "the table names an entry that is not an enrolled record")
  )
  const strayVariants = A.map(
    A.filter(R.keys(input.variants), (key) => !A.contains(recordKeys, key)),
    (key) => finding("P10", key, O.none(), "Enrolled.ts maps variants for an entry that is not an enrolled record")
  )
  return [...p1, ...perEntry, ...p11, ...strayRows, ...strayVariants]
}
