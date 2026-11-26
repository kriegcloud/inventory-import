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

/** Every term the vocabulary holds, by its key, with the decision it names: classes, properties, schemes, concepts. */
const termRatifications = (decoded: Vocabulary): ReadonlyArray<readonly [string, number]> => [
  ...A.map(R.toEntries(decoded.classes), ([key, term]) => [key, term.ratification.decision] as const),
  ...A.map(R.toEntries(decoded.objectProperties), ([key, term]) => [key, term.ratification.decision] as const),
  ...A.map(R.toEntries(decoded.datatypeProperties), ([key, term]) => [key, term.ratification.decision] as const),
  ...A.flatMap(R.toEntries(decoded.schemes), ([key, scheme]) => [
    [key, scheme.ratification.decision] as const,
    ...A.map(R.toEntries(scheme.concepts), ([notation, concept]) => [notation, concept.ratification.decision] as const)
  ])
]

/** Every decision number the vocabulary's terms name: classes, properties, schemes and concepts. */
const termDecisions = (decoded: Vocabulary): ReadonlyArray<number> =>
  A.map(termRatifications(decoded), ([, decision]) => decision)

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

  // Decision 129 with 176: each new term and Party's exception entry name the accepting decision, and the thread's 20
  // other terms keep 111, Person, Organization and grantScope among them, whose new links change no text of theirs.
  // Member's text changed in step 11 (report 18 section 3.2) and membershipIn's in step 12 (decision 169, report 18
  // section 4.4), so both name 176 now.
  it.effect(
    "the thread's 20 other terms name decision 111, the slice's ninety-six name 176, and so does Party's exception entry",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodeVocabulary(vocabulary)
        const exceptions = yield* decodeExceptions(exceptionFile)
        const named176 = A.filter(termRatifications(decoded), ([, decision]) => decision === 176)
        const named111 = A.filter(termRatifications(decoded), ([, decision]) => decision === 111)
        expect(A.map(named176, ([key]) => key)).toStrictEqual([
          "Member",
          "Party",
          "SourceRecord",
          "IdentityDecision",
          "IdentityEvidence",
          "AgentRun",
          "ModelCall",
          "SignInAccount",
          "PostalAddress",
          "ContactPoint",
          "ContactAssignment",
          "membershipIn",
          "recordOf",
          "decidesOn",
          "identityOutcome",
          "decidedBy",
          "citesEvidence",
          "membershipStatus",
          "memberAccount",
          "recordedAgentRun",
          "maxRole",
          "callPurpose",
          "calledFor",
          "hasPostalAddress",
          "addressPurpose",
          "defaultFor",
          "hasContactPoint",
          "contactPointKind",
          "contactPerson",
          "contactAccount",
          "assignmentPoint",
          "servesPurpose",
          "contactAt",
          "contactType",
          "contactOwner",
          "primaryContact",
          "accountStatus",
          "membershipWorkspace",
          "memberContactPoint",
          "sourceSystem",
          "sourceType",
          "sourceId",
          "capturedAt",
          "isCustomer",
          "isVendor",
          "eventTime",
          "evidenceText",
          "joinedAt",
          "accountEmail",
          "name",
          "agentName",
          "calledAt",
          "addressLines",
          "locality",
          "region",
          "postalCode",
          "countryCode",
          "contactValue",
          "extension",
          "givenName",
          "middleName",
          "familyName",
          "jobTitle",
          "profileImage",
          "profileText",
          "IdentityOutcomeScheme",
          "sameParty",
          "differentParties",
          "MembershipStatusScheme",
          "pending",
          "active",
          "suspended",
          "revoked",
          "ModelCallPurposeScheme",
          "view",
          "check",
          "suggest",
          "ContactPurposeScheme",
          "billing",
          "shipping",
          "receiving",
          "ordering",
          "ship_from",
          "manufacturing",
          "other",
          "ContactPointKindScheme",
          "email",
          "phone",
          "ContactTypeScheme",
          "customer",
          "marketing",
          "sales",
          "vendor",
          "AccountStatusScheme",
          "active",
          "archived"
        ])
        expect(named111).toHaveLength(20)
        expect(A.map(named111, ([key]) => key)).toEqual(
          expect.arrayContaining(["Person", "Organization", "grantScope"])
        )
        expect(termRatifications(decoded)).toHaveLength(116)
        expect(A.map(exceptions, (entry) => [entry.class, entry.ratification.decision])).toEqual([
          ["Role", 97],
          ["Party", 176]
        ])
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

  // Report 18 section 4.2: eventTime passes C9 because gist:atDateTime declares no domain and the range xsd:dateTime,
  // eventTime's datatype; the kernel's literal above is the near miss.
  it.effect("reports exactly C9 on eventTime when atDateTime declares another range, or leaves the gist list", () =>
    Effect.gen(function* () {
      const exceptions = yield* decodeExceptions(exceptionFile)
      const { atDateTime, ...others } = vocabulary.gist.properties
      const ranged = yield* decodeVocabulary({
        ...vocabulary,
        gist: { ...vocabulary.gist, properties: { ...others, atDateTime: { ...atDateTime, range: "xsd:string" } } }
      })
      const unlisted = yield* decodeVocabulary({ ...vocabulary, gist: { ...vocabulary.gist, properties: others } })
      expect(named(coherenceFindings({ vocabulary: ranged, exceptions, decisions }))).toEqual([
        ["C9", "datatypeProperty", "eventTime"]
      ])
      expect(named(coherenceFindings({ vocabulary: unlisted, exceptions, decisions }))).toEqual([
        ["C9", "datatypeProperty", "eventTime"]
      ])
    })
  )

  // Report 18 sections 4.1 and 8 (decisions 166 and 174): the three address links pass C9 because gist:hasAddress
  // declares no domain and the range gist:Address, which PostalAddress and ContactPoint reach through their gist
  // parents; the kernel's literal above is the near miss. Given the range gist:Event, or taken off the list, each fails.
  it.effect(
    "reports exactly C9 on the three address links when hasAddress declares another range, or leaves the list",
    () =>
      Effect.gen(function* () {
        const exceptions = yield* decodeExceptions(exceptionFile)
        const { hasAddress, ...others } = vocabulary.gist.properties
        const ranged = yield* decodeVocabulary({
          ...vocabulary,
          gist: { ...vocabulary.gist, properties: { ...others, hasAddress: { ...hasAddress, range: "Event" } } }
        })
        const unlisted = yield* decodeVocabulary({ ...vocabulary, gist: { ...vocabulary.gist, properties: others } })
        const links = [
          ["C9", "objectProperty", "hasPostalAddress"],
          ["C9", "objectProperty", "hasContactPoint"],
          ["C9", "objectProperty", "memberContactPoint"]
        ]
        expect(named(coherenceFindings({ vocabulary: ranged, exceptions, decisions }))).toEqual(links)
        expect(named(coherenceFindings({ vocabulary: unlisted, exceptions, decisions }))).toEqual(links)
      })
  )

  it.effect(
    "near miss: a copy holding a category, retired terms and gist sub-properties, with Party's entry, passes",
    () =>
      Effect.gen(function* () {
        const decoded = yield* decodeVocabulary(constructsVocabulary)
        const exceptions = yield* decodeExceptions(constructsExceptions)
        expect(coherenceFindings({ vocabulary: decoded, exceptions, decisions })).toEqual([])
        // The copy's own terms name decisions 12, 33 and 35, each a heading of the real log (rule C12), beside the
        // kernel's 111 and 176.
        expect(A.dedupe(termDecisions(decoded))).toEqual([111, 176, 12, 33, 35])
      })
  )

  it.effect(
    "reports exactly C4 on Party when the copy is read with the committed list, whose entry gives another reason",
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

  it.effect("reports exactly C9 on every relation and attribute under a gist property that leaves the gist list", () =>
    Effect.gen(function* () {
      const planted = {
        ...constructsVocabulary,
        gist: {
          ...constructsVocabulary.gist,
          properties: {
            isAbout: constructsVocabulary.gist.properties.isAbout,
            atDateTime: constructsVocabulary.gist.properties.atDateTime,
            plantedAttribute: constructsVocabulary.gist.properties.plantedAttribute,
            hasAddress: constructsVocabulary.gist.properties.hasAddress
          }
        }
      }
      const found = yield* findingsOfCopy(planted)
      // The retired relation is held to its gist parent too: C9 reads every property, live or retired. The kernel's
      // identityOutcome, membershipStatus, callPurpose, addressPurpose, contactPointKind, servesPurpose, contactType and
      // accountStatus sit under isCategorizedBy too, and name under gist's name (decision 176); eventTime keeps
      // atDateTime on the list, and the three address links hasAddress.
      expect(found).toEqual([
        ["C9", "objectProperty", "grantScope"],
        ["C9", "objectProperty", "identityOutcome"],
        ["C9", "objectProperty", "membershipStatus"],
        ["C9", "objectProperty", "callPurpose"],
        ["C9", "objectProperty", "addressPurpose"],
        ["C9", "objectProperty", "contactPointKind"],
        ["C9", "objectProperty", "servesPurpose"],
        ["C9", "objectProperty", "contactType"],
        ["C9", "objectProperty", "accountStatus"],
        ["C9", "objectProperty", "workspaceMembership"],
        ["C9", "datatypeProperty", "name"]
      ])
    })
  )
})

