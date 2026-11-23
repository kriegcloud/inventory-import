/**
 * The metamodel of a hand-written vocabulary: what a class, a property, a concept scheme and a concept hold, and the
 * vocabulary that keys them. A vocabulary module is a literal kept `as const` and checked with `satisfies` against
 * `typeof Vocabulary.Encoded`, then decoded strictly; it is never built with `.make`, whose record keys widen to
 * `string`. The rules that span entries (a parent that exists, a gist list closed upward, a decision heading that
 * exists) are not checked here: the schemas only hold what those rules read.
 *
 * Do not break: a term's `ratification` is `{ decision: <a whole number> }`, the decision that accepted it, never the
 * name of a `rat-` record. Nothing here names a term of any one vocabulary.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Tuple from "effect/Tuple"
import { $VocabularyId } from "./internal/identity.ts"
import { RdfVocab } from "./Rdf.vocab.ts"

const $I = $VocabularyId.create("Model")

// ---------------------------------------------------------------------------------------------------------------
// Keys, text and the small values
// ---------------------------------------------------------------------------------------------------------------

/**
 * The local name of a class IRI, UpperCamelCase, acronyms written as words (Bom, Gtin, Id).
 *
 * @example "Book"
 */
export const ClassKey = S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]{0,63}$/)).pipe(
  $I.annoteSchema("ClassKey", { description: "The local name of a class IRI, UpperCamelCase" })
)
/** Runtime type of {@link ClassKey}. */
export type ClassKey = typeof ClassKey.Type

/**
 * The local name of a gist class under the gist namespace, UpperCamelCase as gist writes it.
 *
 * @example "TemporalRelation"
 */
export const GistName = S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]{0,63}$/)).pipe(
  $I.annoteSchema("GistName", { description: "The local name of a gist class" })
)
/** Runtime type of {@link GistName}. */
export type GistName = typeof GistName.Type

/**
 * The local name of a concept scheme IRI: class-shaped, ending in `Scheme`, so it never reads as a class.
 *
 * @example "LoanStatusScheme"
 */
export const SchemeKey = S.String.check(S.isPattern(/^[A-Z][A-Za-z0-9]{0,57}Scheme$/)).pipe(
  $I.annoteSchema("SchemeKey", { description: "The local name of a concept scheme IRI, ending in Scheme" })
)
/** Runtime type of {@link SchemeKey}. */
export type SchemeKey = typeof SchemeKey.Type

const rdfKeywords: ReadonlyArray<string> = ["domain", "range", "label", "type", "comment", "subClassOf"]

/**
 * The local name of a property IRI, lowerCamelCase. An RDF keyword (domain, range, label, type, comment, subClassOf)
 * is refused, so a property's CURIE is never mistaken for the schema language's own.
 *
 * @example "publishedAt"
 */
export const PropertyKey = S.String.check(
  S.isPattern(/^[a-z][A-Za-z0-9]{0,63}$/),
  S.makeFilter((key: string) => !A.contains(rdfKeywords, key), { expected: "a key that is not an RDF keyword" })
).pipe($I.annoteSchema("PropertyKey", { description: "The local name of a property IRI, lowerCamelCase" }))
/** Runtime type of {@link PropertyKey}. */
export type PropertyKey = typeof PropertyKey.Type

/**
 * The code a record stores for one concept, safe in an IRI path; the concept's key in its scheme, never changed.
 *
 * @example "on-loan"
 */
export const Notation = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/)).pipe(
  $I.annoteSchema("Notation", { description: "The code a record stores for one concept" })
)
/** Runtime type of {@link Notation}. */
export type Notation = typeof Notation.Type

/** A name for people, in English, written by hand and never derived from a key (`skos:prefLabel`, `skos:altLabel`). */
export const Label = S.Trimmed.check(S.isMinLength(1), S.isMaxLength(80)).pipe(
  $I.annoteSchema("Label", { description: "A name for people, in English" })
)
/** Runtime type of {@link Label}. */
export type Label = typeof Label.Type

/**
 * One sentence: a definition (`skos:definition`, the genus, then the difference), an identity criterion, or the reason
 * a class has no parent.
 */
export const Definition = S.Trimmed.check(S.isMinLength(12), S.isMaxLength(400)).pipe(
  $I.annoteSchema("Definition", { description: "One sentence: the genus, then the difference" })
)
/** Runtime type of {@link Definition}. */
export type Definition = typeof Definition.Type

/**
 * The ontological category a class's instances fall under. Only the four values every option of the open decision on
 * the tag's values contains; the others wait for that decision.
 */
