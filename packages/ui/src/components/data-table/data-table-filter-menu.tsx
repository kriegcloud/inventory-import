// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

import { useAtom, useAtomMount, useAtomSet } from "@effect/atom-react"
import type { Column, ReactTable, RowData } from "@tanstack/react-table"

import { cn } from "cn"
import * as Atom from "effect/reactivity/Atom"
import { type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, useId, useRef } from "react"

import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import type {
  ColumnFilterItem,
  FilterOperator,
  JoinOperator
} from "@inventory/ui/components/data-table/data-table-types"

import {
  coerceFilterValue,
  FilterVariants,
  getColumnSelectOptions,
  getDateFilterLabel,
  getDefaultFilter,
  getFilterDates,
  getFilterDateValue,
  getFilterOperators,
  getIsEditableTarget,
  getIsTableShortcutTarget,
  getIsValuelessOperator,
  getSelectFilterValue,
  JOIN_OPERATORS
} from "@inventory/ui/components/data-table/data-table-utils"
import { generateId } from "@inventory/ui/components/data-table/id"
import { DataTableRangeFilter } from "@inventory/ui/components/data-table/data-table-range-filter"
import { Badge } from "@inventory/ui/components/badge"
import { Button } from "@inventory/ui/components/button"
import { Calendar } from "@inventory/ui/components/calendar"
import { useDirection } from "@inventory/ui/components/direction"
import {
  Faceted,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger,
  FacetedValue
} from "@inventory/ui/components/faceted"
import { Input } from "@inventory/ui/components/input"
import { Popover, PopoverContent, PopoverTrigger } from "@inventory/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@inventory/ui/components/select"
import {
  Sortable,
  SortableContent,
  SortableItem,
  SortableItemHandle,
  SortableOverlay
} from "@inventory/ui/components/sortable"
import { CalendarIcon, ChevronsUpDown, GripVertical, ListFilter, Trash2 } from "lucide-react"

const FILTER_SHORTCUT_KEY = "f"
const REMOVE_FILTER_SHORTCUTS = ["backspace", "delete"]

type FilterUpdate = Partial<Omit<ColumnFilterItem, "filterId">>
type FilterSelector = "field" | "operator" | "value"

/** Whether one filter menu on screen is open, made for each menu (its `useId`). */
const menuOpen = Atom.family((_instance: string) => Atom.make(false))

/** One filter menu's trigger button, set by the button's ref. */
const menuTrigger = Atom.family((_instance: string) => Atom.make<HTMLButtonElement | null>(null))

/**
 * Ctrl+Shift+F opens and closes one filter menu, from anywhere in its table (or the page, when its table is the
 * first): the listener is on the window while the menu is on screen, and goes with the atom. A disabled trigger takes
 * no shortcut, as upstream's `disabled` prop.
 */
const menuShortcut = Atom.family((instance: string) =>
  Atom.readable((get) => {
    const registry = get.registry
    function onKeyDown(event: KeyboardEvent) {
      const trigger = registry.get(menuTrigger(instance))
      if (trigger?.disabled === true) return
      const open = registry.get(menuOpen(instance))
      if (!open && !getIsTableShortcutTarget(trigger, event.target)) {
        return
      }
      if (getIsEditableTarget(event.target)) return
      if (event.key.toLowerCase() !== FILTER_SHORTCUT_KEY || !(event.ctrlKey || event.metaKey) || !event.shiftKey) {
        return
      }

      event.preventDefault()
      registry.set(menuOpen(instance), !open)
    }

    window.addEventListener("keydown", onKeyDown)
    get.addFinalizer(() => window.removeEventListener("keydown", onKeyDown))
  })
)

/** Which of one filter row's lists is open, made for each row (its `useId`). */
const activeSelectorOf = Atom.family((_instance: string) => Atom.make<FilterSelector | null>(null))

interface DataTableFilterMenuProps<TData extends RowData> extends ComponentProps<typeof PopoverContent> {
  table: ReactTable<DataTableFeatures, TData, unknown>
  disabled?: boolean
}

export function DataTableFilterMenu<TData extends RowData>({ table, ...props }: DataTableFilterMenuProps<TData>) {
  return (
    <table.Subscribe
      selector={(state) => ({
        filters: table.getColumnFilterItems(),
        joinOperator: state.joinOperator
      })}
    >
      {({ filters, joinOperator }) => (
        <DataTableFilterMenuContent table={table} filters={filters} joinOperator={joinOperator} {...props} />
      )}
    </table.Subscribe>
  )
}

