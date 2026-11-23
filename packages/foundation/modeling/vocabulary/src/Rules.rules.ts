/**
 * Gate 4's coherence rules: what must hold across the entries of a decoded vocabulary, its list of classes allowed no
 * gist parent, and the decision log's headings. Each broken rule is one `Finding`, data that names the rule and the
 * term's key; nothing here fails or throws.
 *
 * Do not break: the rules read only their arguments. No file is read, no vocabulary of any one project is imported,
 * and no term's name is written here. C12 asks only whether a named decision number is in the set it is given; it
 * never reads what the decision says.
 *
 * Rules the decoded value already holds are not repeated: a scheme key ends in `Scheme`, a notation is unique in its
 * scheme, a label and a definition are not empty (C2), a datatype is in the registry, a tag is one of the four, and a
 * version is a semantic version. C9 (a sub-property link) is not built: the metamodel has no field for one.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as HashSet from "effect/HashSet"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { $VocabularyId } from "./internal/identity.ts"
import {
  ClassKey,
  Definition,
  IdentityCriterion,
  ParentLink,
  Ratification,
  RangeTarget,
  type ClassTerm,
  type Vocabulary
} from "./Model.schema.ts"

const $I = $VocabularyId.create("Rules")

// ---------------------------------------------------------------------------------------------------------------
// The inputs and the finding
// ---------------------------------------------------------------------------------------------------------------

/**
 * One class allowed no gist parent (decision 97): the class's key, the reason its `none` parent must state word for
 * word, and the decision that allowed it.
 *
 * @example ParentException.make({ class: "Genre", reason: "...", ratification: Ratification.make({ decision: 2 }) })
 */
export class ParentException extends S.Opaque<ParentException, { readonly brand: unique symbol }>()(
  S.Struct({
    class: ClassKey.pipe(S.annotateKey({ description: "The key of the class allowed no gist parent" })),
    reason: Definition.pipe(S.annotateKey({ description: "Why no gist class fits; the class's parent says the same" })),
    ratification: Ratification.pipe(S.annotateKey({ description: "The decision that allowed it" }))
  }).pipe($I.annoteSchema("ParentException", { description: "One class allowed no gist parent, and why" }))
) {}

/** The committed list of classes allowed no gist parent, in the order it is written. */
export const ExceptionList = S.Array(
  ParentException.annotateKey({ description: "One class allowed no gist parent" })
).pipe($I.annoteSchema("ExceptionList", { description: "The classes allowed no gist parent" }))
/** Runtime type of {@link ExceptionList}. */
export type ExceptionList = typeof ExceptionList.Type

/** The rules gate 4 runs, by their names in report 14 section 6.4. C2 and C9 are not here (the file's header says why). */
export const RuleId = LiteralKit(["C1", "C3", "C4", "C5", "C6", "C7", "C8", "C10", "C11", "C12", "C13"]).pipe(
  $I.annoteSchema("RuleId", { description: "A coherence rule of gate 4" })
)
/** Runtime type of {@link RuleId}. */
export type RuleId = typeof RuleId.Type

/** Which table of the vocabulary the finding's key is a key of. */
export const TermKind = LiteralKit([
  "class",
  "objectProperty",
  "datatypeProperty",
  "scheme",
  "concept",
  "gist",
  "exception",
  "vocabulary"
]).pipe($I.annoteSchema("TermKind", { description: "The table of the vocabulary a finding's key belongs to" }))
/** Runtime type of {@link TermKind}. */
export type TermKind = typeof TermKind.Type

/**
 * One broken rule. `key` is the term's key in its table; a concept's is `<scheme>-<notation>`, an exception entry's
 * is its class key, and the vocabulary's own (C13) is its namespace.
 */
export class Finding extends S.Opaque<Finding, { readonly brand: unique symbol }>()(
  S.Struct({
    rule: RuleId.pipe(S.annotateKey({ description: "The rule that is broken" })),
    kind: TermKind.pipe(S.annotateKey({ description: "The table the key is a key of" })),
    key: S.String.check(S.isMinLength(1), S.isMaxLength(200)).pipe(
      S.annotateKey({ description: "The key of the term that breaks it" })
    ),
    detail: S.String.check(S.isMinLength(1), S.isMaxLength(400)).pipe(
      S.annotateKey({ description: "What is wrong, in one sentence" })
    )
  }).pipe($I.annoteSchema("Finding", { description: "One broken coherence rule, naming the term" }))
) {}

