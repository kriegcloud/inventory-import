// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
// Whether the list is open and the value chosen, when the caller does not hold them, are atoms of each `Faceted` on
// screen. Upstream kept a store that a layout effect filled from the props after each draw; here the parts read what
// `Faceted` was drawn with from a React context, the one hook left in this file (goals/atoms PLAN, "The kit on atoms").
"use client"

import { useAtom, useAtomValue } from "@effect/atom-react"
import { Command as CommandPrimitive } from "cmdk"
import { cn } from "cn"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { Slot } from "radix-ui"
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  type Ref,
  type RefCallback,
  // The parts of a `Faceted` read what it was drawn with (its value, items and handlers) in the same draw; an atom
  // would need them written during the draw or after it, in an effect.
  // oxlint-disable-next-line no-restricted-imports
  useContext,
  useId
} from "react"

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator
} from "@inventory/ui/components/command"
import { Popover, PopoverContent, PopoverTrigger } from "@inventory/ui/components/popover"
import { ChevronDown, SearchIcon, Check } from "lucide-react"

type FacetedSelectedValue<Multiple extends boolean> = Multiple extends true ? string[] : string

interface FacetedOption {
  label: string
  value: string
}

const NO_ITEMS: FacetedOption[] = []

/** What the parts of one `Faceted` read: the value as it stands, the items, and what choosing does. */
interface FacetedState {
  readonly value: string | string[] | undefined
  readonly items: FacetedOption[]
  readonly multiple: boolean
  readonly selectItem: (value: string) => void
  readonly clear: () => void
}

/** Whether one `Faceted` is open, when its caller does not say: nothing until it is opened or closed. */
const facetedOpen = Atom.family((_instance: string) => Atom.make<O.Option<boolean>>(O.none()))

/** The value one `Faceted` holds, when its caller does not hold it: nothing until something is chosen. */
const facetedValue = Atom.family((_instance: string) => Atom.make<O.Option<string | string[] | undefined>>(O.none()))

/**
 * What one `Faceted` remembers of its draws: whether the caller held the value in the last one, and which kept value
 * that left stale. A caller that holds the value hands `undefined` when nothing is chosen, which reads the same as a
 * caller that holds nothing; only the draw before tells them apart. Upstream kept this in a ref and a layout effect.
 */
export interface FacetedMemory {
  held: boolean
  stale: O.Option<string | string[] | undefined> | null
}

const facetedMemory = Atom.family((_instance: string) => Atom.make<FacetedMemory>({ held: false, stale: null }))

/**
 * The value a `Faceted` shows in this draw. The caller's, when it hands one. Otherwise what the list kept itself,
 * unless the caller held the value in the draw before: it has just cleared it (the filter's X, the toolbar's Reset,
 * the address going back), and the kept copy from before it took over is nothing chosen any more, so one click on
 * an item chooses it again. `memory` is this instance's own and is written here: the same draw twice says the same.
 */
export function facetedValueNow(
  memory: FacetedMemory,
  valueProp: string | string[] | undefined,
  valueKept: O.Option<string | string[] | undefined>,
  defaultValue: string | string[] | undefined
): string | string[] | undefined {
  if (valueProp !== undefined) {
    memory.held = true
    return valueProp
  }
  if (memory.held) {
    memory.held = false
    memory.stale = valueKept
  }
  if (memory.stale === valueKept && O.isSome(valueKept)) return undefined
  return O.getOrElse(valueKept, () => defaultValue)
}

function getIsValueSelected(value: string | string[] | undefined, multiple: boolean, itemValue: string) {
  if (multiple) return Array.isArray(value) && value.includes(itemValue)
  return value === itemValue
}

const labelsCache = new WeakMap<FacetedOption[], Map<string, string>>()

function getLabels(items: FacetedOption[]) {
  let labels = labelsCache.get(items)
  if (!labels) {
    labels = new Map(items.map((item) => [item.value, item.label]))
    labelsCache.set(items, labels)
  }
  return labels
}

function getSelectedValues(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value
  return value ? [value] : []
}

function getSelectedItems(values: string[], items: FacetedOption[]): FacetedOption[] {
  const labels = getLabels(items)

  return values.map((value) => ({
    label: labels.get(value) ?? value,
    value
  }))
}

