/**
 * The lift (report 14 section 4): one decoded record becomes triples, by following the marks on its schema. The marks
 * are read with the same reader gate 5 uses.
 *
 * Do not break: the lift names no record, class, property or concept of its own. Every IRI it writes comes from a
 * mark on the record it is given, from the vocabulary it is given, or from the record's own values; a lift that wrote
 * a grant for every member whatever the mark said would pass a test on the real `Member` and be wrong, which is why
 * the questions' must-fail cases M6 and M7 call it with a changed mark. It types the subject and each node a path
 * creates, and nothing else: the tenant's type is the fixture's to state. A literal's text is the field's value as its
 * own schema encodes it, so an instant is written as the ISO text the wire carries, never as code formats it. It
 * writes no node of a class that stores no id (decision 135), as a record, a path's node or a link's object: an IRI
 * made from another record's id would say each such record is its own instance, which nobody decided.
 *
 * @packageDocumentation
 */
import { RangeTarget, type Vocabulary, type XsdDatatype } from "@beep/vocabulary/Model"
import { fieldsOf, MarkReading, readKeyMark, type LiftPathRead } from "@beep/vocabulary/Pointer"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import type * as SchemaAST from "effect/SchemaAST"
import * as Str from "effect/String"
import { link, literal, type Iri, type Triple } from "./Graph.schema.ts"
import { $OntologyId } from "./internal/identity.ts"
import { classOf, localOf, propertyOf, schemaTermOf, schemeOf, storesNoId, type Property } from "./internal/terms.ts"
import { misread } from "./Write.ts"

const $I = $OntologyId.create("Lift")

/**
 * The lift cannot follow a record's marks. `field` is the field it stopped at, or none when the record itself is the
 * trouble; `reason` says what the mark or the value lacks.
 *
 * @category errors
 */
export class LiftRefused extends S.TaggedError<LiftRefused, { readonly brand: unique symbol }>($I`LiftRefused`)(
  "LiftRefused",
  {
    field: S.Option(S.String).pipe(S.annotateKey({ description: "The field the lift stopped at, if one" })),
    reason: S.String.pipe(S.annotateKey({ description: "What the mark or the value lacks, in one sentence" }))
  },
  $I.annoteError<LiftRefused>("LiftRefused", { description: "A record whose marks the lift cannot follow." })
) {}

/**
 * What the lift is given beside the record: the decoded vocabulary, the prefix its CURIEs carry, the class whose
 * instances are tenants, which decides the one field a record's IRIs take their organization from (section 4.1), and
 * the organization given beside the rows, for a record that has no such field.
 *
 * `organization` is none for a record that names its own tenant, and the lift refuses one given for it: two sources of
 * the organization could disagree. The People page's `Person` names none, since the page lists one organization's
 * members, so its caller gives it (PLAN, "Choices made"; reversing that choice changes this field alone).
 */
export type LiftContext = {
  readonly vocabulary: Vocabulary
  readonly prefix: string
  readonly tenant: string
  readonly organization: O.Option<string>
}

type Field = { readonly name: string; readonly ast: SchemaAST.AST; readonly mark: MarkReading }

type Attribute = Extract<Property, { readonly kind: "datatype" }>

const refused = (field: O.Option<string>, reason: string) => Effect.fail(LiftRefused.make({ field, reason }))

const typeIri: Iri = `${RdfVocab.rdf.iri}type`

/** A value that may be one segment of an IRI's path: what the kernel's ids admit, so nothing needs escaping. */
const isSegment = (value: unknown): value is string => P.isString(value) && /^[A-Za-z0-9_-]{1,64}$/.test(value)