/** What gate 4 reads: the decoded vocabulary, its exception list, and the decision numbers that have a heading. */
export type CoherenceInput = {
  readonly vocabulary: Vocabulary
  readonly exceptions: ExceptionList
  readonly decisions: HashSet.HashSet<number>
}

// ---------------------------------------------------------------------------------------------------------------
// The decision log's headings
// ---------------------------------------------------------------------------------------------------------------

const headingPattern = /^### ([1-9][0-9]*)\. /

/**
 * The decision numbers a decision log answers: every line that begins `### <n>. `. A combined heading
 * (`### 39 and 43.`) gives neither number, and an open decision, a table row, has no heading.
 *
 * @example decisionHeadings("### 97. A class with no gist parent (2026-11-22)\n### 39 and 43. ...") // HashSet(97)
 */
export const decisionHeadings = (text: string): HashSet.HashSet<number> =>
  HashSet.fromIterable(
    A.flatMap(Str.split(text, /\r?\n/), (line) =>
      O.match(
        O.flatMap(Str.match(headingPattern)(line), (found) => O.flatMap(O.fromNullishOr(found[1]), Num.parse)),
        { onNone: () => [], onSome: (n) => [n] }
      )
    )
  )

// ---------------------------------------------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------------------------------------------

const finding = (rule: RuleId, kind: TermKind, key: string, detail: string): Finding =>
  Finding.make({ rule, kind, key, detail })

const gistParentName = (term: ClassTerm): O.Option<string> =>
  ParentLink.guards.gist(term.parent) ? O.some(term.parent.name) : O.none()

const localParentKey = (term: ClassTerm): O.Option<string> =>
  ParentLink.guards.local(term.parent) ? O.some(term.parent.key) : O.none()

const noParentReason = (term: ClassTerm): O.Option<string> =>
  ParentLink.guards.none(term.parent) ? O.some(term.parent.reason) : O.none()

const tables = (vocabulary: Vocabulary): ReadonlyArray<readonly [TermKind, ReadonlyArray<string>]> => [
  ["class", R.keys(vocabulary.classes)],
  ["objectProperty", R.keys(vocabulary.objectProperties)],
  ["datatypeProperty", R.keys(vocabulary.datatypeProperties)],
  ["scheme", R.keys(vocabulary.schemes)]
]

/** C1: a key names one term across classes, properties and schemes. Reported at each table after the first. */
const c1 = (vocabulary: Vocabulary): ReadonlyArray<Finding> => {
  const all = tables(vocabulary)
  return A.flatMap(all, ([kind, keys], index) =>
    A.flatMap(keys, (key) =>
      A.some(A.take(all, index), ([, earlier]) => A.contains(earlier, key))
        ? [finding("C1", kind, key, `The key ${key} is used by more than one term.`)]
        : []
    )
  )
}

/** True when following local parents from `start` comes back to it. */
const onCycle = (vocabulary: Vocabulary, start: string): boolean => {
  const step = (key: string, left: number): boolean => {
    const next = O.flatMap(R.get(vocabulary.classes, key), localParentKey)
    if (O.isNone(next)) return false
    if (next.value === start) return true
    return left > 0 && step(next.value, left - 1)
  }
  return step(start, R.size(vocabulary.classes))
}

/** C3: a gist parent is on the gist list, a local parent is a class of the vocabulary, and no class is its own ancestor. */
const c3 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) => [
    ...O.match(gistParentName(term), {
      onNone: () => [],
      onSome: (name) =>
        R.has(vocabulary.gist.classes, name)
          ? []
          : [finding("C3", "class", key, `Its gist parent ${name} is not on the gist list.`)]
    }),
    ...O.match(localParentKey(term), {
      onNone: () => [],
      onSome: (parent) =>
        R.has(vocabulary.classes, parent)
          ? []
          : [finding("C3", "class", key, `Its parent ${parent} is not a class of the vocabulary.`)]
    }),
    ...(onCycle(vocabulary, key) ? [finding("C3", "class", key, "Its chain of parents comes back to it.")] : [])
  ])

