import { ReviewText } from "./ReviewText.rules.ts"
import { refCallback } from "./browser.ts"
import { identity } from "effect/Function"
import { CellMark } from "@inventory/review/ReviewTypes"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import { $ReviewId } from "./identity.ts"
import {
  ArrowRightIcon,
  CheckIcon,
  CircleAlertIcon,
  TriangleAlertIcon,
  UserCheckIcon,
  WandSparklesIcon,
  XIcon
} from "lucide-react"
import { useAtom, useAtomValue } from "@effect/atom-react"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import * as Atom from "effect/reactivity/Atom"
import { lazy, type ReactNode, Suspense, useId, useRef } from "react"
import { cn } from "cn"
import { Slot } from "radix-ui"
import { ProposedChip, SourceMark } from "@inventory/ui/ProposedValue"
import { sourceAndConfidence } from "@inventory/ui/ProposalSource"
import { StatusPill } from "@inventory/ui/StatusPill"
import { Button } from "@inventory/ui/components/button"
import { Field, FieldLabel } from "@inventory/ui/components/field"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@inventory/ui/components/hover-card"
import { Input } from "@inventory/ui/components/input"
import { contentBelow, narrowBelow } from "@inventory/ui/ContentWidth"
import {
  Popover,
  PopoverArrow,
  PopoverClose,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger
} from "@inventory/ui/components/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@inventory/ui/components/tooltip"
import { choicesOf, pickedChoice, spellingOf, valueWords, variantsText } from "@inventory/review/ReviewDraft"
import type {
  Fix,
  FixGroup,
  MarkSource,
  ProblemKind,
  ReviewColumn,
  ReviewWords,
  RowView
} from "@inventory/review/ReviewTypes"
import { defaultReviewWords } from "@inventory/review/ReviewWords"

// Each enum's own guard, made once: these run for every row and every cell.
const isCellMarkApplied = CellMark.guards.applied
const isCellMarkProposed = CellMark.guards.proposed

// ---------------------------------------------------------------------------------------------------------------
// Layout: a table when the page has 1101px, a shorter table on a tablet, one decision at a time on a phone
// ---------------------------------------------------------------------------------------------------------------

export type Layout = "wide" | "medium" | "narrow"

// Widths of the page's own area (the window less the sidebar), from `@inventory/ui/ContentWidth`.
const narrowUnder = narrowBelow
const mediumUnder = 1101

/**
 * The layout for the room the page has. Worked out from the window and the sidebar's width, never from an element,
 * so nothing measures layout. Every part of the region reads it here.
 */
export const regionLayout: Atom.Atom<Layout> = Atom.readable((get) =>
  get(contentBelow(narrowUnder)) ? "narrow" : get(contentBelow(mediumUnder)) ? "medium" : "wide"
)

// ---------------------------------------------------------------------------------------------------------------
// A popover on a desk, a bottom sheet on a phone
// ---------------------------------------------------------------------------------------------------------------

// The phone's bottom sheet (vaul) is its own chunk, fetched when one first opens (and ahead of that on a phone by
// ReviewRegion), never on a desk.
const PhoneDrawer = lazy(() => import("./PhoneDrawer.tsx").then((module) => ({ default: module.PhoneDrawer })))

/**
 * What one overlay holds: open when nobody controls it, mounted once opened (so closing slides it away), whether a
 * resting mouse opened it, and the timer that will open or close it.
 */
type OverlayHeld = {
  readonly open: boolean
  readonly opened: boolean
  readonly byHover: boolean
  readonly timer: number
}
const OverlayScope = ScopedAtom.make(() =>
  Atom.make<OverlayHeld>({ open: false, opened: false, byHover: false, timer: 0 })
)

type OverlayProps = {
  readonly trigger: ReactNode
  readonly title: string
  /** For the bottom sheet's hidden description. */
  readonly about: string
  /** Width only (`w-80`): the popover's look is the design system's. */
  readonly children: ReactNode | ((close: () => void) => ReactNode)
  readonly align?: "start" | "center" | "end"
  readonly side?: "top" | "bottom" | "left" | "right"
  readonly className?: string
  readonly open?: boolean
  readonly onOpenChange?: (open: boolean) => void
  /**
   * Also opens when a mouse rests on the trigger (after a short delay) and closes when it leaves both. It stays a
   * popover: a click, Enter or a tap opens it as before and keeps it open, and a screen reader meets it as a dialog.
   * Opened by hover it does not take the focus.
   */
  readonly hover?: boolean
  /**
   * Drawn as the hover card is: the bordered card alone, with no arrow and no close button (Escape, a click outside
   * or the pointer leaving closes it). For a card that explains; a panel that holds a form keeps its close button.
   */
  readonly card?: boolean
}

