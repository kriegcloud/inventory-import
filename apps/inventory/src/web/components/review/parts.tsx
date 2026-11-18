import {
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  WandSparklesIcon,
  XIcon
} from "lucide-react"
import {
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { ProposedChip, SourceMark } from "@/components/app/ProposedValue"
import { sourceAndConfidence } from "@/components/app/proposalSource"
import { StatusPill } from "@/components/app/StatusPill"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { narrowBelow, useContentBelow } from "@/lib/content-width"
import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger
} from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { choicesOf, pickedChoice, spellingOf, valueWords, variantsText } from "./logic.ts"
import type { CellMark, Fix, FixGroup, MarkSource, ProblemKind, ReviewColumn, ReviewWords, RowView } from "./types.ts"
import { defaultReviewWords } from "./words.ts"

// ---------------------------------------------------------------------------------------------------------------
// Layout: a table when the page has 1101px, a shorter table on a tablet, one decision at a time on a phone
// ---------------------------------------------------------------------------------------------------------------

export type Layout = "wide" | "medium" | "narrow"

// Widths of the page's own area (the window less the sidebar), from `lib/content-width.ts`.
const narrowUnder = narrowBelow
const mediumUnder = 1101

/**
 * The layout for the room the page has. Worked out from the window and the sidebar's width, never from an element,
 * so nothing measures layout.
 */
export function useLayout(): Layout {
  const narrow = useContentBelow(narrowUnder)
  const medium = useContentBelow(mediumUnder)
  return narrow ? "narrow" : medium ? "medium" : "wide"
}

export const LayoutContext = createContext<Layout>("wide")

// ---------------------------------------------------------------------------------------------------------------
// A popover on a desk, a bottom sheet on a phone
// ---------------------------------------------------------------------------------------------------------------

// The phone's bottom sheet (vaul) is its own chunk, fetched when one first opens (and ahead of that on a phone by
// ReviewRegion), never on a desk.
const PhoneDrawer = lazy(() => import("./PhoneDrawer.tsx").then((module) => ({ default: module.PhoneDrawer })))