/**
 * C4 (decision 97): the classes with no parent are exactly the entries of the exception list, each with the same
 * reason, and the list names each class once.
 */
const c4 = (vocabulary: Vocabulary, exceptions: ExceptionList): ReadonlyArray<Finding> => {
  const fromClasses = A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) =>
    O.match(noParentReason(term), {
      onNone: () => [],
      onSome: (reason) =>
        O.match(
          A.findFirst(exceptions, (entry) => entry.class === key),
          {
            onNone: () => [finding("C4", "class", key, "It has no parent and no entry on the exception list.")],
            onSome: (entry) =>
              entry.reason === reason
                ? []
                : [finding("C4", "class", key, "Its reason differs from its entry on the exception list.")]
          }
        )
    })
  )
  const fromEntries = A.flatMap(exceptions, (entry, index) => {
    const repeated = A.some(A.take(exceptions, index), (earlier) => earlier.class === entry.class)
    const parentless = O.isSome(O.flatMap(R.get(vocabulary.classes, entry.class), noParentReason))
    return [
      ...(repeated ? [finding("C4", "exception", entry.class, "The exception list names this class twice.")] : []),
      ...(parentless
        ? []
        : [
            finding(
              "C4",
              "exception",
              entry.class,
              "The exception list names a class that has a parent or does not exist."
            )
          ])
    ]
  })
  return A.appendAll(fromClasses, fromEntries)
}

/** C5 (decision 14): the gist list is closed upward; each gist class's parent is on it. */
const c5 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.gist.classes), ([name, gist]) =>
    O.match(gist.parent, {
      onNone: () => [],
      onSome: (parent) =>
        R.has(vocabulary.gist.classes, parent)
          ? []
          : [finding("C5", "gist", name, `Its gist parent ${parent} is not on the gist list.`)]
    })
  )

/** C6 (decision 15): each disjoint pair names two classes on the gist list. Reported at each name not on it. */
const c6 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(vocabulary.gist.disjointPairs, (pair) =>
    A.flatMap(pair, (name) =>
      R.has(vocabulary.gist.classes, name)
        ? []
        : [finding("C6", "gist", name, `A disjoint pair names ${name}, which is not on the gist list.`)]
    )
  )

/** C7: an inherited identity criterion needs a local parent to inherit it from. */
const c7 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) =>
    IdentityCriterion.guards.inherited(term.identity) && O.isNone(localParentKey(term))
      ? [finding("C7", "class", key, "It inherits its identity criterion but has no parent in the vocabulary.")]
      : []
  )

const domainFindings = (
  vocabulary: Vocabulary,
  kind: TermKind,
  key: string,
  domain: O.Option<string>
): ReadonlyArray<Finding> =>
  O.match(domain, {
    onNone: () => [],
    onSome: (cls) =>
      R.has(vocabulary.classes, cls)
        ? []
        : [finding("C8", kind, key, `Its domain ${cls} is not a class of the vocabulary.`)]
  })

/** C8: a property's domain is a class of the vocabulary or absent; an object property's range is a class or scheme of it. */
const c8 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.appendAll(
    A.flatMap(R.toEntries(vocabulary.objectProperties), ([key, term]) => [
      ...domainFindings(vocabulary, "objectProperty", key, term.domain),
      ...RangeTarget.match(term.range, {
        class: (range) =>
          R.has(vocabulary.classes, range.key)
            ? []
            : [finding("C8", "objectProperty", key, `Its range ${range.key} is not a class of the vocabulary.`)],
        scheme: (range) =>
          R.has(vocabulary.schemes, range.key)
            ? []
            : [finding("C8", "objectProperty", key, `Its range ${range.key} is not a scheme of the vocabulary.`)]
      })
    ]),
    A.flatMap(R.toEntries(vocabulary.datatypeProperties), ([key, term]) =>
      domainFindings(vocabulary, "datatypeProperty", key, term.domain)
    )
  )

