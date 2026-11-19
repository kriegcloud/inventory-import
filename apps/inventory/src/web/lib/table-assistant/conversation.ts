// The assistant's conversation for one table, kept in this browser so a hard refresh brings it back: each request,
// who answered, and the changes it made with what takes each back. It is keyed like the import's saved progress
// (`progressKey`: per person, organization and screen) and decoded on the way back, so an older shape is dropped.
import * as S from "effect/Schema"
import { ViewChange } from "@inventory/catalog-contract/TableView"
import { progressKey, type ProgressScope } from "@inventory/review/SavedProgress"
import { Patch } from "./view.ts"

const Applied = S.Struct({
  change: ViewChange,
  label: S.String,
  patch: Patch,
  removed: S.Boolean
})
/** One change a request made, what it says, what takes it back, and whether the person removed it. */
export type Applied = typeof Applied.Type

const Entry = S.Struct({
  id: S.String,
  prompt: S.String,
  outcome: S.Literals(["applied", "refused", "failed"]),
  answeredBy: S.NullOr(S.String),
  note: S.NullOr(S.String),
  reason: S.NullOr(S.String),
  applied: S.Array(Applied),
  undone: S.Boolean
})
/** One request and what came of it. */
export type Entry = typeof Entry.Type

const Conversation = S.Struct({
  version: S.Literal(1),
  entries: S.Array(Entry),
  visibility: S.Record(S.String, S.Boolean)
})
/** Everything kept for one table. `visibility` is the columns as the assistant left them, which the address does not hold. */
export type Conversation = typeof Conversation.Type

/** A conversation before anything was asked. */
export const emptyConversation: Conversation = { version: 1, entries: [], visibility: {} }

const decode = S.decodeUnknownOption(S.fromJsonString(Conversation))
const encode = S.encodeOption(S.fromJsonString(Conversation))

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
