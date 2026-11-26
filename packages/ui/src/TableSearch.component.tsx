import * as S from "effect/Schema"
import { dual } from "effect/Function"
import * as SchemaTransformation from "effect/SchemaTransformation"
import * as Eq from "effect/Equal"
import { closest } from "./internal/browser.ts"
import { Search, X } from "lucide-react"
import type { RowData, Table } from "@tanstack/react-table"
import { useAtomMount, useAtomValue } from "@effect/atom-react"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import type * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { useId } from "react"
import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@inventory/ui/components/input-group"
import { Kbd } from "@inventory/ui/components/kbd"
import { Spinner } from "@inventory/ui/components/spinner"

const SearchText = S.Struct({
  text: S.String.pipe(S.annotateKey({ description: "The unchanged field spelling" })),
  search: S.Trim.pipe(S.annotateKey({ description: "The trimmed text asked of the table" }))
}).annotate({ description: "Both the displayed spelling and the search read at text entry." })
const readSearchText = S.decodeOption(SearchText)
const CommandKey = S.String.pipe(S.decode(SchemaTransformation.toLowerCase())).annotate({
  description: "Case-insensitive search shortcut key."
})
const readCommandKey = S.decodeOption(CommandKey)
const commandK = readCommandKey("k")

/** How long a typed search waits for the next keystroke before it is asked for, as the column filters wait. */
const typingPause = 300

// Whether a key pressed here belongs to a field the person is typing in, where "/" is a character.
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** What the person typed, and the search the table held when they typed it. */
interface Typed {
  readonly text: string
  readonly search: string
  readonly over: string
}

/** One box's own state: what was typed, whether its search is still to be asked for, and the last text it asked. */
interface Box {
  readonly typed: O.Option<Typed>
  readonly waiting: boolean
  readonly asked: O.Option<string>
}

/** What the box shows: the text in the field, the search it stands for, and whether an ask is on its way. */
interface Shown {
  readonly draft: string
  readonly asked: string
  readonly search: O.Option<string>
  readonly askedSearch: O.Option<string>
  readonly waiting: boolean
}

/** The part of a data table the box works with: the search it holds, and the way to ask it for another. */
type Searched = Pick<Table<DataTableFeatures, RowData>, "atoms" | "setGlobalFilter">

/** One box's atoms and what its field can ask of them. */
interface BoxScoped {
  readonly shown: Atom.Atom<Shown>
  /** Mounted while the box is drawn: asks the table for the typed text once the typing has paused. */
  readonly asks: Atom.Atom<void>
  /** Mounted while the box is drawn: "/" or Ctrl+K (⌘K) anywhere puts the caret in the field. */
  readonly keys: Atom.Atom<void>
  readonly type: (text: string) => void
  /** Enter: asks now, without the pause. */
  readonly askNow: () => void
  /** Escape or the cross: empties the field and the search, and puts the caret back. */
  readonly clear: () => void
}

const makeBox: {
  (registry: AtomRegistry.AtomRegistry): (input: { readonly fieldId: string; readonly table: Searched }) => BoxScoped
  (input: { readonly fieldId: string; readonly table: Searched }, registry: AtomRegistry.AtomRegistry): BoxScoped
} = dual(
  2,
  (input: { readonly fieldId: string; readonly table: Searched }, registry: AtomRegistry.AtomRegistry): BoxScoped => {
    const { fieldId, table } = input
    const heldNow = (): string => {
      const search: unknown = table.atoms.globalFilter.get()
      return typeof search === "string" ? search : ""
    }
    // The search the table holds now (the page address, where the table keeps it there): the table's own state, which
    // the box listens to as an atom listens to anything outside. The assistant, Reset or a link changes what it says.
    const held = Atom.readable((get) => {
      const subscription = table.atoms.globalFilter.subscribe(() => get.setSelf(heldNow()))
      get.addFinalizer(() => subscription.unsubscribe())
      return heldNow()
    })
    const box = Atom.make<Box>({ typed: O.none(), waiting: false, asked: O.none() })
    // What was typed counts while the table's search is still the last one this box asked for (its own echo) or, before
    // it asked anything, the one it was typed over. A search changed from elsewhere (the assistant, Reset, a link) shows
    // instead, even one back to where the typing started, and a pause that was still running asks nothing.
    const shown = Atom.readable((get): Shown => {
      const now = get(box)
      const value = get(held)
      return O.match(now.typed, {
        onNone: () => ({
          draft: value,
          asked: value,
          search: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
          askedSearch: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
          waiting: false
        }),
        onSome: (typed) =>
          O.match(now.asked, {
            onNone: () =>
              typed.over === value
                ? {
                    draft: typed.text,
                    asked: value,
                    search: O.some(typed.search),
                    askedSearch: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
                    waiting: now.waiting
                  }
                : {
                    draft: value,
                    asked: value,
                    search: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
                    askedSearch: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
                    waiting: false
                  },
            onSome: (asked) =>
              asked === value
                ? {
                    draft: typed.text,
                    asked,
                    search: O.some(typed.search),
                    askedSearch: O.map(readSearchText({ text: asked, search: asked }), (text) => text.search),
                    waiting: now.waiting
                  }
                : {
                    draft: value,
                    asked: value,
                    search: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
                    askedSearch: O.map(readSearchText({ text: value, search: value }), (text) => text.search),
                    waiting: false
                  }
          })
      })
    })
    const ask = (text: string) => {
      registry.update(box, (now) => ({ ...now, asked: O.some(text), waiting: false }))
      table.setGlobalFilter(text)
    }
    // The typed text, published once the typing has stopped for the pause.
    const typed = Atom.map(box, (now) => now.typed)
    const paused = Atom.debounce(typed, typingPause)
    const field = () => document.getElementById(fieldId)
    return {
      shown,
      // Let go the moment nothing mounts it: a box that has gone asks nothing and hears no key.
      asks: Atom.setIdleTTL(
        Atom.readable((get) => {
          get.subscribe(paused, (after) => {
            const now = registry.get(box)
            // Asked after the pause, unless it was asked already (Enter, the cross), the person typed on, or the search
            // was changed from elsewhere meanwhile.
            if (O.isNone(after) || !now.waiting || now.typed !== after || after.value.over !== heldNow()) return
            ask(after.value.search)
          })
        }),
        0
      ),
      keys: Atom.setIdleTTL(
        Atom.readable((get) => {
          const onKey = (event: KeyboardEvent) => {
            const slash =
              event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !typingIn(event.target)
            const command =
              Eq.equals(readCommandKey(event.key), commandK) && (event.ctrlKey || event.metaKey) && !event.altKey
            // A dialog open over the table keeps its keys.
            const inDialog = event.target instanceof Element && O.isSome(closest("[role=dialog]")(event.target))
            const node = field()
            if ((!slash && !command) || inDialog || !(node instanceof HTMLInputElement)) return
            event.preventDefault()
            node.focus()
            node.select()
          }
          document.addEventListener("keydown", onKey)
          get.addFinalizer(() => document.removeEventListener("keydown", onKey))
        }),
        0
      ),
      type: (text) => {
        const read = readSearchText({ text, search: text })
        if (O.isNone(read)) return
        const same = O.contains(registry.get(shown).askedSearch, read.value.search)
        // Typing starts again from the search the table holds now: the last ask is behind it.
        registry.update(box, (now) => ({
          ...now,
          typed: O.some({ ...read.value, over: heldNow() }),
          asked: O.none(),
          waiting: !same
        }))
      },
      askNow: () => {
        const now = registry.get(shown)
        O.map(now.search, (search) => {
          if (search !== now.asked) ask(search)
          else registry.update(box, (before) => ({ ...before, waiting: false }))
        })
      },
      clear: () => {
        const { asked } = registry.get(shown)
        registry.update(box, (now) => ({
          ...now,
          typed: O.some({ text: "", search: "", over: heldNow() }),
          asked: O.none()
        }))
        if (asked !== "") ask("")
        else registry.update(box, (now) => ({ ...now, waiting: false }))
        field()?.focus()
      }
    }
  }
)