/** One-click-away detail. The same content points at its trigger on a wide screen and rises from the bottom on a phone. */
export function Overlay(props: {
  trigger: ReactNode
  title: string
  /** For the bottom sheet's hidden description. */
  about: string
  /** Width only (`w-80`): the popover's look is the design system's. */
  children: ReactNode | ((close: () => void) => ReactNode)
  align?: "start" | "center" | "end"
  side?: "top" | "bottom" | "left" | "right"
  className?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /**
   * Also opens when a mouse rests on the trigger (after a short delay) and closes when it leaves both. It stays a
   * popover: a click, Enter or a tap opens it as before and keeps it open, and a screen reader meets it as a dialog.
   * Opened by hover it does not take the focus.
   */
  hover?: boolean
  /**
   * Drawn as the hover card is: the bordered card alone, with no arrow and no close button (Escape, a click outside
   * or the pointer leaving closes it). For a card that explains; a panel that holds a form keeps its close button.
   */
  card?: boolean
}) {
  const layout = useContext(LayoutContext)
  const hovered = useRef(false)
  const timer = useRef(0)
  const [inner, setInner] = useState(false)
  const open = props.open ?? inner
  const setOpen = (next: boolean) => {
    setInner(next)
    props.onOpenChange?.(next)
  }
  const body = typeof props.children === "function" ? props.children(() => setOpen(false)) : props.children
  // Mounted from its first opening on, so closing it slides it away instead of cutting it off.
  const [opened, setOpened] = useState(false)
  const trigger = useRef<HTMLElement>(null)
  if (layout === "narrow") {
    return (
      <>
        <Slot.Root
          ref={trigger}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setOpened(true)
            setOpen(true)
          }}
        >
          {props.trigger}
        </Slot.Root>
        {opened || open ? (
          <Suspense fallback={null}>
            <PhoneDrawer
              open={open}
              onOpenChange={setOpen}
              onCloseAutoFocus={(event) => {
                event.preventDefault()
                trigger.current?.focus()
              }}
              title={props.title}
              description={props.about}
              quietDescription
            >
              <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-6 text-sm">{body}</div>
            </PhoneDrawer>
          </Suspense>
        ) : null}
      </>
    )
  }
  const later = (next: boolean, wait: number) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      hovered.current = next
      setOpen(next)
    }, wait)
  }
  const mouse = (event: React.PointerEvent) => props.hover === true && event.pointerType === "mouse"
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        window.clearTimeout(timer.current)
        hovered.current = false
        setOpen(next)
      }}
    >
      <PopoverTrigger
        asChild
        onPointerEnter={(event) => {
          if (mouse(event) && !open) later(true, 450)
        }}
        onPointerLeave={(event) => {
          if (!mouse(event)) return
          if (open && hovered.current) later(false, 200)
          else window.clearTimeout(timer.current)
        }}
        onClick={(event) => {
          // Pressed while open from a hover: it stays open, now as if pressed, instead of closing under the click.
          if (open && hovered.current) {
            event.preventDefault()
            window.clearTimeout(timer.current)
            hovered.current = false
          }
        }}
      >
        {props.trigger}
      </PopoverTrigger>
      <PopoverContent
        align={props.align ?? "start"}
        side={props.side ?? "bottom"}
        sideOffset={props.card === true ? 4 : 6}
        onOpenAutoFocus={(event) => {
          if (hovered.current) event.preventDefault()
        }}
        onPointerEnter={(event) => {
          if (mouse(event) && hovered.current) window.clearTimeout(timer.current)
        }}
        onPointerLeave={(event) => {
          if (mouse(event) && hovered.current) later(false, 200)
        }}
        {...(props.className === undefined ? {} : { className: props.className })}
      >
        <div className="flex flex-col gap-3 text-sm">
          {props.card === true ? (
            <PopoverTitle>{props.title}</PopoverTitle>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <PopoverTitle>{props.title}</PopoverTitle>
              <PopoverClose asChild>
                <Button variant="ghost" size="icon-xs" className="-mt-1 -mr-1.5" aria-label="Close">
                  <XIcon aria-hidden />
                </Button>
              </PopoverClose>
            </div>
          )}
          {body}
        </div>
        {props.card === true ? null : <PopoverArrow />}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------------------------------------------
// Words and small pieces
// ---------------------------------------------------------------------------------------------------------------

/**
 * The class for a column's values: the monospace face for a code (`code` on the column), whose 0 and O, and 1, l and
 * I, cannot be confused; nothing for anything else. The one place a code gets its face.
 */
export const codeFace = (column: ReviewColumn | undefined): string | undefined =>
  column?.code === true ? "font-mono" : undefined

/**
 * A value inside a line of text: a code in its face, anything else as plain text with no element of its own, so a
 * truncated line holds nothing that reaches past its edge.
 */
export function ColumnText(props: { column: ReviewColumn | undefined; children: ReactNode }) {
  const face = codeFace(props.column)
  return face === undefined ? props.children : <span className={face}>{props.children}</span>
}

/** A mark's source as the shared mark takes it: `unknown` is a source the caller did not name. */
const markSource = (by: MarkSource): "rule" | "model" | undefined => (by === "unknown" ? undefined : by)

/** The mark beside a value someone other than the person proposed: who it was, as the caller said. */
export function FixMark(props: { by: MarkSource }) {
  return <SourceMark source={markSource(props.by)} />
}

/** The reason a row needs the person: an icon and three words at most. Never colour alone. */
export function ReasonTag(props: {
  kind: ProblemKind | undefined
  /** The problem's own tone, over its kind's (`Problem.tone`). */
  tone?: ProblemKind["tone"] | undefined
  fallback: string
}) {
  const blocker = (props.tone ?? props.kind?.tone) === "blocker"
  return (
    <StatusPill
      tone={blocker ? "danger" : "warning"}
      icon={blocker ? <CircleAlertIcon aria-hidden /> : <TriangleAlertIcon aria-hidden />}
      className="flex-none"
    >
      {props.kind?.label ?? props.fallback}
    </StatusPill>
  )
}

