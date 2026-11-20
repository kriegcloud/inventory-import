import { Search, X } from "lucide-react"
import { useAtom, useAtomMount, useAtomValue } from "@effect/atom-react"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { useId, useRef } from "react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@inventory/ui/components/input-group"
import { Kbd } from "@inventory/ui/components/kbd"
import { Spinner } from "@inventory/ui/components/spinner"
import { useDebouncedCallback } from "@inventory/ui/hooks/use-debounced-callback"

/** How long a typed search waits for the next keystroke before it is asked for, as the column filters wait. */
const typingPause = 300

// Whether a key pressed here belongs to a field the person is typing in, where "/" is a character.
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/** What the person typed, and the search the table held when they typed it. */
interface Typed {
  readonly text: string
  readonly over: string
}

/** One box's own state: what was typed, whether its search is still to be asked for, and the last text it asked. */
interface Box {
  readonly typed: O.Option<Typed>
  readonly waiting: boolean
  readonly asked: O.Option<string>
}

/**
 * One box's own, made when the box is first drawn from the id of its field: its state, and the keys that put the
 * caret in it. "/" or Ctrl+K (⌘K) anywhere focuses the field while the box is on screen: an atom that listens to the
 * page for as long as the box mounts it, and is let go with the box at once.
 */
const BoxScope = ScopedAtom.make((fieldId: string) =>
  Atom.readable(() => ({
    box: Atom.make<Box>({ typed: O.none(), waiting: false, asked: O.none() }),
    keys: Atom.setIdleTTL(
      Atom.readable((get) => {
        const onKey = (event: KeyboardEvent) => {
          const slash =
            event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !typingIn(event.target)
          const command = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey
          // A dialog open over the table keeps its keys.
          const inDialog = event.target instanceof Element && event.target.closest("[role=dialog]") !== null
          const field = document.getElementById(fieldId)
          if ((!slash && !command) || inDialog || !(field instanceof HTMLInputElement)) return
          event.preventDefault()
          field.focus()
          field.select()
        }
        document.addEventListener("keydown", onKey)
        get.addFinalizer(() => document.removeEventListener("keydown", onKey))
      }),
      0
    )
  }))
)

type TableSearchProps = {
  readonly value: string
  readonly onSearch: (text: string) => void
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
 * The person types words to find in a table; the table asks for them after a pause in the typing. "/" or Ctrl+K
 * (⌘K) puts the caret here, Escape or the cross empties it. `value` is the search the table holds now (the page
 * address), so the assistant, Reset or a link changes what the box shows.
 */
export function TableSearch(props: TableSearchProps) {
  const fieldId = useId()
  return (
    <BoxScope.Provider value={fieldId}>
      <SearchBox {...props} fieldId={fieldId} />
    </BoxScope.Provider>
  )
}

function SearchBox(props: TableSearchProps & { readonly fieldId: string }) {
  const scope = useAtomValue(BoxScope.use())
  const [box, setBox] = useAtom(scope.box)
  useAtomMount(scope.keys)
  const { fieldId } = props
  // The field itself, to put the caret back after the cross.
  const field = useRef<HTMLInputElement | null>(null)
  // What was typed counts while the table's search is still the last one this box asked for (its own echo) or, before
  // it asked anything, the one it was typed over. A search changed from elsewhere (the assistant, Reset, a link) shows
  // instead, even one back to where the typing started, and a pause that was still running asks nothing.
  const ours = O.filter(box.typed, (typed) => O.getOrElse(box.asked, () => typed.over) === props.value)
  const draft = O.match(ours, { onNone: () => props.value, onSome: (typed) => typed.text })
  const asked = O.isSome(ours) ? O.getOrElse(box.asked, () => props.value) : props.value
  const waiting = box.waiting && O.isSome(ours)

  const ask = (text: string) => {
    setBox((now) => ({ ...now, asked: O.some(text), waiting: false }))
    props.onSearch(text)
  }
  // Asked after the pause, unless the search was changed from elsewhere meanwhile.
  const askAfterPause = useDebouncedCallback((text: string, over: string) => {
    if (over === props.value) ask(text)
  }, typingPause)

  const clear = () => {
    askAfterPause.cancel()
    setBox((now) => ({ ...now, typed: O.some({ text: "", over: props.value }), asked: O.none() }))
    if (asked !== "") ask("")
    else setBox((now) => ({ ...now, waiting: false }))
    field.current?.focus()
  }

  const busy = waiting || props.working
  return (
    <InputGroup className={props.className}>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref={field}
        id={fieldId}
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
        onChange={(event) => {
          const text = event.target.value
          const same = text.trim() === asked.trim()
          // Typing starts again from the search the table holds now: the last ask is behind it.
          setBox((now) => ({ ...now, typed: O.some({ text, over: props.value }), asked: O.none(), waiting: !same }))
          if (same) askAfterPause.cancel()
          else askAfterPause(text.trim(), props.value)
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            askAfterPause.cancel()
            if (draft.trim() !== asked) ask(draft.trim())
          }
          if (event.key === "Escape" && draft !== "") {
            event.preventDefault()
            clear()
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
          <InputGroupButton size="icon-xs" aria-label="Clear the search" title="Clear the search" onClick={clear}>
            <X />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    </InputGroup>
  )
}
