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
 * scheme, a label and a definition are not empty (C2), a datatype is in the registry, a tag is one of decision 18's
 * nine, a version is a semantic version, a retirement with no successor states its reason, and a retired term keeps
 * its label and definition. C14 (a category's place), C15 (a retirement, report 05's V14) and C16 (what an identity
 * criterion rests on, report 05's V18) are named after report 14 section 6.4's thirteen. C16 reads what a criterion
 * states it rests on and never its sentence: a word match cannot tell "the named level" from a name.
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
import * as SemVer from "effect/SemVer"
import * as Str from "effect/String"
import { $VocabularyId } from "./internal/identity.ts"
import {
  ClassKey,
  Definition,
  Deprecation,
  Designation,
  GistProperty,
  IdentityCriterion,
  ParentLink,
  Ratification,
  RangeTarget,
  type ClassTerm,
  type KindTag,
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

/**
 * The rules gate 4 runs, by their names in report 14 section 6.4, and C14 to C16 after them. C2 is not here (the
 * file's header says why).
 */
export const RuleId = LiteralKit([
  "C1",
  "C3",
  "C4",
  "C5",
  "C6",
  "C7",
  "C8",
  "C9",
  "C10",
  "C11",
  "C12",
  "C13",
  "C14",
  "C15",
  "C16"
]).pipe($I.annoteSchema("RuleId", { description: "A coherence rule of gate 4" }))
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

/**
 * Every key reached from `from` by following `next` once or more. Each key is visited once, so the walk ends on a
 * cycle; `from` is among the result only when a chain comes back to it.
 */
const reached = (from: string, next: (key: string) => ReadonlyArray<string>): HashSet.HashSet<string> => {
  const walk = (frontier: ReadonlyArray<string>, seen: HashSet.HashSet<string>): HashSet.HashSet<string> => {
    const fresh = A.dedupe(A.filter(A.flatMap(frontier, next), (key) => !HashSet.has(seen, key)))
    return A.isReadonlyArrayNonEmpty(fresh) ? walk(fresh, HashSet.union(seen, HashSet.fromIterable(fresh))) : seen
  }
  return walk([from], HashSet.empty())
}

/** A class's parents in the vocabulary: its local identity-bearing parent, then its category parents (decision 12). */
const classParents =
  (vocabulary: Vocabulary) =>
  (key: string): ReadonlyArray<string> =>
    O.match(R.get(vocabulary.classes, key), {
      onNone: () => [],
      onSome: (term) => [...A.fromOption(localParentKey(term)), ...term.categoryParents]
    })

/** The gist classes a class falls under: the gist parent of the class or of any class above it, and their ancestors. */
const gistAncestors = (vocabulary: Vocabulary, key: string): HashSet.HashSet<string> => {
  const lineage = [key, ...A.fromIterable(reached(key, classParents(vocabulary)))]
  const named = A.flatMap(lineage, (cls) => A.fromOption(O.flatMap(R.get(vocabulary.classes, cls), gistParentName)))
  const gistParent = (name: string): ReadonlyArray<string> =>
    A.fromOption(O.flatMap(R.get(vocabulary.gist.classes, name), (gist) => gist.parent))
  return HashSet.fromIterable(A.flatMap(named, (name) => [name, ...A.fromIterable(reached(name, gistParent))]))
}

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

/** True when following local and category parents from `start` comes back to it. */
const onCycle = (vocabulary: Vocabulary, start: string): boolean =>
  HashSet.has(reached(start, classParents(vocabulary)), start)

/**
 * C3: a gist parent is on the gist list, a local parent and each category parent are classes of the vocabulary, and
 * no class is its own ancestor through either kind of parent (decision 12).
 */
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
    ...A.flatMap(term.categoryParents, (category) =>
      R.has(vocabulary.classes, category)
        ? []
        : [finding("C3", "class", key, `Its category parent ${category} is not a class of the vocabulary.`)]
    ),
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

/** True when following gist parents on the gist list from `start` comes back to it, a self-parent included. */
const onGistCycle = (vocabulary: Vocabulary, start: string): boolean => {
  const step = (name: string, left: number): boolean => {
    const next = O.flatMap(R.get(vocabulary.gist.classes, name), (gist) => gist.parent)
    if (O.isNone(next)) return false
    if (next.value === start) return true
    return left > 0 && step(next.value, left - 1)
  }
  return step(start, R.size(vocabulary.gist.classes))
}

/**
 * C5 (decision 14): the gist list is closed upward, each gist class's parent is on it, and no gist class is its own
 * ancestor. A cycle is refused here so that every later walk up the gist ancestors (a projection's named ancestors, a
 * range that is the parent's class or an ancestor of it) ends.
 */
const c5 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.gist.classes), ([name, gist]) => [
    ...O.match(gist.parent, {
      onNone: () => [],
      onSome: (parent) =>
        R.has(vocabulary.gist.classes, parent)
          ? []
          : [finding("C5", "gist", name, `Its gist parent ${parent} is not on the gist list.`)]
    }),
    ...(onGistCycle(vocabulary, name)
      ? [finding("C5", "gist", name, "Its chain of gist parents comes back to it.")]
      : [])
  ])