/**
 * What happened to a row that no longer needs the person. The person's own decisions carry a person and an outline;
 * what a rule did carries a wand and a grey fill; an untouched row says Ready.
 */
export function DecisionTag(props: { view: RowView; words?: ReviewWords }) {
  const words = props.words ?? defaultReviewWords
  if (props.view.status === "stored") {
    return (
      <StatusPill tone="neutral" className="flex-none">
        {words.stored}
      </StatusPill>
    )
  }
  if (props.view.status === "out") {
    return (
      <StatusPill tone="neutral" className="flex-none">
        {words.out}
      </StatusPill>
    )
  }
  const decided = props.view.decided
  if (decided === undefined) return <span className="text-muted-foreground">{words.ready}</span>
  return decided === "auto" ? (
    <StatusPill tone="neutral" icon={<WandSparklesIcon aria-hidden />} className="flex-none">
      {words.auto}
    </StatusPill>
  ) : (
    <StatusPill tone="outline" icon={<UserCheckIcon aria-hidden />} className="flex-none">
      {/* A value picked from the row's choices was chosen, not edited. */}
      {decided === "edited" && pickedChoice(props.view) !== undefined ? words.chosen : words[decided]}
    </StatusPill>
  )
}

/**
 * Past this many characters a value that only loses its spaces is not shown twice in one cell: a code such as a SKU
 * stands alone in its chip, the old spelling one hover away, so its column is not twice as wide for one stray space.
 */
export const longValue = 8

/** A value with its change, or the plain value. A `low` reading is shown as a question, not as a change. */
export function CellValue(props: {
  value: string
  mark: CellMark | undefined
  /** How the column shows a value (`ReviewColumn.display`): money as the app shows it. */
  display?: ((value: string) => string) | undefined
  accepted?: boolean
  empty?: ReactNode
  /** The row sits under a group heading that already says what its empty cell becomes ("empty → Foot"). */
  stated?: boolean
}) {
  const shown = (text: string): string => (props.display === undefined || text === "" ? text : props.display(text))
  const raw = props.mark
  if (raw === undefined) return props.value === "" ? (props.empty ?? null) : <>{shown(props.value)}</>
  const mark = { ...raw, from: shown(raw.from), to: shown(raw.to) }
  if (mark.from === mark.to) return <>{mark.to}</>
  if (mark.state === "proposed" && choicesOf(mark.fix) !== undefined) {
    // A question, marked with who asks it: a sparkle only when the caller says a model made it.
    return (
      <span className="inline-flex items-center gap-1.5">
        {mark.from === "" ? "empty" : mark.from}
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <FixMark by={mark.by} />
          {mark.to}?
        </span>
      </span>
    )
  }
  // A value typed into an empty cell has nothing to strike through: the value and a check say it changed.
  if (mark.from === "" && mark.state === "applied") {
    return (
      <span className="inline-flex items-center gap-1">
        {mark.to}
        <CheckIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
        <span className="sr-only"> (was empty)</span>
      </span>
    )
  }
  // Nothing to strike through that a person could see: an empty cell under a heading that says "empty", or a value
  // that only loses the spaces around it. The proposed value stands alone.
  // A short value that loses its spaces is shown in quotation marks beside the new one (“Foot ” → Foot), so the
  // change can be seen; a long one (a name) would not fit twice and stands alone.
  const spacesOnly = mark.from !== "" && mark.from.trim() === mark.to
  const alone = spacesOnly && mark.to.length > longValue
  if (mark.state === "proposed" && ((mark.from === "" && props.stated === true) || alone)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <ins className="inline-flex max-w-full min-w-0 no-underline">
            <span className="sr-only">{alone ? "spaces removed, proposed " : "was empty, proposed "}</span>
            <ProposedChip>
              {mark.to}
              <FixMark by={mark.by} />
            </ProposedChip>
          </ins>
        </TooltipTrigger>
        <TooltipContent>
          {alone ? `Was ${spellingOf(mark.from)}: the spaces around it are removed` : "Was empty"}
        </TooltipContent>
      </Tooltip>
    )
  }
  const state = mark.state === "applied" && props.accepted === true && mark.by !== "you" ? "accepted" : mark.state
  const source = mark.by === "you" ? null : <FixMark by={mark.by} />
  // The file's value struck through and the value that would be imported beside it, as real `<del>` and `<ins>` with
  // hidden "was" and "now". Short of room the old value is the part that is cut; its whole spelling is then one hover
  // or tap away in a hover card, never in a native title.
  return (
    <span className="inline-flex max-w-full min-w-0 flex-nowrap items-center gap-x-1.5">
      <del className="min-w-0 text-muted-foreground decoration-muted-foreground/70">
        <CutText text={spellingOf(mark.from)}>
          <span className="sr-only">was </span>
          {spellingOf(mark.from)}
        </CutText>
      </del>
      {state === "applied" ? (
        <ins className="inline-flex items-center gap-1 no-underline">
          <span className="sr-only">now </span>
          {mark.to}
          <CheckIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          {source}
        </ins>
      ) : (
        <>
          <ArrowRightIcon aria-hidden className="size-3 shrink-0 text-muted-foreground" />
          <ins className="shrink-0 no-underline">
            <span className="sr-only">{state === "accepted" ? "accepted " : "proposed "}</span>
            <ProposedChip state={state}>
              {mark.to}
              {source}
            </ProposedChip>
          </ins>
        </>
      )}
    </span>
  )
}

