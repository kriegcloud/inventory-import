// The table assistant's audit line, on D1.
import { Effect, Layer } from "effect"
import { AssistantLog } from "@inventory/catalog-model/AssistantLog"
import { SqlClient } from "effect/sql"
import { D1 } from "@beep/d1/D1"
import { auditLine, lineOf } from "./internal/auditLine.ts"
import { Activity } from "@inventory/kernel/Activity"

/** `AssistantLog` on D1: one insert into the audit trail. */
export const AssistantLogD1 = Layer.effect(
  AssistantLog,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const { run } = yield* D1
    const line = auditLine(sql)
    return AssistantLog.of({
      record: Effect.fn("TableAssistant.item")(function* (activity: Activity) {
        yield* run(line(lineOf(activity)))
      }, Effect.orDie)
    })
  })
)
