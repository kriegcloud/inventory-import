// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

// Local changes: five places pass an optional prop only when it has a value, which this repo's exact optional
// property types require (`prop={undefined}` is not the same as leaving the prop out). Behaviour is unchanged.
// The item being dragged is an atom of each `Sortable` on screen; what a draw of `Sortable` and of an item hands to
// their parts (the items, dnd-kit's listeners for this draw) stays in React context, read with `useContext`, the one
// hook left here (goals/atoms PLAN, "The kit on atoms").

import {
  type Announcements,
  closestCenter,
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  type DndContextProps,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  KeyboardSensor,
  MouseSensor,
  type ScreenReaderInstructions,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors
} from "@dnd-kit/core"
import { restrictToHorizontalAxis, restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers"
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  type SortableContextProps,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useAtom } from "@effect/atom-react"
import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import { Slot as SlotPrimitive } from "radix-ui"
import {
  type ComponentProps,
  createContext,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefCallback,
  // A draw of `Sortable` or of an item hands its parts what it was drawn with (the items, dnd-kit's listeners and
  // attributes for this draw); an atom would need them written during the draw or after it, in an effect.
  // oxlint-disable-next-line no-restricted-imports
  useContext,
  useId
} from "react"
import { createPortal } from "react-dom"

const orientationConfig = {
  vertical: {
    modifiers: [restrictToVerticalAxis, restrictToParentElement],
    strategy: verticalListSortingStrategy,
    collisionDetection: closestCenter
  },
  horizontal: {
    modifiers: [restrictToHorizontalAxis, restrictToParentElement],
    strategy: horizontalListSortingStrategy,
    collisionDetection: closestCenter
  },
  mixed: {
    modifiers: [restrictToParentElement],
    strategy: undefined,
    collisionDetection: closestCorners
  }
}

const ROOT_NAME = "Sortable"
const CONTENT_NAME = "SortableContent"
const ITEM_NAME = "SortableItem"
const ITEM_HANDLE_NAME = "SortableItemHandle"
const OVERLAY_NAME = "SortableOverlay"

interface SortableRootContextValue<T> {
  id: string
  items: UniqueIdentifier[]
  modifiers: DndContextProps["modifiers"]
  strategy: SortableContextProps["strategy"]
  activeId: UniqueIdentifier | null
  setActiveId: (id: UniqueIdentifier | null) => void
  getItemValue: (item: T) => UniqueIdentifier
  flatCursor: boolean
}

/** The item one `Sortable` on screen is dragging, made for each (its `useId`). */
const activeIdOf = Atom.family((_instance: string) => Atom.make<UniqueIdentifier | null>(null))

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

// One item's ref callback, made again only when what it closes over changes, as upstream's `useComposedRefs` over a
// `useCallback`: React hands a new ref callback null and then the node, which dnd-kit reads as the node leaving and
// coming back. Kept per dnd-kit's own setter, which is the same for the item's whole life.
const keptRefs = new WeakMap<
  object,
  { readonly deps: ReadonlyArray<unknown>; readonly ref: RefCallback<HTMLElement> }
>()

function keptRef(owner: object, deps: ReadonlyArray<unknown>, make: () => RefCallback<HTMLElement>) {
  const kept = keptRefs.get(owner)
  if (kept !== undefined && kept.deps.length === deps.length && kept.deps.every((dep, i) => Object.is(dep, deps[i]))) {
    return kept.ref
  }
  const ref = make()
  keptRefs.set(owner, { deps, ref })
  return ref
}

const SortableRootContext = createContext<SortableRootContextValue<unknown> | null>(null)

function useSortableContext(consumerName: string) {
  const context = useContext(SortableRootContext)
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ROOT_NAME}\``)
  }
  return context
}

interface GetItemValue<T> {
  /**
   * Callback that returns a unique identifier for each sortable item. Required for array of objects.
   * @example getItemValue={(item) => item.id}
   */
  getItemValue: (item: T) => UniqueIdentifier
}

type SortableProps<T> = DndContextProps &
  (T extends object ? GetItemValue<T> : Partial<GetItemValue<T>>) & {
    value: T[]
    onValueChange?: (items: T[]) => void
    onMove?: (event: DragEndEvent & { activeIndex: number; overIndex: number }) => void
    strategy?: SortableContextProps["strategy"]
    orientation?: "vertical" | "horizontal" | "mixed"
    flatCursor?: boolean
  }

