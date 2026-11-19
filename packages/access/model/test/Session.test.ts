// Who a request acts as, and what the browser is told, over the in-memory directory.
import { expect, layer } from "@effect/vitest"
import { AccountEmail, SignInFeatures } from "@inventory/access-contract/SessionState"
import { SignedInUser } from "@inventory/access-model/MemberDirectory"
import { accessMemory } from "@inventory/access-model/Memory"
import { actorOf, membersOfActor, sessionState } from "@inventory/access-model/SessionHandler"
import { OrganizationId, UserId } from "@inventory/kernel/Ids"
import * as Effect from "effect/Effect"
import * as A from "effect/Array"
import * as O from "effect/Option"
import { as, elena, seed } from "./support.ts"

const features = SignInFeatures.make({ testAccounts: O.none(), pwnedPasswordCheck: false })
const user = (id: string, email: string, active: O.Option<string>) =>
  O.some(
    SignedInUser.make({
      userId: UserId.make(id),
      email: AccountEmail.make(email),
      active: O.map(active, (organization) => OrganizationId.make(organization))
    })
  )

layer(accessMemory(seed))("the session", (it) => {
  it.effect("nobody signed in: sign in to continue, and an answer with nothing but the features", () =>
    Effect.gen(function* () {
      const refused = yield* O.none().pipe(actorOf, Effect.flip)
      expect(refused.reason).toBe("Sign in to continue.")
      const state = yield* sessionState({ user: O.none(), features })
      expect(state).toEqual({ status: "signed-out", features })
    })
  )

  it.effect("with no organization chosen, a person acts in their earliest; chosen, in that one", () =>
    Effect.gen(function* () {
      const first = yield* actorOf(user("usr_dana", "dana@example-works.test", O.none()))
      expect([first.organizationId, first.role]).toEqual(["org_prairie", "admin"])
      const chosen = yield* actorOf(user("usr_dana", "dana@example-works.test", O.some("org_northline")))
      expect([chosen.organizationId, chosen.role]).toEqual(["org_northline", "viewer"])
      const state = yield* sessionState({ user: user("usr_dana", "dana@example-works.test", O.none()), features })
      expect(state.status === "ready" ? A.map(state.organizations, (choice) => choice.name) : []).toEqual([
        "Example Works (test)",
        "Sample Supply Co. (test)"
      ])
    })
  )

  it.effect("signed up and in no organization: said so, and the answer has an email and no actor", () =>
    Effect.gen(function* () {
      const sam = user("usr_sam", "Sam@Example.test", O.none())
      const refused = yield* sam.pipe(actorOf, Effect.flip)
      expect(refused.reason).toBe("You are signed in but not part of an organization yet.")
      const state = yield* sessionState({ user: sam, features })
      expect(state).toEqual({ status: "no-organization", email: "Sam@Example.test", organizations: [], features })
      // Not a member of the organization the session names: no access there, and it is said without naming it.
      const elsewhere = yield* user("usr_marcus", "marcus@example-works.test", O.some("org_northline")).pipe(
        actorOf,
        Effect.flip
      )
      expect(elsewhere.reason).toBe("You are no longer a member of that organization.")
    })
  )

  it.effect("a member reads the people of their own organization only", () =>
    Effect.gen(function* () {
      const members = yield* membersOfActor().pipe(as(elena))
      expect(A.map(members, (member) => member.name)).toEqual(["Elena Sokolova", "Dana Whitfield"])
    })
  )
})
