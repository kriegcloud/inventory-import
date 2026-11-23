// Compile-only (report 14 sections 3.5 and 6.6): the marks `Model.fieldEvolve` puts on `Activity`'s three `Field`s
// change no type. For each variant each field has, the decoded type, the encoded type and the constructor's input of
// `Activity`'s variant field equal the unmarked field's, each way round; the insert variant of `id` is among them, so
// `Activity.insert.make` still takes a value with no `id`. Not a `*.test.ts` file, so Vitest never collects it;
// `tsconfig.test.json` compiles it, and a type that drifted makes an alias below fail to compile.
import type * as S from "effect/Schema"
import * as Model from "effect/schema/Model"
import { Activity } from "@inventory/kernel/Activity"
import { ActivityId } from "@inventory/kernel/Ids"
import { DisplayName } from "@inventory/kernel/Text"

const id = Model.UuidV4Insert(ActivityId)
const agent = Model.FieldOption(DisplayName)
const createdAt = Model.DateTimeInsert

type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false

/** Every side of two schemas agrees, compared in both directions. */
type Agree<Marked extends S.Top, Unmarked extends S.Top> = [
  Same<Marked["Type"], Unmarked["Type"]>,
  Same<Unmarked["Type"], Marked["Type"]>,
  Same<Marked["Encoded"], Unmarked["Encoded"]>,
  Same<Unmarked["Encoded"], Marked["Encoded"]>,
  Same<Marked["~type.make.in"], Unmarked["~type.make.in"]>,
  Same<Unmarked["~type.make.in"], Marked["~type.make.in"]>
] extends [true, true, true, true, true, true]
  ? true
  : false

type Holds<T extends true> = T

/** `id`: select, insert, update and json. */
export type IdVariants = [
  Holds<Agree<typeof Activity.select.fields.id, typeof id.schemas.select>>,
  Holds<Agree<typeof Activity.insert.fields.id, typeof id.schemas.insert>>,
  Holds<Agree<typeof Activity.update.fields.id, typeof id.schemas.update>>,
  Holds<Agree<typeof Activity.json.fields.id, typeof id.schemas.json>>
]

/** `agent`: all six. */
export type AgentVariants = [
  Holds<Agree<typeof Activity.select.fields.agent, typeof agent.schemas.select>>,
  Holds<Agree<typeof Activity.insert.fields.agent, typeof agent.schemas.insert>>,
  Holds<Agree<typeof Activity.update.fields.agent, typeof agent.schemas.update>>,
  Holds<Agree<typeof Activity.json.fields.agent, typeof agent.schemas.json>>,
  Holds<Agree<typeof Activity.jsonCreate.fields.agent, typeof agent.schemas.jsonCreate>>,
  Holds<Agree<typeof Activity.jsonUpdate.fields.agent, typeof agent.schemas.jsonUpdate>>
]

/** `createdAt`: select, insert and json. */
export type CreatedAtVariants = [
  Holds<Agree<typeof Activity.select.fields.createdAt, typeof createdAt.schemas.select>>,
  Holds<Agree<typeof Activity.insert.fields.createdAt, typeof createdAt.schemas.insert>>,
  Holds<Agree<typeof Activity.json.fields.createdAt, typeof createdAt.schemas.json>>
]

/** The class itself is the select variant's fields: its own constructor takes the same `id`. */
export type ClassId = Holds<Agree<(typeof Activity.fields)["id"], typeof id.schemas.select>>

/** `Activity.insert.make` takes a value with no `id`: the key is optional in its input. */
export type InsertTakesNoId = Holds<
  Same<{} extends Pick<(typeof Activity.insert)["~type.make.in"], "id"> ? true : false, true>
>