/** The object a property takes from one field's value: a concept, or a link to another record (sections 4.1, 4.3). */
const objectOf = Effect.fnUntraced(function* (
  context: LiftContext,
  organization: string,
  property: Property,
  field: Field,
  value: unknown
) {
  const { vocabulary } = context
  const at = O.some(field.name)
  if (property.kind === "datatype") {
    // A path's last step: no mark ends a path at an attribute, so the node it would make is not built for one.
    return yield* refused(at, `${property.key} takes a literal, which the lift writes for a field's own property only`)
  }
  const pointed = O.flatMap(O.flatMap(schemaTermOf(field.ast), localOf(context.prefix)), (local) =>
    schemeOf(vocabulary, local)
  )
  if (O.isNone(pointed)) {
    // A link to another record: the property's range names its class, the field's value is its id.
    if (!RangeTarget.guards.class(property.range)) {
      return yield* refused(at, `${property.key} ranges over a scheme the field's schema does not point at`)
    }
    if (storesNoId(vocabulary, property.range.key)) {
      return yield* refused(at, `${property.key} ranges over ${property.range.key}, which stores no id to link to`)
    }
    if (!isSegment(value)) {
      return yield* refused(at, "the field's value is no id")
    }
    return `${vocabulary.base}/data/${organization}/${property.range.key}/${value}`
  }
  // Cases (b) and (c): the scheme is read from the field's own schema, and the value is one of its notations.
  const scheme = pointed.value
  const concept = P.isString(value)
    ? O.flatMap(R.get(vocabulary.schemes, scheme), (term) => R.get(term.concepts, value))
    : O.none()
  if (O.isNone(concept) || !P.isString(value)) {
    return yield* refused(at, `the field's value is no notation of ${scheme}`)
  }
  const fits = RangeTarget.match(property.range, {
    scheme: (range) => range.key === scheme,
    class: (range) => O.isSome(concept.value.alsoInstanceOf) && concept.value.alsoInstanceOf.value === range.key
  })
  if (!fits) {
    return yield* refused(at, `${property.key}'s range does not admit the concept ${scheme}-${value}`)
  }
  return `${vocabulary.namespace}${scheme}-${value}`
})

/** A datatype's IRI under the `xsd` namespace of the RDF registry. */
const datatypeIri = (datatype: XsdDatatype): Iri => `${RdfVocab.xsd.iri}${Str.slice(Str.length("xsd:"))(datatype)}`

/** A literal's text from a field's encoded value: a boolean's `true` or `false` for `xsd:boolean`, else a string. */
const textOf = (datatype: XsdDatatype, encoded: unknown): O.Option<string> => {
  if (datatype === "xsd:boolean") {
    return P.isBoolean(encoded) ? O.some(encoded ? "true" : "false") : O.none()
  }
  return P.isString(encoded) ? O.some(encoded) : O.none()
}

/**
 * What a field marked with an attribute states (section 4.1, case (a)): one literal of the attribute's datatype, its
 * text the field's encoded value, or nothing when the decoded value is an absent `Option`. A value its datatype does
 * not write is refused, as the writer would refuse it: a number for a string, a text for a boolean, a text that is no
 * `xsd:dateTime`.
 */
const literalsOf = Effect.fnUntraced(function* (
  property: Attribute,
  field: Field,
  subject: Iri,
  predicate: Iri,
  value: unknown,
  encoded: O.Option<unknown>
) {
  const at = O.some(field.name)
  if (O.isOption(value) && O.isNone(value)) {
    return []
  }
  const text = O.flatMap(encoded, (written) => textOf(property.datatype, written))
  if (O.isNone(text)) {
    return yield* refused(at, `the field's value is no ${property.datatype} the lift writes`)
  }
  const datatype = datatypeIri(property.datatype)
  const problem = misread(text.value, datatype)
  if (O.isSome(problem)) {
    return yield* refused(at, `the field's value ${problem.value}`)
  }
  return [literal(subject, predicate, text.value, datatype)]
})

/**
 * The organization a record's IRIs take (section 4.1): its one field that names a property ranging over the tenant, or,
 * when it has none, the organization given beside the rows. A record that names its tenant and is given one too, a
 * record that names it twice, and one that names none and is given none are refused.
 */
