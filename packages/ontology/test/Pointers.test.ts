// Gate 5, record pointers on the AST (report 14 section 6.5): the committed `enrolment.json`, decoded strictly, the
// schemas `src/Enrolled.ts` maps it to and the kernel's vocabulary give no finding of P1 to P13. The gate reads the
// real records, never copies: the marks are read from their ASTs through `@beep/vocabulary/Pointer`'s reader.
//
// P13's table states section 3's placements (3.3, 3.5, 3.6), eighteen rows, each mark built with the kernel's helper
// that writes it and turned into a reading by the same reader, so no annotation key is written here by hand.
//
// Each negative hands the gate one planted input in place of a real one, and the table's rows for a planted field are
// the plant's own marks, so the negative names its rule alone. The two the report specifies (the unmarked `name`,
// and the swapped `Activity` properties) are kept as it writes them.
import { describe, expect, it } from "@effect/vitest"
import { Vocabulary } from "@beep/vocabulary/Model"
import { noTermFor, readKeyMark } from "@beep/vocabulary/Pointer"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Model from "effect/schema/Model"
import { Activity } from "@inventory/kernel/Activity"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { vocabulary } from "@inventory/kernel/Terms"
import { aboutClass, aboutPath, aboutProperty, aboutScheme, noTerm } from "@inventory/kernel/TermsPointer"
import { DisplayName } from "@inventory/kernel/Text"
import enrolmentFile from "../enrolment.json" with { type: "json" }
import { enrolled, variants } from "../src/Enrolled.ts"
import { Enrolment, Placement, pointerFindings, type PointerFinding, type PointerInput } from "../src/Pointers.rules.ts"

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