const samePair = (a: readonly [string, string], b: readonly [string, string]): boolean =>
  (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0])

/**
 * C6 (decision 15): each disjoint pair names two different classes on the gist list, and no two pairs name the same
 * classes, in either order. A name not on the list is reported at that name; a pair naming one class twice, or
 * repeating an earlier pair, at its first name. A class disjoint with itself has no instance, so every term under it
 * would fail the reasoner for a reason other than its own.
 */
const c6 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(vocabulary.gist.disjointPairs, (pair, index) => [
    ...A.flatMap(pair, (name) =>
      R.has(vocabulary.gist.classes, name)
        ? []
        : [finding("C6", "gist", name, `A disjoint pair names ${name}, which is not on the gist list.`)]
    ),
    ...(pair[0] === pair[1] ? [finding("C6", "gist", pair[0], `A disjoint pair names ${pair[0]} twice.`)] : []),
    ...(A.some(A.take(vocabulary.gist.disjointPairs, index), (earlier) => samePair(earlier, pair))
      ? [finding("C6", "gist", pair[0], `The disjoint pair of ${pair[0]} and ${pair[1]} is stated twice.`)]
      : [])
  ])

const IdentityShape = LiteralKit(["stated", "inherited", "absent"])
type IdentityShape = typeof IdentityShape.Type

/**
 * The identity criterion each tag carries (report 05's V17, as far as the metamodel holds it): a rigid sort states
 * its own, a subkind, phase or role inherits its bearer's, and a category supplies none (decision 12).
 */
const identityByTag: { readonly [Tag in KindTag]: IdentityShape } = {
  kind: "stated",
  subkind: "inherited",
  role: "inherited",
  phase: "inherited",
  relator: "stated",
  event: "stated",
  information: "stated",
  category: "absent",
  value: "stated"
}

const identityShape = (term: ClassTerm): IdentityShape =>
  O.match(term.identity, {
    onNone: (): IdentityShape => "absent",
    onSome: (identity) =>
      IdentityCriterion.match(identity, {
        stated: (): IdentityShape => "stated",
        inherited: (): IdentityShape => "inherited"
      })
  })

/**
 * C7: a class's identity criterion agrees with its tag, and an inherited one has a local parent to inherit it from.
 * One finding a class: a criterion of the wrong shape is reported before a missing parent. A role with no local
 * parent is C11's alone: it has no bearer whose criterion it could inherit, and V17's `notApplicable` is not built.
 */
const c7 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) => {
    const expected = identityByTag[term.tag]
    const actual = identityShape(term)
    if (term.tag === "role" && O.isNone(localParentKey(term))) {
      return []
    }
    if (expected !== actual) {
      return [
        finding(
          "C7",
          "class",
          key,
          `It is tagged ${term.tag}, so its identity criterion is ${expected}, not ${actual}.`
        )
      ]
    }
    return actual === "inherited" && O.isNone(localParentKey(term))
      ? [finding("C7", "class", key, "It inherits its identity criterion but has no parent in the vocabulary.")]
      : []
  })

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