// What a screen reader hears while an item is dragged: one set per list of values, kept while the list is the same.
const announcementsKept = new WeakMap<ReadonlyArray<unknown>, Announcements>()

function announcementsFor(value: ReadonlyArray<unknown>): Announcements {
  const kept = announcementsKept.get(value)
  if (kept !== undefined) return kept
  const made: Announcements = {
    onDragStart({ active }) {
      const activeValue = active.id.toString()
      return `Grabbed sortable item "${activeValue}". Current position is ${active.data.current?.sortable.index + 1} of ${value.length}. Use arrow keys to move, space to drop.`
    },
    onDragOver({ active, over }) {
      if (over) {
        const overIndex = over.data.current?.sortable.index ?? 0
        const activeIndex = active.data.current?.sortable.index ?? 0
        const moveDirection = overIndex > activeIndex ? "down" : "up"
        const activeValue = active.id.toString()
        return `Sortable item "${activeValue}" moved ${moveDirection} to position ${overIndex + 1} of ${value.length}.`
      }
      return "Sortable item is no longer over a droppable area. Press escape to cancel."
    },
    onDragEnd({ active, over }) {
      const activeValue = active.id.toString()
      if (over) {
        const overIndex = over.data.current?.sortable.index ?? 0
        return `Sortable item "${activeValue}" dropped at position ${overIndex + 1} of ${value.length}.`
      }
      return `Sortable item "${activeValue}" dropped. No changes were made.`
    },
    onDragCancel({ active }) {
      const activeIndex = active.data.current?.sortable.index ?? 0
      const activeValue = active.id.toString()
      return `Sorting cancelled. Sortable item "${activeValue}" returned to position ${activeIndex + 1} of ${value.length}.`
    },
    onDragMove({ active, over }) {
      if (over) {
        const overIndex = over.data.current?.sortable.index ?? 0
        const activeIndex = active.data.current?.sortable.index ?? 0
        const moveDirection = overIndex > activeIndex ? "down" : "up"
        const activeValue = active.id.toString()
        return `Sortable item "${activeValue}" is moving ${moveDirection} to position ${overIndex + 1} of ${value.length}.`
      }
      return "Sortable item is no longer over a droppable area. Press escape to cancel."
    }
  }
  announcementsKept.set(value, made)
  return made
}

function instructionsOf(orientation: "vertical" | "horizontal" | "mixed"): ScreenReaderInstructions {
  return {
    draggable: `
        To pick up a sortable item, press space or enter.
        While dragging, use the ${orientation === "vertical" ? "up and down" : orientation === "horizontal" ? "left and right" : "arrow"} keys to move the item.
        Press space or enter again to drop the item in its new position, or press escape to cancel.
      `
  }
}

// One set of instructions for each orientation, made once.
const instructionsFor = {
  vertical: instructionsOf("vertical"),
  horizontal: instructionsOf("horizontal"),
  mixed: instructionsOf("mixed")
}