const organizationOf = Effect.fnUntraced(function* (
  context: LiftContext,
  tenants: ReadonlyArray<Field>,
  valueOf: (field: Field) => unknown
) {
  const none = O.none<string>()
  const tenant = A.head(tenants)
  if (tenants.length > 1) {
    return yield* refused(none, `${tenants.length} fields name a property ranging over the tenant; the lift needs one`)
  }
  if (O.isSome(tenant)) {
    const at = O.some(tenant.value.name)
    if (O.isSome(context.organization)) {
      return yield* refused(at, "the record names its tenant here, and another is given beside it")
    }
    const value = valueOf(tenant.value)
    return isSegment(value) ? value : yield* refused(at, "the field's value is no id")
  }
  if (O.isNone(context.organization)) {
    return yield* refused(
      none,
      "0 fields name a property ranging over the tenant, and none is given beside the record; the lift needs one"
    )
  }
  const given = context.organization.value
  return isSegment(given) ? given : yield* refused(none, "the organization given beside the record is no id")
})

/** A CURIE of the vocabulary's prefix as its IRI, or a refusal naming it. */
const iriOf = Effect.fnUntraced(function* (context: LiftContext, field: O.Option<string>, curie: string) {
  const local = localOf(context.prefix)(curie)
  if (O.isNone(local)) {
    return yield* refused(field, `${curie} does not carry the prefix ${context.prefix}`)
  }
  return `${context.vocabulary.namespace}${local.value}`
})

const propertyNamed = Effect.fnUntraced(function* (context: LiftContext, field: O.Option<string>, curie: string) {
  const property = O.flatMap(localOf(context.prefix)(curie), (local) => propertyOf(context.vocabulary, local))
  if (O.isNone(property)) {
    return yield* refused(field, `${curie} is no property of the vocabulary`)
  }
  return property.value
})

/** The triples of one path: at most one node step, then the value step (section 4.3). */
const pathTriples = Effect.fnUntraced(function* (
  context: LiftContext,
  organization: string,
  subject: Iri,
  field: Field,
  path: LiftPathRead,
  value: unknown
) {
  const at = O.some(field.name)
  const nodeSteps = A.dropRight(path, 1)
  const last = A.last(path)
  if (nodeSteps.length > 1 || O.isNone(last)) {
    return yield* refused(at, "a path is at most one node step and then one value step")
  }
  const triples: Array<Triple> = []
  let from = subject
  for (const step of nodeSteps) {
    if (!("node" in step)) {
      return yield* refused(at, "a step before the last creates no node")
    }
    if (O.exists(localOf(context.prefix)(step.node), (local) => storesNoId(context.vocabulary, local))) {
      return yield* refused(at, `${step.node} stores no id, so the lift makes no node of it from this record`)
    }
    const node = `${subject}/${field.name}`
    const nodeClass = yield* iriOf(context, at, step.node)
    const linking = yield* iriOf(context, at, step.property)
    triples.push(link(node, typeIri, nodeClass))
    for (const fix of step.fixed) {
      const fixing = yield* iriOf(context, at, fix.property)
      const concept = yield* iriOf(context, at, fix.concept)
      triples.push(link(node, fixing, concept))
    }
    triples.push(O.isSome(step.reverse) ? link(node, linking, subject) : link(subject, linking, node))
    from = node
  }
  const property = yield* propertyNamed(context, at, last.value.property)
  const predicate = yield* iriOf(context, at, last.value.property)
  const object = yield* objectOf(context, organization, property, field, value)
  return [...triples, link(from, predicate, object)]
})

/**
 * The triples one decoded record states (section 4.2): its type, one triple for each field that names a property, and
 * what each path creates. A field that names the record's own class is its id and is in the IRI; a field that stands
 * for no term states nothing.
 *
 * It fails with `LiftRefused` when the record names no class or one that stores no id, when not exactly one field is
 * its id, when its tenant is not named by exactly one field or given beside it (and not both), when a field is
 * unmarked, when a mark cannot be followed, when a path's node or a link's object is of a class that stores no id, or
 * when a literal's value is not one its datatype writes.
 *
 * @example lift(context, Member, member) // six triples: the member, its tenant, and the grant its role is
 */