/** True when the class `key` falls under the gist class `gist` names, or when `gist` names none. */
const domainFits = (vocabulary: Vocabulary, key: O.Option<string>, gist: O.Option<string>): boolean =>
  O.match(gist, {
    onNone: () => true,
    onSome: (name) => O.exists(key, (cls) => HashSet.has(gistAncestors(vocabulary, cls), name))
  })

const domainCheck = (
  vocabulary: Vocabulary,
  kind: TermKind,
  key: string,
  domain: O.Option<string>,
  gist: GistProperty
): ReadonlyArray<Finding> =>
  domainFits(vocabulary, domain, gist.domain)
    ? []
    : [finding("C9", kind, key, "Its domain does not fall under the domain of the gist property it sits under.")]

/**
 * C9 (decision 16): a gist property's declared domain and class range are gist classes on the gist list, reported at
 * the gist property, as C6 reports a disjoint pair's name; a property's gist parent is a gist property of its own kind
 * on the gist list, and the property's domain and range fall under that gist property's. A domain falls under a gist
 * class its class reaches through its parents, category parents included; a scheme range falls under no gist class,
 * since concepts are typed by SKOS only (decision 17); a datatype falls under the same datatype only. A gist property
 * that declares no domain or range accepts any. A gist property no property sits under is not refused, as C5 refuses
 * no gist class that no class reaches.
 */
const c9 = (vocabulary: Vocabulary): ReadonlyArray<Finding> => {
  const parentOf = (name: string): O.Option<GistProperty> => R.get(vocabulary.gist.properties, name)
  const missing = (kind: TermKind, key: string, name: string): Finding =>
    finding("C9", kind, key, `Its gist parent ${name} is not on the gist list.`)
  const onList = (name: string, part: string, declared: O.Option<string>): ReadonlyArray<Finding> =>
    O.match(declared, {
      onNone: () => [],
      onSome: (cls) =>
        R.has(vocabulary.gist.classes, cls)
          ? []
          : [finding("C9", "gist", name, `Its ${part} ${cls} is not on the gist list.`)]
    })
  return [
    ...A.flatMap(R.toEntries(vocabulary.gist.properties), ([name, gist]) => [
      ...onList(name, "domain", gist.domain),
      ...GistProperty.match(gist, {
        object: (relation) => onList(name, "range", relation.range),
        datatype: () => []
      })
    ]),
    ...A.flatMap(R.toEntries(vocabulary.objectProperties), ([key, term]) =>
      O.match(term.subPropertyOf, {
        onNone: () => [],
        onSome: ({ name }) =>
          O.match(parentOf(name), {
            onNone: () => [missing("objectProperty", key, name)],
            onSome: (gist) =>
              GistProperty.match(gist, {
                datatype: () => [
                  finding("C9", "objectProperty", key, `It is a relation and its gist parent ${name} an attribute.`)
                ],
                object: (relation) => [
                  ...domainCheck(vocabulary, "objectProperty", key, term.domain, relation),
                  ...(RangeTarget.match(term.range, {
                    class: (range) => domainFits(vocabulary, O.some(range.key), relation.range),
                    scheme: () => O.isNone(relation.range)
                  })
                    ? []
                    : [
                        finding(
                          "C9",
                          "objectProperty",
                          key,
                          `Its range does not fall under the range of its gist parent ${name}.`
                        )
                      ])
                ]
              })
          })
      })
    ),
    ...A.flatMap(R.toEntries(vocabulary.datatypeProperties), ([key, term]) =>
      O.match(term.subPropertyOf, {
        onNone: () => [],
        onSome: ({ name }) =>
          O.match(parentOf(name), {
            onNone: () => [missing("datatypeProperty", key, name)],
            onSome: (gist) =>
              GistProperty.match(gist, {
                object: () => [
                  finding("C9", "datatypeProperty", key, `It is an attribute and its gist parent ${name} a relation.`)
                ],
                datatype: (attribute) => [
                  ...domainCheck(vocabulary, "datatypeProperty", key, term.domain, attribute),
                  ...(O.match(attribute.range, { onNone: () => true, onSome: (datatype) => datatype === term.datatype })
                    ? []
                    : [
                        finding(
                          "C9",
                          "datatypeProperty",
                          key,
                          `Its datatype is not the datatype of its gist parent ${name}.`
                        )
                      ])
                ]
              })
          })
      })
    )
  ]
}

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

