// The one in-memory state the twins of the three ports share, so a person added through the people store can sign in
// through the directory and their audit line reads back from the audit trail, as on D1.
import { AccountEmail } from "@inventory/access-contract/SessionState"
import { Activity } from "@inventory/kernel/Activity"
import { UserId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { DisplayName } from "@inventory/kernel/Text"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import { EmailToFind } from "@inventory/access-contract/PeoplePayload"
import { $AccessModelId } from "./identity.ts"

const $I = $AccessModelId.create("internal/memory")

/** A sign-in account, including the email key normalized when the twin is seeded. */
export const MemoryAccount = S.Struct({
  userId: UserId,
  name: DisplayName,
  email: AccountEmail,
  emailKey: EmailToFind.pipe(S.toType, S.check(S.isTrimmed(), S.isLowercased()))
}).pipe($I.annoteSchema("MemoryAccount", { description: "A sign-in account and its normalized lookup key" }))
/** The account row held by the access twin. */
export type MemoryAccount = typeof MemoryAccount.Type

/** A membership row, including its account link and joining time when known. */
export const MemoryMembership = S.Struct({
  member: Member,
  userId: S.Option(UserId),
  joinedAt: S.Option(S.DateTimeUtc),
  removed: S.Boolean
}).pipe($I.annoteSchema("MemoryMembership", { description: "A membership row in the access twin" }))
/** The membership row held by the access twin. */
export type MemoryMembership = typeof MemoryMembership.Type

const emptyTable = <Schema extends S.Constraint>(row: Schema) =>
  S.Array(row).pipe(S.withConstructorDefault(Effect.succeed([])), S.withDecodingDefaultTypeKey(Effect.succeed([])))

/** Everything the access tables hold, in memory. Memberships are in creation order, and fresh tables are empty. */
export const AccessMemoryState = S.Struct({
  accounts: emptyTable(MemoryAccount),
  memberships: emptyTable(MemoryMembership),
  lines: emptyTable(Activity.pipe(S.toType))
}).pipe($I.annoteSchema("AccessMemoryState", { description: "The access tables in memory, initially empty" }))

/** The decoded access tables held by the twin. */
export type AccessMemoryState = typeof AccessMemoryState.Type

/** The shared state of the in-memory twins. */
export class AccessMemoryRef extends Context.Service<AccessMemoryRef, Ref.Ref<AccessMemoryState>>()(
  $I`AccessMemoryRef`
) {
  /** A fresh state holding `seed`. */
  static readonly layer = (seed: AccessMemoryState) => Layer.effect(AccessMemoryRef, Ref.make(seed))
}
