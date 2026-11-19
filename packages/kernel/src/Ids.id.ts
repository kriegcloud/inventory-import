/**
 * The ids the whole app passes around. Each is branded, so one cannot stand in for another, and bounded, so a
 * request cannot send an id no row could have.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $KernelId } from "./internal/identity.ts"

const $I = $KernelId.create("Ids")

/**
 * The text of a stored id: 1 to 64 letters, digits, `_` or `-`. It holds the seeded ids (`org_prairie`, `mem_dana`)
 * and the ids Better Auth generates.
 */
const IdText = S.String.check(S.isPattern(/^[A-Za-z0-9_-]{1,64}$/))

/**
 * The organization (tenant) a row belongs to. It always comes from the actor, never from a request.
 *
 * **Example** (A seeded organization)
 *
 * ```ts
 * import { OrganizationId } from "@inventory/kernel/Ids"
 *
 * OrganizationId.make("org_prairie")
 * ```
 *
 * @category ids
 */
export const OrganizationId = IdText.pipe(
  S.brand("OrganizationId"),
  $I.annoteSchema("OrganizationId", {
    description: "The organization (tenant) a row belongs to. It always comes from the actor, never from a request."
  })
)

/**
 * An `OrganizationId` as code holds it: branded, so a member id cannot be passed where a tenant is expected.
 *
 * @category ids
 */
export type OrganizationId = typeof OrganizationId.Type

/**
 * A person within one organization. People are told apart by this id, never by name.
 *
 * @category ids
 */
export const MemberId = IdText.pipe(
  S.brand("MemberId"),
  $I.annoteSchema("MemberId", {
    description: "A person within one organization. People are told apart by this id, never by name."
  })
)

/**
 * A `MemberId` as code holds it. Compare people with it, never with their names.
 *
 * @category ids
 */
export type MemberId = typeof MemberId.Type

/**
 * A sign-in account: who signed in, before an organization is chosen. One account is a member of several
 * organizations.
 *
 * @category ids
 */
export const UserId = IdText.pipe(
  S.brand("UserId"),
  $I.annoteSchema("UserId", { description: "A sign-in account: who signed in, before an organization is chosen" })
)

/**
 * A `UserId` as code holds it.
 *
 * @category ids
 */
export type UserId = typeof UserId.Type

/**
 * The id of one audit-trail row: a UUID made on insert, never supplied by a request.
 *
 * @category ids
 */
export const ActivityId = S.String.check(S.isUUID()).pipe(
  S.brand("ActivityId"),
  $I.annoteSchema("ActivityId", { description: "The id of one audit-trail row" })
)

/**
 * The decoded value of `ActivityId`.
 *
 * @category ids
 */
export type ActivityId = typeof ActivityId.Type

/**
 * The key the browser makes once for each thing a person does (one click of a write button, one Confirm). Sent again
 * on a retry or a double submit, it names the same write, so the server answers with what is stored instead of
 * writing a second copy.
 *
 * @category ids
 */
export const RequestId = S.String.check(S.isUUID()).pipe(
  S.brand("RequestId"),
  $I.annoteSchema("RequestId", {
    description:
      "A UUID the browser makes once per action a person takes. A request repeated with the same id writes nothing new."
  })
)

/**
 * A `RequestId` as code holds it: branded, so a row id cannot stand in for it.
 *
 * @category ids
 */
export type RequestId = typeof RequestId.Type