function Sortable<T>(props: SortableProps<T>) {
  const {
    value,
    onValueChange,
    collisionDetection,
    modifiers,
    strategy,
    onMove,
    orientation = "vertical",
    flatCursor = false,
    getItemValue: getItemValueProp,
    accessibility,
    onDragStart: onDragStartProp,
    onDragEnd: onDragEndProp,
    onDragCancel: onDragCancelProp,
    ...sortableProps
  } = props

  const id = useId()
  const [activeId, setActiveId] = useAtom(activeIdOf(id))

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )
  const config = orientationConfig[orientation]

  // Worked out in each draw: callers hand `getItemValue` as a new function in each draw, so upstream's memos on it,
  // and on the items and context worked out from it, never kept anything.
  const getItemValue = (item: T): UniqueIdentifier => {
    if (typeof item === "object" && !getItemValueProp) {
      throw new Error("`getItemValue` is required when using array of objects")
    }
    return getItemValueProp ? getItemValueProp(item) : (item as UniqueIdentifier)
  }

  const items = value.map((item) => getItemValue(item))

  function onDragStart(event: DragStartEvent) {
    onDragStartProp?.(event)

    if (event.activatorEvent.defaultPrevented) return

    setActiveId(event.active.id)
  }

  function onDragEnd(event: DragEndEvent) {
    onDragEndProp?.(event)

    if (event.activatorEvent.defaultPrevented) return

    const { active, over } = event
    if (over && active.id !== over?.id) {
      const activeIndex = value.findIndex((item) => getItemValue(item) === active.id)
      const overIndex = value.findIndex((item) => getItemValue(item) === over.id)

      if (onMove) {
        onMove({ ...event, activeIndex, overIndex })
      } else {
        onValueChange?.(arrayMove(value, activeIndex, overIndex))
      }
    }
    setActiveId(null)
  }

  function onDragCancel(event: DragEndEvent) {
    onDragCancelProp?.(event)

    if (event.activatorEvent.defaultPrevented) return

    setActiveId(null)
  }

  const announcements = announcementsFor(value)
  const screenReaderInstructions = instructionsFor[orientation]

  const contextValue = {
    id,
    items,
    modifiers: modifiers ?? config.modifiers,
    strategy: strategy ?? config.strategy,
    activeId,
    setActiveId,
    getItemValue,
    flatCursor
  }

  return (
    <SortableRootContext.Provider value={contextValue as SortableRootContextValue<unknown>}>
      <DndContext
        collisionDetection={collisionDetection ?? config.collisionDetection}
        modifiers={modifiers ?? config.modifiers}
        sensors={sensors}
        {...(sortableProps as Omit<DndContextProps, "id">)}
        id={id}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
        accessibility={{
          announcements,
          screenReaderInstructions,
          ...accessibility
        }}
      />
    </SortableRootContext.Provider>
  )
}

const SortableContentContext = createContext<boolean>(false)

interface SortableContentProps extends ComponentProps<"div"> {
  strategy?: SortableContextProps["strategy"]
  children: ReactNode
  asChild?: boolean
  withoutSlot?: boolean
}

function SortableContent(props: SortableContentProps) {
  const { strategy: strategyProp, asChild, withoutSlot, children, ref, ...contentProps } = props

  const context = useSortableContext(CONTENT_NAME)

  const ContentPrimitive = asChild ? SlotPrimitive.Slot : "div"
  const strategy = strategyProp ?? context.strategy

  return (
    <SortableContentContext.Provider value={true}>
      <SortableContext items={context.items} {...(strategy === undefined ? {} : { strategy })}>
        {withoutSlot ? (
          children
        ) : (
          <ContentPrimitive data-slot="sortable-content" {...contentProps} ref={ref}>
            {children}
          </ContentPrimitive>
        )}
      </SortableContext>
    </SortableContentContext.Provider>
  )
}

interface SortableItemContextValue {
  id: string
  attributes: DraggableAttributes
  listeners: DraggableSyntheticListeners | undefined
  setActivatorNodeRef: (node: HTMLElement | null) => void
  isDragging?: boolean
  disabled?: boolean
}

const SortableItemContext = createContext<SortableItemContextValue | null>(null)

function useSortableItemContext(consumerName: string) {
  const context = useContext(SortableItemContext)
  if (!context) {
    throw new Error(`\`${consumerName}\` must be used within \`${ITEM_NAME}\``)
  }
  return context
}

interface SortableItemProps extends ComponentProps<"div"> {
  value: UniqueIdentifier
  asHandle?: boolean
  asChild?: boolean
  disabled?: boolean
}

