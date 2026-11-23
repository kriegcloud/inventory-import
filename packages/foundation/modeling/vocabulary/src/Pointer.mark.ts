/**
 * The marks a record schema carries to say which term of a vocabulary it stands for, and the reader that finds them
 * again. A mark is one of three annotation keys: `term` (a class, property or scheme pointer), `path` (a lift path)
 * and `noTerm` (why a position stands for no term). It sits in one of two stores: a schema's own annotations (a
 * record, or a union of literals pointing at a scheme), or a struct field's key annotations. The makers are typed by
 * the vocabulary a caller hands them; the reader returns what it finds as data, and a later gate compares it.
 *
 * Do not break: this package knows no term of any one vocabulary. Every name type is a parameter the caller supplies,
 * and the reader's names are plain CURIE text.
 *
 * @packageDocumentation
 */
import type { Curie, VocabShape } from "@beep/identity/Vocab"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { dual } from "effect/Function"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"
import * as Tuple from "effect/Tuple"
import { $VocabularyId } from "./internal/identity.ts"

const $I = $VocabularyId.create("Pointer")

// ---------------------------------------------------------------------------------------------------------------
// The closed list of reasons a position stands for no term
// ---------------------------------------------------------------------------------------------------------------

/**
 * Why a field or a schema stands for no term (decision 21): it only carries a value across the wire, holds a request's
 * own data, exists for a screen, describes a failure, or is the store's bookkeeping. A position the vocabulary will
 * place later is `deferred` instead, with the slice that places it (decision 98).
 */
export const NoTermReason = LiteralKit(["transport", "request", "screen", "error", "bookkeeping"]).pipe(
  $I.annoteSchema("NoTermReason", { description: "Why a position stands for no term, from the closed list" })
)
/** Runtime type of {@link NoTermReason}. */
export type NoTermReason = typeof NoTermReason.Type

// ---------------------------------------------------------------------------------------------------------------
// The makers. Each returns an annotation object to spread into `annotate`, `annotateKey` or `annoteSchema`'s extras
// ---------------------------------------------------------------------------------------------------------------

/**
 * A class, property or scheme pointer: the position stands for the one term it names. The marks are type aliases, not
 * interfaces, so a mark held in a constant is still assignable to Effect's annotation types, which have an index
 * signature an interface never satisfies.
 */
export type TermMark<C extends string> = {
  readonly term: C
}

/**
 * Makes the pointer helper of one registry. The caller binds it to a registry of classes, properties or schemes, and
 * a name outside that registry is a type error.
 *
 * @example
 * const aboutClass = pointerFor<typeof LibraryClasses>()
 * S.Struct({ ... }).annotate({ description: "A book", ...aboutClass("lib:Book") })
 */
export const pointerFor =
  <const V extends VocabShape>() =>
  <const C extends Curie<V>>(term: C): TermMark<C> => ({ term })

/** A concept a lift fixes on the node it makes: one more triple, the node, `property`, the concept. */
export interface FixedConcept<P extends string, K extends string> {
  readonly property: P
  readonly concept: K
}

/**
 * A step of a lift that makes a node of class `node`, joined to the node before it by `property`. With `reverse`, the
 * new node is the subject of that triple and the node before it the object.
 */
export interface NodeStep<C extends string, P extends string, K extends string> {
  readonly property: P
  readonly reverse?: true
  readonly node: C
  readonly fixed?: ReadonlyArray<FixedConcept<P, K>>
}

/**
 * The last step of a lift: the field's value is the object of `property` on the last node. It makes no node, so it
 * can hold no class, no direction and no fixed concept; a node step in its place is a type error.
 */
export interface ValueStep<P extends string> {
  readonly property: P
  readonly node?: never
  readonly reverse?: never
  readonly fixed?: never
}

/** A lift path: node steps, then one value step. */
export type LiftPath<C extends string, P extends string, K extends string> = readonly [
  ...ReadonlyArray<NodeStep<C, P, K>>,
  ValueStep<P>
]

/** A path mark: the field's value is reached by the lift it names. */
export type PathMark<Path> = {
  readonly path: Path
}

/**
 * Makes the path helper. The caller supplies the three name types (its class, property and concept CURIEs), so a
 * path naming anything else is a type error, and this package names none of them.
 *
 * @example
 * const aboutPath = pathFor<LibraryClass, LibraryProperty, LibraryConcept>()
 * aboutPath([{ property: "lib:loanOf", reverse: true, node: "lib:Loan" }, { property: "lib:loanStatus" }])
 */
