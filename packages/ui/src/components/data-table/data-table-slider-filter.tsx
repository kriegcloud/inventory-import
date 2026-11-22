// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

import { useAtom, useAtomValue } from "@effect/atom-react"
import { type Column, type RowData, Subscribe } from "@tanstack/react-table"
import * as MutableHashSet from "effect/MutableHashSet"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { type FocusEvent, type KeyboardEvent, type MouseEvent, useId } from "react"

import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { boundsDraft, oneTimer } from "@inventory/ui/components/data-table/data-table-state"

import {
  getColumnNumberOptions,
  getRangeFilterBounds,
  getValidRangeFilterBounds
} from "@inventory/ui/components/data-table/data-table-utils"
import { Button } from "@inventory/ui/components/button"
import { useDirection } from "@inventory/ui/components/direction"
import { InputGroup, InputGroupInput } from "@inventory/ui/components/input-group"
import { Label } from "@inventory/ui/components/label"
import { Popover, PopoverContent, PopoverTrigger } from "@inventory/ui/components/popover"
import { Separator } from "@inventory/ui/components/separator"
import { Slider } from "@inventory/ui/components/slider"
import { XCircle, PlusCircle } from "lucide-react"

const INVALID_RING_DELAY_MS = 500

type RangeValue = [number, number]

/**
 * The range of the column's values as the filter keeps it: read again and kept each time the filter opens, and read
 * as the filter is drawn until it first opens (upstream read it once, when the filter was first drawn).
 */
const facetedRangeOf = Atom.family((_instance: string) => Atom.make<O.Option<RangeValue | null>>(O.none()))

// The columns already warned of in development: once a column, while the page is open.
const warnedOf = MutableHashSet.empty<string>()

interface DataTableSliderFilterProps<TData extends RowData> {
  column: Column<DataTableFeatures, TData>
  title?: string
}

export function DataTableSliderFilter<TData extends RowData>({ column, ...props }: DataTableSliderFilterProps<TData>) {
  return (
    <Subscribe source={column.table.atoms.columnFilters} selector={() => column.getFilterValue()}>
      {(filterValue) => <DataTableSliderFilterContent column={column} columnFilterValue={filterValue} {...props} />}
    </Subscribe>
  )
}