function getIsFacetedSelectedValue<Multiple extends boolean>(
  value: string | string[] | undefined,
  multiple: Multiple
): value is FacetedSelectedValue<Multiple> | undefined {
  if (value === undefined) return true
  return multiple ? Array.isArray(value) : typeof value === "string"
}

/** Calls the caller's handler, then ours unless the caller's prevented the default (Radix's own rule). */
function composeEventHandlers<E extends { readonly defaultPrevented: boolean }>(
  theirs: ((event: E) => void) | undefined,
  ours: (event: E) => void
) {
  return (event: E) => {
    theirs?.(event)
    if (!event.defaultPrevented) ours(event)
  }
}

/** One ref callback that hands the node to each ref, and cleans up after each when the node goes. */
function composeRefs<T>(...refs: ReadonlyArray<Ref<T> | undefined>): RefCallback<T> {
  return (node) => {
    const cleanups = refs.map((ref) => {
      if (typeof ref === "function") return ref(node)
      if (ref !== null && ref !== undefined) ref.current = node
      return undefined
    })
    return () => {
      cleanups.forEach((cleanup, index) => {
        const ref = refs[index]
        if (typeof cleanup === "function") cleanup()
        else if (typeof ref === "function") ref(null)
        else if (ref !== null && ref !== undefined) ref.current = null
      })
    }
  }
}

const FacetedContext = createContext<FacetedState | null>(null)

function useFacetedState(name: string) {
  const state = useContext(FacetedContext)
  if (!state) {
    throw new Error(`\`${name}\` must be used within \`Faceted\`.`)
  }
  return state
}

interface FacetedProps<Multiple extends boolean = false> extends ComponentProps<typeof Popover> {
  value?: FacetedSelectedValue<Multiple> | undefined
  defaultValue?: FacetedSelectedValue<Multiple>
  onValueChange?: (value: FacetedSelectedValue<Multiple> | undefined) => void
  items?: FacetedOption[]
  multiple?: Multiple
}

function Faceted<Multiple extends boolean = false>({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  value: valueProp,
  defaultValue,
  onValueChange,
  items = NO_ITEMS,
  multiple = false as Multiple,
  ...props
}: FacetedProps<Multiple>) {
  const instance = useId()
  const [openKept, setOpenKept] = useAtom(facetedOpen(instance))
  const [valueKept, setValueKept] = useAtom(facetedValue(instance))
  const open = openProp ?? O.getOrElse(openKept, () => defaultOpen)
  const isValueControlled = valueProp !== undefined
  const memory = useAtomValue(facetedMemory(instance))
  const value = facetedValueNow(memory, valueProp, valueKept, defaultValue)

  function setOpen(nextOpen: boolean) {
    onOpenChange?.(nextOpen)
    if (openProp === undefined) setOpenKept(O.some(nextOpen))
  }

  function commitValue(nextValue: string | string[] | undefined) {
    if (getIsFacetedSelectedValue(nextValue, multiple)) onValueChange?.(nextValue)
    if (!isValueControlled && !Object.is(value, nextValue)) setValueKept(O.some(nextValue))
  }

  const state: FacetedState = {
    value,
    items,
    multiple,
    selectItem: (selectedValue) => {
      if (multiple) {
        const selected = Array.isArray(value) ? value : []
        commitValue(
          selected.includes(selectedValue)
            ? selected.filter((item) => item !== selectedValue)
            : [...selected, selectedValue]
        )
        return
      }

      commitValue(value === selectedValue ? undefined : selectedValue)
      setOpen(false)
    },
    clear: () => {
      commitValue(multiple ? [] : undefined)
    }
  }

  return (
    <FacetedContext.Provider value={state}>
      <Popover data-slot="faceted" open={open} onOpenChange={setOpen} {...props} />
    </FacetedContext.Provider>
  )
}

function FacetedTrigger({ className, ...props }: ComponentProps<typeof PopoverTrigger>) {
  return (
    <PopoverTrigger
      data-slot="faceted-trigger"
      className={cn(
        "justify-between text-left has-[>[data-slot=faceted-value]]:transition-[color,background-color,border-color,box-shadow] has-[>[data-slot=faceted-value]>[data-slot=faceted-badge-list]]:pl-1",
        className
      )}
      {...props}
    />
  )
}

