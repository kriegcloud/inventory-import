/**
 * The lift (report 14 section 4): one decoded record becomes triples, by following the marks on its schema. The marks
 * are read with the same reader gate 5 uses.
 *
 * Do not break: the lift names no record, class, property or concept of its own. Every IRI it writes comes from a
 * mark on the record it is given, from the vocabulary it is given, or from the record's own values; a lift that wrote
 * a grant for every member whatever the mark said would pass a test on the real `Member` and be wrong, which is why
 * the questions' must-fail cases M6 and M7 call it with a changed mark. It types the subject and each node a path
 * creates, and nothing else: the tenant's type is the fixture's to state.
 *
 * @packageDocumentation
 */
import { RangeTarget, type Vocabulary } from "@beep/vocabulary/Model"
import { fieldsOf, MarkReading, readKeyMark, type LiftPathRead } from "@beep/vocabulary/Pointer"
import { RdfVocab } from "@beep/vocabulary/Rdf"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import type * as SchemaAST from "effect/SchemaAST"
import { link, type Iri, type Triple } from "./Graph.schema.ts"
import { $OntologyId } from "./internal/identity.ts"
import { classOf, localOf, propertyOf, schemaTermOf, schemeOf, type Property } from "./internal/terms.ts"

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
 * What the lift is given beside the record: the decoded vocabulary, the prefix its CURIEs carry, and the class whose
 * instances are tenants, which decides the one field a record's IRIs take their organization from (section 4.1).
 */
export type LiftContext = {
  readonly vocabulary: Vocabulary
  readonly prefix: string
  readonly tenant: string
}

type Field = { readonly name: string; readonly ast: SchemaAST.AST; readonly mark: MarkReading }

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
    // Case (a). No record the thread lifts has one; it is built by the slice that first lifts a literal.
    return yield* refused(at, `${property.key} takes a literal, which the lift does not write yet`)
  }
  const pointed = O.flatMap(O.flatMap(schemaTermOf(field.ast), localOf(context.prefix)), (local) =>
    schemeOf(vocabulary, local)
  )
  if (O.isNone(pointed)) {
    // A link to another record: the property's range names its class, the field's value is its id.
    if (!RangeTarget.guards.class(property.range)) {
      return yield* refused(at, `${property.key} ranges over a scheme the field's schema does not point at`)
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
 * It fails with `LiftRefused` when the record names no class, when not exactly one field is its id or not exactly one
 * names a property ranging over the tenant, when a field is unmarked, or when a mark cannot be followed.
 *
 * @example lift(context, Member, member) // six triples: the member, its tenant, and the grant its role is
 */
export const lift = Effect.fnUntraced(function* <Record extends S.Top>(
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
  const tenants = A.filter(fields, isTenant)
  const id = A.head(ids)
  const tenant = A.head(tenants)
  if (ids.length !== 1 || O.isNone(id)) {
    return yield* refused(none, `${ids.length} fields name the record's class; exactly one is its id`)
  }
  if (tenants.length !== 1 || O.isNone(tenant)) {
    return yield* refused(none, `${tenants.length} fields name a property ranging over the tenant; the lift needs one`)
  }
  const identifier = valueOf(id.value)
  const organization = valueOf(tenant.value)
  if (!isSegment(identifier)) {
    return yield* refused(O.some(id.value.name), "the field's value is no id")
  }
  if (!isSegment(organization)) {
    return yield* refused(O.some(tenant.value.name), "the field's value is no id")
  }
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
