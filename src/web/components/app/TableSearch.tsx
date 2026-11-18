import { Search, X } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { useDebouncedCallback } from "@/hooks/use-debounced-callback"

/** How long a typed search waits for the next keystroke before it is asked for, as the column filters wait. */
const typingPause = 300

// Whether a key pressed here belongs to a field the person is typing in, where "/" is a character.
const typingIn = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))

/**
 * The person types words to find in a table; the table asks for them after a pause in the typing. "/" or Ctrl+K
 * (⌘K) puts the caret here, Escape or the cross empties it. `value` is the search the table holds now (the page
 * address), so the assistant, Reset or a link changes what the box shows.
 */
export function TableSearch(props: {
  readonly value: string
  readonly onSearch: (text: string) => void
  readonly placeholder: string
  /** The table is fetching rows for this search: the box shows it is working, the rows on screen stay. */
  readonly working: boolean
  readonly maxLength: number
  /** Shows "/" in the empty box. Off where there is no keyboard to press it on. */
  readonly shortcutHint: boolean
  readonly className?: string
}) {
  const [draft, setDraft] = useState(props.value)
  const [waiting, setWaiting] = useState(false)
  const field = useRef<HTMLInputElement>(null)
  // The last text this box asked for, so a change of `value` from elsewhere is told apart from its own echo.
  const asked = useRef(props.value)

  const ask = (text: string) => {
    asked.current = text
    setWaiting(false)
    props.onSearch(text)
  }
  const askAfterPause = useDebouncedCallback(ask, typingPause)

  useEffect(() => {
    if (props.value === asked.current) return
    asked.current = props.value
    askAfterPause.cancel()
    setWaiting(false)
    setDraft(props.value)
  }, [props.value, askAfterPause])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey && !typingIn(event.target)
      const command = event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey) && !event.altKey
      // A dialog open over the table keeps its keys.
      const inDialog = event.target instanceof Element && event.target.closest("[role=dialog]") !== null
      if ((!slash && !command) || inDialog || field.current === null) return
      event.preventDefault()
      field.current.focus()
      field.current.select()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const clear = () => {
    askAfterPause.cancel()
    setDraft("")
    if (asked.current !== "") ask("")
    else setWaiting(false)
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
          setDraft(text)
          if (text.trim() === asked.current.trim()) {
            askAfterPause.cancel()
            setWaiting(false)
            return
          }
          setWaiting(true)
          askAfterPause(text.trim())
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            askAfterPause.cancel()
            if (draft.trim() !== asked.current) ask(draft.trim())
          }
          if (event.key === "Escape" && draft !== "") {
            event.preventDefault()
            clear()
          }
        }}
      />
      <InputGroupAddon align="inline-end">
        {busy ? <Spinner aria-label="Searching" /> : null}
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
