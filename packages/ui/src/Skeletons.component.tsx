import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import * as A from "effect/Array"
import { LineSkeleton } from "@inventory/ui/PageHeader"
import { DataTableFrameSkeleton } from "@inventory/ui/components/data-table/data-table-frame-skeleton"
import { Skeleton } from "@inventory/ui/components/skeleton"
import {
  StickyTable,
  StickyTableBody,
  StickyTableCell,
  StickyTableColumn,
  StickyTableFrame,
  StickyTableHeader,
  StickyTableRow,
  StickyTableRowHeader
} from "@inventory/ui/components/sticky-table"
import { useAtomValue } from "@effect/atom-react"
import { isNarrow } from "@inventory/ui/ContentWidth"

// Skeletons of what is on its way, each drawn in the same boxes as the real thing (the same frame, header row and
// 36px rows; the same page header; the review's own bands), so nothing on the screen moves when the data arrives.
// Kept free of the table and review code, so a page whose code is still loading can show one.

/** One grey bar of a cell, in one of three widths so the rows do not look stamped; at the right in a number column. */
function Bar(props: { readonly seed: number; readonly right?: boolean | undefined }) {
  const n = props.seed % 3
  if (props.right === true) {
    return (
      <Skeleton className={n === 0 ? "ml-auto h-3.5 w-2/3" : n === 1 ? "ml-auto h-3.5 w-1/2" : "ml-auto h-3.5 w-4/5"} />
    )
  }
  return <Skeleton className={n === 0 ? "h-3.5 w-2/3" : n === 1 ? "h-3.5 w-1/2" : "h-3.5 w-4/5"} />
}

/** A column of a skeleton table: its heading when the page knows it, and its width as the real table has it. */
export type SkeletonColumn = { readonly label: O.Option<string>; readonly width?: number; readonly align?: "right" }

/**
 * A page's top while the page's code is on its way: its title (a bar when even that depends on data), the grey line
 * and an action, in PageHeader's box.
 */
export function PageHeaderSkeleton(props: {
  readonly title?: string
  readonly line?: boolean
  readonly action?: boolean
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-4 pt-5 pb-3 sm:px-9">
      <div className="min-w-0 flex-1">
        {props.title === undefined ? (
          <div className="flex h-7 items-center">
            <Skeleton className="h-5 w-56" />
          </div>
        ) : (
          <h1 className="truncate text-xl font-semibold tracking-tight">{props.title}</h1>
        )}
        {props.line === true ? <LineSkeleton /> : null}
      </div>
      {props.action === true ? <Skeleton className="h-9 w-28" /> : null}
    </div>
  )
}