export const lift = Effect.fnUntraced(function* <Record extends S.Top & { readonly EncodingServices: never }>(
  context: LiftContext,
  record: Record,
  value: Record["Type"]
) {
  const { vocabulary } = context
  const none = O.none<string>()
  const local = localOf(context.prefix)
  const own = O.flatMap(O.flatMap(schemaTermOf(record.ast), local), (key) => classOf(vocabulary, key))
  const signatures = fieldsOf(record.ast)
  if (O.isNone(own) || O.isNone(signatures)) {
    return yield* refused(none, "the record is no struct pointing at a class of the vocabulary")
  }
  if (storesNoId(vocabulary, own.value)) {
    return yield* refused(none, `${own.value} stores no id, so the lift makes no node of it (decision 135)`)
  }
  const fields = A.map(signatures.value, (signature): Field => ({
    name: String(signature.name),
    ast: signature.type,
    mark: readKeyMark(signature.type)
  }))
  const valueOf = (field: Field): unknown => (P.hasProperty(value, field.name) ? value[field.name] : undefined)
  const termOf = (field: Field): O.Option<string> =>
    MarkReading.guards.term(field.mark) ? local(field.mark.term) : O.none()
  const isId = (field: Field): boolean => O.contains(termOf(field), own.value)
  const isTenant = (field: Field): boolean =>
    O.exists(
      O.flatMap(termOf(field), (key) => propertyOf(vocabulary, key)),
      (property) =>
        property.kind === "object" && RangeTarget.guards.class(property.range) && property.range.key === context.tenant
    )
  const ids = A.filter(fields, isId)
  const id = A.head(ids)
  if (ids.length !== 1 || O.isNone(id)) {
    return yield* refused(none, `${ids.length} fields name the record's class; exactly one is its id`)
  }
  const organization = yield* organizationOf(context, A.filter(fields, isTenant), valueOf)
  const identifier = valueOf(id.value)
  if (!isSegment(identifier)) {
    return yield* refused(O.some(id.value.name), "the field's value is no id")
  }
  // The record as its schema encodes it: where a literal's text is read, so a value is written as the wire writes it.
  const encoded = yield* Effect.mapError(S.encodeUnknownEffect(record)(value), () =>
    LiftRefused.make({ field: none, reason: "the value does not encode through the record's schema" })
  )
  const encodedOf = (field: Field): O.Option<unknown> =>
    P.hasProperty(encoded, field.name) ? O.some(encoded[field.name]) : O.none()
  const subject = `${vocabulary.base}/data/${organization}/${own.value}/${identifier}`
  const triples: Array<Triple> = [link(subject, typeIri, `${vocabulary.namespace}${own.value}`)]
  for (const field of fields) {
    const at = O.some(field.name)
    if (MarkReading.guards.noTerm(field.mark) || isId(field)) {
      continue
    }
    if (MarkReading.guards.term(field.mark)) {
      const property = yield* propertyNamed(context, at, field.mark.term)
      const predicate = yield* iriOf(context, at, field.mark.term)
      if (property.kind === "datatype") {
        const stated = yield* literalsOf(property, field, subject, predicate, valueOf(field), encodedOf(field))
        triples.push(...stated)
        continue
      }
      const object = yield* objectOf(context, organization, property, field, valueOf(field))
      triples.push(link(subject, predicate, object))
      continue
    }
    if (MarkReading.guards.path(field.mark)) {
      const made = yield* pathTriples(context, organization, subject, field, field.mark.path, valueOf(field))
      triples.push(...made)
      continue
    }
    return yield* refused(at, "the field carries no mark the lift can follow")
  }
  return triples
})
