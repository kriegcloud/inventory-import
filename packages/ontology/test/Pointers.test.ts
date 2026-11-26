// Gate 5, record pointers on the AST (report 14 section 6.5): the committed `enrolment.json`, decoded strictly, the
// schemas `src/Enrolled.ts` maps it to and the kernel's vocabulary give no finding of P1 to P14. The gate reads the
// real records, never copies: the marks are read from their ASTs through `@beep/vocabulary/Pointer`'s reader.
//
// P13's table states section 3's placements (3.3, 3.5, 3.6), eighteen rows, each mark built with the kernel's helper
// that writes it and turned into a reading by the same reader, so no annotation key is written here by hand.
//
// Each negative hands the gate one planted input in place of a real one, and the table's rows for a planted field are
// the plant's own marks, so the negative names its rule alone. The two the report specifies (the unmarked `name`,
// and the swapped `Activity` properties) are kept as it writes them.
//
// The party slice's step 3 runs the gate on step 2's in-memory copy (`support/constructs.ts`) and on copies of it:
// a category walk through `Party` (decision 12), and P14, a pointer at a retired term (report 05's V14, decision 33),
// with a retired notation of a live scheme still passing P8 (V12). Its planted records point at the copy's terms
// through helpers bound to the copy's own keys, so a misspelt name is a type error here too.
import { describe, expect, it } from "@effect/vitest"
import type { Curie } from "@beep/identity/Vocab"
import { Vocabulary } from "@beep/vocabulary/Model"
import { noTermFor, pathFor, pointerFor, readKeyMark, type LiftPath, type PathMark } from "@beep/vocabulary/Pointer"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Model from "effect/schema/Model"
import { Activity } from "@inventory/kernel/Activity"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import { vocabulary } from "@inventory/kernel/Terms"
import { aboutClass, aboutPath, aboutProperty, aboutScheme, noTerm } from "@inventory/kernel/TermsPointer"
import { DisplayName } from "@inventory/kernel/Text"
import enrolmentFile from "../enrolment.json" with { type: "json" }
import { enrolled, variants } from "../src/Enrolled.ts"
import { Enrolment, Placement, pointerFindings, type PointerFinding, type PointerInput } from "../src/Pointers.rules.ts"
import { constructsVocabulary } from "./support/constructs.ts"

const strict = { onExcessProperty: "error", errors: "all" } as const
const decodeVocabulary = S.decodeUnknownEffect(Vocabulary, strict)
const decodeEnrolment = S.decodeUnknownEffect(Enrolment, strict)

const member = "packages/kernel/src/Member.schema.ts#Member"
const role = "packages/kernel/src/Role.schema.ts#Role"
const activity = "packages/kernel/src/Activity.schema.ts#Activity"
const person = "packages/access/contract/src/People/Person.read.ts#Person"
const auditTrail = "packages/access/contract/src/Activity/AuditTrail.read.ts#AuditTrail"

/** A mark as the reader reads it in a field's key annotations: the helper's object, put on a throwaway schema. */
const reading = (mark: S.Annotations.Key<string>) => readKeyMark(S.String.annotateKey(mark).ast)

const roleGrant = aboutPath([
  {
    property: "inv:grantedTo",
    reverse: true,
    node: "inv:Grant",
    fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }]
  },
  { property: "inv:grantsRole" }
])

/** Report 14 sections 3.3, 3.5 and 3.6: record, field, mark. Eighteen rows. */
const table: ReadonlyArray<readonly [string, string, S.Annotations.Key<string>]> = [
  [member, "id", aboutClass("inv:Member")],
  [member, "name", noTerm("screen")],
  [member, "role", roleGrant],
  [member, "organizationId", aboutProperty("inv:membershipIn")],
  [member, "organizationName", noTerm("screen")],
  [activity, "id", aboutClass("inv:AuditEntry")],
  [activity, "organizationId", aboutProperty("inv:inTenant")],
  [activity, "actorId", aboutProperty("inv:recordedActor")],
  [activity, "actorName", noTerm("screen")],
  [activity, "action", aboutProperty("inv:action")],
  [activity, "detail", noTerm("screen")],
  [activity, "agent", noTerm("deferred", "party")],
  [activity, "createdAt", aboutProperty("inv:recordedAt")],
  [person, "memberId", aboutClass("inv:Member")],
  [person, "name", noTerm("screen")],
  [person, "role", roleGrant],
  [person, "email", noTerm("deferred", "party")],
  [person, "joinedAt", noTerm("deferred", "party")]
]