export const pathFor =
  <C extends string, P extends string, K extends string>() =>
  <const Path extends LiftPath<C, P, K>>(path: Path): PathMark<Path> => ({ path })

/** A mark that says the position stands for no term, for one of the closed reasons. */
export type ClosedNoTermMark = {
  readonly noTerm: { readonly reason: NoTermReason }
}

/** A mark that says the vocabulary will place the position in a later slice, which it names. */
export type DeferredNoTermMark<Slice extends string> = {
  readonly noTerm: { readonly reason: "deferred"; readonly slice: Slice }
}

/** The no-term helper: a closed reason alone, or `deferred` with the slice that will place the position. */
export interface NoTermMaker<Slice extends string> {
  (reason: NoTermReason): ClosedNoTermMark
  // One mark, written as two words: a tuple, so the helper has no second parameter to be piped into.
  (...deferred: readonly [reason: "deferred", slice: Slice]): DeferredNoTermMark<Slice>
}

/**
 * Makes the no-term helper. The caller names the slices a position may be deferred to; any other slice, a slice
 * with a closed reason, or `deferred` with no slice is a type error.
 *
 * @example
 * const noTerm = noTermFor<"party">()
 * noTerm("screen") // { noTerm: { reason: "screen" } }
 * noTerm("deferred", "party") // { noTerm: { reason: "deferred", slice: "party" } }
 */
export const noTermFor = <Slice extends string>(): NoTermMaker<Slice> => {
  // The body writes what it was given and decides nothing: a call the overloads refuse, reached only past the type
  // checker, writes a mark the reader reports as malformed.
  function noTerm(reason: NoTermReason): ClosedNoTermMark
  function noTerm(reason: "deferred", slice: Slice): DeferredNoTermMark<Slice>
  function noTerm(
    reason: NoTermReason | "deferred",
    ...slice: ReadonlyArray<Slice>
  ): { readonly noTerm: { readonly reason: NoTermReason | "deferred"; readonly slice?: Slice } } {
    return O.match(A.head(slice), {
      onNone: () => ({ noTerm: { reason } }),
      onSome: (named) => ({ noTerm: { reason, slice: named } })
    })
  }
  return noTerm
}

// ---------------------------------------------------------------------------------------------------------------
// What a mark holds once read: the names are plain CURIE text
// ---------------------------------------------------------------------------------------------------------------

/**
 * A name as a mark writes it, `prefix:local`. The reader checks its shape only; whether the vocabulary has the term
 * is the gate's question.
 *
 * @example "lib:Book"
 */