/**
 * One box's own, made when the box is first drawn from the id of its field and the table it searches: what was typed,
 * the pause before it is asked for (`Atom.debounce`), and the keys that put the caret in it.
 */
const BoxScope = ScopedAtom.make((input: { readonly fieldId: string; readonly table: Searched }) =>
  Atom.readable((get) => makeBox(input, get.registry))
)

type TableSearchProps<Row extends RowData> = {
  /** The table whose rows are searched: the box shows the search it holds, and asks it for the typed one. */
  readonly table: Pick<Table<DataTableFeatures, Row>, "atoms" | "setGlobalFilter">
  readonly placeholder: string
  /**
   * The table is fetching rows (for this search, or again for a return to the page): the box shows it is working, the
   * rows on screen stay.
   */
  readonly working: boolean
  readonly maxLength: number
  /** Shows "/" in the empty box. Off where there is no keyboard to press it on. */
  readonly shortcutHint: boolean
  readonly className?: string
}

/**
 * The person types words to find in a table; the table is asked for them after a pause in the typing. "/" or Ctrl+K
 * (⌘K) puts the caret here, Escape or the cross empties it. The box shows the search the table holds now (the page
 * address, where the table keeps it there), so the assistant, Reset or a link changes what the box shows.
 */
export function TableSearch<Row extends RowData>(props: TableSearchProps<Row>) {
  const fieldId = useId()
  return (
    // One scope serves every kind of row: the box reads the table's search and nothing of its rows.
    <BoxScope.Provider value={{ fieldId, table: props.table as never }}>
      <SearchBox {...props} fieldId={fieldId} />
    </BoxScope.Provider>
  )
}

function SearchBox<Row extends RowData>(props: TableSearchProps<Row> & { readonly fieldId: string }) {
  const box = useAtomValue(BoxScope.use())
  const { draft, waiting } = useAtomValue(box.shown)
  useAtomMount(box.asks)
  useAtomMount(box.keys)
  const busy = waiting || props.working
  return (
    <InputGroup className={props.className}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        id={props.fieldId}
        // A plain text field with the search role: the browser's own clear button would be a second cross.
        type="text"
        role="searchbox"
        inputMode="search"
        enterKeyHint="search"
        aria-label={props.placeholder}
        aria-keyshortcuts="/ Control+K Meta+K"
        aria-busy={busy}
        placeholder={props.placeholder}
        value={draft}
        maxLength={props.maxLength}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => box.type(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") box.askNow()
          if (event.key === "Escape" && draft !== "") {
            event.preventDefault()
            box.clear()
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        {busy ? <Spinner aria-label={waiting ? "Searching" : "Updating"} /> : null}
        {draft === "" ? (
          props.shortcutHint ? (
            <Kbd aria-hidden>/</Kbd>
          ) : null
        ) : (
          <InputGroupButton size="icon-xs" aria-label="Clear the search" title="Clear the search" onClick={box.clear}>
            <X />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