/** One-click-away detail. The same content points at its trigger on a wide screen and rises from the bottom on a phone. */
export function Overlay(props: OverlayProps) {
  return (
    <OverlayScope.Provider>
      <OverlayBody {...props} />
    </OverlayScope.Provider>
  )
}

function OverlayBody(props: OverlayProps) {
  const layout = useAtomValue(regionLayout)
  const [held, setHeld] = useAtom(OverlayScope.use())
  const { open = held.open, align = "start", side = "bottom" } = props
  const setOpen = (next: boolean) => {
    setHeld((before) => ({ ...before, open: next }))
    props.onOpenChange?.(next)
  }
  const body = typeof props.children === "function" ? props.children(() => setOpen(false)) : props.children
  const opened = held.opened
  const setOpened = (next: boolean) => setHeld((before) => ({ ...before, opened: next }))
  const byHover = held.byHover
  const setByHover = (next: boolean) =>
    setHeld((before) => (before.byHover === next ? before : { ...before, byHover: next }))
  const stopTimer = () => window.clearTimeout(held.timer)
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
    stopTimer()
    const timer = window.setTimeout(() => {
      setByHover(next)
      setOpen(next)
    }, wait)
    setHeld((before) => ({ ...before, timer }))
  }
  const mouse = (event: React.PointerEvent) => props.hover === true && event.pointerType === "mouse"
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        stopTimer()
        setByHover(false)
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
          if (open && byHover) later(false, 200)
          else stopTimer()
        }}
        onClick={(event) => {
          // Pressed while open from a hover: it stays open, now as if pressed, instead of closing under the click.
          if (open && byHover) {
            event.preventDefault()
            stopTimer()
            setByHover(false)
          }
        }}
      >
        {props.trigger}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={props.card === true ? 4 : 6}
        onOpenAutoFocus={(event) => {
          if (byHover) event.preventDefault()
        }}
        onPointerEnter={(event) => {
          if (mouse(event) && byHover) stopTimer()
        }}
        onPointerLeave={(event) => {
          if (mouse(event) && byHover) later(false, 200)
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
export function ColumnText(props: { readonly column: ReviewColumn | undefined; readonly children: ReactNode }) {
  return props.column?.code === true ? <span className="font-mono">{props.children}</span> : props.children
}

/** A mark's source as the shared mark takes it: `unknown` is a source the caller did not name. */
const markSource = (by: MarkSource): "rule" | "model" | undefined => (by === "unknown" ? undefined : by)

/** The mark beside a value someone other than the person proposed: who it was, as the caller said. */
export function FixMark(props: { readonly by: MarkSource }) {
  return <SourceMark source={markSource(props.by)} />
}

/** The reason a row needs the person: an icon and three words at most. Never colour alone. */
export function ReasonTag(props: {
  readonly kind: O.Option<ProblemKind>
  /** The problem's own tone, over its kind's (`Problem.tone`). */
  readonly tone: O.Option<ProblemKind["tone"]>
  readonly fallback: string
}) {
  const blocker = O.contains(
    O.orElse(props.tone, () => O.map(props.kind, (kind) => kind.tone)),
    "blocker"
  )
  return (
    <StatusPill
      tone={blocker ? "danger" : "warning"}
      icon={blocker ? <CircleAlertIcon aria-hidden /> : <TriangleAlertIcon aria-hidden />}
      className="flex-none"
    >
      {O.match(props.kind, { onNone: () => props.fallback, onSome: (kind) => kind.label })}
    </StatusPill>
  )
}

/**
 * What happened to a row that no longer needs the person. The person's own decisions carry a person and an outline;
 * what a rule did carries a wand and a grey fill; an untouched row says Ready.
 */
export function DecisionTag(props: { readonly view: RowView; readonly words?: ReviewWords }) {
  const { words = defaultReviewWords } = props
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
  return O.match(props.view.decided, {
    onNone: () => <span className="text-muted-foreground">{words.ready}</span>,
    onSome: (decided) =>
      decided === "auto" ? (
        <StatusPill tone="neutral" icon={<WandSparklesIcon aria-hidden />} className="flex-none">
          {words.auto}
        </StatusPill>
      ) : (
        <StatusPill tone="outline" icon={<UserCheckIcon aria-hidden />} className="flex-none">
          {/* A value picked from the row's choices was chosen, not edited. */}
          {decided === "edited" && O.isSome(pickedChoice(props.view)) ? words.chosen : words[decided]}
        </StatusPill>
      )
  })
}

/**
 * Past this many characters a value that only loses its spaces is not shown twice in one cell: a code such as a SKU
 * stands alone in its chip, the old spelling one hover away, so its column is not twice as wide for one stray space.
 */
export const longValue = 8

/** A value with its change, or the plain value. A `low` reading is shown as a question, not as a change. */
export function CellValue(props: {
  readonly value: string
  readonly mark: O.Option<CellMark>
  /** How the column shows a value (`ReviewColumn.display`): money as the app shows it. */
  readonly display?: ((value: string) => string) | undefined
  readonly accepted?: boolean
  readonly empty?: ReactNode
  /** The row sits under a group heading that already says what its empty cell becomes ("empty → Foot"). */
  readonly stated?: boolean
}) {
  const { empty = null, display = identity } = props
  const shown = (text: string): string => (text === "" ? text : display(text))
  return O.match(props.mark, {
    onNone: () => (props.value === "" ? empty : <>{shown(props.value)}</>),
    onSome: (raw) => {
      const mark = { ...raw, from: shown(raw.from), to: shown(raw.to) }
      if (mark.from === mark.to) return <>{mark.to}</>
      if (isCellMarkProposed(mark) && O.isSome(choicesOf(mark.fix))) {
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
      if (mark.from === "" && isCellMarkApplied(mark)) {
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
      const spacesOnly = mark.from !== "" && ReviewText.comparison(mark.from) === mark.to
      const alone = spacesOnly && mark.to.length > longValue
      if (isCellMarkProposed(mark) && ((mark.from === "" && props.stated === true) || alone)) {
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
      const state = isCellMarkApplied(mark)
        ? props.accepted === true && mark.by !== "you"
          ? "accepted"
          : "applied"
        : "proposed"
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
  })
}

/**
 * One cut text's own: whether it is cut and its card open, and the ref callback for its span, the same for as long as
 * the text is drawn: it measures the span when it appears and again whenever its box changes size.
 */
const CutScope = ScopedAtom.make(() =>
  Atom.readable((get) => {
    const registry = get.registry
    const held = Atom.make({ cut: false, open: false })
    const measured = refCallback<HTMLSpanElement, undefined | (() => void)>((element) =>
      O.match(element, {
        onNone: () => undefined,
        onSome: (element) => {
          const measure = () => {
            const now = element.scrollWidth > element.clientWidth + 1
            registry.update(held, (before) => (before.cut === now ? before : { ...before, cut: now }))
          }
          measure()
          const observer = new ResizeObserver(measure)
          observer.observe(element)
          return () => observer.disconnect()
        }
      })
    )
    return { held, measured }
  })
)

type CutTextProps = {
  /** The whole text, for the card. */
  readonly text: string
  /** What is drawn, when it is more than the text (a code in its face, hidden words for a screen reader). */
  readonly children?: ReactNode
  /** What the card shows, when it is more than the text (an old and a new value). */
  readonly card?: ReactNode
  readonly className?: string
}

/**
 * Text in one line that may be cut short. Once it is cut (measured after it is drawn, again when its cell changes
 * width), the whole text is in a hover card: on hover, on keyboard focus (the cut text joins the tab order) and on a
 * tap, for a touch screen has no hover. Text that fits is plain, and not a tab stop.
 */
export function CutText(props: CutTextProps) {
  return (
    <CutScope.Provider>
      <CutBody {...props} />
    </CutScope.Provider>
  )
}

function CutBody(props: CutTextProps) {
  const scope = useAtomValue(CutScope.use())
  const [{ cut, open }, setHeld] = useAtom(scope.held)
  const setOpen = (next: boolean | ((before: boolean) => boolean)) =>
    setHeld((before) => ({ ...before, open: typeof next === "function" ? next(before.open) : next }))
  return (
    <HoverCard openDelay={350} closeDelay={100} open={open && cut} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span
          ref={scope.measured}
          className={cn(
            "block truncate",
            cut && "cursor-default rounded-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            props.className
          )}
          {...(cut ? { tabIndex: 0, onClick: () => setOpen((before) => !before) } : {})}
        >
          {O.match(O.fromNullishOr(props.children), { onNone: () => props.text, onSome: identity })}
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-auto max-w-sm">
        <div className="text-sm break-words whitespace-normal">
          {O.match(O.fromNullishOr(props.card), { onNone: () => props.text, onSome: identity })}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}

/** A group of identical fixes in one line: the file's spellings with their counts, and what they become. */
export function GroupChange(props: {
  readonly group: FixGroup
  readonly applied?: boolean
  /** In a table heading of one fixed height: short of room, the file's spellings end in an ellipsis. */
  readonly oneLine?: boolean
  /** How the column shows a value (`ReviewColumn.display`): vendors as "2 · Acme preferred", not the file's JSON. */
  readonly display?: ((value: string) => string) | undefined
}) {
  const { group, display = identity } = props
  const choices = choicesOf(group)
  const variants = variantsText(group, display)
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
      ) : (
        O.match(choices, {
          onNone: () =>
            props.applied === true ? (
              <span className="inline-flex items-center gap-1 font-medium">
                {O.match(group.label, { onNone: () => group.to, onSome: (label) => label })}
                <CheckIcon aria-hidden className="size-3 text-muted-foreground" />
              </span>
            ) : props.oneLine === true ? (
              <span className="flex-none">
                <ProposedChip>
                  {O.match(group.label, { onNone: () => group.to, onSome: (label) => label })}
                </ProposedChip>
              </span>
            ) : (
              <ProposedChip>{O.match(group.label, { onNone: () => group.to, onSome: (label) => label })}</ProposedChip>
            ),
          onSome: (present) => <span>{present.map((choice) => valueWords(group, choice)).join(" or ")}?</span>
        })
      )}
    </span>
  )
}

/**
 * The reason for a proposal in plain words with its one line of evidence, and who is behind it as the caller said.
 * `brief` keeps it to one line: who is behind it and the reason, without the evidence.
 */
export function Reason(props: {
  readonly fix: { readonly by: Fix["by"]; readonly confidence: Fix["confidence"]; readonly why: Fix["why"] }
  readonly brief?: boolean
  readonly className?: string
}) {
  const { why } = props.fix
  return (
    // The whole reason on hover: in a heading of one line it is the part that is cut.
    <span className={cn("text-muted-foreground", props.className)}>
      <span className="font-medium text-foreground">
        {sourceAndConfidence({
          by: props.fix.by,
          confidence: props.fix.confidence
        })}
        .
      </span>{" "}
      {why.basis}
      {props.brief === true ? null : O.match(why.detail, { onNone: () => null, onSome: (detail) => ` ${detail}` })}
    </span>
  )
}

/** The answer to "Why?": the reason, then what accepting applies to: this row, or every row with the same fix. */
export function WhyBody(props: {
  readonly fix: Fix
  readonly size: "sm" | "touch"
  readonly onAccept?: (() => void) | undefined
  /** Present when other rows wait on the same fix. */
  readonly all?: { readonly count: number; readonly onAccept: () => void } | undefined
  readonly onPick?: ((value: string) => void) | undefined
  /** The proposal is turned down: the file's value stands and the row waits for the person. One undo step. */
  readonly onReject?: (() => void) | undefined
  /** The fix is in force: this takes it out again. One undo step. */
  readonly onUndoFix?: (() => void) | undefined
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
        ) : O.isSome(choices) && props.onPick !== undefined ? (
          choices.value.map((value) => (
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

const $I = $ReviewId.create("parts")

/** The form's submitted text: outside spaces removed, and a blank box never submitted. */
const SubmittedText = S.Trim.check(S.isNonEmpty()).pipe(
  $I.annoteSchema("SubmittedText", {
    description: "The edit form's trimmed, nonempty submitted text"
  })
)

/** The box's raw text and the checked value it can submit, read once at each input event. */
const EditText = S.Struct({
  text: S.String.pipe(S.annotateKey({ description: "The person's exact text in the box" })),
  submission: SubmittedText.pipe(
    S.toType,
    S.Option,
    S.annotateKey({ description: "The trimmed, nonempty value, or none for a blank box" })
  )
}).pipe($I.annoteSchema("EditText", { description: "The edit form's raw input and checked submission" }))

type EditText = typeof EditText.Type

/** What one edit form holds; a later value from outside does not move it. */
const EditScope = ScopedAtom.make((opened: string) =>
  Atom.make<EditText>({ text: opened, submission: S.decodeOption(SubmittedText)(opened) })
)

type EditFormProps = {
  readonly label: string
  readonly value: string
  readonly size: "sm" | "touch"
  readonly onSave: (value: string) => void
}

/** One field for the value that is wrong. Enter saves; the row is checked again by the caller's rule. */
export function EditForm(props: EditFormProps) {
  return (
    <EditScope.Provider value={props.value}>
      <EditBody {...props} />
    </EditScope.Provider>
  )
}

function EditBody(props: EditFormProps) {
  const id = useId()
  const [value, setValue] = useAtom(EditScope.use())
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        O.match(value.submission, { onNone: () => undefined, onSome: props.onSave })
      }}
    >
      <Field>
        <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
        <Input
          id={id}
          value={value.text}
          autoFocus
          autoComplete="off"
          className="max-md:h-11"
          onChange={(event) =>
            setValue({ text: event.target.value, submission: S.decodeOption(SubmittedText)(event.target.value) })
          }
        />
      </Field>
      <Button type="submit" variant="secondary" size={props.size} disabled={O.isNone(value.submission)}>
        Save
      </Button>
    </form>
  )
}
