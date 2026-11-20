import * as Match from "effect/Match"
import { stringify } from "@inventory/ui/Json"
import { ArrowUp, ChevronRight, MessageSquarePlus, Sparkles, Undo2, X } from "lucide-react"
import { useAtom, useAtomMount, useAtomSet, useAtomSubscribe } from "@effect/atom-react"
import * as Cause from "effect/Cause"
import * as Exit from "effect/Exit"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { type FormEvent, useRef } from "react"
import * as Clock from "effect/Clock"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import { Button } from "@inventory/ui/components/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@inventory/ui/components/collapsible"
import { Input } from "@inventory/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@inventory/ui/components/popover"
import { Spinner } from "@inventory/ui/components/spinner"
import { member, memberKey } from "@inventory/client/MemberAtoms"
import { apiRuntime, perKey } from "@inventory/client/Api"
import { useAtomValue } from "@effect/atom-react"
import { catalogApi } from "./Catalog.runtime.ts"
import { sayError } from "@inventory/client/SayError"
import {
  type Conversation,
  conversationKey,
  emptyConversation,
  type Entry,
  readConversation,
  writeConversation
} from "./Conversation.machine.ts"
import { applyAll, describe, overtaken, takeBack, type ViewFilter, type ViewState } from "./internal/view.ts"
import type { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { rulesRead } from "@inventory/catalog-model/TableViewRules"
import { type ColumnCatalog, maxPrompt } from "@inventory/catalog-contract/TableView"
/**
 * Who answered and the line under it, as the conversation keeps them: "Rules" with the reason no model answered, or
 * the model's name with what it said it could not do.
 */
const whoAnswered = (answer: {
  readonly answeredBy: AnsweredBy
  readonly note: O.Option<string>
}): { readonly answeredBy: string; readonly note: string | null } =>
  Match.valueTags(answer.answeredBy, {
    Rules: (by) => ({ answeredBy: "Rules", note: by.reason }),
    Model: (by) => ({ answeredBy: by.model, note: O.getOrNull(answer.note) })
  })

/** The parts of a TanStack table the assistant reads and writes: the table's own state, never a copy of it. */
export type AssistedTable = {
  readonly atoms: {
    readonly sorting: { get(): ReadonlyArray<{ readonly id: string; readonly desc: boolean }> }
    readonly columnFilters: { get(): ReadonlyArray<unknown> }
    readonly columnVisibility: { get(): Readonly<Record<string, boolean>> }
    readonly globalFilter?: { get(): unknown }
  }
  setSorting(next: Array<{ id: string; desc: boolean }>): void
  setColumnFilters(next: Array<never>): void
  setColumnVisibility(next: Record<string, boolean>): void
  setGlobalFilter(next: string): void
}

/** Reads and writes the parts of a table's view the assistant may change. */
export function useTableView(table: AssistedTable, searchable: boolean) {
  return {
    read: (): ViewState => {
      const search = table.atoms.globalFilter?.get()
      return {
        sorting: table.atoms.sorting.get(),
        filters: table.atoms.columnFilters.get() as ReadonlyArray<ViewFilter>,
        visibility: table.atoms.columnVisibility.get(),
        search: typeof search === "string" ? search : ""
      }
    },
    write: (before: ViewState, next: ViewState) => {
      if (stringify(before.sorting) !== stringify(next.sorting)) table.setSorting([...next.sorting])
      if (stringify(before.filters) !== stringify(next.filters)) {
        table.setColumnFilters(next.filters.map((filter) => ({ ...filter })) as Array<never>)
      }
      if (stringify(before.visibility) !== stringify(next.visibility)) {
        table.setColumnVisibility({ ...next.visibility })
      }
      if (searchable && before.search !== next.search) table.setGlobalFilter(next.search)
    }
  }
}

/** The columns the assistant has hidden or shown, kept from before a refresh, for the table's first state. */
export function keptVisibility(table: string, organizationId: string | undefined, memberId: string | undefined) {
  if (organizationId === undefined || memberId === undefined) return {}
  return readConversation(conversationKey({ organizationId, memberId }, table)).visibility
}

const suggestionsFor = (columns: ColumnCatalog): ReadonlyArray<string> => {
  const sortable = columns.find((column) => column.sortable && column.type === "text")
  const hideable = columns.find((column) => column.hideable && column.type === "text")
  const listed = columns.find((column) => column.type === "select" && column.values.length > 0)
  return [
    ...(sortable === undefined ? [] : [`Sort by ${sortable.label}`]),
    ...(listed === undefined ? [] : [`Only ${listed.values[0]}`]),
    ...(hideable === undefined ? [] : [`Hide ${hideable.label}`]),
    "Clear"
  ]
}

/** One person's conversation with the assistant about one table, kept in this browser (`writeConversation`). */
const conversationOf = perKey((key: string) =>
  Atom.writable(
    () => readConversation(key),
    (ctx, next: Conversation) => {
      writeConversation(key, next)
      ctx.setSelf(next)
    }
  )
)

/** The conversation while nobody is known yet: nothing to keep. */
const noConversation = Atom.make<Conversation>(emptyConversation)

/** One table's assistant on screen: open or not, and what is typed. */
const assistantOf = perKey((_table: string) =>
  Atom.make<{ readonly open: boolean; readonly prompt: string }>({ open: false, prompt: "" })
)

/**
 * The request on its way for one person's conversation about one table: what they asked. Kept while it is out, since
 * the request outlives the screen: a person who leaves the table and comes back before the answer still reads
 * "Working", and cannot ask a second time.
 */
const assistantPending = perKey((_conversation: string) => Atom.make<O.Option<string>>(O.none()).pipe(Atom.keepAlive))
const noPending = Atom.make<O.Option<string>>(O.none())

/** A drawing of one table's assistant: another number each time the assistant comes on screen. */
export type AssistantScreen = { readonly table: string; readonly drawing: number }

/** Counts the drawings of every assistant, so no two are the same. */
const drawings = Atom.make(0).pipe(Atom.keepAlive)

/** Which drawing of a table's assistant is on screen now; none while it is not drawn. */
export const assistantScreen = perKey((_table: string) =>
  Atom.make<O.Option<AssistantScreen>>(O.none()).pipe(Atom.keepAlive)
)

/**
 * Mounted while a table's assistant is drawn: names this drawing as the one on screen, and takes that back the moment
 * it leaves (no idle time: an answer that lands just after must not find the screen it left).
 */
export const assistantPresent = perKey((table: string) =>
  Atom.setIdleTTL(
    Atom.readable((get) => {
      const registry = get.registry
      registry.update(drawings, (n) => n + 1)
      const drawing = registry.get(drawings)
      registry.set(assistantScreen(table), O.some({ table, drawing }))
      get.addFinalizer(() =>
        registry.update(assistantScreen(table), (now) =>
          O.exists(now, (drawn) => drawn.drawing === drawing) ? O.none() : now
        )
      )
    }),
    0
  )
)

/** Where a request was asked from: who was signed in to which organization, and which drawing of the assistant. */
export interface AskedFrom {
  readonly member: string
  readonly screen: O.Option<AssistantScreen>
}

/** Where a request asked now would be asked from. */
export const askingFrom = (registry: AtomRegistry.AtomRegistry, table: string): AskedFrom => ({
  member: registry.get(memberKey),
  screen: registry.get(assistantScreen(table))
})

/**
 * True when an answer may still change the table: the same person is signed in to the same organization, and the
 * drawing of the assistant that asked is still the one on screen. The path alone does not say so: the person may have
 * left the table and come back to a fresh view of it, or switched organization without leaving the address.
 */
export const stillAsked = (input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly table: string
  readonly asked: AskedFrom
}): boolean => {
  const now = askingFrom(input.registry, input.table)
  return (
    now.member === input.asked.member &&
    O.exists(now.screen, (here) => O.exists(input.asked.screen, (asked) => asked.drawing === here.drawing))
  )
}

