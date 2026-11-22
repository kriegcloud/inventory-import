import { CheckIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useAtomValue } from "@effect/atom-react"
import * as ScopedAtom from "@effect/atom-react/ScopedAtom"
import * as Atom from "effect/reactivity/Atom"
import { Button } from "@inventory/ui/components/button"
import { ScrollArea, ScrollBar } from "@inventory/ui/components/scroll-area"
import { ToggleGroup, ToggleGroupItem } from "@inventory/ui/components/toggle-group"
import type { WorkItem } from "@inventory/review/ReviewDraft"

const whole = new Intl.NumberFormat("en-US")

/**
 * The problem kinds as a work list: the person picks the kind to work on, sees how many of each are left, and a tick
 * once a kind is done. One component in two shapes: a narrow `rail` beside the table where there is room for it, one
 * row of toggle chips above the table where there is not. The arrow keys move along it (a toggle group).
 */
export function WorkList(props: {
  items: ReadonlyArray<WorkItem>
  /** The kind the table is showing; undefined while it shows another view (Ready, All). */
  active: string | undefined
  onPick: (kindId: string) => void
  mode: "rail" | "chips"
}) {
  const items = props.items.map((item) => (
    <ToggleGroupItem
      key={item.kind.id}
      value={item.kind.id}
      aria-label={`${item.kind.label}: ${item.done ? "done" : `${whole.format(item.left)} left`}`}
      className={props.mode === "rail" ? "w-full justify-between" : undefined}
    >
      <span className="truncate">{item.kind.label}</span>
      {item.done ? (
        <CheckIcon aria-hidden className="text-muted-foreground" />
      ) : (
        <span className="text-muted-foreground tabular-nums">{whole.format(item.left)}</span>
      )}
    </ToggleGroupItem>
  ))
  // Pressing the kind on screen again keeps it: the table always shows one kind while the person is deciding.
  const onValueChange = (next: string) => {
    if (next !== "") props.onPick(next)
  }
  if (props.mode === "rail") {
    return (
      <nav aria-label="Problems to settle" className="flex w-44 flex-none flex-col border-r">
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-2">
            <ToggleGroup
              type="single"
              orientation="vertical"
              size="sm"
              spacing={1}
              value={props.active ?? ""}
              onValueChange={onValueChange}
              className="w-full flex-col items-stretch"
            >
              {items}
            </ToggleGroup>
          </div>
        </ScrollArea>
      </nav>
    )
  }
  return (
    <Strip>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={1}
        value={props.active ?? ""}
        onValueChange={onValueChange}
      >
        {items}
      </ToggleGroup>
    </Strip>
  )
}

/** Whether a strip has chips hidden past its left and right edges. */
type More = { readonly left: boolean; readonly right: boolean }

/** The strip's scrolling box, where the scroll area draws it. */
const viewportOf = (root: HTMLElement | null): HTMLElement | null =>
  root?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null

/**
 * One strip's own: whether chips are hidden past its edges, and the ref callback for its `nav`, the same for as long
 * as the strip is drawn. From the moment the strip appears until it goes it hears the strip's scroll, its size, and a
 * wheel that turns down.
 */
const StripScope = ScopedAtom.make(() =>
  Atom.readable((get) => {
    const registry = get.registry
    const more = Atom.make<More>({ left: false, right: false })
    const follow = (root: HTMLElement | null) => {
      const element = viewportOf(root)
      if (element === null) return undefined
      const measure = () => {
        const left = element.scrollLeft > 1
        const right = element.scrollLeft + element.clientWidth < element.scrollWidth - 1
        registry.update(more, (before) => (before.left === left && before.right === right ? before : { left, right }))
      }
      measure()
      // A wheel that turns down moves the line along: a mouse has no sideways wheel.
      const onWheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || element.scrollWidth <= element.clientWidth) return
        event.preventDefault()
        element.scrollLeft += event.deltaY
      }
      element.addEventListener("scroll", measure, { passive: true })
      element.addEventListener("wheel", onWheel, { passive: false })
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      if (element.firstElementChild !== null) observer.observe(element.firstElementChild)
      return () => {
        element.removeEventListener("scroll", measure)
        element.removeEventListener("wheel", onWheel)
        observer.disconnect()
      }
    }
    return { more, follow }
  })
)

/**
 * One line of chips that scrolls sideways with no bar drawn: by wheel, by touch, by the arrow keys (focus brings a
 * chip into view), and by a round button over a fade at each edge that has more behind it.
 */
function Strip(props: { children: React.ReactNode }) {
  return (
    <StripScope.Provider>
      <StripBody>{props.children}</StripBody>
    </StripScope.Provider>
  )
}

function StripBody(props: { children: React.ReactNode }) {
  const strip = useAtomValue(StripScope.use())
  const more = useAtomValue(strip.more)
  const move = (target: HTMLElement, by: number) => {
    const element = viewportOf(target.closest("nav"))
    element?.scrollBy({ left: by * element.clientWidth * 0.8, behavior: "smooth" })
  }
  return (
    <nav ref={strip.follow} aria-label="Problems to settle" className="relative flex-none border-b">
      <ScrollArea className="w-full">
        <div className="w-max px-3 py-2">{props.children}</div>
        {/* Mounted so the line scrolls sideways; never drawn. */}
        <ScrollBar orientation="horizontal" className="hidden" />
      </ScrollArea>
      {more.left ? (
        <span className="absolute inset-y-0 left-0 flex items-center bg-linear-to-r from-background from-60% to-transparent pr-6 pl-2">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="Earlier problems"
            onClick={(event) => move(event.currentTarget, -1)}
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
        </span>
      ) : null}
      {more.right ? (
        <span className="absolute inset-y-0 right-0 flex items-center bg-linear-to-l from-background from-60% to-transparent pr-2 pl-6">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label="More problems"
            onClick={(event) => move(event.currentTarget, 1)}
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </span>
      ) : null}
    </nav>
  )
}