// V18 (decision 146) on the kernel's terms: CQ-I08 asks what tells two records of a class apart, and C16 holds that
// the properties a criterion rests on are the vocabulary's and that none of them is a name or an email. The kernel
// states `restsOn` for Member and ModelCall (report 18), so these copies add it for AuditEntry and Grant, and plant the
// kernel's own `name` (report 18 section 5, under gist's `name`, a designation) under Organization's criterion.
const { classes } = constructsVocabulary

/** The copy with Member, AuditEntry and Grant each resting on the relation that holds it to the others. */
const restingOn = {
  ...constructsVocabulary,
  classes: {
    ...classes,
    Member: { ...classes.Member, identity: { ...classes.Member.identity, restsOn: ["membershipIn"] } },
    AuditEntry: { ...classes.AuditEntry, identity: { ...classes.AuditEntry.identity, restsOn: ["inTenant"] } },
    Grant: { ...classes.Grant, identity: { ...classes.Grant.identity, restsOn: ["grantedTo"] } }
  }
}

describe("gate 4, what a criterion rests on (CQ-I08, V18)", () => {
  it.effect("near miss: Member on membershipIn, AuditEntry on inTenant and Grant on grantedTo give no finding", () =>
    Effect.gen(function* () {
      const found = yield* findingsOfCopy(restingOn)
      expect(found).toEqual([])
    })
  )

  it.effect("reports exactly C16 on Organization when its criterion rests on its name", () =>
    Effect.gen(function* () {
      const planted = {
        ...restingOn,
        classes: {
          ...restingOn.classes,
          Organization: { ...classes.Organization, identity: { ...classes.Organization.identity, restsOn: ["name"] } }
        }
      }
      const found = yield* findingsOfCopy(planted)
      expect(found).toEqual([["C16", "class", "Organization"]])
    })
  )
})
