/**
 * The audit trail of one organization, as the Activity page reads it.
 *
 * @packageDocumentation
 */
import { Activity } from "@inventory/kernel/Activity"
import * as S from "effect/Schema"
import { $AccessContractId } from "../internal/identity.ts"

const $I = $AccessContractId.create("Activity/AuditTrail")

/**
 * The organization's audit trail: at most its newest 500 lines, newest first.
 *
 * @category schemas
 */
export const AuditTrail = S.Array(Activity.json)
  .check(S.isMaxLength(500))
  .pipe($I.annoteSchema("AuditTrail", { description: "The organization's audit trail, newest first" }))

/**
 * The decoded value of `AuditTrail`.
 *
 * @category models
 */
export type AuditTrail = typeof AuditTrail.Type
