// Gate 4, vocabulary coherence (report 14 section 6.4): the kernel's vocabulary literal, decoded strictly, the
// committed exception list and the decision log's headings give no finding. The gate reads the three real inputs,
// never copies of them: the literal from `@inventory/kernel/Terms`, the list from `exceptions/no-gist-parent.json`
// and `explorations/erp-ontology/DECISIONS.md` as text. The log lives outside this package, so `turbo.json` names it
// among the test's inputs; an edit to any of the three runs this file again.
//
// The planted mistake and the C12 negative are copies of the literal made in the test: no committed input changes.
// So are the party slice's constructs (PLAN, step 2): a copy of the literal holding each of them, with a copy of the
// list that adds `Party`'s entry, read beside the real log, and that copy with one mistake planted per new rule.
import { describe, expect, it } from "@effect/vitest"
import { Vocabulary } from "@beep/vocabulary/Model"
import { coherenceFindings, decisionHeadings, ExceptionList, type Finding } from "@beep/vocabulary/Rules"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { vocabulary } from "@inventory/kernel/Terms"
import decisionLog from "../../../explorations/erp-ontology/DECISIONS.md?raw"
import exceptionFile from "../exceptions/no-gist-parent.json" with { type: "json" }
import { constructsExceptions, constructsVocabulary } from "./support/constructs.ts"

const strict = { onExcessProperty: "error", errors: "all" } as const
const decodeVocabulary = S.decodeUnknownEffect(Vocabulary, strict)
const decodeExceptions = S.decodeUnknownEffect(ExceptionList, strict)

const decisions = decisionHeadings(decisionLog)

/** A finding as the rule, the table and the key it names, so a changed sentence does not fail the gate's test. */
const named = (findings: ReadonlyArray<Finding>) => A.map(findings, (found) => [found.rule, found.kind, found.key])

/** Every decision number the vocabulary's terms name: classes, properties, schemes and concepts, 22 in the thread. */
const termDecisions = (decoded: Vocabulary): ReadonlyArray<number> => [
  ...A.map(R.values(decoded.classes), (term) => term.ratification.decision),
  ...A.map(R.values(decoded.objectProperties), (term) => term.ratification.decision),
  ...A.map(R.values(decoded.datatypeProperties), (term) => term.ratification.decision),
  ...A.flatMap(R.values(decoded.schemes), (scheme) => [
    scheme.ratification.decision,
    ...A.map(R.values(scheme.concepts), (concept) => concept.ratification.decision)
  ])
]

/** Gate 4 on a copy of the constructs' literal, read with the copied list and the real log. */
const findingsOfCopy = Effect.fn("findingsOfCopy")(function* (copy: unknown) {
  const decoded = yield* decodeVocabulary(copy)
  const exceptions = yield* decodeExceptions(constructsExceptions)
  return named(coherenceFindings({ vocabulary: decoded, exceptions, decisions }))
})

