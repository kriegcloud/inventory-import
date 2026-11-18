// The assistant's conversation for one table, kept in this browser so a hard refresh brings it back: each request,
// who answered, and the changes it made with what takes each back. It is keyed like the import's saved progress
// (`progressKey`: per person, organization and screen) and decoded on the way back, so an older shape is dropped.
import { Schema } from "effect"
import { ViewChange } from "../../../domain/TableView.ts"
import { progressKey, type ProgressScope } from "../saved-progress/store.ts"
import { Patch } from "./view.ts"

const Applied = Schema.Struct({
  change: ViewChange,
  label: Schema.String,
  patch: Patch,
  removed: Schema.Boolean
})
/** One change a request made, what it says, what takes it back, and whether the person removed it. */
export type Applied = typeof Applied.Type

const Entry = Schema.Struct({
  id: Schema.String,
  prompt: Schema.String,
  outcome: Schema.Literals(["applied", "refused", "failed"]),
  answeredBy: Schema.NullOr(Schema.String),
  note: Schema.NullOr(Schema.String),
  reason: Schema.NullOr(Schema.String),
  applied: Schema.Array(Applied),
  undone: Schema.Boolean
})
/** One request and what came of it. */
export type Entry = typeof Entry.Type

const Conversation = Schema.Struct({
  version: Schema.Literal(1),
  entries: Schema.Array(Entry),
  visibility: Schema.Record(Schema.String, Schema.Boolean)
})
/** Everything kept for one table. `visibility` is the columns as the assistant left them, which the address does not hold. */
export type Conversation = typeof Conversation.Type

/** A conversation before anything was asked. */
export const emptyConversation: Conversation = { version: 1, entries: [], visibility: {} }

const decode = Schema.decodeUnknownOption(Schema.fromJsonString(Conversation))
const encode = Schema.encodeOption(Schema.fromJsonString(Conversation))

/** The storage key of one table's conversation for one person. */
export const conversationKey = (scope: Omit<ProgressScope, "screen">, table: string) =>
  progressKey({ ...scope, screen: `assistant:${table}` })

/** Reads the conversation, dropping one that no longer decodes. */
export const readConversation = (key: string): Conversation => {
  try {
    const text = localStorage.getItem(key)
    if (text === null) return emptyConversation
    const found = decode(text)
    if (found._tag === "Some") return found.value
    localStorage.removeItem(key)
  } catch {
    // A private window or a refused store: the conversation starts empty, and the table still works.
  }
  return emptyConversation
}

/** Writes the conversation. A refusal (a private window, a full disk) is ignored: only the refresh loses it. */
export const writeConversation = (key: string, conversation: Conversation) => {
  const text = encode(conversation)
  if (text._tag === "None") return
  try {
    localStorage.setItem(key, text.value)
  } catch {
    // Kept in memory only.
  }
}