export const MarkedName = S.String.check(
  S.isPattern(/^[A-Za-z][A-Za-z0-9_-]{0,31}:[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/)
).pipe($I.annoteSchema("MarkedName", { description: "A CURIE a mark names, prefix:local" }))
/** Runtime type of {@link MarkedName}. */
export type MarkedName = typeof MarkedName.Type

/**
 * The name of the slice a deferred position waits for.
 *
 * @example "party"
 */
export const SliceName = S.Trimmed.check(S.isMinLength(1), S.isMaxLength(64)).pipe(
  $I.annoteSchema("SliceName", { description: "The slice that will place a deferred position" })
)
/** Runtime type of {@link SliceName}. */
export type SliceName = typeof SliceName.Type

/** A concept fixed on a lift's node, as read. */
export class FixedConceptRead extends S.Opaque<FixedConceptRead, { readonly brand: unique symbol }>()(
  S.Struct({
    property: MarkedName.pipe(S.annotateKey({ description: "The property joining the node to the concept" })),
    concept: MarkedName.pipe(S.annotateKey({ description: "The concept the node always has" }))
  }).pipe($I.annoteSchema("FixedConceptRead", { description: "A concept a lift fixes on its node" }))
) {}

/** A node step of a lift, as read: a missing `reverse` reads as false and a missing `fixed` as none. */
export class NodeStepRead extends S.Opaque<NodeStepRead, { readonly brand: unique symbol }>()(
  S.Struct({
    property: MarkedName.pipe(S.annotateKey({ description: "The property joining the new node to the one before" })),
    node: MarkedName.pipe(S.annotateKey({ description: "The class of the new node" })),
    reverse: S.Literal(true).pipe(
      S.annotateKey({ description: "The new node is the triple's subject; absent, its object" }),
      S.optionalKey
    ),
    fixed: S.Array(FixedConceptRead).pipe(
      S.annotateKey({ description: "The concepts the new node always has" }),
      S.withConstructorDefault(Effect.succeed([])),
      S.withDecodingDefaultTypeKey(Effect.succeed([]))
    )
  }).pipe($I.annoteSchema("NodeStepRead", { description: "A step of a lift that makes a node" }))
) {}

/** The value step of a lift, as read. */
export class ValueStepRead extends S.Opaque<ValueStepRead, { readonly brand: unique symbol }>()(
  S.Struct({
    property: MarkedName.pipe(S.annotateKey({ description: "The property whose object is the field's value" }))
  }).pipe($I.annoteSchema("ValueStepRead", { description: "The last step of a lift: the field's value" }))
) {}

/**
 * A lift path as read: node steps, then exactly one value step. A node step in last place, or a value step before it,
 * does not decode, since a key the step does not have is refused.
 */
export const LiftPathRead = S.TupleWithRest(S.Tuple([]), [NodeStepRead, ValueStepRead]).pipe(
  $I.annoteSchema("LiftPathRead", { description: "Node steps, then one value step" })
)
/** Runtime type of {@link LiftPathRead}. */
export type LiftPathRead = typeof LiftPathRead.Type

/** A no-term mark with a closed reason, as read. */
export class ClosedNoTermRead extends S.Opaque<ClosedNoTermRead, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: NoTermReason.pipe(S.annotateKey({ description: "Why the position stands for no term" }))
  }).pipe($I.annoteSchema("ClosedNoTermRead", { description: "No term, for one of the closed reasons" }))
) {}

/** A deferred no-term mark, as read: the slice that will place the position. */
export class DeferredNoTermRead extends S.Opaque<DeferredNoTermRead, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: S.tag("deferred"),
    slice: SliceName.pipe(S.annotateKey({ description: "The slice that will place the position" }))
  }).pipe($I.annoteSchema("DeferredNoTermRead", { description: "No term yet: a later slice places it" }))
) {}

/** A no-term mark as read: a closed reason, or deferred with its slice. */
export const NoTermRead = S.Union([ClosedNoTermRead, DeferredNoTermRead]).pipe(
  $I.annoteSchema("NoTermRead", { description: "Why a position stands for no term" })
)
/** Runtime type of {@link NoTermRead}. */
export type NoTermRead = typeof NoTermRead.Type

/** The three annotation keys a mark is written under. */
export const MarkKey = LiteralKit(["term", "path", "noTerm"]).pipe(
  $I.annoteSchema("MarkKey", { description: "The annotation key a mark is written under" })
)
/** Runtime type of {@link MarkKey}. */
export type MarkKey = typeof MarkKey.Type

// ---------------------------------------------------------------------------------------------------------------
// What the reader reports for one position
// ---------------------------------------------------------------------------------------------------------------

const ReadingKind = LiteralKit(["none", "term", "path", "noTerm", "several", "malformed"])

/** The position carries none of the three keys. */
export class Unmarked extends S.Opaque<Unmarked, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("none") }).pipe($I.annoteSchema("Unmarked", { description: "A position with no mark" }))
) {}

/** The position points at one term: a class, a property or a scheme; which one is the gate's to say. */
export class TermReading extends S.Opaque<TermReading, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("term"),
    term: MarkedName.pipe(S.annotateKey({ description: "The term the position points at" }))
  }).pipe($I.annoteSchema("TermReading", { description: "A position that points at one term" }))
) {}

/** The position's value is reached by a lift. */
export class PathReading extends S.Opaque<PathReading, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("path"),
    path: LiftPathRead.pipe(S.annotateKey({ description: "The lift, node steps then one value step" }))
  }).pipe($I.annoteSchema("PathReading", { description: "A position reached by a lift" }))
) {}

/** The position stands for no term, and why. */
export class NoTermReading extends S.Opaque<NoTermReading, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("noTerm"),
    noTerm: NoTermRead.pipe(S.annotateKey({ description: "The reason, and the slice when deferred" }))
  }).pipe($I.annoteSchema("NoTermReading", { description: "A position that stands for no term" }))
) {}