export const KindTag = LiteralKit(["kind", "role", "relator", "information"]).pipe(
  $I.annoteSchema("KindTag", { description: "The ontological category a class's instances fall under" })
)
/** Runtime type of {@link KindTag}. */
export type KindTag = typeof KindTag.Type

/**
 * A literal datatype a datatype property states, as a CURIE under the `xsd` prefix of {@link RdfVocab}: a datatype
 * the registry lacks does not decode.
 *
 * @example "xsd:dateTime"
 */
export const XsdDatatype = S.TemplateLiteral(["xsd:", S.Literals(RdfVocab.xsd.terms)]).pipe(
  $I.annoteSchema("XsdDatatype", { description: "A literal datatype the RDF registry holds, as an xsd CURIE" })
)
/** Runtime type of {@link XsdDatatype}. */
export type XsdDatatype = typeof XsdDatatype.Type

/**
 * The decision that accepted a term: its number in the vocabulary's decision log. Whether the log has a heading for
 * that number is a rule of the vocabulary, not of this schema, so a number with no heading still decodes.
 *
 * @example Ratification.make({ decision: 3 })
 */
export class Ratification extends S.Opaque<Ratification, { readonly brand: unique symbol }>()(
  S.Struct({
    decision: S.Int.check(S.isGreaterThanOrEqualTo(1)).pipe(
      S.annotateKey({ description: "The number of the decision that accepted the term" })
    )
  }).pipe($I.annoteSchema("Ratification", { description: "The decision in which the term was accepted" }))
) {}

// ---------------------------------------------------------------------------------------------------------------
// A class's parent and identity
// ---------------------------------------------------------------------------------------------------------------

const ParentKind = LiteralKit(["gist", "local", "none"])

/** A class directly under one gist class the vocabulary's gist projection admits. */
export class GistParent extends S.Opaque<GistParent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("gist"),
    name: GistName.pipe(S.annotateKey({ description: "A gist class the vocabulary's gist projection lists" }))
  }).pipe($I.annoteSchema("GistParent", { description: "A class under one projected gist class" }))
) {}

/** A class directly under another class of the same vocabulary. */
export class LocalParent extends S.Opaque<LocalParent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("local"),
    key: ClassKey.pipe(S.annotateKey({ description: "The class of this vocabulary this one narrows" }))
  }).pipe($I.annoteSchema("LocalParent", { description: "A subclass of a class of the same vocabulary" }))
) {}

/**
 * A class with no parent, and why. Its reason is compared with the vocabulary's committed exception list, which says
 * who allowed it; the list is a file apart from the vocabulary, not part of it.
 */
export class NoParent extends S.Opaque<NoParent, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("none"),
    reason: Definition.pipe(S.annotateKey({ description: "Why no gist class fits, as the exception list states it" }))
  }).pipe($I.annoteSchema("NoParent", { description: "A top class with no gist parent, and why" }))
) {}

/** A class's one identity-bearing parent: a gist class, a class of the vocabulary, or none with the reason. */
export const ParentLink = ParentKind.mapMembers(() => Tuple.make(GistParent, LocalParent, NoParent)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("ParentLink", { description: "A class's one parent, or the stated reason it has none" })
)
/** Runtime type of {@link ParentLink}. */
export type ParentLink = typeof ParentLink.Type

const IdentityKind = LiteralKit(["stated", "inherited"])

/** What makes two instances of the class the same one, written out. */
export class StatedIdentity extends S.Opaque<StatedIdentity, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("stated"),
    criterion: Definition.pipe(S.annotateKey({ description: "What makes two instances the same one" }))
  }).pipe($I.annoteSchema("StatedIdentity", { description: "An identity criterion written out" }))
) {}

/** The class takes its identity criterion from its parent, which must then be a class of the same vocabulary. */
export class InheritedIdentity extends S.Opaque<InheritedIdentity, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("inherited") }).pipe(
    $I.annoteSchema("InheritedIdentity", { description: "The identity criterion of the class's parent" })
  )
) {}

/** A class's one identity criterion: stated, or inherited from its parent. */
export const IdentityCriterion = IdentityKind.mapMembers(() => Tuple.make(StatedIdentity, InheritedIdentity)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("IdentityCriterion", { description: "What makes two instances of a class the same one" })
)
/** Runtime type of {@link IdentityCriterion}. */
export type IdentityCriterion = typeof IdentityCriterion.Type

// ---------------------------------------------------------------------------------------------------------------
// A property's range
// ---------------------------------------------------------------------------------------------------------------

const RangeKind = LiteralKit(["class", "scheme"])

/** The values of an object property are instances of one class of the vocabulary. */
export class ClassRange extends S.Opaque<ClassRange, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("class"),
    key: ClassKey.pipe(S.annotateKey({ description: "The class of the property's values" }))
  }).pipe($I.annoteSchema("ClassRange", { description: "Values that are instances of one class" }))
) {}

