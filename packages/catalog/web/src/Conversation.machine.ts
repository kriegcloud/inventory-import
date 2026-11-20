// The assistant's conversation for one table, kept in this browser so a hard refresh brings it back: each request,
// who answered, and the changes it made with what takes each back. It is keyed like the import's saved progress
// (`progressKey`: per person, organization and screen) and decoded on the way back, so an older shape is dropped.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { ViewChange } from "@inventory/catalog-contract/TableView"
import { progressKey, type ProgressScope } from "@inventory/review/SavedProgress"
import { Patch } from "./internal/view.ts"

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
  // Who answered, kept as its case: the rules are told from a model by the case, never by a name a model could have.
  answeredBy: S.NullOr(AnsweredBy),
  note: S.NullOr(S.String),
  reason: S.NullOr(S.String),
  applied: S.Array(Applied),
  undone: S.Boolean
})
/** One request and what came of it. */
export type Entry = typeof Entry.Type

// Version 2 keeps who answered as its case; a version 1 conversation (a name) no longer decodes, so it is dropped.
const Conversation = S.Struct({
  version: S.Literal(2),
  entries: S.Array(Entry),
  visibility: S.Record(S.String, S.Boolean)
})
/** Everything kept for one table. `visibility` is the columns as the assistant left them, which the address does not hold. */
export type Conversation = typeof Conversation.Type

/** The name an entry's "Answered by" line gives: "Rules", or the model's own name. */
export const answererName: (answeredBy: AnsweredBy) => string = AnsweredBy.match({
  Rules: () => "Rules",
  Model: (by) => by.model
})

/**
 * True when the rules answered the conversation's last request, told by the case: a model whose name were "Rules" is
 * still a model, and the line on what the rules read is not shown under it.
 */
export const lastAnsweredByRules = (entries: ReadonlyArray<Entry>): boolean =>
  O.exists(
    O.flatMap(A.last(entries), (entry) => O.fromNullOr(entry.answeredBy)),
    AnsweredBy.guards.Rules
  )

/** A conversation before anything was asked. */
export const emptyConversation: Conversation = { version: 2, entries: [], visibility: {} }

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
    if (O.isSome(found)) return found.value
    localStorage.removeItem(key)
  } catch {
    // A private window or a refused store: the conversation starts empty, and the table still works.
  }
  return emptyConversation
}

/** Writes the conversation. A refusal (a private window, a full disk) is ignored: only the refresh loses it. */
export const writeConversation = (key: string, conversation: Conversation) => {
  const text = encode(conversation)
  if (O.isNone(text)) return
  try {
    localStorage.setItem(key, text.value)
  } catch {
    // Kept in memory only.
  }
}