interface FacetedValueProps {
  placeholder?: ReactNode
  children?: ReactNode | ((selected: FacetedOption[]) => ReactNode)
}

function FacetedValue({ placeholder = "Select options...", children }: FacetedValueProps) {
  const { value, items, multiple } = useFacetedState("FacetedValue")
  const values = getSelectedValues(value)

  if (typeof children === "function") {
    return children(getSelectedItems(values, items))
  }
  if (children != null) return children

  const selected = multiple && values.length > 2 ? [] : getSelectedItems(values, items)
  const [item] = selected

  return (
    <span
      data-slot="faceted-value"
      className={cn("flex w-full min-w-0 items-center gap-1", values.length === 0 && "text-muted-foreground")}
    >
      {multiple && values.length > 0 ? (
        <FacetedBadgeList className="min-w-0 flex-nowrap">
          {values.length > 2 ? (
            <FacetedBadge>
              <bdi>{values.length} selected</bdi>
            </FacetedBadge>
          ) : (
            selected.map((selectedItem) => (
              <FacetedBadge key={selectedItem.value}>
                <bdi className="truncate">{selectedItem.label}</bdi>
              </FacetedBadge>
            ))
          )}
        </FacetedBadgeList>
      ) : (
        <bdi className="truncate">{item ? item.label : placeholder}</bdi>
      )}
      <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
    </span>
  )
}

function FacetedBadgeList({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="faceted-badge-list"
      className={cn("flex w-max max-w-full flex-wrap items-center gap-1", className)}
      {...props}
    />
  )
}

interface FacetedBadgeProps extends ComponentProps<"span"> {
  asChild?: boolean
}

function FacetedBadge({ className, asChild = false, ...props }: FacetedBadgeProps) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="faceted-badge"
      className={cn(
        "flex h-[calc(--spacing(5.25))] w-fit max-w-full min-w-0 items-center justify-center gap-1 rounded-sm bg-input/60 px-1.5 text-xs font-medium whitespace-nowrap text-foreground [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

interface FacetedContentProps
  extends
    ComponentProps<typeof PopoverContent>,
    Pick<ComponentProps<typeof Command>, "shouldFilter" | "filter" | "loop"> {}

function FacetedContent({ className, children, shouldFilter, filter, loop, ...props }: FacetedContentProps) {
  return (
    <PopoverContent
      data-slot="faceted-content"
      align="start"
      className={cn("w-50 origin-(--radix-popover-content-transform-origin) p-0", className)}
      {...props}
    >
      <Command
        {...(shouldFilter === undefined ? {} : { shouldFilter })}
        {...(filter === undefined ? {} : { filter })}
        {...(loop === undefined ? {} : { loop })}
        className="p-0.5"
      >
        {children}
      </Command>
    </PopoverContent>
  )
}

interface FacetedInputProps extends ComponentProps<typeof CommandPrimitive.Input> {
  variant?: "default" | "line"
}

/**
 * Keeps the input's aria-activedescendant on the highlighted item while the input is on screen: a ref callback, run
 * when the input is attached and cleaned up when it goes (upstream: an effect on mount). cmdk's own lags behind.
 */
function followActiveItem(input: HTMLInputElement | null) {
  const root = input?.closest("[cmdk-root]")
  if (!input || !root) return

  const onSync = () => {
    const id = root.querySelector("[cmdk-item][aria-selected='true']")?.id
    if (!id) {
      input.removeAttribute("aria-activedescendant")
      return
    }
    if (input.getAttribute("aria-activedescendant") !== id) {
      input.setAttribute("aria-activedescendant", id)
    }
  }

  onSync()
  const observer = new MutationObserver(onSync)
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributeFilter: ["aria-selected", "aria-activedescendant"]
  })
  return () => observer.disconnect()
}