const isCategory = (vocabulary: Vocabulary, key: string): boolean =>
  O.exists(R.get(vocabulary.classes, key), (term) => term.tag === "category")

/**
 * C14 (decision 12): a category parent is a class tagged category, named once; and a category is never a class's one
 * identity-bearing parent, since it supplies no identity criterion to inherit. A category parent that is no class at
 * all is C3's.
 */
const c14 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) => [
    ...A.flatMap(term.categoryParents, (category, index) => [
      ...(R.has(vocabulary.classes, category) && !isCategory(vocabulary, category)
        ? [finding("C14", "class", key, `Its category parent ${category} is not tagged category.`)]
        : []),
      ...(A.contains(A.take(term.categoryParents, index), category)
        ? [finding("C14", "class", key, `It names the category parent ${category} twice.`)]
        : [])
    ]),
    ...O.match(localParentKey(term), {
      onNone: () => [],
      onSome: (parent) =>
        isCategory(vocabulary, parent)
          ? [finding("C14", "class", key, `Its one parent ${parent} is a category, which supplies no identity.`)]
          : []
    })
  ])

type Retirable = { readonly deprecation: O.Option<Deprecation> }

const successorOf =
  <T extends Retirable>(table: Readonly<Record<string, T>>) =>
  (key: string): ReadonlyArray<string> =>
    A.fromOption(
      O.flatMap(
        O.flatMap(R.get(table, key), (term) => term.deprecation),
        (retired) => (Deprecation.guards.replaced(retired) ? O.some(retired.replacedBy) : O.none())
      )
    )

/** The retirement findings of one table: a successor of the same table, no cycle of successors, a version not ahead. */
const retirements = <T extends Retirable>(
  vocabulary: Vocabulary,
  kind: TermKind,
  table: Readonly<Record<string, T>>,
  keyOf: (key: string) => string
): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(table), ([key, term]) =>
    O.match(term.deprecation, {
      onNone: () => [],
      onSome: (retired) => [
        ...(SemVer.isGreaterThan(retired.since, vocabulary.version)
          ? [
              finding(
                "C15",
                kind,
                keyOf(key),
                `It is retired from ${SemVer.format(retired.since)}, after the vocabulary's ${SemVer.format(vocabulary.version)}.`
              )
            ]
          : []),
        ...Deprecation.match(retired, {
          withdrawn: () => [],
          replaced: ({ replacedBy }) =>
            !R.has(table, replacedBy)
              ? [finding("C15", kind, keyOf(key), `Its successor ${replacedBy} is not a term of the same table.`)]
              : HashSet.has(reached(key, successorOf(table)), key)
                ? [finding("C15", kind, keyOf(key), "Its chain of successors comes back to it.")]
                : []
        })
      ]
    })
  )

const isRetired = <T extends Retirable>(table: Readonly<Record<string, T>>, key: string): boolean =>
  O.exists(R.get(table, key), (term) => O.isSome(term.deprecation))

/** One finding when a live term's link names a retired term of the table: decision 33 drops the retired term's axioms. */
const liveLink = <T extends Retirable>(
  kind: TermKind,
  key: string,
  link: string,
  table: Readonly<Record<string, T>>,
  target: string
): ReadonlyArray<Finding> =>
  isRetired(table, target)
    ? [finding("C15", kind, key, `Its ${link} ${target} is retired; retarget the link or retire the term.`)]
    : []

/**
 * C15 (decision 33, report 05's V14): a retired term's successor is a term of its own table (a concept's, a notation of
 * its scheme), the successors form no cycle, and its retirement is not dated after the vocabulary's version. A
 * successor may itself retire later: the earlier edge stays the fact of that retirement. A live class's parent and
 * category parents, and a live property's domain and range, name no retired term.
 */