const placements = A.map(table, ([entry, field, mark]) => Placement.make({ entry, field, mark: reading(mark) }))

/** The table with one row's mark replaced: a planted field is held to the plant's own mark. */
const placedAs = (entry: string, field: string, mark: S.Annotations.Key<string>): ReadonlyArray<Placement> =>
  A.map(placements, (row) =>
    row.entry === entry && row.field === field ? Placement.make({ entry, field, mark: reading(mark) }) : row
  )

/** A finding as its rule, entry and field, so a changed sentence does not fail the gate's test. */
const named = (findings: ReadonlyArray<PointerFinding>) =>
  A.map(findings, (found) => [found.rule, found.entry, O.match(found.field, { onNone: () => "", onSome: identity })])

/** The real inputs, decoded; a negative overrides one of them. */
const gate = Effect.fn("gate")(function* (overrides: Partial<PointerInput>) {
  const decoded = yield* decodeVocabulary(vocabulary)
  const enrolment = yield* decodeEnrolment(enrolmentFile)
  return named(
    pointerFindings({
      vocabulary: decoded,
      prefix: "inv",
      tenant: "Tenant",
      slices: ["party"],
      enrolment,
      enrolled,
      variants,
      placements,
      ...overrides
    })
  )
})

/** `Member`'s fields with one replaced, pointed at `inv:Member`: a struct handed to the gate in `Member`'s place. */
const memberWith = (fields: Partial<typeof Member.fields>) =>
  S.Struct({ ...Member.fields, ...fields }).pipe(S.annotate(aboutClass("inv:Member")))

/** A class's six variants as Enrolled.ts maps them. */
const sixOf = <C extends Record<"select" | "insert" | "update" | "json" | "jsonCreate" | "jsonUpdate", S.Top>>(
  model: C
) => ({
  select: model.select,
  insert: model.insert,
  update: model.update,
  json: model.json,
  jsonCreate: model.jsonCreate,
  jsonUpdate: model.jsonUpdate
})

/** Section 6.5's P13 plant as a class: Activity's fields with the tenant and actor properties swapped. */
class Swapped extends Model.Class<Swapped>("Swapped")(
  {
    ...Activity.fields,
    organizationId: OrganizationId.pipe(S.annotateKey(aboutProperty("inv:recordedActor"))),
    actorId: MemberId.pipe(S.annotateKey(aboutProperty("inv:inTenant")))
  },
  { description: "Activity with two marks swapped", ...aboutClass("inv:AuditEntry") }
) {}

/** Activity's fields with createdAt marked on its select variant only: the other variants lose the mark. */
class Uneven extends Model.Class<Uneven>("Uneven")(
  {
    ...Activity.fields,
    createdAt: Model.fieldEvolve(Model.DateTimeInsert, {
      select: (s) => s.annotateKey(aboutProperty("inv:recordedAt"))
    })
  },
  { description: "Activity with createdAt marked on one variant", ...aboutClass("inv:AuditEntry") }
) {}