function SortableItem(props: SortableItemProps) {
  const { value, style, asHandle, asChild, disabled, className, ref, id: idProp, ...itemProps } = props

  const inSortableContent = useContext(SortableContentContext)
  const inSortableOverlay = useContext(SortableOverlayContext)

  if (!inSortableContent && !inSortableOverlay) {
    throw new Error(`\`${ITEM_NAME}\` must be used within \`${CONTENT_NAME}\` or \`${OVERLAY_NAME}\``)
  }

  if (value === "") {
    throw new Error(`\`${ITEM_NAME}\` value cannot be an empty string`)
  }

  const context = useSortableContext(ITEM_NAME)
  const instanceId = useId()
  const id = idProp ?? instanceId
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: value,
    ...(disabled === undefined ? {} : { disabled })
  })

  const composedRef = keptRef(setNodeRef, [disabled, asHandle, ref], () =>
    composeRefs(ref, (node: HTMLElement | null) => {
      if (disabled) return
      setNodeRef(node)
      if (asHandle) setActivatorNodeRef(node)
    })
  )

  // Worked out in each draw: React compares a style by its properties, and the item's parts are drawn with it.
  const composedStyle: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    ...style
  }

  const itemContext: SortableItemContextValue = {
    id,
    attributes,
    listeners,
    setActivatorNodeRef,
    isDragging,
    ...(disabled === undefined ? {} : { disabled })
  }

  const ItemPrimitive = asChild ? SlotPrimitive.Slot : "div"

  return (
    <SortableItemContext.Provider value={itemContext}>
      <ItemPrimitive
        id={id}
        data-disabled={disabled}
        data-dragging={isDragging ? "" : undefined}
        data-slot="sortable-item"
        {...itemProps}
        {...(asHandle && !disabled ? attributes : {})}
        {...(asHandle && !disabled ? listeners : {})}
        ref={composedRef}
        style={composedStyle}
        className={cn(
          "focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden",
          {
            "touch-none select-none": asHandle,
            "cursor-default": context.flatCursor,
            "data-dragging:cursor-grabbing": !context.flatCursor,
            "cursor-grab": !isDragging && asHandle && !context.flatCursor,
            "opacity-50": isDragging,
            "pointer-events-none opacity-50": disabled
          },
          className
        )}
      />
    </SortableItemContext.Provider>
  )
}

interface SortableItemHandleProps extends ComponentProps<"button"> {
  asChild?: boolean
}

function SortableItemHandle(props: SortableItemHandleProps) {
  const { asChild, disabled, className, ref, ...itemHandleProps } = props

  const context = useSortableContext(ITEM_HANDLE_NAME)
  const itemContext = useSortableItemContext(ITEM_HANDLE_NAME)

  const isDisabled = disabled ?? itemContext.disabled

  const { setActivatorNodeRef } = itemContext

  const composedRef = keptRef(setActivatorNodeRef, [isDisabled, ref], () =>
    composeRefs(ref, (node: HTMLElement | null) => {
      if (isDisabled) return
      setActivatorNodeRef(node)
    })
  )

  const HandlePrimitive = asChild ? SlotPrimitive.Slot : "button"

  return (
    <HandlePrimitive
      type="button"
      aria-controls={itemContext.id}
      data-disabled={isDisabled}
      data-dragging={itemContext.isDragging ? "" : undefined}
      data-slot="sortable-item-handle"
      {...itemHandleProps}
      {...(isDisabled ? {} : itemContext.attributes)}
      {...(isDisabled ? {} : itemContext.listeners)}
      ref={composedRef}
      className={cn(
        "select-none disabled:pointer-events-none disabled:opacity-50",
        context.flatCursor ? "cursor-default" : "cursor-grab data-dragging:cursor-grabbing",
        className
      )}
      disabled={isDisabled}
    />
  )
}

const SortableOverlayContext = createContext(false)

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4"
      }
    }
  })
}

interface SortableOverlayProps extends Omit<ComponentProps<typeof DragOverlay>, "children"> {
  container?: Element | DocumentFragment | null
  children?: ((params: { value: UniqueIdentifier }) => ReactNode) | ReactNode
}

function SortableOverlay(props: SortableOverlayProps) {
  const { container: containerProp, children, ...overlayProps } = props

  const context = useSortableContext(OVERLAY_NAME)

  // Upstream asked `useSyncExternalStore` whether it was drawn on a server, where there is no page to portal into.
  // This app is drawn only in the browser, so the page's body is there from the first draw.
  const container = containerProp ?? globalThis.document?.body ?? null

  if (!container) return null

  return createPortal(
    <DragOverlay
      {...(dropAnimation === undefined ? {} : { dropAnimation })}
      {...(context.modifiers === undefined ? {} : { modifiers: context.modifiers })}
      className={cn(!context.flatCursor && "cursor-grabbing")}
      {...overlayProps}
    >
      <SortableOverlayContext.Provider value={true}>
        {context.activeId ? (typeof children === "function" ? children({ value: context.activeId }) : children) : null}
      </SortableOverlayContext.Provider>
    </DragOverlay>,
    container
  )
}

export { Sortable, SortableContent, SortableItem, SortableItemHandle, SortableOverlay, type SortableProps }