/** The values of an object property are concepts of one scheme of the vocabulary; no `rdfs:range` is written. */
export class SchemeRange extends S.Opaque<SchemeRange, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("scheme"),
    key: SchemeKey.pipe(S.annotateKey({ description: "The scheme the property's values are concepts of" }))
  }).pipe($I.annoteSchema("SchemeRange", { description: "Values that are concepts of one scheme" }))
) {}

/** What an object property's values are: instances of a class, or concepts of a scheme. */
export const RangeTarget = RangeKind.mapMembers(() => Tuple.make(ClassRange, SchemeRange)).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("RangeTarget", { description: "The class or the scheme an object property's values come from" })
)
/** Runtime type of {@link RangeTarget}. */
export type RangeTarget = typeof RangeTarget.Type

/**
 * Where a property's use is shown when no record fills it: `fixture`, a test graph only. Absent, a record must name
 * the property.
 */
export const Evidence = LiteralKit(["fixture"]).pipe(
  $I.annoteSchema("Evidence", { description: "Where a property no record fills is shown in use" })
)
/** Runtime type of {@link Evidence}. */
export type Evidence = typeof Evidence.Type

// ---------------------------------------------------------------------------------------------------------------
// The terms
// ---------------------------------------------------------------------------------------------------------------

const termFields = {
  prefLabel: Label.pipe(S.annotateKey({ description: "The one name people read (skos:prefLabel)" })),
  altLabels: S.Array(Label.annotateKey({ description: "Another name people use for it" })).pipe(
    S.annotateKey({ description: "Other names people use for it (skos:altLabel)" }),
    S.withConstructorDefault(Effect.succeed([])),
    S.withDecodingDefaultTypeKey(Effect.succeed([]))
  ),
  definition: Definition.pipe(
    S.annotateKey({ description: "What it means: genus, then difference (skos:definition)" })
  ),
  ratification: Ratification.pipe(S.annotateKey({ description: "The decision that accepted it" }))
} as const

const propertyFields = {
  ...termFields,
  domain: ClassKey.pipe(
    S.annotateKey({ description: "The class of the property's subjects; absent when none is declared" }),
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone)
  ),
  evidence: Evidence.pipe(
    S.annotateKey({ description: "Where it is shown in use when no record fills it" }),
    S.OptionFromOptionalKey,
    S.withConstructorDefault(Effect.succeedNone)
  )
} as const

/** One OWL class: its one parent, its kind tag and its identity criterion. */
export class ClassTerm extends S.Opaque<ClassTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    tag: KindTag.pipe(S.annotateKey({ description: "The category its instances fall under" })),
    parent: ParentLink.pipe(S.annotateKey({ description: "Its one parent, or why it has none" })),
    identity: IdentityCriterion.pipe(S.annotateKey({ description: "What makes two instances the same one" }))
  }).pipe($I.annoteSchema("ClassTerm", { description: "One OWL class of the vocabulary" }))
) {}

/** A relation, stated in one direction only: there is no field for an inverse, so none can be written. */
export class ObjectPropertyTerm extends S.Opaque<ObjectPropertyTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...propertyFields,
    range: RangeTarget.pipe(S.annotateKey({ description: "The class of its values, or the scheme they come from" }))
  }).pipe($I.annoteSchema("ObjectPropertyTerm", { description: "A relation, stated in one direction only" }))
) {}

/** An attribute of instances of one class, with the literal datatype it is written as. */
export class DatatypePropertyTerm extends S.Opaque<DatatypePropertyTerm, { readonly brand: unique symbol }>()(
  S.Struct({
    ...propertyFields,
    datatype: XsdDatatype.pipe(S.annotateKey({ description: "The literal datatype its values are written as" }))
  }).pipe($I.annoteSchema("DatatypePropertyTerm", { description: "An attribute with a literal datatype" }))
) {}

/**
 * One code of a concept scheme. Its notation is its key in the scheme, not a field. Where the code is also an
 * individual of a class (a code that is also an instance the vocabulary counts), that class is named.
 */