describe("gate 5, record pointers", () => {
  it.effect("finds nothing in the five enrolled exports, the committed enrolment list and the vocabulary", () =>
    Effect.gen(function* () {
      const found = yield* gate({})
      expect(found).toEqual([])
    })
  )

  it.effect("reads enrolment.json as the five entries of section 3.7, and Enrolled.ts maps the same five", () =>
    Effect.gen(function* () {
      const enrolment = yield* decodeEnrolment(enrolmentFile)
      const keys = A.map(enrolment, (entry) => `${entry.file}#${entry.export}`)
      expect(keys).toEqual([member, role, activity, person, auditTrail])
      expect(A.map(enrolment, (entry) => entry.as)).toEqual(["record", "scheme", "record", "record", "collection"])
    })
  )

  it("states eighteen placements, every field of the three records once", () => {
    expect(placements).toHaveLength(18)
    expect(A.dedupe(A.map(placements, (row) => `${row.entry}#${row.field}`))).toHaveLength(18)
  })
})

describe("gate 5's negatives, one rule each", () => {
  it.effect("P1: Enrolled.ts leaves out an export enrolment.json lists", () =>
    Effect.gen(function* () {
      const { [person]: _left, ...rest } = enrolled
      const found = yield* gate({ enrolled: rest })
      expect(found).toEqual([["P1", person, ""]])
    })
  )

  it.effect("P2: a union of literals in Role's place points at no scheme", () =>
    Effect.gen(function* () {
      const unpointed = S.Literals(["viewer", "editor", "admin"])
      const found = yield* gate({ enrolled: { ...enrolled, [role]: unpointed } })
      expect(found).toEqual([["P2", role, ""]])
    })
  )

  it.effect("P3, as section 6.5 plants it: Member's name unmarked; P13 names the same field", () =>
    Effect.gen(function* () {
      const planted = memberWith({ name: DisplayName })
      const found = yield* gate({ enrolled: { ...enrolled, [member]: planted } })
      expect(found).toEqual([
        ["P3", member, "name"],
        ["P13", member, "name"]
      ])
    })
  )

  it.effect("P3 alone: Member's name unmarked, with the table holding the field unmarked too", () =>
    Effect.gen(function* () {
      const planted = memberWith({ name: DisplayName })
      const found = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "name", {})
      })
      expect(found).toEqual([["P3", member, "name"]])
    })
  )

  it.effect("P4: a second field names Member's own class", () =>
    Effect.gen(function* () {
      const mark = aboutClass("inv:Member")
      const planted = memberWith({ organizationName: DisplayName.pipe(S.annotateKey(mark)) })
      const findings = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "organizationName", mark)
      })
      expect(findings).toEqual([["P4", member, ""]])
    })
  )

  it.effect("P5: a field names a property whose domain is another class", () =>
    Effect.gen(function* () {
      const mark = aboutProperty("inv:recordedAt")
      const planted = memberWith({ name: DisplayName.pipe(S.annotateKey(mark)) })
      const findings = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "name", mark)
      })
      expect(findings).toEqual([["P5", member, "name"]])
    })
  )

  it.effect("P6: two fields name a property ranging over the tenant", () =>
    Effect.gen(function* () {
      const mark = aboutProperty("inv:inTenant")
      const planted = memberWith({ organizationName: DisplayName.pipe(S.annotateKey(mark)) })
      const findings = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "organizationName", mark)
      })
      expect(findings).toEqual([["P6", member, ""]])
    })
  )

  it.effect("P7: the grant step without reverse, so grantedTo runs from the member to the grant", () =>
    Effect.gen(function* () {
      const mark = aboutPath([
        {
          property: "inv:grantedTo",
          node: "inv:Grant",
          fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-organization" }]
        },
        { property: "inv:grantsRole" }
      ])
      const planted = memberWith({ role: Member.fields.role.annotateKey(mark) })
      const findings = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "role", mark)
      })
      expect(A.dedupe(findings)).toEqual([["P7", member, "role"]])
    })
  )

  it.effect("P7: grantedTo and grantScope with no declared domain, which a node step needs exactly", () =>
    Effect.gen(function* () {
      const { domain: _grantedTo, ...grantedTo } = vocabulary.objectProperties.grantedTo
      const { domain: _grantScope, ...grantScope } = vocabulary.objectProperties.grantScope
      const decoded = yield* decodeVocabulary({
        ...vocabulary,
        objectProperties: { ...vocabulary.objectProperties, grantedTo, grantScope }
      })
      const found = yield* gate({ vocabulary: decoded })
      expect(found).toEqual([
        ["P7", member, "role"],
        ["P7", member, "role"],
        ["P7", person, "role"],
        ["P7", person, "role"]
      ])
    })
  )

  it.effect("P5: a term that does not decode, written by hand, names no property", () =>
    Effect.gen(function* () {
      const mark = { term: 5 }
      const planted = memberWith({ name: DisplayName.pipe(S.annotateKey(mark)) })
      const found = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "name", mark)
      })
      expect(found).toEqual([["P5", member, "name"]])
    })
  )

  it.effect("P8: a union in Role's place allows a literal its scheme has no notation for", () =>
    Effect.gen(function* () {
      const widened = S.Literals(["viewer", "owner"]).pipe(S.annotate(aboutScheme("inv:MemberRoleScheme")))
      const found = yield* gate({ enrolled: { ...enrolled, [role]: widened } })
      expect(found).toEqual([["P8", role, ""]])
    })
  )

  it.effect("P9: a field deferred to a slice the gate does not know", () =>
    Effect.gen(function* () {
      const mark = noTermFor<"catalogue">()("deferred", "catalogue")
      const planted = memberWith({ name: DisplayName.pipe(S.annotateKey(mark)) })
      const findings = yield* gate({
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "name", mark)
      })
      expect(findings).toEqual([["P9", member, "name"]])
    })
  )

  it.effect("P10: a class whose createdAt is marked on its select variant only", () =>
    Effect.gen(function* () {
      const found = yield* gate({
        enrolled: { ...enrolled, [activity]: Uneven, [auditTrail]: S.Array(Uneven.json) },
        variants: { ...variants, [activity]: sixOf(Uneven) }
      })
      expect(A.dedupe(found)).toEqual([["P10", activity, "createdAt"]])
    })
  )

  it.effect("P10: Enrolled.ts's table for Activity drops a variant", () =>
    Effect.gen(function* () {
      const { jsonUpdate: _dropped, ...five } = sixOf(Activity)
      const found = yield* gate({ variants: { ...variants, [activity]: five } })
      expect(found).toEqual([["P10", activity, ""]])
    })
  )

  it.effect("P10: Enrolled.ts maps no variants for Activity, which has six", () =>
    Effect.gen(function* () {
      const found = yield* gate({ variants: {} })
      expect(found).toEqual([["P10", activity, ""]])
    })
  )

  it.effect("P10: Enrolled.ts's update is another variant of the class, not its own update", () =>
    Effect.gen(function* () {
      const found = yield* gate({
        variants: { ...variants, [activity]: { ...sixOf(Activity), update: Activity.insert } }
      })
      expect(found).toEqual([["P10", activity, ""]])
    })
  )

  it.effect("P10: variants mapped for Member, which is no class, and for Role, which is no record", () =>
    Effect.gen(function* () {
      const found = yield* gate({ variants: { ...variants, [member]: sixOf(Activity), [role]: sixOf(Activity) } })
      expect(found).toEqual([
        ["P10", member, ""],
        ["P10", role, ""]
      ])
    })
  )

  it.effect("P11: membershipOf, named by no record, without its fixture evidence", () =>
    Effect.gen(function* () {
      const { evidence: _evidence, ...unevidenced } = vocabulary.objectProperties.membershipOf
      const decoded = yield* decodeVocabulary({
        ...vocabulary,
        objectProperties: { ...vocabulary.objectProperties, membershipOf: unevidenced }
      })
      const found = yield* gate({ vocabulary: decoded })
      expect(found).toEqual([["P11", "vocabulary", "membershipOf"]])
    })
  )

  it.effect("P12: the audit trail's entry names the insert variant, which is not its element", () =>
    Effect.gen(function* () {
      const enrolment = yield* decodeEnrolment(
        A.map(enrolmentFile, (entry) =>
          "of" in entry ? { ...entry, of: "packages/kernel/src/Activity.schema.ts#Activity.insert" } : entry
        )
      )
      const found = yield* gate({ enrolment })
      expect(found).toEqual([["P12", auditTrail, ""]])
    })
  )

  it.effect(
    "P13, as section 6.5 plants it: Activity's tenant and actor properties swapped; P1 to P12 see nothing",
    () =>
      Effect.gen(function* () {
        const found = yield* gate({
          enrolled: { ...enrolled, [activity]: Swapped, [auditTrail]: S.Array(Swapped.json) },
          variants: { ...variants, [activity]: sixOf(Swapped) }
        })
        expect(found).toEqual([
          ["P13", activity, "organizationId"],
          ["P13", activity, "actorId"]
        ])
      })
  )

  it.effect("P13: a table row for Role, which is enrolled as a scheme, not a record", () =>
    Effect.gen(function* () {
      const stray = Placement.make({ entry: role, field: "viewer", mark: reading(noTerm("screen")) })
      const found = yield* gate({ placements: [...placements, stray] })
      expect(found).toEqual([["P13", role, "viewer"]])
    })
  )
})