function FacetedInput({ variant = "default", className, ref, ...props }: FacetedInputProps) {
  // The same callback in every draw unless the caller hands a ref of its own.
  const composedRef = ref === undefined ? followActiveItem : composeRefs(ref, followActiveItem)

  if (variant === "line") {
    return (
      <div
        data-slot="faceted-input-wrapper"
        data-variant="line"
        className="-mx-0.5 -mt-0.5 mb-0.5 flex h-9 items-center gap-2 border-b px-3.5"
      >
        <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
        <CommandPrimitive.Input
          ref={composedRef}
          data-slot="faceted-input"
          className={cn(
            "h-full w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
          {...props}
        />
      </div>
    )
  }

  return <CommandInput ref={composedRef} data-slot="faceted-input" className={className} {...props} />
}

function FacetedList({ ...props }: ComponentProps<typeof CommandList>) {
  return <CommandList data-slot="faceted-list" {...props} />
}

function FacetedEmpty({ ...props }: ComponentProps<typeof CommandEmpty>) {
  return <CommandEmpty data-slot="faceted-empty" {...props} />
}

function FacetedLoading({ className, ...props }: ComponentProps<typeof CommandPrimitive.Loading>) {
  return (
    <CommandPrimitive.Loading
      data-slot="faceted-loading"
      className={cn("py-6 text-center text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function FacetedGroup({ ...props }: ComponentProps<typeof CommandGroup>) {
  return <CommandGroup data-slot="faceted-group" {...props} />
}

function FacetedCommandItem({
  className,
  onPointerDownCapture,
  onMouseDown,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "group/command-item relative flex cursor-default items-center gap-1.5 rounded-md px-1.5 py-1 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-selected:bg-muted data-selected:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 data-selected:*:[svg]:text-foreground",
        className
      )}
      onPointerDownCapture={composeEventHandlers(onPointerDownCapture, (event) => {
        // A focusable item steals the input on pointerdown.
        event.preventDefault()
        if (event.pointerType === "touch") return
        event.currentTarget.closest("[cmdk-root]")?.querySelector<HTMLInputElement>("[cmdk-input]")?.focus()
      })}
      onMouseDown={composeEventHandlers(onMouseDown, (event) => {
        // iOS Safari can emit a synthetic mousedown without a pointerdown.
        event.preventDefault()
      })}
      {...props}
    />
  )
}

interface FacetedItemProps extends ComponentProps<typeof CommandPrimitive.Item> {
  value: string
}

function FacetedItem({ value, onSelect, ...props }: FacetedItemProps) {
  const faceted = useFacetedState("FacetedItem")
  const isSelected = getIsValueSelected(faceted.value, faceted.multiple, value)

  return (
    <FacetedCommandItem
      data-slot="faceted-item"
      data-checked={isSelected || undefined}
      aria-checked={isSelected}
      onSelect={() => {
        if (onSelect) {
          onSelect(value)
          return
        }
        faceted.selectItem(value)
      }}
      {...props}
    />
  )
}

function FacetedItemIndicator({ className, children, ...props }: ComponentProps<"span">) {
  return (
    <span
      data-slot="faceted-item-indicator"
      className={cn("ml-auto grid place-items-center *:col-start-1 *:row-start-1", className)}
      {...props}
    >
      {children != null && (
        <span className="font-mono text-xs group-data-checked/command-item:invisible">{children}</span>
      )}
      <Check className="invisible group-data-checked/command-item:visible" />
    </span>
  )
}

function FacetedClear({
  className,
  children = "Clear",
  onSelect,
  ...props
}: ComponentProps<typeof CommandPrimitive.Item>) {
  const faceted = useFacetedState("FacetedClear")
  const hasSelection = getSelectedValues(faceted.value).length > 0

  if (!hasSelection) return null

  return (
    <>
      <FacetedSeparator />
      <FacetedGroup>
        <FacetedCommandItem
          data-slot="faceted-clear"
          className={cn("justify-center text-center", className)}
          onSelect={(value) => {
            onSelect?.(value)
            faceted.clear()
          }}
          {...props}
        >
          {children}
        </FacetedCommandItem>
      </FacetedGroup>
    </>
  )
}

function FacetedSeparator({ ...props }: ComponentProps<typeof CommandSeparator>) {
  return <CommandSeparator data-slot="faceted-separator" aria-hidden="true" className="mx-0 my-0.5 w-full" {...props} />
}

export {
  Faceted,
  FacetedBadge,
  FacetedBadgeList,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedLoading,
  FacetedSeparator,
  FacetedTrigger,
  FacetedValue
}