/** The registry these atoms live in, for what answers after the draw that asked. */
const registryOf = Atom.readable((get) => get.registry)

/** What the assistant is asked: the words, the table, its columns, and whether it can be searched. */
interface Asked {
  readonly prompt: string
  readonly table: string
  readonly columns: ColumnCatalog
  readonly searchable: boolean
}

/** One request to the assistant, sent once: a model's answer is not asked for twice. */
const askAssistant = apiRuntime.fn<Asked>()((asked: Asked) =>
  catalogApi.ask((api) => api.assistant.view({ payload: asked }))
)

/** Where one table's conversation ends now: a new value when it has a new last line. */
type LastLine = { readonly table: string; readonly line: string }

/**
 * What says the conversation about one table has a new last line: a line was added, a request started or ended, or
 * the panel opened. One atom per table and conversation.
 */
const lastLine = perKey((table: string) =>
  perKey((conversation: string) =>
    Atom.withEquality(
      Atom.readable((get): LastLine => ({
        table,
        line: `${get(conversationOf(conversation)).entries.length}:${O.getOrElse(get(assistantPending(conversation)), () => "")}:${get(assistantOf(table)).open}`
      })),
      (before, next) => before.line === next.line
    )
  )
)
const noLine: Atom.Atom<LastLine> = Atom.make<LastLine>({ table: "", line: "" })

