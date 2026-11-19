// The one in-memory state the twins of the four ports share, so a person added through the people store can sign in
// through the directory and their audit line reads back from the audit trail, as on D1.
import type { ModelCallPurpose } from "@inventory/access-contract/ModelAllowance"
import type { AccountEmail } from "@inventory/access-contract/SessionState"
import type { Activity } from "@inventory/kernel/Activity"
import type { MemberId, OrganizationId, UserId } from "@inventory/kernel/Ids"
import type { Member } from "@inventory/kernel/Member"
import type { DisplayName } from "@inventory/kernel/Text"
import * as Context from "effect/Context"
import type * as DateTime from "effect/DateTime"
import * as Layer from "effect/Layer"
import type * as O from "effect/Option"
import * as Ref from "effect/Ref"
import { $AccessModelId } from "./identity.ts"

const $I = $AccessModelId.create("internal/memory")

/** A sign-in account, as the `user` table holds it. */
export type MemoryAccount = { readonly userId: UserId; readonly name: DisplayName; readonly email: AccountEmail }

/** A membership row: the member, the account linked to it (none once removed), and when it began. */
export type MemoryMembership = {
  readonly member: Member
  readonly userId: O.Option<UserId>
  readonly joinedAt: O.Option<DateTime.Utc>
  readonly removed: boolean
}

/** One model call taken from an organization's allowance. */
export type MemoryCall = {
  readonly organization: OrganizationId
  readonly actor: MemberId
  readonly purpose: ModelCallPurpose
  readonly at: DateTime.Utc
}

/** Everything the access tables hold, in memory. Memberships are in the order they were created. */
export type AccessMemoryState = {
  readonly accounts: ReadonlyArray<MemoryAccount>
  readonly memberships: ReadonlyArray<MemoryMembership>
  /** Audit lines, oldest first. */
  readonly lines: ReadonlyArray<Activity>
  readonly calls: ReadonlyArray<MemoryCall>
}

/** The shared state of the in-memory twins. */
export class AccessMemoryRef extends Context.Service<AccessMemoryRef, Ref.Ref<AccessMemoryState>>()(
  $I`AccessMemoryRef`
) {
  /** A fresh state holding `seed`. */
  static readonly layer = (seed: AccessMemoryState) => Layer.effect(AccessMemoryRef, Ref.make(seed))
}