// ---------------------------------------------------------------------------------------------------------------
// The party slice's constructs (PLAN, step 3)
// ---------------------------------------------------------------------------------------------------------------

/** Step 2's copy with Activity's `action` live again, so the real records find nothing in it and a plant one rule. */
const live = {
  ...constructsVocabulary,
  datatypeProperties: { ...constructsVocabulary.datatypeProperties, action: vocabulary.datatypeProperties.action }
} as const satisfies typeof Vocabulary.Encoded

/** That copy with two properties of this test's own whose domain is the category `Party`, each shown on a fixture. */
const partied = {
  ...live,
  objectProperties: {
    ...live.objectProperties,
    partyGrant: {
      prefLabel: "party grant",
      definition: "Links a party to a grant it holds, a relation of this test's own.",
      domain: "Party",
      range: { kind: "class", key: "Grant" },
      evidence: "fixture",
      ratification: { decision: 12 }
    }
  },
  datatypeProperties: {
    ...live.datatypeProperties,
    knownAs: {
      prefLabel: "known as",
      definition: "The name a party is known by, an attribute of this test's own.",
      domain: "Party",
      datatype: "xsd:string",
      evidence: "fixture",
      ratification: { decision: 12 }
    }
  }
} as const satisfies typeof Vocabulary.Encoded