/**
 * Text in one line that may be cut short. Once it is cut (measured after it is drawn, again when its cell changes
 * width), the whole text is in a hover card: on hover, on keyboard focus (the cut text joins the tab order) and on a
 * tap, for a touch screen has no hover. Text that fits is plain, and not a tab stop.
 */
export function CutText(props: {
  /** The whole text, for the card. */
  text: string
  /** What is drawn, when it is more than the text (a code in its face, hidden words for a screen reader). */
  children?: ReactNode
  /** What the card shows, when it is more than the text (an old and a new value). */
  card?: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [cut, setCut] = useState(false)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null) return
    const measure = () => setCut(element.scrollWidth > element.clientWidth + 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [props.text])
  return (
    <HoverCard openDelay={350} closeDelay={100} open={open && cut} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span
          ref={ref}
          className={cn(
            "block truncate",
            cut && "cursor-default rounded-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            props.className
          )}
          {...(cut ? { tabIndex: 0, onClick: () => setOpen((before) => !before) } : {})}
        >
          {props.children ?? props.text}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-sm">
        <div className="text-sm break-words whitespace-normal">{props.card ?? props.text}</div>
      </HoverCardContent>
    </HoverCard>
  )
}

/** A group of identical fixes in one line: the file's spellings with their counts, and what they become. */
export function GroupChange(props: {
  group: FixGroup
  applied?: boolean
  /** In a table heading of one fixed height: short of room, the file's spellings end in an ellipsis. */
  oneLine?: boolean
}) {
  const { group } = props
  const choices = choicesOf(group)
  const variants = variantsText(group)
  return (
    <span
      className={cn(
        "inline-flex items-center gap-x-1.5 gap-y-1",
        props.oneLine === true ? "min-w-0 flex-nowrap" : "flex-wrap"
      )}
    >
      {props.oneLine === true ? <CutText text={variants} className="min-w-0" /> : <span>{variants}</span>}
      <ArrowRightIcon aria-hidden className="size-3.5 flex-none text-muted-foreground" />
      <span className="sr-only">becomes</span>
      {group.mixed === true ? (
        // The rows end in different values: none is named here, each row shows its own.
        <span className="flex-none font-normal text-muted-foreground">each row its own value, shown below</span>
      ) : choices !== undefined ? (
        <span>{choices.map((choice) => valueWords(group, choice)).join(" or ")}?</span>
      ) : props.applied === true ? (
        <span className="inline-flex items-center gap-1 font-medium">
          {group.label ?? group.to}
          <CheckIcon aria-hidden className="size-3 text-muted-foreground" />
        </span>
      ) : props.oneLine === true ? (
        <span className="flex-none">
          <ProposedChip>{group.label ?? group.to}</ProposedChip>
        </span>
      ) : (
        <ProposedChip>{group.label ?? group.to}</ProposedChip>
      )}
    </span>
  )
}

