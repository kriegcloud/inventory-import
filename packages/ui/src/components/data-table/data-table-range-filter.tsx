// Local change: moved from React's hooks to atoms (goals/atoms, "The kit on atoms", batch 1); no longer as its registry has it.
"use client"

import { useAtom, useAtomValue } from "@effect/atom-react"
import type { Column, RowData } from "@tanstack/react-table"

import { cn } from "cn"
import { type ComponentProps, type FocusEvent, type KeyboardEvent, useId } from "react"

import type { DataTableFeatures } from "@inventory/ui/components/data-table/data-table-features"
import { boundsDraft, oneTimer } from "@inventory/ui/components/data-table/data-table-state"
import type { ColumnFilterItem } from "@inventory/ui/components/data-table/data-table-types"

import {
  getColumnNumberOptions,
  getRangeFilterBounds,
  getValidRangeFilterBounds
} from "@inventory/ui/components/data-table/data-table-utils"
import { Input } from "@inventory/ui/components/input"

const INVALID_RING_DELAY_MS = 500

interface DataTableRangeFilterProps<TData extends RowData> extends ComponentProps<"div"> {
  filter: ColumnFilterItem
  column: Column<DataTableFeatures, TData>
  inputId: string
  onFilterUpdate: (filterId: string, updates: Partial<Omit<ColumnFilterItem, "filterId">>) => void
}

export function DataTableRangeFilter<TData extends RowData>({
  filter,
  column,
  inputId,
  onFilterUpdate,
  onBlur,
  className,
  ...props
}: DataTableRangeFilterProps<TData>) {
  const meta = column.columnDef.meta
  const bounds = getColumnNumberOptions(meta)

  const [startValue, endValue] = getRangeFilterValues(filter.value).map(getInputValue)
  // The boxes' drafts and the ring's delay are atoms of this filter's own; the delay is cleared when it leaves.
  const instance = useId()
  const [{ drafts, showInvalid }, setBounds] = useAtom(boundsDraft(instance))
  const invalidTimer = useAtomValue(oneTimer(instance))
  const setDrafts = (next: readonly [string | null, string | null]) =>
    setBounds((previous) => ({ ...previous, drafts: next }))
  const setShowInvalid = (next: boolean) => setBounds((previous) => ({ ...previous, showInvalid: next }))
  const [startInput, endInput] = getInputValues(drafts)

  function onInvalidChange(isInvalid: boolean) {
    invalidTimer.cancel()
    if (!isInvalid) {
      setShowInvalid(false)
      return
    }
    if (showInvalid) return
    invalidTimer.start(() => setShowInvalid(true), INVALID_RING_DELAY_MS)
  }

  function getInputValues(nextDrafts: readonly [string | null, string | null]): [string, string] {
    return [nextDrafts[0] ?? startValue ?? "", nextDrafts[1] ?? endValue ?? ""]
  }

  function onBoundsUpdate([start, end]: [number | undefined, number | undefined]) {
    onFilterUpdate(filter.filterId, {
      value: [start?.toString() ?? "", end?.toString() ?? ""]
    })
  }

  function onDraftChange(index: 0 | 1, value: string) {
    const nextDrafts: [string | null, string | null] = index === 0 ? [value, drafts[1]] : [drafts[0], value]
    setDrafts(nextDrafts)

    const nextBounds = getValidRangeFilterBounds(getInputValues(nextDrafts))
    if (nextBounds) onBoundsUpdate(nextBounds)
    onInvalidChange(!nextBounds)
  }

  function onDraftCommit() {
    if (drafts[0] === null && drafts[1] === null) return

    onBoundsUpdate(getRangeFilterBounds([startInput, endInput]))
    setDrafts([null, null])
    onInvalidChange(false)
  }

  function onContainerBlur(event: FocusEvent<HTMLDivElement>) {
    onBlur?.(event)
    if (event.currentTarget.contains(event.relatedTarget)) return
    onDraftCommit()
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") onDraftCommit()
  }

  return (
    <div
      data-slot="data-table-range-filter"
      className={cn("flex w-full items-center gap-2", className)}
      {...props}
      onBlur={onContainerBlur}
    >
      <Input
        id={`${inputId}-min`}
        type="number"
        aria-label={`${meta?.label} minimum value`}
        aria-invalid={(showInvalid && drafts[0] !== null) || undefined}
        data-slot="data-table-range-filter-min"
        inputMode="numeric"
        placeholder={bounds?.min?.toString() ?? "Min"}
        className="w-full min-w-20"
        value={startInput}
        onChange={(event) => onDraftChange(0, event.target.value)}
        onKeyDown={onInputKeyDown}
      />
      <span data-slot="data-table-range-filter-separator" className="shrink-0 text-sm text-muted-foreground">
        to
      </span>
      <Input
        id={`${inputId}-max`}
        type="number"
        aria-label={`${meta?.label} maximum value`}
        aria-invalid={(showInvalid && drafts[1] !== null) || undefined}
        data-slot="data-table-range-filter-max"
        inputMode="numeric"
        placeholder={bounds?.max?.toString() ?? "Max"}
        className="w-full min-w-20"
        value={endInput}
        onChange={(event) => onDraftChange(1, event.target.value)}
        onKeyDown={onInputKeyDown}
      />
    </div>
  )
}

function getRangeFilterValues(value: string | string[]): [string, string] {
  if (Array.isArray(value)) return [value[0] ?? "", value[1] ?? ""]
  return [value, ""]
}

function getInputValue(value: string) {
  return value === "" || Number.isNaN(Number(value)) ? "" : value
}