/**
 * That copy with `scopeKind`, a retired relation of this test's own from a grant to a scheme, as `grantScope` is: a
 * path can fix a grant's scope through it and break P14 alone. Nothing in step 2's copy fits there, since its retired
 * relation ranges over a class and a fixed property must range over the concept's scheme (P7).
 */
const retiring = {
  ...partied,
  objectProperties: {
    ...partied.objectProperties,
    scopeKind: {
      prefLabel: "scope kind",
      definition:
        "Linked a grant to the kind of its scope, before grant scope replaced it, a relation of this test's own.",
      domain: "Grant",
      range: { kind: "scheme", key: "GrantScopeKindScheme" },
      deprecation: { kind: "replaced", replacedBy: "grantScope", since: partied.version },
      ratification: { decision: 33 }
    }
  }
} as const satisfies typeof Vocabulary.Encoded

/**
 * That copy with a live concept, `basic`, in the retired `AccessLevelScheme`, and `accessLevel`, a live relation from a
 * grant to that scheme. Gate 4's C15 refuses a live property whose range is retired (V14), so this copy is incoherent
 * on purpose: it is the one way a path fixes a live concept of a retired scheme without also naming a retired property.
 */
const lapsedScheme = {
  ...retiring,
  objectProperties: {
    ...retiring.objectProperties,
    accessLevel: {
      prefLabel: "access level",
      definition: "Links a grant to the access level it gives, a relation of this test's own.",
      domain: "Grant",
      range: { kind: "scheme", key: "AccessLevelScheme" },
      ratification: { decision: 33 }
    }
  },
  schemes: {
    ...retiring.schemes,
    AccessLevelScheme: {
      ...retiring.schemes.AccessLevelScheme,
      concepts: {
        ...retiring.schemes.AccessLevelScheme.concepts,
        basic: {
          prefLabel: "Basic access",
          definition: "An access level whose holder could read every record, a concept of this test's own.",
          ratification: { decision: 33 }
        }
      }
    }
  }
} as const satisfies typeof Vocabulary.Encoded