export class Concept extends S.Opaque<Concept, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    alsoInstanceOf: ClassKey.pipe(
      S.annotateKey({ description: "The class of the vocabulary this code is also an individual of" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe($I.annoteSchema("Concept", { description: "One code of a concept scheme" }))
) {}

/** One code list: its concepts keyed by notation, in the order a screen lists them. */
export class ConceptScheme extends S.Opaque<ConceptScheme, { readonly brand: unique symbol }>()(
  S.Struct({
    ...termFields,
    closed: S.Boolean.pipe(S.annotateKey({ description: "Every value a record may hold is listed" })),
    concepts: S.Record(Notation.annotateKey({ description: "A concept's notation" }), Concept).pipe(
      S.annotateKey({ description: "Its codes, keyed by notation, in the order a screen lists them" })
    )
  }).pipe($I.annoteSchema("ConceptScheme", { description: "One code list" }))
) {}

// ---------------------------------------------------------------------------------------------------------------
// The gist projection and the vocabulary
// ---------------------------------------------------------------------------------------------------------------

/**
 * An absolute https IRI ending in `/`, with no query, every local key is appended to. It does not know any one
 * project's host.
 *
 * @example "https://example.org/library/ontology/"
 */
export const Namespace = S.String.check(S.isPattern(/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9-]+)+\/$/)).pipe(
  $I.annoteSchema("Namespace", { description: "The IRI every local key is appended to" })
)
/** Runtime type of {@link Namespace}. */
export type Namespace = typeof Namespace.Type

/**
 * The one base IRI a vocabulary's other IRIs are derived from: absolute, https, with no trailing `/`.
 *
 * @example "https://example.org/library"
 */
export const BaseIri = S.String.check(S.isPattern(/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9-]+)*$/)).pipe(
  $I.annoteSchema("BaseIri", { description: "The one IRI every other IRI of the vocabulary is derived from" })
)
/** Runtime type of {@link BaseIri}. */
export type BaseIri = typeof BaseIri.Type

/** One gist class the vocabulary admits, as a name and a link only: its gist parent when it has one on the list. */
export class GistClass extends S.Opaque<GistClass, { readonly brand: unique symbol }>()(
  S.Struct({
    parent: GistName.pipe(
      S.annotateKey({ description: "Its gist parent, itself on the list; absent at a gist top class" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe($I.annoteSchema("GistClass", { description: "One admitted gist class, as a name and a link" }))
) {}

/**
 * The gist names a vocabulary admits: the parents its classes name and their named ancestors, and the disjoint pairs
 * gist states between them, as names and links only. No label, definition, property, domain or range of gist's.
 */
export class GistProjection extends S.Opaque<GistProjection, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.SemVerFromString.pipe(S.annotateKey({ description: "The pinned gist release" })),
    namespace: Namespace.pipe(S.annotateKey({ description: "The gist namespace IRI" })),
    classes: S.Record(GistName.annotateKey({ description: "A gist class's local name" }), GistClass).pipe(
      S.annotateKey({ description: "The admitted gist classes, by local name" })
    ),
    disjointPairs: S.Array(
      S.Tuple([
        GistName.annotateKey({ description: "One class of the pair" }),
        GistName.annotateKey({ description: "The other class of the pair" })
      ]).annotateKey({ description: "Two gist classes gist states share no instance" })
    ).pipe(S.annotateKey({ description: "The disjoint pairs gist states between admitted classes, and no others" }))
  }).pipe($I.annoteSchema("GistProjection", { description: "The gist names a vocabulary admits" }))
) {}

/**
 * Every term under one namespace, keyed by local name. Decode a hand-written literal with
 * `{ onExcessProperty: "error", errors: "all" }`: a record drops a key its key schema refuses unless excess keys are
 * errors, so a misspelt key would otherwise disappear.
 */
export class Vocabulary extends S.Opaque<Vocabulary, { readonly brand: unique symbol }>()(
  S.Struct({
    base: BaseIri.pipe(S.annotateKey({ description: "The one IRI every other IRI is derived from" })),
    namespace: Namespace.pipe(S.annotateKey({ description: "The IRI every local key is appended to" })),
    version: S.SemVerFromString.pipe(
      S.annotateKey({ description: "The vocabulary's version, written by hand: 0.y.0 before publication" })
    ),
    gist: GistProjection.pipe(S.annotateKey({ description: "The gist names the vocabulary admits" })),
    classes: S.Record(ClassKey.annotateKey({ description: "A class's local name" }), ClassTerm).pipe(
      S.annotateKey({ description: "The classes, by key" })
    ),
    objectProperties: S.Record(
      PropertyKey.annotateKey({ description: "A relation's local name" }),
      ObjectPropertyTerm
    ).pipe(S.annotateKey({ description: "The relations, by key" })),
    datatypeProperties: S.Record(
      PropertyKey.annotateKey({ description: "An attribute's local name" }),
      DatatypePropertyTerm
    ).pipe(S.annotateKey({ description: "The attributes, by key" })),
    schemes: S.Record(SchemeKey.annotateKey({ description: "A scheme's local name" }), ConceptScheme).pipe(
      S.annotateKey({ description: "The code lists, by key" })
    )
  }).pipe($I.annoteSchema("Vocabulary", { description: "Every term under one namespace" }))
) {}