/** For `lastLine`: brings the newest line of that table's conversation into view, a frame later, when it is drawn. */
const bringNewest = (now: LastLine): void => {
  requestAnimationFrame(() =>
    document.querySelector(`[data-assistant-end="${CSS.escape(now.table)}"]`)?.scrollIntoView({ block: "nearest" })
  )
}

/**
 * The person types what they want to see in a table; the assistant changes the table's sort, filters and columns, and
 * lists what it changed so each change can be taken back.
 */
export function TableAssistant(props: {
  readonly table: AssistedTable
  /** The table's name as the person reads it, which also keeps its conversation apart from another table's. */
  readonly name: string
  readonly columns: ColumnCatalog
  readonly searchable: boolean
  /** The view as the table opens, which "clear" returns to. */
  readonly opened: ViewState
}) {
  const signedIn = useAtomValue(member)
  const actor = O.getOrUndefined(signedIn)
  const key =
    actor === undefined
      ? undefined
      : conversationKey({ organizationId: actor.organizationId, memberId: actor.id }, props.name)
  const conversationAtom = key === undefined ? noConversation : conversationOf(key)
  const [conversation, save] = useAtom(conversationAtom)
  const [ui, setUi] = useAtom(assistantOf(props.name))
  const { open, prompt } = ui
  const [out, setOut] = useAtom(key === undefined ? noPending : assistantPending(key))
  const pending = O.getOrNull(out)
  const registry = useAtomValue(registryOf)
  // This drawing of the assistant is the one on screen for as long as it is mounted.
  useAtomMount(assistantPresent(props.name))
  // The newest line is brought into view when it arrives.
  useAtomSubscribe(key === undefined ? noLine : lastLine(props.name)(key), bringNewest)
  const setOpen = (next: boolean) => setUi((now) => ({ ...now, open: next }))
  const setPrompt = (next: string) => setUi((now) => ({ ...now, prompt: next }))
  const view = useTableView(props.table, props.searchable)
  const promptField = useRef<HTMLInputElement>(null)
  const ask = useAtomSet(askAssistant, { mode: "promiseExit" })

  // Added to the conversation as it stands when the answer lands, not as it stood when the question was asked.
  const record = (entry: Entry, visibility?: Readonly<Record<string, boolean>>) => {
    const now = registry.get(conversationAtom)
    registry.set(conversationAtom, {
      ...now,
      entries: [...now.entries, entry],
      visibility: { ...(visibility ?? now.visibility) }
    })
  }

  const send = (words: string) => {
    const typed = words.trim()
    if (typed === "" || pending !== null) return
    setUi((now) => ({ ...now, prompt: "" }))
    setOut(O.some(typed))
    const id = `${Effect.runSync(Clock.currentTimeMillis)}`
    // Who asked, and from which drawing of this table's assistant: an answer that arrives after the person has left
    // it (another screen, the same table opened again, another organization) changes nothing.
    const asked = askingFrom(registry, props.name)
    void ask({ prompt: typed, table: props.name, columns: props.columns, searchable: props.searchable }).then(
      (exit) => {
        setOut(O.none())
        if (!stillAsked({ registry, table: props.name, asked })) {
          // The request outlives the screen. Applied now, the view would be written through the table the person
          // left into the address of whatever they are on, and the conversation would list changes the table never
          // showed.
          record({
            id,
            prompt: typed,
            outcome: "failed",
            answeredBy: null,
            note: null,
            reason: `The answer came after you left ${props.name}, so nothing was changed. Ask again.`,
            applied: [],
            undone: false
          })
          return
        }
        if (Exit.isFailure(exit)) {
          const error = exit.cause.pipe(Cause.squash)
          record(
            {
              id,
              prompt: typed,
              outcome: "failed",
              answeredBy: null,
              note: null,
              reason: sayError(error).sentence,
              applied: [],
              undone: false
            },
            view.read().visibility
          )
          return
        }
        const outcome = exit.value
        {
          if (Result.isFailure(outcome)) {
            const failure = outcome.failure
            record(
              {
                id,
                prompt: typed,
                outcome: "refused",
                ...whoAnswered(failure),
                reason: failure.reason,
                applied: [],
                undone: false
              },
              view.read().visibility
            )
            return
          }
          const answer = outcome.success
          const before = view.read()
          const after = applyAll({
            state: before,
            changes: answer.changes,
            columns: props.columns,
            opened: props.opened
          })
          view.write(before, after.state)
          record(
            {
              id,
              prompt: typed,
              outcome: "applied",
              ...whoAnswered(answer),
              reason: null,
              applied: answer.changes.map((change, index) => ({
                change,
                label: describe(props.columns, change),
                patch: after.patches[index] ?? {},
                removed: false
              })),
              undone: false
            },
            after.state.visibility
          )
        }
      }
    )
  }

  const update = (id: string, change: (entry: Entry, now: ViewState) => { entry: Entry; next: ViewState }) => {
    const now = view.read()
    let next = now
    const entries = conversation.entries.map((entry) => {
      if (entry.id !== id) return entry
      const done = change(entry, now)
      next = done.next
      return done.entry
    })
    view.write(now, next)
    save({ ...conversation, entries, visibility: { ...next.visibility } })
  }

  // The changes still in force after a given one, across every later request, in order.
  const laterThan = (id: string, index: number) => {
    const at = conversation.entries.findIndex((entry) => entry.id === id)
    return conversation.entries.flatMap((entry, e) =>
      entry.applied.flatMap((applied, i) =>
        !applied.removed && (e > at || (e === at && i > index)) ? [applied.change] : []
      )
    )
  }

  // Every change before a given one, removed or not, in order.
  const earlierThan = (id: string, index: number) => {
    const at = conversation.entries.findIndex((entry) => entry.id === id)
    return conversation.entries.flatMap((entry, e) => entry.applied.filter((_, i) => e < at || (e === at && i < index)))
  }

  // A change a later one has overtaken is only marked removed: taking it back would undo the later change too.
  const removeChange = (id: string, index: number) =>
    update(id, (entry, now) => {
      const applied = entry.applied[index]
      if (applied === undefined || applied.removed) return { entry, next: now }
      return {
        entry: { ...entry, applied: entry.applied.map((a, i) => (i === index ? { ...a, removed: true } : a)) },
        next: overtaken(applied.change, laterThan(id, index)) ? now : takeBack(now, applied, earlierThan(id, index))
      }
    })

  // The request's changes are taken back last first, each as if the person removed it.
  const undo = (id: string) =>
    update(id, (entry, now) => {
      const after = laterThan(id, entry.applied.length)
      let next = now
      const applied = entry.applied.map((a) => ({ ...a }))
      for (let i = applied.length - 1; i >= 0; i--) {
        const one = applied[i]
        if (one === undefined || one.removed) continue
        if (!overtaken(one.change, after)) {
          next = takeBack(next, one, [...earlierThan(id, 0), ...applied.slice(0, i)])
        }
        applied[i] = { ...one, removed: true }
      }
      return { entry: { ...entry, undone: true, applied }, next }
    })

  const suggestions = suggestionsFor(props.columns)
  const latest = pending ?? conversation.entries[conversation.entries.length - 1]?.prompt

  const submit = (event: FormEvent) => {
    event.preventDefault()
    send(prompt)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Ask the table assistant" title="Ask the table assistant">
          <Sparkles />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        // Opening puts the caret in the prompt, not on Close: the person opened it to type.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          promptField.current?.focus()
        }}
        className="flex max-h-(--radix-popover-content-available-height) w-80 flex-col sm:w-96"
      >
        <div className="flex items-start gap-2 border-b pb-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Table assistant</h2>
            <p className="truncate text-xs text-muted-foreground" title={latest}>
              {latest ?? `Say what you want to see in ${props.name}`}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            title="New conversation"
            disabled={conversation.entries.length === 0 || pending !== null}
            onClick={() => save({ ...conversation, entries: [] })}
          >
            <MessageSquarePlus />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" title="Close" onClick={() => setOpen(false)}>
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto py-2" aria-live="polite">
          {conversation.entries.length === 0 && pending === null ? (
            <p className="py-4 text-sm text-muted-foreground">
              {props.searchable
                ? "Ask for a view: find items, sort, filter, hide or show columns."
                : "Ask for a view: sort, filter, hide or show columns."}{" "}
              It changes only what you see, never the items.
            </p>
          ) : null}
          <ol className="flex flex-col gap-3">
            {conversation.entries.map((entry, index) => (
              <li key={entry.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium">{entry.prompt}</p>
                {entry.answeredBy === null ? null : (
                  <p className="text-xs text-muted-foreground">Answered by {entry.answeredBy}</p>
                )}
                {entry.reason === null ? null : <p className="text-sm text-destructive">{entry.reason}</p>}
                {entry.note === null || entry.note === conversation.entries[index - 1]?.note ? null : (
                  <p className="text-xs text-muted-foreground">{entry.note}</p>
                )}
                {entry.applied.length === 0 ? null : (
                  <Collapsible defaultOpen>
                    <div className="flex items-center gap-1">
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="group -ml-2">
                          <ChevronRight className="transition-transform group-data-[state=open]:rotate-90" />
                          Applied changes
                        </Button>
                      </CollapsibleTrigger>
                      {entry.undone || entry.applied.every((applied) => applied.removed) ? (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {entry.undone ? "Undone" : "All removed"}
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => undo(entry.id)}>
                          <Undo2 />
                          Undo
                        </Button>
                      )}
                    </div>
                    <CollapsibleContent>
                      <ul className="flex flex-col">
                        {entry.applied.map((applied, index) => (
                          <li key={`${entry.id}-${index}`} className="flex items-center gap-2 py-0.5 text-sm">
                            <span className={applied.removed ? "flex-1 text-muted-foreground line-through" : "flex-1"}>
                              {applied.label}
                            </span>
                            {applied.removed ? (
                              <span className="text-xs text-muted-foreground">Removed</span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`Remove: ${applied.label}`}
                                title="Remove this change"
                                onClick={() => removeChange(entry.id, index)}
                              >
                                <X />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </li>
            ))}
            {pending === null ? null : (
              <li className="flex flex-col gap-1">
                <p className="text-sm font-medium">{pending}</p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner />
                  Working…
                </p>
              </li>
            )}
          </ol>
          {/* Where the conversation ends: brought into view when a line arrives (`lastLine`). */}
          <div data-assistant-end={props.name} />
        </div>
        <div className="flex flex-col gap-2 border-t pt-2">
          <form className="flex gap-2" onSubmit={submit}>
            <Input
              ref={promptField}
              aria-label="What do you want to see?"
              placeholder={
                props.searchable ? "Find brackets, sort by name, only Box" : "Sort by name, only Box, hide Note"
              }
              value={prompt}
              maxLength={maxPrompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <Button type="submit" size="icon" aria-label="Send" disabled={pending !== null || prompt.trim() === ""}>
              <ArrowUp />
            </Button>
          </form>
          {conversation.entries[conversation.entries.length - 1]?.answeredBy === "Rules" ? (
            <p className="text-xs text-muted-foreground">{rulesRead}</p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((words) => (
              <Button key={words} variant="outline" size="xs" disabled={pending !== null} onClick={() => send(words)}>
                {words}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