const c15 = (vocabulary: Vocabulary): ReadonlyArray<Finding> => {
  const { classes, datatypeProperties, objectProperties, schemes } = vocabulary
  const live = <T extends Retirable>(table: Readonly<Record<string, T>>): ReadonlyArray<readonly [string, T]> =>
    A.filter(R.toEntries(table), ([, term]) => O.isNone(term.deprecation))
  const same = (key: string): string => key
  return [
    ...retirements(vocabulary, "class", classes, same),
    ...retirements(vocabulary, "objectProperty", objectProperties, same),
    ...retirements(vocabulary, "datatypeProperty", datatypeProperties, same),
    ...retirements(vocabulary, "scheme", schemes, same),
    ...A.flatMap(R.toEntries(schemes), ([schemeKey, scheme]) =>
      retirements(vocabulary, "concept", scheme.concepts, (notation) => `${schemeKey}-${notation}`)
    ),
    ...A.flatMap(live(classes), ([key, term]) => [
      ...A.flatMap(A.fromOption(localParentKey(term)), (parent) => liveLink("class", key, "parent", classes, parent)),
      ...A.flatMap(term.categoryParents, (category) => liveLink("class", key, "category parent", classes, category))
    ]),
    ...A.flatMap(live(objectProperties), ([key, term]) => [
      ...A.flatMap(A.fromOption(term.domain), (domain) => liveLink("objectProperty", key, "domain", classes, domain)),
      ...RangeTarget.match(term.range, {
        class: (range) => liveLink("objectProperty", key, "range", classes, range.key),
        scheme: (range) => liveLink("objectProperty", key, "range", schemes, range.key)
      })
    ]),
    ...A.flatMap(live(datatypeProperties), ([key, term]) =>
      A.flatMap(A.fromOption(term.domain), (domain) => liveLink("datatypeProperty", key, "domain", classes, domain))
    )
  ]
}

/** The properties a class's stated criterion rests on; none for an inherited criterion or a class with none. */
const basisOf = (term: ClassTerm): ReadonlyArray<string> =>
  O.match(term.identity, {
    onNone: () => [],
    onSome: (identity) =>
      IdentityCriterion.match(identity, {
        stated: (stated) => stated.restsOn,
        inherited: () => []
      })
  })

/** A property's designation, a relation's or an attribute's: none when the vocabulary has no property of that key. */
const designationOf = (vocabulary: Vocabulary, key: string): O.Option<O.Option<Designation>> =>
  O.orElse(
    O.map(R.get(vocabulary.objectProperties, key), (term) => term.designation),
    () => O.map(R.get(vocabulary.datatypeProperties, key), (term) => term.designation)
  )

/**
 * C16 (decision 146, report 05's V18): a stated identity criterion rests only on properties of the vocabulary, and on
 * none whose values are a name or an email, since two parties may share a name and one may change its address (report
 * 04's CQ-I08). Only the basis the criterion states is read, never its sentence, so a criterion whose basis is left
 * empty passes; report 05's review list of sentences is not kept here.
 */
const c16 = (vocabulary: Vocabulary): ReadonlyArray<Finding> =>
  A.flatMap(R.toEntries(vocabulary.classes), ([key, term]) =>
    A.flatMap(basisOf(term), (property) =>
      O.match(designationOf(vocabulary, property), {
        onNone: () => [
          finding(
            "C16",
            "class",
            key,
            `Its identity criterion rests on ${property}, which is not a property of the vocabulary.`
          )
        ],
        onSome: (designation) =>
          O.match(designation, {
            onNone: () => [],
            onSome: (label) => [
              finding(
                "C16",
                "class",
                key,
                `Its identity criterion rests on ${property}, whose values are ${Designation.match(label, {
                  name: () => "a name",
                  email: () => "an email address"
                })}, which tells nothing apart.`
              )
            ]
          })
      })
    )
  )

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
    ...c9(vocabulary),
    ...c10(vocabulary),
    ...c11(vocabulary),
    ...c12(vocabulary, exceptions, decisions),
    ...c13(vocabulary),
    ...c14(vocabulary),
    ...c15(vocabulary),
    ...c16(vocabulary)
  ]
}
