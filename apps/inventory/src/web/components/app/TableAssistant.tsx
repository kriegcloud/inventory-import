import { stringify } from "@/ui-kit/Json.codec"
import { useMutation } from "@tanstack/react-query"
import { ArrowUp, ChevronRight, MessageSquarePlus, Sparkles, Undo2, X } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { Clock, Effect, Result } from "effect"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { useActor } from "@/lib/actor"
import { call } from "@/lib/api"
import { sayError } from "@/lib/errors"
import {
  type Conversation,
  conversationKey,
  emptyConversation,
  type Entry,
  readConversation,
  writeConversation
} from "@/lib/table-assistant/conversation"
import { applyAll, describe, overtaken, takeBack, type ViewFilter, type ViewState } from "@/lib/table-assistant/view"
import { type ColumnCatalog, maxPrompt, rulesRead } from "../../../domain/TableView.ts"

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
  const { actor } = useActor()
  const key =
    actor === undefined
      ? undefined
      : conversationKey({ organizationId: actor.organizationId, memberId: actor.id }, props.name)
  const [conversation, setConversation] = useState<Conversation>(() =>
    key === undefined ? emptyConversation : readConversation(key)
  )
  const [open, setOpen] = useState(false)
  const [prompt, setPrompt] = useState("")
  const [pending, setPending] = useState<string | null>(null)
  const view = useTableView(props.table, props.searchable)
  const end = useRef<HTMLDivElement>(null)
  const promptField = useRef<HTMLInputElement>(null)

  const save = (next: Conversation) => {
    setConversation(next)
    if (key !== undefined) writeConversation(key, next)
  }

  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" })
  }, [conversation.entries.length, pending, open])

  const ask = useMutation({
    mutationFn: (words: string) =>
      call((api) =>
        api.assistant.view({
          payload: { prompt: words, table: props.name, columns: props.columns, searchable: props.searchable }
        })
      )
  })

  const record = (entry: Entry, visibility: Readonly<Record<string, boolean>>) =>
    save({ ...conversation, entries: [...conversation.entries, entry], visibility: { ...visibility } })

  const send = (words: string) => {
    const typed = words.trim()
    if (typed === "" || pending !== null) return
    setPrompt("")
    setPending(typed)
    const id = `${Effect.runSync(Clock.currentTimeMillis)}`
    ask.mutate(typed, {
      onSettled: () => setPending(null),
      onError: (error) => {
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
      },
      onSuccess: (outcome) => {
        if (Result.isFailure(outcome)) {
          const failure = outcome.failure
          record(
            {
              id,
              prompt: typed,
              outcome: "refused",
              answeredBy: failure.by === "rules" ? "Rules" : failure.model,
              note: failure.note,
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
        const after = applyAll({ state: before, changes: answer.changes, columns: props.columns, opened: props.opened })
        view.write(before, after.state)
        record(
          {
            id,
            prompt: typed,
            outcome: "applied",
            answeredBy: answer.by === "rules" ? "Rules" : answer.model,
            note: answer.note,
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
    })
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

  const suggestions = useMemo(() => suggestionsFor(props.columns), [props.columns])
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
          <div ref={end} />
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
