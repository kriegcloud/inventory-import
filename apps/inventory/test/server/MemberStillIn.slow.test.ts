// The member check the session lookup's `memberNow` makes, on D1 with the real migrations and the seeded people: a
// member is found only in their own organization, and not once they were removed from it. The removal is a real
// People remove through the handlers, not a row edited by hand. The rule that would hurt if wrong: a member of
// another organization, or a removed one, found by `memberNow`, which a guarded read is to trust on every push.
import { BetterAuthTest } from "@beep/better-auth/BetterAuthTest"
import { expect, layer } from "@effect/vitest"
import { assertNone } from "@effect/vitest/utils"
import { MemberDirectoryD1 } from "@inventory/access-host/MemberDirectoryD1"
import { MemberDirectory } from "@inventory/access-model/MemberDirectory"
import { SessionLookupLive } from "@inventory/access-host/SessionLookup"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { SessionLookup } from "@inventory/kernel/SessionLookup"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import { Api } from "../../src/api/v1/Api.ts"
import { as, TestDatabase, TypedApp } from "./support/app.ts"

const prairie = OrganizationId.make("org_prairie")
const northline = OrganizationId.make("org_northline")

/**
 * The session lookup, and the directory it reads, on the same test database the handlers write to: nobody is signed
 * in, only `memberNow` runs.
 */
const Lookup = SessionLookupLive.pipe(
  Layer.provideMerge(Layer.merge(MemberDirectoryD1, BetterAuthTest.signedOut)),
  Layer.provide(TestDatabase)
)

const memberNow = (id: string, organizationId: OrganizationId) =>
  Effect.flatMap(SessionLookup, (sessions) => sessions.memberNow({ id: MemberId.make(id), organizationId }))

layer(Layer.merge(TypedApp, Lookup))("a member, as the session lookup finds them now", (it) => {
  it.effect("is found in their own organization with their record, and not in another one", () =>
    Effect.gen(function* () {
      const dana = yield* memberNow("mem_dana", prairie)
      expect(O.map(dana, (member) => [member.id, member.role, member.organizationId, member.name])).toEqual(
        O.some(["mem_dana", "admin", "org_prairie", "Dana Whitfield"])
      )
      const danaElsewhere = yield* memberNow("mem_dana", northline)
      assertNone(danaElsewhere)
      const elenaHere = yield* memberNow("mem_elena", prairie)
      assertNone(elenaHere)
    })
  )

  it.effect("is not found once an admin removed them, though their row stays", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["people"])
      const before = yield* memberNow("mem_marcus", prairie)
      expect(O.map(before, (member) => member.id)).toEqual(O.some("mem_marcus"))
      yield* client.people.remove({ params: { memberId: MemberId.make("mem_marcus") } }).pipe(as("mem_dana"))
      const after = yield* memberNow("mem_marcus", prairie)
      assertNone(after)
      // Removed, not deleted: the row is still there for the audit lines that name them, so it is `removedAt` alone
      // that keeps them out.
      const directory = yield* MemberDirectory
      const row = yield* directory.byId(MemberId.make("mem_marcus"))
      expect(O.map(row, (member) => member.organizationId)).toEqual(O.some("org_prairie"))
    })
  )
})