type Planted = typeof lapsedScheme
type PlantedRegistry<K extends string> = {
  readonly inv: { readonly iri: Planted["namespace"]; readonly terms: ReadonlyArray<K> }
}
type PlantedClasses = PlantedRegistry<keyof Planted["classes"] & string>
type PlantedProperties = PlantedRegistry<
  (keyof Planted["objectProperties"] | keyof Planted["datatypeProperties"]) & string
>
type PlantedSchemes = Planted["schemes"]
type PlantedConcept = {
  readonly [K in keyof PlantedSchemes & string]: `inv:${K}-${keyof PlantedSchemes[K]["concepts"] & string}`
}[keyof PlantedSchemes & string]

/** The kernel's helpers, bound to the copy's keys: a class, a property, a scheme, a path. */
const plantedClass = pointerFor<PlantedClasses>()
const plantedProperty = pointerFor<PlantedProperties>()
const plantedScheme = pointerFor<PlantedRegistry<keyof PlantedSchemes & string>>()
const plantedPath = pathFor<Curie<PlantedClasses>, Curie<PlantedProperties>, PlantedConcept>()

const plantedFile = "packages/ontology/test/Pointers.test.ts"

/**
 * A planted record enrolled beside the real ones: the enrolment list with its entry, the schemas with it, and P13's
 * table holding the plant's own marks, so a finding names the rule the plant breaks and no other.
 */
const withRecord = Effect.fn("withRecord")(function* (
  name: string,
  schema: S.Top,
  marks: ReadonlyArray<readonly [string, S.Annotations.Key<string>]>
) {
  const key = `${plantedFile}#${name}`
  const enrolment = yield* decodeEnrolment([...enrolmentFile, { file: plantedFile, export: name, as: "record" }])
  const rows = A.map(marks, ([field, mark]) => Placement.make({ entry: key, field, mark: reading(mark) }))
  return { enrolment, enrolled: { ...enrolled, [key]: schema }, placements: [...placements, ...rows] }
})

/** A record of `cls` whose `knownAs` fills the property whose domain is `Party`. */
const knownAsRecord = (cls: "inv:Person" | "inv:Tenant" | "inv:Member") => {
  const marks = [
    ["id", plantedClass(cls)],
    ["knownAs", plantedProperty("inv:knownAs")]
  ] as const
  const schema = S.Struct({
    id: S.String.pipe(S.annotateKey(marks[0][1])),
    knownAs: S.String.pipe(S.annotateKey(marks[1][1]))
  }).pipe(S.annotate(plantedClass(cls)))
  return withRecord("KnownAs", schema, marks)
}

/** A record of `cls` whose role is reached through `partyGrant`, a relation from a `Party` to its grant. */
const partyGrantRecord = (cls: "inv:Person" | "inv:Member") => {
  const path = plantedPath([{ property: "inv:partyGrant", node: "inv:Grant" }, { property: "inv:grantsRole" }])
  const marks = [
    ["id", plantedClass(cls)],
    ["role", path]
  ] as const
  const schema = S.Struct({
    id: S.String.pipe(S.annotateKey(marks[0][1])),
    role: Role.pipe(S.annotateKey(path))
  }).pipe(S.annotate(plantedClass(cls)))
  return withRecord("PartyGrant", schema, marks)
}