describe("gate 4, vocabulary coherence", () => {
  it.effect("finds nothing in the kernel's vocabulary, the committed exception list and the decision log", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(vocabulary)
      const exceptions = yield* decodeExceptions(exceptionFile)
      expect(coherenceFindings({ vocabulary: decoded, exceptions, decisions })).toEqual([])
    })
  )

  it.effect("all 22 terms name decision 111, and the one exception entry, Role, names decision 97", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(vocabulary)
      const exceptions = yield* decodeExceptions(exceptionFile)
      const numbers = termDecisions(decoded)
      expect(numbers).toHaveLength(22)
      expect(A.dedupe(numbers)).toEqual([111])
      expect(A.map(exceptions, (entry) => [entry.class, entry.ratification.decision])).toEqual([["Role", 97]])
    })
  )

  // The literal states gist's release twice, as a number and inside the IRI the OWL file names as its source. No rule
  // of the gate compares them, and only the IRI is written, so a number moved alone would go unseen.
  it("gist's version IRI is the release the vocabulary says it projects", () => {
    expect(vocabulary.gist.versionIri).toBe(`https://w3id.org/semanticarts/ontology/gistCore${vocabulary.gist.version}`)
  })

  // Section 6.4's planted mistake: `none` is a legal parent, so the copy decodes, and only C4 can see that no entry
  // of the list allows it. The reason is held to a definition's length, so it is longer than the report's "planted".
  it.effect("reports exactly C4 on Grant when a copy gives Grant no parent and the list no entry", () =>
    Effect.gen(function* () {
      const planted = {
        ...vocabulary,
        classes: {
          ...vocabulary.classes,
          Grant: { ...vocabulary.classes.Grant, parent: { kind: "none", reason: "A planted parentless class." } }
        }
      }
      const decoded = yield* decodeVocabulary(planted)
      const exceptions = yield* decodeExceptions(exceptionFile)
      expect(named(coherenceFindings({ vocabulary: decoded, exceptions, decisions }))).toEqual([
        ["C4", "class", "Grant"]
      ])
    })
  )

  // The C12 negative: decision 999 has no heading in the real log, which is read unchanged.
  it.effect("reports exactly C12 on Member when a copy names decision 999", () =>
    Effect.gen(function* () {
      const unanswered = {
        ...vocabulary,
        classes: {
          ...vocabulary.classes,
          Member: { ...vocabulary.classes.Member, ratification: { decision: 999 } }
        }
      }
      const decoded = yield* decodeVocabulary(unanswered)
      const exceptions = yield* decodeExceptions(exceptionFile)
      expect(named(coherenceFindings({ vocabulary: decoded, exceptions, decisions }))).toEqual([
        ["C12", "class", "Member"]
      ])
    })
  )

  it.effect(
    "near miss: a copy holding a category, retired terms and gist sub-properties, with Party's entry, passes",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodeVocabulary(constructsVocabulary)
        const exceptions = yield* decodeExceptions(constructsExceptions)
        expect(coherenceFindings({ vocabulary: decoded, exceptions, decisions })).toEqual([])
        // The copy's new terms name decisions 12, 33 and 35, each a heading of the real log (rule C12).
        expect(A.dedupe(termDecisions(decoded))).toEqual([111, 12, 33, 35])
      })
  )

  it.effect(
    "reports exactly C4 on Party when the copy is read with the committed list, which has no entry for it",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodeVocabulary(constructsVocabulary)
        const exceptions = yield* decodeExceptions(exceptionFile)
        expect(named(coherenceFindings({ vocabulary: decoded, exceptions, decisions }))).toEqual([
          ["C4", "class", "Party"]
        ])
      })
  )

  it.effect("reports exactly C7 on Party when the category states an identity criterion", () =>
    Effect.gen(function* () {
      const planted = {
        ...constructsVocabulary,
        classes: {
          ...constructsVocabulary.classes,
          Party: {
            ...constructsVocabulary.classes.Party,
            identity: { kind: "stated", criterion: "the person or the organization it is." }
          }
        }
      }
      const found = yield* findingsOfCopy(planted)
      expect(found).toEqual([["C7", "class", "Party"]])
    })
  )

  it.effect("reports exactly C14 on Person when its category parent is Tenant, which is no category", () =>
    Effect.gen(function* () {
      const planted = {
        ...constructsVocabulary,
        classes: {
          ...constructsVocabulary.classes,
          Person: { ...constructsVocabulary.classes.Person, categoryParents: ["Tenant"] }
        }
      }
      const found = yield* findingsOfCopy(planted)
      expect(found).toEqual([["C14", "class", "Person"]])
    })
  )

  it.effect("reports exactly C15 on Workspace when its successor is no class", () =>
    Effect.gen(function* () {
      const planted = {
        ...constructsVocabulary,
        classes: {
          ...constructsVocabulary.classes,
          Workspace: {
            ...constructsVocabulary.classes.Workspace,
            deprecation: { kind: "replaced", replacedBy: "membershipIn", since: vocabulary.version }
          }
        }
      }
      const found = yield* findingsOfCopy(planted)
      expect(found).toEqual([["C15", "class", "Workspace"]])
    })
  )

  it.effect("reports exactly C9 on the two relations under a gist property that leaves the gist list", () =>
    Effect.gen(function* () {
      const planted = {
        ...constructsVocabulary,
        gist: {
          ...constructsVocabulary.gist,
          properties: { plantedAttribute: constructsVocabulary.gist.properties.plantedAttribute }
        }
      }
      const found = yield* findingsOfCopy(planted)
      // The retired relation is held to its gist parent too: C9 reads every property, live or retired.
      expect(found).toEqual([
        ["C9", "objectProperty", "grantScope"],
        ["C9", "objectProperty", "workspaceMembership"]
      ])
    })
  )
})
