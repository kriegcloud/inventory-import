/**
 * The enrolled schemas as values: each `file#export` that `enrolment.json` lists, mapped to the schema it names, and
 * the variants of each enrolled `Model.Class`, which a collection's `of` names and rule P10 reads (report 14 sections
 * 3.7 and 6.5).
 *
 * Do not break: these tables and `enrolment.json` name the same exports (rule P1). A slice that enrols a record adds
 * it to both; a schema listed here and not there, or there and not here, fails gate 5.
 *
 * @packageDocumentation
 */
import { AuditTrail } from "@inventory/access-contract/AuditTrail"
import { Person } from "@inventory/access-contract/Person"
import { Activity } from "@inventory/kernel/Activity"
import { Member } from "@inventory/kernel/Member"
import { Role } from "@inventory/kernel/Role"
import type * as S from "effect/Schema"

const member = "packages/kernel/src/Member.schema.ts#Member"
const role = "packages/kernel/src/Role.schema.ts#Role"
const activity = "packages/kernel/src/Activity.schema.ts#Activity"
const person = "packages/access/contract/src/People/Person.read.ts#Person"
const auditTrail = "packages/access/contract/src/Activity/AuditTrail.read.ts#AuditTrail"

/**
 * Each enrolled export by its `file#export`, the key `enrolment.json` gives it: the schema gate 5 reads the marks of.
 */
export const enrolled: Readonly<Record<string, S.Top>> = {
  [member]: Member,
  [role]: Role,
  [activity]: Activity,
  [person]: Person,
  [auditTrail]: AuditTrail
}

/**
 * The six variants of each enrolled `Model.Class`, by the class's `file#export`. A collection's `of` names one as
 * `file#Export.variant`; rule P10 reads every one against the class's own fields.
 */
export const variants: Readonly<Record<string, Readonly<Record<string, S.Top>>>> = {
  [activity]: {
    select: Activity.select,
    insert: Activity.insert,
    update: Activity.update,
    json: Activity.json,
    jsonCreate: Activity.jsonCreate,
    jsonUpdate: Activity.jsonUpdate
  }
}