/** The position carries more than one of the three keys, which a mark never does. */
export class SeveralMarks extends S.Opaque<SeveralMarks, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("several"),
    keys: S.Array(MarkKey).pipe(
      S.annotateKey({ description: "The keys found together, in the order term, path, noTerm" })
    )
  }).pipe($I.annoteSchema("SeveralMarks", { description: "A position with more than one mark" }))
) {}

/** The position carries one key whose value is not a mark: a name of the wrong shape, a broken path, a bad reason. */
export class MalformedMark extends S.Opaque<MalformedMark, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("malformed"),
    key: MarkKey.pipe(S.annotateKey({ description: "The key whose value is not a mark" })),
    message: S.String.pipe(S.annotateKey({ description: "What the value lacks, as the decoder says it" }))
  }).pipe($I.annoteSchema("MalformedMark", { description: "A position whose one mark is not well formed" }))
) {}

/** What the reader found at one position. */
export const MarkReading = ReadingKind.mapMembers(() =>
  Tuple.make(Unmarked, TermReading, PathReading, NoTermReading, SeveralMarks, MalformedMark)
).pipe(S.toTaggedUnion("kind"), $I.annoteSchema("MarkReading", { description: "What one position is marked with" }))
/** Runtime type of {@link MarkReading}. */
export type MarkReading = typeof MarkReading.Type

/** One field of a record and the mark in its key annotations. */
export class FieldMark extends S.Opaque<FieldMark, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String.pipe(S.annotateKey({ description: "The field's name in the struct" })),
    mark: MarkReading.pipe(S.annotateKey({ description: "The mark in the field's key annotations" }))
  }).pipe($I.annoteSchema("FieldMark", { description: "A field and its mark" }))
) {}

/**
 * The marks of one schema: its own (from its schema annotations) and, when it is a struct or a class over one, each
 * field's (from the field's key annotations), in declaration order. A schema with no fields, a union of literals
 * say, has none.
 */
export class SchemaMarks extends S.Opaque<SchemaMarks, { readonly brand: unique symbol }>()(
  S.Struct({
    mark: MarkReading.pipe(S.annotateKey({ description: "The mark in the schema's own annotations" })),
    fields: S.Array(FieldMark).pipe(
      S.annotateKey({ description: "Each field and its mark; absent when the schema is not a struct" }),
      S.OptionFromOptionalKey,
      S.withConstructorDefault(Effect.succeedNone)
    )
  }).pipe($I.annoteSchema("SchemaMarks", { description: "A schema's mark and its fields' marks" }))
) {}

// ---------------------------------------------------------------------------------------------------------------
// The reader
// ---------------------------------------------------------------------------------------------------------------

const strict = { onExcessProperty: "error", errors: "all" } as const
const decodeTerm = S.decodeUnknownResult(MarkedName, strict)
const decodePath = S.decodeUnknownResult(LiftPathRead, strict)
const decodeNoTerm = S.decodeUnknownResult(NoTermRead, strict)

const malformed: {
  (key: MarkKey): (error: S.SchemaError) => MarkReading
  (error: S.SchemaError, key: MarkKey): MarkReading
} = dual(2, (error: S.SchemaError, key: MarkKey): MarkReading => MalformedMark.make({ key, message: error.message }))

const readOne = (key: MarkKey, value: unknown): MarkReading =>
  MarkKey.match(key, {
    term: () =>
      Result.match(decodeTerm(value), {
        onFailure: malformed(key),
        onSuccess: (term) => TermReading.make({ term })
      }),
    path: () =>
      Result.match(decodePath(value), {
        onFailure: malformed(key),
        onSuccess: (path) => PathReading.make({ path })
      }),
    noTerm: () =>
      Result.match(decodeNoTerm(value), {
        onFailure: malformed(key),
        onSuccess: (noTerm) => NoTermReading.make({ noTerm })
      })
  })

// Effect reads a key set to `undefined` as absent, so the reader does too.
// The three keys are no name an object's prototype holds, so indexing finds only what was written.
const valueAt = (store: S.Annotations.Annotations | undefined, key: MarkKey): O.Option<unknown> =>
  O.flatMap(O.fromUndefinedOr(store), (annotations) => O.fromUndefinedOr(annotations[key]))