function DataTableSliderFilterContent<TData extends RowData>({
  column,
  title = column.columnDef.meta?.label ?? column.id,
  columnFilterValue: columnFilterValueProp
}: DataTableSliderFilterProps<TData> & {
  columnFilterValue: unknown
}) {
  const dir = useDirection()
  const id = useId()

  const numberMeta = getColumnNumberOptions(column.columnDef.meta)
  const declaredMin = numberMeta?.min
  const declaredMax = numberMeta?.max
  const unit = numberMeta?.unit

  const [facetedRangeKept, setFacetedRange] = useAtom(facetedRangeOf(id))
  const facetedRange = O.getOrElse(facetedRangeKept, () => getFacetedRange(column))
  const min = declaredMin ?? facetedRange?.[0] ?? 0
  const max = declaredMax ?? facetedRange?.[1] ?? 100
  const hasNoValues = (declaredMin === undefined || declaredMax === undefined) && getFacetedRange(column) === null
  const step = getRangeStep(min, max)

  function onOpenChange(open: boolean) {
    if (open) setFacetedRange(O.some(getFacetedRange(column)))
  }

  if (
    import.meta.env.DEV &&
    column.table.options.manualFiltering === true &&
    (declaredMin === undefined || declaredMax === undefined) &&
    !MutableHashSet.has(warnedOf, column.id)
  ) {
    MutableHashSet.add(warnedOf, column.id)
    console.warn(
      `DataTableSliderFilter: column "${column.id}" is missing \`meta.min\` or \`meta.max\`, so in server mode its bounds only cover the rows on the current page. Set both to the full range of the data.`
    )
  }

  const bounds = parseRangeBounds(columnFilterValueProp)
  const columnFilterValue: RangeValue | undefined = bounds ? [bounds[0] ?? min, bounds[1] ?? max] : undefined
  const range: RangeValue = columnFilterValue ?? [min, max]
  // The boxes' drafts and the ring's delay are atoms of this filter's own; the delay is cleared when it leaves.
  const [{ drafts, showInvalid }, setBounds] = useAtom(boundsDraft(id))
  const invalidTimer = useAtomValue(oneTimer(id))
  const setDrafts = (next: readonly [string | null, string | null]) =>
    setBounds((previous) => ({ ...previous, drafts: next }))
  const setShowInvalid = (next: boolean) => setBounds((previous) => ({ ...previous, showInvalid: next }))

  function onInvalidChange(isInvalid: boolean) {
    invalidTimer.cancel()
    if (!isInvalid) {
      setShowInvalid(false)
      return
    }
    if (showInvalid) return
    invalidTimer.start(() => setShowInvalid(true), INVALID_RING_DELAY_MS)
  }

  function formatValue(value: number) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }

  function setRangeFilter([start = min, end = max]: [number | undefined, number | undefined]) {
    column.setFilterValue(start <= min && end >= max ? undefined : [start, end])
  }

  function getInputValues(nextDrafts: readonly [string | null, string | null]): [string, string] {
    return [nextDrafts[0] ?? range[0].toString(), nextDrafts[1] ?? range[1].toString()]
  }

  function onDraftChange(index: 0 | 1, value: string) {
    const nextDrafts: [string | null, string | null] = index === 0 ? [value, drafts[1]] : [drafts[0], value]
    setDrafts(nextDrafts)

    const nextBounds = getValidRangeFilterBounds(getInputValues(nextDrafts), [min, max])
    if (nextBounds) setRangeFilter(nextBounds)
    onInvalidChange(!nextBounds)
  }

  function onDraftCommit() {
    if (drafts[0] === null && drafts[1] === null) return

    setRangeFilter(getRangeFilterBounds(getInputValues(drafts), [min, max]))
    setDrafts([null, null])
    onInvalidChange(false)
  }

  function onInputsBlur(event: FocusEvent<HTMLDivElement>) {
    if (event.currentTarget.contains(event.relatedTarget)) return
    onDraftCommit()
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") onDraftCommit()
  }

  function onSliderValueChange(value: RangeValue) {
    if (Array.isArray(value) && value.length === 2) {
      setDrafts([null, null])
      onInvalidChange(false)
      setRangeFilter([value[0], value[1]])
    }
  }

  function onReset(event: MouseEvent) {
    event.stopPropagation()
    setDrafts([null, null])
    onInvalidChange(false)
    column.setFilterValue(undefined)
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="max-w-full shrink" disabled={hasNoValues && !columnFilterValue}>
          {columnFilterValue ? (
            <span
              aria-hidden="true"
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100"
              onClick={onReset}
            >
              <XCircle />
            </span>
          ) : (
            <PlusCircle />
          )}
          <bdi className="truncate">{title}</bdi>
          {columnFilterValue ? (
            <>
              <Separator orientation="vertical" className="mx-0.5 data-vertical:h-4 data-vertical:self-center" />
              <bdi className="truncate">
                {formatValue(columnFilterValue[0])} - {formatValue(columnFilterValue[1])}
                {unit ? ` ${unit}` : ""}
              </bdi>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent aria-label={`${title} filter`} dir={dir} align="start" className="flex w-auto flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            {title}
            {unit ? ` (${unit})` : ""}
          </p>
          <div className="flex items-center gap-4" onBlur={onInputsBlur}>
            <Label htmlFor={`${id}-from`} className="sr-only">
              From
            </Label>
            <InputGroup className="w-24">
              <InputGroupInput
                id={`${id}-from`}
                type="number"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-invalid={(showInvalid && drafts[0] !== null) || undefined}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={min.toString()}
                min={min}
                max={max}
                value={drafts[0] ?? range[0].toString()}
                onChange={(event) => onDraftChange(0, event.target.value)}
                onKeyDown={onInputKeyDown}
              />
            </InputGroup>
            <Label htmlFor={`${id}-to`} className="sr-only">
              to
            </Label>
            <InputGroup className="w-24">
              <InputGroupInput
                id={`${id}-to`}
                type="number"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-invalid={(showInvalid && drafts[1] !== null) || undefined}
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder={max.toString()}
                min={min}
                max={max}
                value={drafts[1] ?? range[1].toString()}
                onChange={(event) => onDraftChange(1, event.target.value)}
                onKeyDown={onInputKeyDown}
              />
            </InputGroup>
          </div>
          <Label htmlFor={`${id}-slider`} className="sr-only">
            {title} slider
          </Label>
          <Slider
            id={`${id}-slider`}
            min={min}
            max={max}
            step={step}
            value={range}
            onValueChange={onSliderValueChange}
          />
        </div>
        <Button aria-label={`Clear ${title} filter`} variant="outline" onClick={onReset}>
          Clear
        </Button>
      </PopoverContent>
    </Popover>
  )
}

function getFacetedRange<TData extends RowData>(column: Column<DataTableFeatures, TData>): RangeValue | null {
  const values = column.getFacetedMinMaxValues()
  if (Array.isArray(values) && values.length === 2) {
    const [min, max] = values
    if (typeof min === "number" && typeof max === "number") {
      return min === max ? [min, min + 1] : [min, max]
    }
  }
  return null
}

function getRangeStep(min: number, max: number) {
  const rangeSize = max - min
  if (rangeSize <= 100) return 1
  return 10 ** Math.floor(Math.log10(rangeSize / 100))
}

function parseRangeBounds(value: unknown): [number | undefined, number | undefined] | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined

  const [start, end] = value.map(parseRangeBound)
  if (start === null || end === null) return undefined
  if (start === undefined && end === undefined) return undefined

  return [start, end]
}

function parseRangeBound(value: unknown) {
  if (value === undefined || value === "") return undefined
  if (typeof value !== "number" && typeof value !== "string") return null

  const number = Number(value)
  return Number.isNaN(number) ? null : number
}
