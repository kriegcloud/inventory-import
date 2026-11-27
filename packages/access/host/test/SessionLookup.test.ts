// The one session lookup every model's `Session` middleware is to rest on, over the in-memory twins and Better Auth's
// stand-ins: who a session acts as, the page that names somebody else, the minute a verdict is trusted for, and
// whether a member is still in the organization a guarded read asks about.
import type { BetterAuth } from "@beep/better-auth/BetterAuth"
import { AuthEmail, AuthOrganizationId, AuthSession, AuthUserId } from "@beep/better-auth/BetterAuthSession"
import { BetterAuthTest } from "@beep/better-auth/BetterAuthTest"
import { assertNone, assertSome } from "@effect/vitest/utils"
import { expect, layer } from "@effect/vitest"
import { pageMemberHeader } from "@inventory/access-contract/Access"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { SessionLookupLive } from "@inventory/access-host/SessionLookup"
import { accessMemory, type MemoryMembership } from "@inventory/access-model/Memory"
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { SessionLookup } from "@inventory/kernel/SessionLookup"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Headers from "effect/http/Headers"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"

const membership = (member: Member, removed: boolean): MemoryMembership => ({
  member,
  userId: removed ? O.none() : O.some(UserId.make(`usr_${member.id}`)),
  joinedAt: O.none(),
  removed
})

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "editor",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})
const elena = Member.make({
  id: MemberId.make("mem_elena"),
  name: "Elena Sokolova",
  role: "admin",
  organizationId: OrganizationId.make("org_northline"),
  organizationName: "Sample Supply Co. (test)"
})
/** Removed from Example Works: the row stays, with no account, as on D1. */
const priya = Member.make({
  id: MemberId.make("mem_priya"),
  name: "Priya Raman",
  role: "viewer",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const twins = accessMemory({
  accounts: [
    { userId: UserId.make("usr_mem_dana"), name: "Dana Whitfield", email: AccountEmail.make("dana@example.com") }
  ],
  memberships: [membership(dana, false), membership(elena, false), membership(priya, true)]
})

const lookupOver = (auth: Layer.Layer<BetterAuth>) => SessionLookupLive.pipe(Layer.provide(Layer.merge(twins, auth)))

const danaSignedIn = BetterAuthTest.signedIn(
  AuthSession.make({
    userId: AuthUserId.make("usr_mem_dana"),
    email: AuthEmail.make("dana@example.com"),
    activeOrganizationId: O.some(AuthOrganizationId.make("org_prairie"))
  })
)

const verdictOf = (headers: Headers.Headers) => Effect.flatMap(SessionLookup, (sessions) => sessions.verdictOf(headers))

layer(lookupOver(BetterAuthTest.signedOut))("nobody signed in", (it) => {
  it.effect("is refused with the sentence to sign in", () =>
    Effect.gen(function* () {
      const refused = yield* Effect.flip(verdictOf(Headers.empty))
      expect(refused).toEqual(NotSignedIn.make({ reason: "Sign in to continue." }))
    })
  )
})

layer(lookupOver(danaSignedIn))("Dana signed in at Example Works", (it) => {
  it.effect("acts as Dana, trusted for one minute from the verdict", () =>
    Effect.gen(function* () {
      const verdict = yield* verdictOf(Headers.empty)
      expect(verdict.member).toEqual(dana)
      // The test clock starts at the epoch.
      expect(DateTime.formatIso(verdict.until)).toBe("1970-01-01T00:01:00.000Z")
    })
  )

  it.effect("acts as Dana when the page names Dana", () =>
    Effect.gen(function* () {
      const verdict = yield* verdictOf(Headers.fromInput({ [pageMemberHeader]: "mem_dana/org_prairie" }))
      expect(verdict.member.id).toBe("mem_dana")
    })
  )

  it.effect("refuses a page opened for somebody else, whatever the cookie says", () =>
    Effect.gen(function* () {
      const refused = yield* Effect.flip(
        verdictOf(Headers.fromInput({ [pageMemberHeader]: "mem_elena/org_northline" }))
      )
      expect(refused).toEqual(
        NotSignedIn.make({
          reason: "This page was opened for somebody else than is signed in now. Load the page again."
        })
      )
    })
  )

  it.effect("knows a member still in their organization, with their record as it is now", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionLookup
      const found = yield* sessions.memberNow({ id: dana.id, organizationId: dana.organizationId })
      assertSome(found, dana)
    })
  )

  it.effect("finds nobody for a member asked about in another organization", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionLookup
      const found = yield* sessions.memberNow({ id: elena.id, organizationId: dana.organizationId })
      assertNone(found)
    })
  )

  it.effect("finds nobody for a member removed from the organization", () =>
    Effect.gen(function* () {
      const sessions = yield* SessionLookup
      const found = yield* sessions.memberNow({ id: priya.id, organizationId: priya.organizationId })
      assertNone(found)
    })
  )
})

layer(
  lookupOver(
    BetterAuthTest.signedIn(
      AuthSession.make({
        userId: AuthUserId.make("usr_nobody"),
        email: AuthEmail.make("nobody@example.com"),
        activeOrganizationId: O.none()
      })
    )
  )
)("a person in no organization", (it) => {
  it.effect("is refused with the sentence to join one", () =>
    Effect.gen(function* () {
      const refused = yield* Effect.flip(verdictOf(Headers.empty))
      expect(refused).toEqual(NotSignedIn.make({ reason: "You are signed in but not part of an organization yet." }))
    })
  )
})