const readStore = (store: S.Annotations.Annotations | undefined): MarkReading => {
  const found = A.filter(MarkKey.literals, (key) => O.isSome(valueAt(store, key)))
  const first = A.head(found)
  if (O.isNone(first)) {
    return Unmarked.make({})
  }
  if (found.length > 1) {
    return SeveralMarks.make({ keys: found })
  }
  return O.match(valueAt(store, first.value), {
    onNone: () => Unmarked.make({}),
    onSome: (value) => readOne(first.value, value)
  })
}

/**
 * Reads the mark in a node's schema annotations, where `S.annotate` and `annoteSchema` write it: on the last check
 * when the node has checks, else on the node, as `S.resolveAnnotations` reads them.
 *
 * @example readSchemaMark(Book.ast) // TermReading { term: "lib:Book" }
 */
export const readSchemaMark = (ast: SchemaAST.AST): MarkReading =>
  readStore(
    O.match(O.fromUndefinedOr(ast.checks), {
      onNone: () => ast.annotations,
      onSome: (checks) => A.lastNonEmpty(checks).annotations
    })
  )

/**
 * Reads the mark in a node's key annotations, where `S.annotateKey` writes it, as `S.resolveAnnotationsKey` reads
 * them. A mark is found only when its `annotateKey` is the last step that builds the field's node: any step after it
 * makes a new node with no key annotations, and the mark is lost. So `S.optional(X.pipe(S.annotateKey(mark)))`,
 * `S.NullOr(...)`, `S.UndefinedOr(...)` or `S.Array(...)` around a marked schema, and a `decodeTo` after it (inside
 * `S.OptionFromOptionalKey`, say, where the mark is left on the encoded side), all read as unmarked. Put the
 * `annotateKey` last in the field's pipe.
 *
 * @example readKeyMark(Book.fields.title.ast) // TermReading { term: "lib:title" }
 */
export const readKeyMark = (ast: SchemaAST.AST): MarkReading => readStore(ast.context?.annotations)

/**
 * The annotation key Effect 4's `S.Class` (and so `Model.Class`) writes on the declaration it makes, and no other
 * declaration carries (`getClassSchemaFactory` in effect's `Schema.ts`). It is how a class over a struct is told
 * from any other one-parameter declaration over one, such as `S.Option(Book)`, whose fields are not its own.
 */
const classConstructorKey = "~constructor"

/**
 * The fields the reader reads a schema's marks from, in declaration order: a struct's own, or those of the struct a
 * class (`S.Class`, `Model.Class`, an `S.Opaque` is a struct) is declared over; none for any other schema, even a
 * declaration over a struct such as `S.Option(Book)`. A gate that needs a field's node as well as its mark reads the
 * fields here, so it and `readMarks` agree on what a record's fields are.
 *
 * @example O.map(fieldsOf(Book.ast), A.map((field) => field.name)) // Some(["id", "title", ...])
 */
export const fieldsOf = (ast: SchemaAST.AST): O.Option<ReadonlyArray<SchemaAST.PropertySignature>> => {
  if (SchemaAST.isObjects(ast)) {
    return O.some(ast.propertySignatures)
  }
  if (SchemaAST.isDeclaration(ast) && P.hasProperty(ast.annotations, classConstructorKey)) {
    return O.flatMap(A.head(ast.typeParameters), (inner) =>
      ast.typeParameters.length === 1 && SchemaAST.isObjects(inner) ? O.some(inner.propertySignatures) : O.none()
    )
  }
  return O.none()
}

/**
 * Reads every mark a schema carries: its own, and each field's when it is a struct (`S.Struct`, an `S.Opaque` over
 * one) or a class over one (`S.Class`, `Model.Class`, whose fields are its default variant's). Any other declaration
 * has no fields here, even one over a struct: `S.Option(Book)` holds a book, it is not one. A field's mark is read
 * from its key annotations only, so a field whose schema is itself a marked record reads as unmarked unless the field
 * is marked.
 *
 * @example
 * readMarks(Book.ast) // SchemaMarks { mark: TermReading { term: "lib:Book" }, fields: Some([...]) }
 */
export const readMarks = (ast: SchemaAST.AST): SchemaMarks =>
  SchemaMarks.make({
    mark: readSchemaMark(ast),
    fields: O.map(fieldsOf(ast), (signatures) =>
      A.map(signatures, (signature) =>
        FieldMark.make({
          name: P.isString(signature.name) ? signature.name : String(signature.name),
          mark: readKeyMark(signature.type)
        })
      )
    )
  })