/** Phone cards while their rows are on their way, the shape a data table's cards (`DataTableCards`) draw on a phone. */
function CardsSkeleton(props: { readonly lines: number }) {
  return (
    <div aria-hidden className="relative min-h-0 flex-1 overflow-hidden border-y">
      {Array.from({ length: 6 }, (_, card) => (
        <div key={card} className="flex flex-col gap-1 border-b px-4 py-3">
          <div className="flex h-6 items-center">
            <Skeleton className={card % 2 === 0 ? "h-4 w-2/3" : "h-4 w-1/2"} />
          </div>
          <div className="grid grid-cols-label-value items-center gap-x-3 gap-y-1">
            {Array.from({ length: props.lines }, (_, line) => (
              <div key={line} className="contents">
                <div className="flex h-5 items-center">
                  <Skeleton className="h-3 w-16" />
                </div>
                <div className="flex h-5 items-center">
                  <Bar seed={card + line} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * A data table while its rows are on their way: the data table's own frame and header row (with the column names when
 * the page knows them), then rows of grey bars, enough to fill the screen. On a phone, the cards it draws there.
 */
export function TableSkeleton(props: {
  readonly caption: string
  readonly columns: ReadonlyArray<SkeletonColumn>
  readonly rows?: number
}) {
  const narrow = useAtomValue(isNarrow)
  if (narrow) return <CardsSkeleton lines={Math.min(4, Math.max(1, props.columns.length - 1))} />
  return (
    <DataTableFrameSkeleton
      caption={props.caption}
      columns={props.columns.map(({ label, ...column }) => ({ ...column, ...R.getSomes({ label }) }))}
      {...(props.rows === undefined ? {} : { rows: props.rows })}
    />
  )
}

/** The grid's layout keeps a flexible column distinct from the space it contributes to the minimum width. */
class GridLayoutColumn extends S.Opaque<GridLayoutColumn, { readonly brand: unique symbol }>()(
  S.Struct({
    width: S.Option(S.Finite).annotateKey({ description: "Fixed pixels, or a flexible column" }),
    minimumWidth: S.Finite.pipe(
      S.annotateKey({ description: "Pixels contributed to the grid's minimum width, including flexible columns" }),
      S.withConstructorDefault(Effect.succeed(240))
    )
  }).annotate({ description: "A skeleton grid column's fixed or flexible layout and minimum room" })
) {}

/**
 * The review's grid while its rows are on their way: the review region's own frame (the sticky table it draws, with
 * its pinned first column), so the review does not move when it arrives.
 */
function GridSkeleton({
  caption,
  columns,
  rows = 24
}: {
  readonly caption: string
  readonly columns: ReadonlyArray<SkeletonColumn>
  readonly rows?: number
}) {
  const layout = A.map(columns, (column) => {
    const width = O.fromUndefinedOr(column.width)
    return GridLayoutColumn.make({ width, ...R.getSomes({ minimumWidth: width }) })
  })
  const minWidth = A.reduce(layout, 0, (total, column) => total + column.minimumWidth)
  return (
    <StickyTableFrame label={`${caption}, loading`} aria-busy="true">
      <StickyTable
        caption={caption}
        widths={A.map(layout, (column) => O.match(column.width, { onNone: () => undefined, onSome: (width) => width }))}
        minWidth={minWidth}
        rowCount={rows + 1}
      >
        <StickyTableHeader>
          <StickyTableRow>
            {A.map(columns, (column, index) => (
              <StickyTableColumn key={index} pin={index === 0 ? "start" : undefined} align={column.align}>
                {O.match(column.label, {
                  onNone: () => <Skeleton className={column.align === "right" ? "ml-auto h-3 w-16" : "h-3 w-16"} />,
                  onSome: (label) => label
                })}
              </StickyTableColumn>
            ))}
          </StickyTableRow>
        </StickyTableHeader>
        <StickyTableBody>
          {Array.from({ length: rows }, (_, row) => (
            <StickyTableRow key={row} aria-hidden>
              {A.map(columns, (column, index) =>
                index === 0 ? (
                  <StickyTableRowHeader key={index}>
                    <Bar seed={row + index} />
                  </StickyTableRowHeader>
                ) : (
                  <StickyTableCell key={index} align={column.align}>
                    <Bar seed={row + index} right={column.align === "right"} />
                  </StickyTableCell>
                )
              )}
            </StickyTableRow>
          ))}
        </StickyTableBody>
      </StickyTable>
    </StickyTableFrame>
  )
}

/** A page that is a header and a table, while its code or its rows are on their way. */
export function TablePageSkeleton(props: {
  readonly title?: string
  readonly caption: string
  readonly columns: ReadonlyArray<SkeletonColumn>
  readonly line?: boolean
  readonly action?: boolean
  readonly views?: number
}) {
  return (
    <div className="flex h-full flex-col" aria-busy="true">
      <PageHeaderSkeleton
        {...(props.title === undefined ? {} : { title: props.title })}
        {...(props.line === undefined ? {} : { line: props.line })}
        {...(props.action === undefined ? {} : { action: props.action })}
      />
      {props.views === undefined ? null : <ViewsSkeleton count={props.views} />}
      <TableSkeleton caption={props.caption} columns={props.columns} />
    </div>
  )
}

/** The row of saved views ("Decisions 12", "Events 30") while their counts are on their way, in `Views`' box. */
export function ViewsSkeleton(props: { readonly count: number }) {
  return (
    <div className="flex flex-wrap gap-1 px-4 pb-2 sm:px-8">
      {Array.from({ length: props.count }, (_, index) => (
        <Skeleton key={index} className="h-8 w-24" />
      ))}
    </div>
  )
}

/** Columns for a table whose page has not loaded yet: widths only, as many as such a table usually has. */
export const someColumns = (count: number): ReadonlyArray<SkeletonColumn> =>
  Array.from({ length: count }, (_, index) => ({
    label: O.none(),
    ...(index === count - 1 ? {} : { width: index === 0 ? 240 : 120 })
  }))

/**
 * The review while its code or its rows are on their way, in the review's own bands: the title row, the filter row,
 * the grid with its header and 36px rows, and the bar with the import button. On a phone, the one-decision queue.
 */
export function ReviewSkeleton(props: { readonly title?: string }) {
  const narrow = useAtomValue(isNarrow)
  const gutter = "px-4 sm:px-9"
  const title =
    props.title === undefined ? (
      <Skeleton className="h-5 w-64" />
    ) : (
      <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">{props.title}</h1>
    )
  return (
    <section aria-busy="true" aria-label="The review, loading" className="flex h-full min-h-0 flex-col">
      <div className={`flex h-12 flex-none items-center gap-3 ${gutter}`}>
        {title}
        <span className="flex-1" />
        {narrow ? null : (
          <>
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-6 w-32" />
          </>
        )}
        <Skeleton className="h-8 w-16" />
      </div>
      {narrow ? (
        <>
          <div className="flex flex-none flex-col gap-1 px-4 pb-2">
            <Skeleton className="h-11 w-full" />
            <div className="flex h-11 items-center gap-1.5">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3 border-y p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-64 w-full" />
          </div>
        </>
      ) : (
        <>
          <div className={`flex h-11 flex-none items-center gap-3 pb-1 ${gutter}`}>
            <Skeleton className="h-8 w-72" />
            <span className="flex-1" />
            <Skeleton className="h-8 w-32" />
          </div>
          <GridSkeleton caption="Rows of the file" columns={someColumns(10)} rows={20} />
        </>
      )}
      <div className={`flex h-16 flex-none items-center gap-2 ${gutter}`}>
        <Skeleton className="h-4 w-40" />
        <span className="flex-1" />
        <Skeleton className={narrow ? "h-11 w-40" : "h-9 w-48"} />
      </div>
    </section>
  )
}

/** The upload screen while its code is on its way: the same title, drop zone and sample row. */
export function UploadSkeleton() {
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col" aria-busy="true">
      <div className="px-4 pt-5 pb-3 sm:px-9">
        <h1 className="truncate text-xl font-semibold tracking-tight">Import items</h1>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">.csv or .xlsx</p>
      </div>
      <div className="flex flex-col gap-4 px-4 sm:px-9">
        <Skeleton className="min-h-40 w-full" />
        <div className="flex h-8 items-center gap-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-28" />
        </div>
      </div>
    </div>
  )
}

/** The import's step bar while the import page's code is on its way: the same band, 48px, 56 on a phone. */
export function StepsSkeleton() {
  // On a desk the steps are in the shell's top bar, so the page has no band to hold a place for.
  const narrow = useAtomValue(isNarrow)
  if (!narrow) return null
  return (
    <div className="flex h-14 flex-none items-center gap-4 border-b px-4 sm:px-9 md:h-12">
      <Skeleton className="size-7" />
      <Skeleton className="h-4 w-16" />
      <span className="flex-1" />
    </div>
  )
}