interface DataTableFilterMenuContentProps<TData extends RowData> extends DataTableFilterMenuProps<TData> {
  filters: ColumnFilterItem[]
  joinOperator: JoinOperator
}

function DataTableFilterMenuContent<TData extends RowData>({
  table,
  filters,
  joinOperator,
  disabled,
  ...props
}: DataTableFilterMenuContentProps<TData>) {
  const dir = useDirection()
  const id = useId()
  const labelId = useId()
  const descriptionId = useId()
  const [open, setOpen] = useAtom(menuOpen(id))
  const setTrigger = useAtomSet(menuTrigger(id))
  const addButtonRef = useRef<HTMLButtonElement>(null)
  useAtomMount(menuShortcut(id))

  // Worked out in each draw: the table handed in is a new object in each draw of its owner, so upstream's memo on it
  // never kept anything.
  const columns = table.getAllLeafColumns().filter((column) => column.getCanFilter())

  const hasFilters = filters.length > 0

  function onFilterAdd() {
    const column = columns[0]
    if (!column) return

    table.addColumnFilter({
      ...getDefaultFilter(column),
      filterId: generateId({ length: 8 })
    })
  }

  function onFilterUpdate(filterId: string, updates: FilterUpdate) {
    table.updateColumnFilter(filterId, updates)
  }

  function onFilterRemove(filterId: string) {
    table.removeColumnFilter(filterId)
    addButtonRef.current?.focus()
  }

  function onFiltersReset() {
    table.resetColumnFilters(true)
    table.resetJoinOperator()
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    const lastFilter = filters.at(-1)
    if (!lastFilter || !getIsRemoveKey(event)) return

    event.preventDefault()
    onFilterRemove(lastFilter.filterId)
  }

  return (
    <Sortable
      value={filters}
      onValueChange={(value) => table.setColumnFilters(value)}
      getItemValue={(item) => item.filterId}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" ref={setTrigger} onKeyDown={onTriggerKeyDown} disabled={disabled}>
            <ListFilter className="text-muted-foreground" />
            Filter
            {hasFilters && (
              <Badge variant="secondary" className="h-[18.24px] px-[5.12px] font-mono text-[10.4px]">
                {filters.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          dir={dir}
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className="flex w-full max-w-(--radix-popover-content-available-width) flex-col gap-3.5 p-4 sm:min-w-95"
          {...props}
        >
          <div className="flex flex-col gap-1">
            <h4 id={labelId} className="leading-none font-medium">
              {hasFilters ? "Filters" : "No filters applied"}
            </h4>
            <p id={descriptionId} className={cn("text-sm text-muted-foreground", hasFilters && "sr-only")}>
              {hasFilters ? "Modify filters to refine your rows." : "Add filters to refine your rows."}
            </p>
          </div>
          {hasFilters && (
            <SortableContent asChild>
              <div
                role="list"
                className="grid max-h-75 grid-cols-[minmax(4.5rem,auto)_auto_8rem_minmax(10rem,max-content)_auto_auto] gap-x-2 gap-y-2 overflow-y-auto p-1 max-md:max-h-[60svh] max-md:grid-cols-[minmax(4.5rem,auto)_minmax(0,1fr)_auto_auto] max-md:gap-y-4"
              >
                {filters.map((filter, index) => (
                  <DataTableFilterItem<TData>
                    key={filter.filterId}
                    filter={filter}
                    index={index}
                    filterItemId={`${id}-filter-${filter.filterId}`}
                    joinOperator={joinOperator}
                    columns={columns}
                    onJoinOperatorChange={(value) => table.setJoinOperator(value)}
                    onFilterUpdate={onFilterUpdate}
                    onFilterRemove={onFilterRemove}
                  />
                ))}
              </div>
            </SortableContent>
          )}
          <div className="flex w-full items-center gap-2">
            <Button ref={addButtonRef} onClick={onFilterAdd}>
              Add filter
            </Button>
            {hasFilters && (
              <Button variant="outline" onClick={onFiltersReset}>
                Reset filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div
          dir={dir}
          className="grid size-full grid-cols-[minmax(4.5rem,auto)_8rem_8rem_minmax(10rem,1fr)_auto_auto] items-center gap-2"
        >
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="h-8 rounded-lg bg-primary/10" />
          <div className="size-8 rounded-lg bg-primary/10" />
          <div className="size-8 rounded-lg bg-primary/10" />
        </div>
      </SortableOverlay>
    </Sortable>
  )
}

function getIsRemoveKey(event: ReactKeyboardEvent) {
  return REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase())
}

interface DataTableFilterItemProps<TData extends RowData> {
  filter: ColumnFilterItem
  index: number
  filterItemId: string
  joinOperator: JoinOperator
  columns: Column<DataTableFeatures, TData>[]
  onJoinOperatorChange: (value: JoinOperator) => void
  onFilterUpdate: (filterId: string, updates: FilterUpdate) => void
  onFilterRemove: (filterId: string) => void
}

function DataTableFilterItem<TData extends RowData>({
  filter,
  index,
  filterItemId,
  joinOperator,
  columns,
  onJoinOperatorChange,
  onFilterUpdate,
  onFilterRemove
}: DataTableFilterItemProps<TData>) {
  const [activeSelector, setActiveSelector] = useAtom(activeSelectorOf(useId()))

  const column = columns.find((column) => column.id === filter.id)
  if (!column) return null

  const label = column.columnDef.meta?.label ?? column.id

  function getSelectorProps(selector: FilterSelector) {
    return {
      open: activeSelector === selector,
      onOpenChange: (open: boolean) => setActiveSelector(open ? selector : null)
    }
  }

  function onItemKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (activeSelector || getIsEditableTarget(event.target)) return
    if (!getIsRemoveKey(event)) return

    event.preventDefault()
    onFilterRemove(filter.filterId)
  }

  return (
    <SortableItem id={filterItemId} value={filter.filterId} asChild>
      <div
        role="listitem"
        tabIndex={-1}
        className="col-span-full grid grid-cols-subgrid items-center gap-y-2"
        onKeyDown={onItemKeyDown}
      >
        <div className="min-w-18 text-center">
          <FilterJoinOperator
            index={index}
            joinOperator={joinOperator}
            listboxId={`${filterItemId}-join-operator-listbox`}
            onJoinOperatorChange={onJoinOperatorChange}
          />
        </div>
        <FilterFieldSelector
          filter={filter}
          column={column}
          columns={columns}
          listboxId={`${filterItemId}-field-listbox`}
          onFilterUpdate={onFilterUpdate}
          {...getSelectorProps("field")}
        />
        <FilterOperatorSelector
          filter={filter}
          label={label}
          listboxId={`${filterItemId}-operator-listbox`}
          onFilterUpdate={onFilterUpdate}
          {...getSelectorProps("operator")}
        />
        <div className="w-full min-w-0 max-md:col-span-3 max-md:col-start-2 max-md:row-start-3">
          <FilterValueInput
            filter={filter}
            column={column}
            inputId={`${filterItemId}-input`}
            onFilterUpdate={onFilterUpdate}
            {...getSelectorProps("value")}
          />
        </div>
        <Button
          aria-controls={filterItemId}
          aria-label={`Remove ${label} filter`}
          variant="outline"
          size="icon"
          className="max-md:col-start-3 max-md:row-start-1"
          onClick={() => onFilterRemove(filter.filterId)}
        >
          <Trash2 />
        </Button>
        <SortableItemHandle aria-label={`Reorder ${label} filter`} asChild>
          <Button variant="outline" size="icon" className="max-md:col-start-4 max-md:row-start-1">
            <GripVertical />
          </Button>
        </SortableItemHandle>
      </div>
    </SortableItem>
  )
}

interface FilterJoinOperatorProps {
  index: number
  joinOperator: JoinOperator
  listboxId: string
  onJoinOperatorChange: (value: JoinOperator) => void
}

function FilterJoinOperator({ index, joinOperator, listboxId, onJoinOperatorChange }: FilterJoinOperatorProps) {
  if (index === 0) {
    return <span className="text-sm text-muted-foreground">Where</span>
  }

  if (index > 1) {
    return <span className="text-sm text-muted-foreground">{joinOperator}</span>
  }

  return (
    <Select value={joinOperator} onValueChange={onJoinOperatorChange}>
      <SelectTrigger aria-label="Select join operator" aria-controls={listboxId} className="lowercase">
        <SelectValue placeholder={joinOperator} />
      </SelectTrigger>
      <SelectContent id={listboxId} position="popper" className="min-w-(--radix-select-trigger-width) lowercase">
        <SelectGroup>
          {JOIN_OPERATORS.map((joinOperator) => (
            <SelectItem key={joinOperator} value={joinOperator}>
              {joinOperator}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

interface FilterSelectorProps {
  filter: ColumnFilterItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onFilterUpdate: (filterId: string, updates: FilterUpdate) => void
}

interface FilterFieldSelectorProps<TData extends RowData> extends FilterSelectorProps {
  column: Column<DataTableFeatures, TData>
  columns: Column<DataTableFeatures, TData>[]
  listboxId: string
}

function FilterFieldSelector<TData extends RowData>({
  filter,
  column,
  columns,
  listboxId,
  open,
  onOpenChange,
  onFilterUpdate
}: FilterFieldSelectorProps<TData>) {
  const dir = useDirection()
  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={filter.id}
      onValueChange={(columnId) => {
        const column = columns.find((column) => column.id === columnId)
        if (column) {
          onFilterUpdate(filter.filterId, getDefaultFilter(column))
        }
      }}
    >
      <FacetedTrigger asChild>
        <Button
          aria-controls={listboxId}
          variant="outline"
          title={column.columnDef.meta?.label}
          className="w-full max-w-48 min-w-32 max-md:min-w-0"
        >
          <bdi className="truncate">{column.columnDef.meta?.label ?? "Select field"}</bdi>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </FacetedTrigger>
      <FacetedContent dir={dir} id={listboxId} className="w-auto max-w-80 min-w-40">
        <FacetedInput placeholder="Search fields..." />
        <FacetedList>
          <FacetedEmpty>No fields found.</FacetedEmpty>
          <FacetedGroup>
            {columns.map((column) => (
              <FacetedItem key={column.id} value={column.id}>
                <bdi className="truncate">{column.columnDef.meta?.label ?? column.id}</bdi>
                <FacetedItemIndicator />
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  )
}

interface FilterOperatorSelectorProps extends FilterSelectorProps {
  label: string
  listboxId: string
}

function FilterOperatorSelector({
  filter,
  label,
  listboxId,
  open,
  onOpenChange,
  onFilterUpdate
}: FilterOperatorSelectorProps) {
  return (
    <Select
      open={open}
      onOpenChange={onOpenChange}
      value={filter.operator}
      onValueChange={(operator: FilterOperator) =>
        onFilterUpdate(filter.filterId, {
          operator,
          value: coerceFilterValue(operator, filter.value)
        })
      }
    >
      <SelectTrigger
        aria-controls={listboxId}
        aria-label={`${label} filter operator`}
        className="w-32 lowercase max-md:col-span-3 max-md:col-start-2 max-md:row-start-2 max-md:w-full"
      >
        <div className="truncate">
          <SelectValue placeholder={filter.operator} />
        </div>
      </SelectTrigger>
      <SelectContent id={listboxId}>
        <SelectGroup>
          {getFilterOperators(filter.variant).map((operator) => (
            <SelectItem key={operator.value} value={operator.value} className="lowercase">
              {operator.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

interface FilterValueInputProps<TData extends RowData> extends FilterSelectorProps {
  column: Column<DataTableFeatures, TData>
  inputId: string
}

function FilterValueInput<TData extends RowData>(props: FilterValueInputProps<TData>) {
  const { filter, column, inputId, onFilterUpdate } = props
  const columnMeta = column.columnDef.meta

  if (getIsValuelessOperator(filter.operator)) {
    return (
      <div
        id={inputId}
        role="status"
        aria-label={`${columnMeta?.label ?? column.id} filter is ${
          filter.operator === "isEmpty" ? "empty" : "not empty"
        }`}
        aria-live="polite"
        className="h-8 w-full rounded-lg border border-dashed border-input bg-transparent dark:bg-input/30"
      />
    )
  }

  // Text and numbers share one box (or two, for a range).
  const typed = () => {
    if (filter.operator === "isBetween") {
      return <DataTableRangeFilter filter={filter} column={column} inputId={inputId} onFilterUpdate={onFilterUpdate} />
    }

    return (
      <Input
        // Local change: keyed by the column, so choosing another field starts with an empty box. The box is
        // uncontrolled, and without the key it kept showing the old field's text after that value was cleared.
        key={filter.id}
        id={inputId}
        type={filter.variant === "text" ? "text" : "number"}
        aria-label={`${columnMeta?.label ?? column.id} filter value`}
        inputMode={filter.variant === "text" ? undefined : "numeric"}
        placeholder={columnMeta?.placeholder ?? "Enter a value..."}
        defaultValue={typeof filter.value === "string" ? filter.value : undefined}
        onChange={(event) => onFilterUpdate(filter.filterId, { value: event.target.value })}
      />
    )
  }

  return FilterVariants.match(filter.variant, {
    text: typed,
    number: typed,
    boolean: () => <BooleanFilterValue {...props} />,
    select: () => <SelectFilterValue {...props} />,
    date: () => <DateFilterValue {...props} />
  })
}

function BooleanFilterValue<TData extends RowData>({
  filter,
  column,
  inputId,
  open,
  onOpenChange,
  onFilterUpdate
}: FilterValueInputProps<TData>) {
  const listboxId = `${inputId}-listbox`

  return (
    <Select
      open={open}
      onOpenChange={onOpenChange}
      value={typeof filter.value === "string" ? filter.value : undefined}
      onValueChange={(value) => onFilterUpdate(filter.filterId, { value })}
    >
      <SelectTrigger
        id={inputId}
        aria-controls={listboxId}
        aria-label={`${column.columnDef.meta?.label ?? column.id} boolean filter`}
        className="w-full"
      >
        <SelectValue placeholder="Select value" />
      </SelectTrigger>
      <SelectContent id={listboxId}>
        <SelectGroup>
          {/* Local change: "Yes" and "No", the words this app shows for these values everywhere else. */}
          <SelectItem value="true">Yes</SelectItem>
          <SelectItem value="false">No</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function SelectFilterValue<TData extends RowData>({
  filter,
  column,
  inputId,
  open,
  onOpenChange,
  onFilterUpdate
}: FilterValueInputProps<TData>) {
  const dir = useDirection()
  const listboxId = `${inputId}-listbox`
  const columnMeta = column.columnDef.meta
  const multiple = filter.operator === "inArray" || filter.operator === "notInArray"

  return (
    <Faceted
      open={open}
      onOpenChange={onOpenChange}
      value={getSelectFilterValue(filter)}
      onValueChange={(value) => onFilterUpdate(filter.filterId, { value: value ?? "" })}
      items={getColumnSelectOptions(columnMeta)}
      multiple={multiple}
    >
      <FacetedTrigger asChild>
        <Button
          id={inputId}
          aria-controls={listboxId}
          aria-label={`${columnMeta?.label ?? column.id} filter value${multiple ? "s" : ""}`}
          variant="outline"
          className="w-full hover:bg-muted/50 aria-expanded:bg-background dark:aria-expanded:bg-input/30"
        >
          <FacetedValue placeholder={columnMeta?.placeholder ?? `Select option${multiple ? "s" : ""}...`} />
        </Button>
      </FacetedTrigger>
      <FacetedContent dir={dir} id={listboxId} className="w-50">
        <FacetedInput
          aria-label={`Search ${columnMeta?.label ?? column.id} options`}
          placeholder={columnMeta?.placeholder ?? "Search options..."}
        />
        <FacetedList>
          <FacetedEmpty>No options found.</FacetedEmpty>
          <FacetedGroup>
            {getColumnSelectOptions(columnMeta).map((option) => (
              <FacetedItem key={option.value} value={option.value}>
                {option.icon && <option.icon />}
                <bdi className="flex-1 truncate">{option.label}</bdi>
                <FacetedItemIndicator>{option.count}</FacetedItemIndicator>
              </FacetedItem>
            ))}
          </FacetedGroup>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  )
}

function DateFilterValue<TData extends RowData>({
  filter,
  column,
  inputId,
  open,
  onOpenChange,
  onFilterUpdate
}: FilterValueInputProps<TData>) {
  const dir = useDirection()
  const listboxId = `${inputId}-listbox`
  const label = column.columnDef.meta?.label ?? column.id
  const [startDate, endDate] = getFilterDates(filter.value)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={inputId}
          aria-controls={listboxId}
          aria-label={`${label} date filter`}
          variant="outline"
          className={cn("w-full justify-start text-start", !startDate && "text-muted-foreground")}
        >
          <CalendarIcon />
          <bdi className="truncate">{getDateFilterLabel(filter) ?? "Pick a date"}</bdi>
        </Button>
      </PopoverTrigger>
      <PopoverContent dir={dir} id={listboxId} align="start" className="w-auto p-0">
        {filter.operator === "isBetween" ? (
          <Calendar
            aria-label={`Select ${label} date range`}
            autoFocus
            captionLayout="dropdown"
            mode="range"
            selected={startDate ? { from: startDate, to: endDate } : undefined}
            onSelect={(range) =>
              onFilterUpdate(filter.filterId, {
                value: range ? [getFilterDateValue(range.from), getFilterDateValue(range.to)] : []
              })
            }
          />
        ) : (
          <Calendar
            aria-label={`Select ${label} date`}
            autoFocus
            captionLayout="dropdown"
            mode="single"
            selected={startDate}
            onSelect={(date) => {
              onFilterUpdate(filter.filterId, {
                value: getFilterDateValue(date)
              })
              onOpenChange(false)
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}