/**
 * The reason for a proposal in plain words with its one line of evidence, and who is behind it as the caller said.
 * `brief` keeps it to one line: who is behind it and the reason, without the evidence.
 */
export function Reason(props: {
  fix: { by?: MarkSource | undefined; confidence?: Fix["confidence"]; why: Fix["why"] }
  brief?: boolean
  className?: string
}) {
  const { why } = props.fix
  const by = props.fix.by === undefined ? undefined : markSource(props.fix.by)
  return (
    // The whole reason on hover: in a heading of one line it is the part that is cut.
    <span className={cn("text-muted-foreground", props.className)}>
      <span className="font-medium text-foreground">
        {sourceAndConfidence({ by, confidence: props.fix.confidence })}.
      </span>{" "}
      {why.basis}
      {why.detail === undefined || props.brief === true ? null : ` ${why.detail}`}
    </span>
  )
}

/** The answer to "Why?": the reason, then what accepting applies to: this row, or every row with the same fix. */
export function WhyBody(props: {
  fix: Fix
  size: "sm" | "touch"
  onAccept?: (() => void) | undefined
  /** Present when other rows wait on the same fix. */
  all?: { count: number; onAccept: () => void } | undefined
  onPick?: ((value: string) => void) | undefined
  /** The proposal is turned down: the file's value stands and the row waits for the person. One undo step. */
  onReject?: (() => void) | undefined
  /** The fix is in force: this takes it out again. One undo step. */
  onUndoFix?: (() => void) | undefined
}) {
  const { fix } = props
  const choices = choicesOf(fix)
  const to = valueWords(fix, fix.to)
  return (
    <>
      <p>
        <Reason fix={fix} />
      </p>
      <div className="flex flex-wrap gap-2">
        {props.onUndoFix !== undefined ? (
          <Button variant="outline" size={props.size} onClick={props.onUndoFix}>
            Undo this fix
          </Button>
        ) : choices !== undefined && props.onPick !== undefined ? (
          choices.map((value) => (
            <Button
              key={value}
              variant="secondary"
              size={props.size}
              className="h-auto min-h-8"
              onClick={() => props.onPick?.(value)}
            >
              <span className="py-1 whitespace-normal">Use {valueWords(fix, value)}</span>
            </Button>
          ))
        ) : (
          <>
            {props.onAccept === undefined ? null : (
              <Button variant="secondary" size={props.size} onClick={props.onAccept}>
                Use {to} here
              </Button>
            )}
            {props.all === undefined ? null : (
              <Button variant="secondary" size={props.size} onClick={props.all.onAccept}>
                Use {to} for all {props.all.count}
              </Button>
            )}
          </>
        )}
        {props.onReject === undefined ? null : (
          <Button variant="outline" size={props.size} onClick={props.onReject}>
            Reject this proposal
          </Button>
        )}
      </div>
    </>
  )
}

/** One field for the value that is wrong. Enter saves; the row is checked again by the caller's rule. */
export function EditForm(props: {
  label: string
  value: string
  size: "sm" | "touch"
  onSave: (value: string) => void
}) {
  const id = useId()
  const [value, setValue] = useState(props.value)
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (value.trim() !== "") props.onSave(value.trim())
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
        <Input
          id={id}
          value={value}
          autoFocus
          autoComplete="off"
          className="max-md:h-11"
          onChange={(event) => setValue(event.target.value)}
        />
      </Field>
      <Button type="submit" variant="secondary" size={props.size} disabled={value.trim() === ""}>
        Save
      </Button>
    </form>
  )
}
