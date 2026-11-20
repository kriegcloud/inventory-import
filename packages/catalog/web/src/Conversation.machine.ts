// The assistant's conversation for one table, kept in this browser so a hard refresh brings it back: each request,
// who answered, and the changes it made with what takes each back. It is keyed like the import's saved progress
// (`progressKey`: per person, organization and screen) and decoded on the way back: a version 1 conversation is
// converted, so its Undo buttons and the columns it left come back; any other shape is dropped.
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

// Version 2 keeps who answered as its case.
const Conversation = S.Struct({
  version: S.Literal(2),
  entries: S.Array(Entry),
  visibility: S.Record(S.String, S.Boolean)
})
/** Everything kept for one table. `visibility` is the columns as the assistant left them, which the address does not hold. */
export type Conversation = typeof Conversation.Type

// Version 1 kept who answered as a name: "Rules", or the model's id. Everything else is the same shape.
const EntryV1 = S.Struct({ ...Entry.fields, answeredBy: S.NullOr(S.String) })
const ConversationV1 = S.Struct({
  version: S.Literal(1),
  entries: S.Array(EntryV1),
  visibility: S.Record(S.String, S.Boolean)
})

/**
 * Who answered a version 1 request, as its case: the name "Rules" is the rules, with the line kept under it (what
 * the rules read) as the reason; any other name is the model of that id, asked through OpenRouter, the only provider
 * version 1 knew, as its first choice.
 */
const answeredByV1 = (name: string, note: string | null): AnsweredBy =>
  name === "Rules"
    ? AnsweredBy.cases.Rules.make({ reason: note ?? "" })
    : AnsweredBy.cases.Model.make({ provider: "openrouter", model: name, fallback: false })

/** A version 1 conversation as version 2: each entry's answerer turned into its case, the rest kept as it was. */
const fromV1 = (old: typeof ConversationV1.Type): Conversation => ({
  version: 2,
  entries: A.map(old.entries, (entry) => ({
    ...entry,
    answeredBy: entry.answeredBy === null ? null : answeredByV1(entry.answeredBy, entry.note)
  })),
  visibility: old.visibility
})

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
const decodeV1 = S.decodeUnknownOption(S.fromJsonString(ConversationV1))
const encode = S.encodeOption(S.fromJsonString(Conversation))

/** The storage key of one table's conversation for one person. */
export const conversationKey = (scope: Omit<ProgressScope, "screen">, table: string) =>
  progressKey({ ...scope, screen: `assistant:${table}` })

/** Reads the conversation, converting a version 1 one and dropping one that decodes as neither. */
export const readConversation = (key: string): Conversation => {
  try {
    const text = localStorage.getItem(key)
    if (text === null) return emptyConversation
    const found = O.orElse(decode(text), () => O.map(decodeV1(text), fromV1))
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
