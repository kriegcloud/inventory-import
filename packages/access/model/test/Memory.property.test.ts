// Empty tables belong to the twin's schema; supplying one table preserves its rows and fills only the others.
import { describe, expect, it } from "@effect/vitest"
import * as Arbitrary from "effect/Arbitrary"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { EmailToFind } from "@inventory/access-contract/PeoplePayload"
import { MemoryAccount, MemoryMembership, AccessMemoryState } from "../src/internal/memory.ts"
import { seed } from "./support.ts"

const empty = { accounts: [], memberships: [], lines: [] }

describe("the access twin's initial state", () => {
  it.effect("constructs and decodes empty tables when a seed leaves them out", () =>
    Effect.gen(function* () {
      expect(AccessMemoryState.make({})).toEqual(empty)
      const decoded = yield* S.decodeEffect(AccessMemoryState)({})
      expect(decoded).toEqual(empty)
    })
  )

  it.effect("preserves supplied accounts and memberships through constructor and decoding defaults", () =>
    Effect.gen(function* () {
      const accounts = yield* Effect.forEach(
        seed.accounts,
        (account) => Effect.map(S.decodeEffect(EmailToFind)(account.email), (emailKey) => ({ ...account, emailKey })),
        { concurrency: 1 }
      )
      const made = AccessMemoryState.make({ ...seed, accounts })
      expect(made).toEqual({ ...empty, ...seed, accounts })
      const decoded = yield* S.decodeEffect(AccessMemoryState)({
        accounts: made.accounts,
        memberships: made.memberships
      })
      expect(decoded).toEqual(made)
      expect(AccessMemoryState.make({})).toEqual(empty)
    })
  )

  it.prop(
    "generates only valid states",
    [Arbitrary.schema(AccessMemoryState)],
    ([state]) => {
      expect(S.is(AccessMemoryState)(state)).toBe(true)
    },
    { arbitrary: { runs: 50 } }
  )
})

for (const row of [MemoryAccount, MemoryMembership]) {
  it.prop("generates valid memory rows", [Arbitrary.schema(row)], ([value]) => {
    expect(S.is(row)(value)).toBe(true)
  })
}
