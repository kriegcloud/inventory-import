/**
 * The access context on in-memory twins of its four ports, sharing one state: a person added through the people
 * store signs in through the directory, and their audit line reads back from the audit trail, as on D1.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { UserId } from "@inventory/kernel/Ids"
import { DisplayName } from "@inventory/kernel/Text"
import { EmailToFind } from "@inventory/access-contract/PeopleCommand"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { MemoryAccount } from "./internal/memory.ts"
import * as Layer from "effect/Layer"
import type { AccessPorts } from "./Access.ports.ts"
import { AuditTrailStore } from "./Activity/AuditTrailStore.store.ts"
import { AllowanceStore } from "./Allowance/AllowanceStore.store.ts"
import { AccessMemoryRef, AccessMemoryState } from "./internal/memory.ts"
import { PeopleStore } from "./People/PeopleStore.store.ts"
import { MemberDirectory } from "./Session/MemberDirectory.store.ts"

export type { AccessMemoryState, MemoryAccount, MemoryCall, MemoryMembership } from "./internal/memory.ts"
export { AccessMemoryRef } from "./internal/memory.ts"

/** What the twins start with: accounts, memberships (earliest first), audit lines (oldest first) and calls taken. */
export type AccessSeed = Partial<Omit<AccessMemoryState, "accounts">> & {
  readonly accounts?: ReadonlyArray<Omit<MemoryAccount, "emailKey">>
}

const SeedAccount = S.Struct({ userId: UserId, name: DisplayName, email: AccountEmail }).pipe(
  S.decodeTo(
    MemoryAccount.pipe(S.toType),
    SchemaTransformation.transformEffect({
      decode: (account) =>
        S.decodeEffect(EmailToFind)(account.email).pipe(
          Effect.mapBoth({ onSuccess: (emailKey) => ({ ...account, emailKey }), onFailure: (error) => error.issue })
        ),
      encode: (account) => Effect.succeed({ userId: account.userId, name: account.name, email: account.email })
    })
  ),
  S.annotate({ description: "A seeded account, preserving its email and deriving its normalized lookup key" })
)

const AccessSeedInput = S.Struct({
  ...AccessMemoryState.fields,
  accounts: S.Array(SeedAccount).pipe(S.withDecodingDefaultTypeKey(Effect.succeed([])))
}).annotate({ description: "The twin seed boundary, normalizing account keys and filling absent tables" })

/**
 * The four ports in memory, starting from `seed`. Also provides the state itself, so a test can read what was
 * written.
 *
 * @category layers
 */
export const accessMemory = (seed?: AccessSeed): Layer.Layer<AccessPorts | AccessMemoryRef> =>
  Layer.mergeAll(MemberDirectory.memory, PeopleStore.memory, AuditTrailStore.memory, AllowanceStore.memory).pipe(
    Layer.provideMerge(
      Layer.unwrap(
        S.decodeEffect(AccessSeedInput)({ ...seed }).pipe(
          Effect.map((state) => AccessMemoryRef.layer(state)),
          Effect.orDie
        )
      )
    )
  )
