import { assertDefined, assertNone } from "@effect/vitest/utils"
import { assertedValue } from "./support"
// Reads belong to one member and organization (Benjamin: "Keyed reads, and drop them on sign-out"). A sign-out lets go
// of every read held, at once: none is left in the held map nor in the registry, and the next person to sign in on the
// tab starts from the skeleton and never sees the first one's rows. A switch of organization keeps the person's reads
// for the organization they left, so switching back shows its rows at once.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { Member } from "@inventory/kernel/Member"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { DisplayName } from "@inventory/kernel/Text"
import { forgetReads, heldReadMembers, makeApiAtoms, provideApi } from "@inventory/client/Api"
import { provideMember } from "@inventory/client/MemberAtoms"

interface Rows {
  readonly rows: Effect.Effect<string>
}
class RowServer extends Context.Service<RowServer, Rows>()("@inventory/client/test/SignOut.atoms.test/RowServer") {}

const someone = (id: string, organization: string) =>
  O.some(
    Member.make({
      id: MemberId.make(id),
      name: DisplayName.make(id),
      role: "admin",
      organizationId: OrganizationId.make(organization),
      organizationName: DisplayName.make(organization)
    })
  )

const world = () => {
  const signedIn = Atom.make(someone("mem_dana", "org_prairie"))
  // Who the server's session says is asking, as the cookie tells it; set when someone signs in.
  let session = "mem_dana in org_prairie"
  // The rows of whoever asks, after a moment, as a server answers.
  const layer = Layer.succeed(RowServer, {
    rows: Effect.sleep("20 millis").pipe(Effect.andThen(Effect.sync(() => `rows of ${session}`)))
  })
  const rows = makeApiAtoms(RowServer).query((server) => server.rows, { keep: "unwatched" })
  const registry = AtomRegistry.make({
    initialValues: [provideApi(layer), provideMember(signedIn)],
    defaultIdleTTL: 50
  })
  const seen = () => registry.get(rows).pipe(AsyncResult.value, assertedValue)
  // Every answer the registry still holds, anywhere.
  const heldValues = () =>
    A.flatMap(A.fromIterable(registry.getNodes().values()), (node) =>
      O.match(node.valueOption(), {
        onNone: (): ReadonlyArray<string> => [],
        onSome: (value) =>
          AsyncResult.isAsyncResult(value) ? value.pipe(AsyncResult.value, O.toArray, A.map(String)) : []
      })
    )
  const signIn = (who: O.Option<Member>) => {
    session = O.match(who, { onNone: () => "nobody", onSome: (one) => `${one.id} in ${one.organizationId}` })
    registry.set(signedIn, who)
  }
  return { registry, rows, seen, heldValues, signIn }
}

describe("signing out", () => {
  it.live("lets go of every read held, and the next person starts from the skeleton", () =>
    Effect.gen(function* () {
      const t = world()
      const leave = t.registry.mount(t.rows)
      yield* Effect.sleep("100 millis")
      expect(t.seen()).toBe("rows of mem_dana in org_prairie")

      // Dana leaves the screen: her rows are kept for her.
      leave()
      yield* Effect.sleep("150 millis")
      expect(heldReadMembers()).toContain("mem_dana/org_prairie")
      expect(t.heldValues()).toContain("rows of mem_dana in org_prairie")

      // She signs out: nothing of hers is held any more, in the held map or the registry.
      t.signIn(O.none())
      forgetReads()
      yield* Effect.sleep("150 millis")
      expect(heldReadMembers()).toEqual([])
      expect(t.heldValues()).not.toContain("rows of mem_dana in org_prairie")

      // Marcus signs in on the same tab: the skeleton, then his rows, never hers.
      t.signIn(someone("mem_marcus", "org_prairie"))
      const seen: Array<O.Option<string>> = []
      t.registry.mount(t.rows)
      for (let i = 0; i < 10; i++) {
        seen.push(AsyncResult.value(t.registry.get(t.rows)))
        yield* Effect.sleep("10 millis")
      }
      const first = seen[0]
      assertDefined(first)
      assertNone(first)
      expect(seen).not.toContain("rows of mem_dana in org_prairie")
      expect(t.seen()).toBe("rows of mem_marcus in org_prairie")
    })
  )

  it.live("a switch of organization keeps the rows of the one left, shown at once on the way back", () =>
    Effect.gen(function* () {
      const t = world()
      t.registry.mount(t.rows)
      yield* Effect.sleep("100 millis")
      expect(t.seen()).toBe("rows of mem_dana in org_prairie")
      t.signIn(someone("mem_dana_northline", "org_northline"))
      yield* Effect.sleep("100 millis")
      expect(t.seen()).toBe("rows of mem_dana_northline in org_northline")
      t.signIn(someone("mem_dana", "org_prairie"))
      // At once: the rows she had there, while they are asked again.
      expect(t.seen()).toBe("rows of mem_dana in org_prairie")
    })
  )
})
