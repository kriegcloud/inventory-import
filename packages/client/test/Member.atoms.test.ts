// A read belongs to the member who asked: switching organization shows nothing of the previous one's answer, not even
// marked as waiting, and asks again for the new one. And a key said to have changed from outside the atoms (the
// catalog screens still on TanStack Query) makes a read registered under it ask again.
import { describe, expect, it } from "@effect/vitest"
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
import { invalidate, makeApiAtoms, provideApi } from "@inventory/client/Api"
import { provideMember } from "@inventory/client/MemberAtoms"

interface Rows {
  readonly rows: Effect.Effect<string>
}
class RowServer extends Context.Service<RowServer, Rows>()("@inventory/client/test/Member.atoms.test/RowServer") {}

const settle = Effect.sleep("10 millis")

const memberOf = (organization: string) =>
  O.some(
    Member.make({
      id: MemberId.make("mem_dana"),
      name: DisplayName.make("Dana Whitfield"),
      role: "admin",
      organizationId: OrganizationId.make(organization),
      organizationName: DisplayName.make(organization)
    })
  )

const world = () => {
  const signedIn = Atom.make(memberOf("org_prairie"))
  let reads = 0
  const layer = Layer.succeed(RowServer, {
    // Answers after a moment, as a server does, so what the screen shows meanwhile can be seen.
    rows: Effect.sleep("1 millis").pipe(
      Effect.andThen(
        Effect.sync(() => {
          reads++
          return `rows of read ${reads}`
        })
      )
    )
  })
  const api = makeApiAtoms(RowServer)
  const rows = api.query((server) => server.rows, { reactivityKeys: ["rows"] })
  const registry = AtomRegistry.make({ initialValues: [provideApi(layer), provideMember(signedIn)] })
  registry.mount(rows)
  const seen = () => registry.get(rows).pipe(AsyncResult.value, O.getOrUndefined)
  return { registry, signedIn, rows, seen, reads: () => reads }
}

describe("reads per member", () => {
  it.live("starts from nothing for another organization", () =>
    Effect.gen(function* () {
      const t = world()
      yield* settle
      expect(t.seen()).toBe("rows of read 1")
      t.registry.set(t.signedIn, memberOf("org_northline"))
      // Not the previous organization's rows, waiting: nothing until the new answer.
      const switching = t.registry.get(t.rows)
      expect(O.isNone(AsyncResult.value(switching))).toBe(true)
      yield* settle
      expect(t.seen()).toBe("rows of read 2")
    })
  )

  it.live("asks again when a key it shows is said to have changed", () =>
    Effect.gen(function* () {
      const t = world()
      yield* settle
      invalidate(["unrelated"])
      yield* settle
      expect(t.reads()).toBe(1)
      invalidate(["rows"])
      yield* settle
      expect(t.seen()).toBe("rows of read 2")
    })
  )
})
