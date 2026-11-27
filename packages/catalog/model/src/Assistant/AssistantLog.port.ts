// The table assistant's one trace: an audit line when a model answered. It changes nothing else, so this port has
// one method and no read.
import type { Activity } from "@inventory/kernel/Activity"
import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"

/** Where the table assistant's audit line goes. */
export class AssistantLog extends Context.Service<
  AssistantLog,
  {
    /** Records that a model answered a request for a view. An answer from the rules is a read and leaves no line. */
    readonly record: (line: Activity) => Effect.Effect<void>
  }
>()("@inventory/catalog-model/Assistant/AssistantLog.port/AssistantLog") {}
