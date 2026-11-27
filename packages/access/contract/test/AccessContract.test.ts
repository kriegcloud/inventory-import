// The access contract's schemas generate only values they accept (schema-first rule SF-7), and the three shapes the
// wire changed for keep the bytes the brief promises: a signed-out session has no null keys, a person's absent email
// is null on the wire and none in code, and the email an admin types is the lookup key.
import { describe, expect, it } from "@effect/vitest"
import { AuditTrail } from "@inventory/access-contract/AuditTrail"
import { AddPerson, AddPersonProblem, ChangeRole, EmailToFind } from "@inventory/access-contract/PeoplePayload"
import { Person } from "@inventory/access-contract/Person"
import {
  AccountEmail,
  actorOfSession,
  OrganizationChoice,
  SessionState,
  SignedOut,
  SignInFeatures,
  TestAccount
} from "@inventory/access-contract/SessionState"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Arbitrary from "effect/Arbitrary"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"

const runs = { arbitrary: { runs: 50 } }
const schemas: Readonly<Record<string, S.Top>> = {
  AccountEmail,
  OrganizationChoice,
  TestAccount,
  SignInFeatures,
  SessionState,
  Person,
  AddPerson,
  ChangeRole,
  AddPersonProblem,
  AuditTrail
}

describe("every schema generates only valid values", () => {
  for (const [name, schema] of R.toEntries(schemas)) {
    it.prop(
      name,
      [Arbitrary.schema(schema)],
      ([value]) => {
        expect(S.is(schema)(value)).toBe(true)
      },
      runs
    )
  }
})

describe("the wire", () => {
  it.effect("a signed-out session carries its status and the features, and nothing that would be null", () =>
    Effect.gen(function* () {
      const state = SignedOut.make({
        features: SignInFeatures.make({ testAccounts: O.none(), pwnedPasswordCheck: false })
      })
      const wire = yield* S.encodeEffect(SessionState)(state)
      expect(wire).toEqual({
        status: "signed-out",
        features: { testAccounts: null, pwnedPasswordCheck: false, signUp: "closed" }
      })
      expect(actorOfSession(state)).toEqual(O.none())
    })
  )

  it.effect("a person with no account is null on the wire and none in code, and comes back the same", () =>
    Effect.gen(function* () {
      const wire = { memberId: "mem_priya", name: "Priya Raman", email: null, role: "viewer", joinedAt: null }
      const person = yield* S.decodeUnknownEffect(Person)(wire)
      expect([person.email, person.joinedAt]).toEqual([O.none(), O.none()])
      const back = yield* S.encodeEffect(Person)(person)
      expect(back).toEqual(wire)
    })
  )

  it.effect("the email an admin types is trimmed and lower-cased, and a text that is no email is refused", () =>
    Effect.gen(function* () {
      const key = yield* S.decodeEffect(EmailToFind)("  Sam.Okafor@Example.TEST ")
      const blank = yield* Effect.exit(S.decodeEffect(EmailToFind)("   "))
      const noEmail = yield* Effect.exit(S.decodeEffect(EmailToFind)("sam"))
      expect([key, Exit.isFailure(blank), Exit.isFailure(noEmail)]).toEqual(["sam.okafor@example.test", true, true])
    })
  )
})