/** C10: a scheme has at least one concept, and a concept's `alsoInstanceOf` names a class of the vocabulary. */
const c10 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.schemes), ([schemeKey, scheme]) => [
    ...(R.isEmptyRecord(scheme.concepts) ? [finding("C10", "scheme", schemeKey, "It has no concept.")] : []),
    ...A.flatMap(R.toEntries(scheme.concepts), ([notation, concept]) =>
      O.match(concept.alsoInstanceOf, {
        onNone: () => [],
        onSome: (cls) =>
          R.has(vocabulary.classes, cls)
            ? []
            : [
                finding(
                  "C10",
                  "concept",
                  `${schemeKey}-${notation}`,
                  `It is an individual of ${cls}, which is not a class of the vocabulary.`
                )
              ]
      })
    )
  ])

/** C11: a `role` class has a parent in the vocabulary, the kind it is a role of. */
const c11 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) =>
    term.tag === "role" && O.isNone(localParentKey(term))
      ? [finding("C11", "class", key, "It is tagged role but has no parent in the vocabulary.")]
      : []
  )

const ratified = (
  decisions: HashSet.HashSet<number>,
  kind: TermKind,
  key: string,
  decision: number
): ReadonlyArray<Finding> =>
  HashSet.has(decisions, decision)
    ? []
    : [finding("C12", kind, key, `It names decision ${decision}, which has no heading in the decision log.`)]

/**
 * C12 (decisions 107 and 111): every term and every exception entry names a decision number that has a heading. Only
 * the number is checked, never what the decision says.
 */
const c12 = (
  vocabulary: Vocabulary,
  exceptions: ExceptionList,
  decisions: HashSet.HashSet<number>
): ReadonlyArray<Finding> => [
  ...A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) =>
    ratified(decisions, "class", key, term.ratification.decision)
  ),
  ...A.flatMap(R.toEntries(vocabulary.objectProperties), ([key, term]) =>
    ratified(decisions, "objectProperty", key, term.ratification.decision)
  ),
  ...A.flatMap(R.toEntries(vocabulary.datatypeProperties), ([key, term]) =>
    ratified(decisions, "datatypeProperty", key, term.ratification.decision)
  ),
  ...A.flatMap(R.toEntries(vocabulary.schemes), ([schemeKey, scheme]) => [
    ...ratified(decisions, "scheme", schemeKey, scheme.ratification.decision),
    ...A.flatMap(R.toEntries(scheme.concepts), ([notation, concept]) =>
      ratified(decisions, "concept", `${schemeKey}-${notation}`, concept.ratification.decision)
    )
  ]),
  ...A.flatMap(exceptions, (entry) => ratified(decisions, "exception", entry.class, entry.ratification.decision))
]

/**
 * C13 (decision 24): the version is three numbers, with no pre-release or build part, and while it is `0.y` (before
 * publication) its third number is 0: any change advances `y`.
 */
const c13 = (vocabulary: Vocabulary): ReadonlyArray<Finding> => {
  const { build, major, patch, prerelease } = vocabulary.version
  return [
    ...(A.isReadonlyArrayNonEmpty(prerelease) || A.isReadonlyArrayNonEmpty(build)
      ? [finding("C13", "vocabulary", vocabulary.namespace, "Its version has more than three numbers.")]
      : []),
    ...(major === 0 && patch !== 0
      ? [finding("C13", "vocabulary", vocabulary.namespace, "Before publication its version is 0.y.0.")]
      : [])
  ]
}

/**
 * Gate 4: every broken coherence rule of a decoded vocabulary, in rule order, then in the order the terms are written.
 * An empty result means the vocabulary is coherent. The caller decodes the vocabulary and the exception list first,
 * and reads the decision numbers with {@link decisionHeadings}.
 *
 * @example coherenceFindings({ vocabulary, exceptions, decisions: decisionHeadings(text) }) // []
 */
export const coherenceFindings = (input: CoherenceInput): ReadonlyArray<Finding> => {
  const { decisions, exceptions, vocabulary } = input
  return [
    ...c1(vocabulary),
    ...c3(vocabulary),
    ...c4(vocabulary, exceptions),
    ...c5(vocabulary),
    ...c6(vocabulary),
    ...c7(vocabulary),
    ...c8(vocabulary),
    ...c10(vocabulary),
    ...c11(vocabulary),
    ...c12(vocabulary, exceptions, decisions),
    ...c13(vocabulary)
  ]
}
