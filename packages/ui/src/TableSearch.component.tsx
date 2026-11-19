import { Search, X } from "lucide-react"
import { useAtom } from "@effect/atom-react"
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

/** Each box on screen has its own, by its `useId`; let go when the box is. */
const boxes = Atom.family((_box: string) => Atom.make<Box>({ typed: O.none(), waiting: false, asked: O.none() }))

/**
 * "/" or Ctrl+K (⌘K) anywhere puts the caret in this field, while it is on screen: a ref callback, so the keys are
 * heard exactly as long as the field is there.
 */
const shortcutKeys = (field: HTMLInputElement | null) => {
  if (field === null) return
  const onKey = (event: KeyboardEvent) => {
    const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !typingIn(event.target)
    const command = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey
    // A dialog open over the table keeps its keys.
    const inDialog = event.target instanceof Element && event.target.closest("[role=dialog]") !== null
    if ((!slash && !command) || inDialog) return
    event.preventDefault()
    field.focus()
    field.select()
  }
  document.addEventListener("keydown", onKey)
  return () => document.removeEventListener("keydown", onKey)
}

/**
 * The person types words to find in a table; the table asks for them after a pause in the typing. "/" or Ctrl+K
 * (⌘K) puts the caret here, Escape or the cross empties it. `value` is the search the table holds now (the page
 * address), so the assistant, Reset or a link changes what the box shows.
 */
export function TableSearch(props: {
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
}) {
  const [box, setBox] = useAtom(boxes(useId()))
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
        ref={(node) => {
          field.current = node
          return shortcutKeys(node)
        }}
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