/** A Member record whose one other field, `reached`, a string, is marked with `path`. */
const memberPathRecord = (path: S.Annotations.Key<string>) => {
  const marks = [
    ["id", plantedClass("inv:Member")],
    ["reached", path]
  ] as const
  const schema = S.Struct({
    id: S.String.pipe(S.annotateKey(marks[0][1])),
    reached: S.String.pipe(S.annotateKey(path))
  }).pipe(S.annotate(plantedClass("inv:Member")))
  return withRecord("Reached", schema, marks)
}

/** `Member` with its role path replaced by `mark`, and P13's table holding the plant's mark. */
const memberRoleAs = (mark: PathMark<LiftPath<string, string, string>>): Partial<PointerInput> => ({
  enrolled: { ...enrolled, [member]: memberWith({ role: Member.fields.role.annotateKey(mark) }) },
  placements: placedAs(member, "role", mark)
})

const knownAs = `${plantedFile}#KnownAs`
const partyGrant = `${plantedFile}#PartyGrant`
const reached = `${plantedFile}#Reached`

describe("gate 5 on the party slice's constructs", () => {
  it.effect("the real records on step 2's copy: only Activity's action, an attribute the copy withdraws (P14)", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(constructsVocabulary)
      const found = yield* gate({ vocabulary: decoded })
      expect(found).toEqual([["P14", activity, "action"]])
    })
  )

  it.effect("the real records on the copy with action live: nothing, the two retired properties no P11 finding", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(live)
      const found = yield* gate({ vocabulary: decoded })
      expect(found).toEqual([])
    })
  )

  it.effect("a Person record fills a property whose domain is Party, through its category parent", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* knownAsRecord("inv:Person")
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([])
    })
  )

  it.effect("a Tenant record fills it too: Tenant is an Organization, and Organization falls under Party", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* knownAsRecord("inv:Tenant")
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([])
    })
  )

  it.effect("P5: a Member record, which falls under no Party, fills the same property", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* knownAsRecord("inv:Member")
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([["P5", knownAs, "knownAs"]])
    })
  )

  it.effect("a Person record's path leaves it along a relation whose domain is Party", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* partyGrantRecord("inv:Person")
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([])
    })
  )

  it.effect("P7: a Member record's path leaves it along the same relation", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* partyGrantRecord("inv:Member")
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([["P7", partyGrant, "role"]])
    })
  )

  it.effect("P14: a record pointed at Workspace, a retired class, once though its id field names it too", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(live)
      const mark = plantedClass("inv:Workspace")
      const schema = S.Struct({ id: S.String.pipe(S.annotateKey(mark)) }).pipe(S.annotate(mark))
      const planted = yield* withRecord("Retired", schema, [["id", mark]])
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([["P14", `${plantedFile}#Retired`, ""]])
    })
  )

  it.effect("P14: a membership record's organizationId fills workspaceMembership, a retired relation", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(live)
      const marks = [
        ["id", plantedClass("inv:Member")],
        ["organizationId", plantedProperty("inv:workspaceMembership")]
      ] as const
      const schema = S.Struct({
        id: S.String.pipe(S.annotateKey(marks[0][1])),
        organizationId: S.String.pipe(S.annotateKey(marks[1][1]))
      }).pipe(S.annotate(plantedClass("inv:Member")))
      const planted = yield* withRecord("Membership", schema, marks)
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([["P14", `${plantedFile}#Membership`, "organizationId"]])
    })
  )

  it.effect("P14: a union in Role's place points at AccessLevelScheme, a retired scheme", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(live)
      const retired = S.Literals(["full"]).pipe(S.annotate(plantedScheme("inv:AccessLevelScheme")))
      const found = yield* gate({ vocabulary: decoded, enrolled: { ...enrolled, [role]: retired } })
      expect(found).toEqual([["P14", role, ""]])
    })
  )

  it.effect("P8 passes owner, a retired notation of the live MemberRoleScheme kept in Role's literals (V12)", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(live)
      const kept = S.Literals(["viewer", "editor", "admin", "owner"]).pipe(
        S.annotate(plantedScheme("inv:MemberRoleScheme"))
      )
      const found = yield* gate({ vocabulary: decoded, enrolled: { ...enrolled, [role]: kept } })
      expect(found).toEqual([])
    })
  )

  it.effect("P14: Member's role path fixes the grant's scope to whole, a retired concept", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(live)
      const mark = plantedPath([
        {
          property: "inv:grantedTo",
          reverse: true,
          node: "inv:Grant",
          fixed: [{ property: "inv:grantScope", concept: "inv:GrantScopeKindScheme-whole" }]
        },
        { property: "inv:grantsRole" }
      ])
      const planted = memberWith({ role: Member.fields.role.annotateKey(mark) })
      const found = yield* gate({
        vocabulary: decoded,
        enrolled: { ...enrolled, [member]: planted },
        placements: placedAs(member, "role", mark)
      })
      expect(found).toEqual([["P14", member, "role"]])
    })
  )

  it.effect("P14: a Member record's path takes a node step along workspaceMembership, a retired relation", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* memberPathRecord(
        plantedPath([{ property: "inv:workspaceMembership", node: "inv:Tenant" }, { property: "inv:knownAs" }])
      )
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([["P14", reached, "reached"]])
    })
  )

  it.effect("the same path along membershipIn, the live relation, passes", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* memberPathRecord(
        plantedPath([{ property: "inv:membershipIn", node: "inv:Tenant" }, { property: "inv:knownAs" }])
      )
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([])
    })
  )

  it.effect("P14: a Member record's path ends in loggedAt, a retired attribute, on its audit entry", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* memberPathRecord(
        plantedPath([
          { property: "inv:recordedActor", reverse: true, node: "inv:AuditEntry" },
          { property: "inv:loggedAt" }
        ])
      )
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([["P14", reached, "reached"]])
    })
  )

  it.effect("the same path ending in recordedAt, the live attribute, passes", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* memberPathRecord(
        plantedPath([
          { property: "inv:recordedActor", reverse: true, node: "inv:AuditEntry" },
          { property: "inv:recordedAt" }
        ])
      )
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([])
    })
  )

  it.effect("P14 and P7: a path's node is Workspace, a retired class, which no live relation ranges over (V14)", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(partied)
      const planted = yield* memberPathRecord(
        plantedPath([{ property: "inv:membershipIn", node: "inv:Workspace" }, { property: "inv:knownAs" }])
      )
      const found = yield* gate({ vocabulary: decoded, ...planted })
      expect(found).toEqual([
        ["P7", reached, "reached"],
        ["P14", reached, "reached"]
      ])
    })
  )

  it.effect("P14: Member's role path fixes the grant's scope through scopeKind, a retired relation", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(retiring)
      const mark = plantedPath([
        {
          property: "inv:grantedTo",
          reverse: true,
          node: "inv:Grant",
          fixed: [{ property: "inv:scopeKind", concept: "inv:GrantScopeKindScheme-organization" }]
        },
        { property: "inv:grantsRole" }
      ])
      const found = yield* gate({ vocabulary: decoded, ...memberRoleAs(mark) })
      expect(found).toEqual([["P14", member, "role"]])
    })
  )

  it.effect("a live concept of a retired scheme, fixed through a live relation, is not refused (Needs Benjamin)", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeVocabulary(lapsedScheme)
      const mark = plantedPath([
        {
          property: "inv:grantedTo",
          reverse: true,
          node: "inv:Grant",
          fixed: [{ property: "inv:accessLevel", concept: "inv:AccessLevelScheme-basic" }]
        },
        { property: "inv:grantsRole" }
      ])
      const found = yield* gate({ vocabulary: decoded, ...memberRoleAs(mark) })
      expect(found).toEqual([])
    })
  )
})
