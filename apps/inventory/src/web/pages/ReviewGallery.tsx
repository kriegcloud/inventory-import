import { LayoutGridIcon } from "lucide-react"
import { useAtom, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { toast } from "sonner"
import { AppShell } from "@/components/app/AppShell"
import { ReviewRegion } from "@inventory/review/ReviewRegion"
import { proposing } from "@inventory/review/ReviewDraft"
import { Problem, ProblemKind, ReviewColumn, ReviewRow } from "@inventory/review/ReviewTypes"
import type { ReviewState } from "@inventory/review/ReviewTypes"
import { Button } from "@inventory/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from "@inventory/ui/components/dropdown-menu"
import {
  activity,
  columns,
  columnsUnmatched,
  makeRows,
  problemKinds,
  recheck
} from "../../../../../packages/review/test/fixtures/fabrication.ts"
import { JobsReview } from "./gallery/JobsReview.tsx"

const states = [
  ["default", "Default: 178 rows"],
  ["stored", "Some already there"],
  ["elsewhere", "Some can't be fixed here"],
  ["settled", "Every row already there"],
  ["unmatched", "A column to match"],
  ["readonly", "Read only"],
  ["loading", "Loading"],
  ["empty", "Empty file"],
  ["clear", "All clear"],
  ["error", "Error"],
  ["big", "5,000 rows"],
  ["parent", "Records with a parent"],
  ["months", "One line, several records"]
] as const

type GalleryState = (typeof states)[number][0]

const readState = (): GalleryState => {
  const wanted = new URLSearchParams(window.location.search).get("state")
  return states.find(([id]) => id === wanted)?.[0] ?? "default"
}

/** Rows whose items are in stock already: nothing is written for them and nothing is asked. */
const storedRows: ReadonlyArray<ReviewRow> = [
  ReviewRow.make({
    id: "stored-1",
    line: 180,
    cells: { name: "Hex bolt M8 × 30", sku: "HB-M8-30", unit: "pcs", onHand: "400" },
    stored: true
  }),
  ReviewRow.make({
    id: "stored-2",
    line: 181,
    cells: { name: "Flat bar 40 × 5", sku: "FB-40-5", unit: "m", onHand: "60" },
    stored: true
  }),
  ReviewRow.make({
    id: "stored-3",
    line: 182,
    cells: { name: "Weld wire 0.9 mm", sku: "WW-09", unit: "kg", onHand: "15" },
    stored: true
  })
]

/**
 * A kind of problem nothing on the review can settle: the supplier is not in the shop's supplier list yet, and only
 * that list can add one. Its rows are counted apart, say why, and hold nothing back.
 */
const newSupplier: ProblemKind = ProblemKind.make({
  id: "supplier",
  label: "New supplier",
  tone: "blocker",
  help: "Add the supplier to your supplier list, then load the file again.",
  fixable: false
})
const elsewhereKinds: ReadonlyArray<ProblemKind> = [...problemKinds, newSupplier]

/** Rows whose supplier is not in the list yet, each with its own reason. */
const elsewhereRows: ReadonlyArray<ReviewRow> = [
  ["Square tube 40 × 40", "ST-40-2", "Ridgeline Metals"],
  ["Angle iron 30 × 3", "AI-30-3", "Ridgeline Metals"],
  ["Cutting disc 125 mm", "CD-125", "Sample Abrasives"]
].map(([name = "", sku = "", supplier = ""], index) =>
  ReviewRow.make({
    id: `elsewhere-${index + 1}`,
    line: 183 + index,
    cells: { name, sku, unit: "pcs", onHand: "10", supplier },
    problem: {
      kind: newSupplier.id,
      column: "supplier",
      reason: `Supplier ${supplier} is not in your supplier list yet.`
    }
  })
)

/**
 * A file with a line per item and a count per month: each month is its own record, so two rows share a line. The
 * Month column tells them apart on every row, and each row's label names it in the region's sentences ("Leave row
 * 3 · Feb out").
 */
const monthColumns: ReadonlyArray<ReviewColumn> = [
  ReviewColumn.make({ id: "name", label: "Item", size: "fill", width: 200, core: true }),
  ReviewColumn.make({ id: "sku", label: "SKU", code: true, search: true, core: true, under: true }),
  ReviewColumn.make({ id: "month", label: "Month", core: true, context: true, facet: true }),
  ReviewColumn.make({ id: "unit", label: "Unit", core: true }),
  ReviewColumn.make({ id: "onHand", label: "On hand", align: "right", core: true, context: true })
]

const monthItems = [
  { name: "Flat bar 40 × 5", sku: "FB-40-5", unit: "m", counts: ["120", "96"] },
  { name: "Hex bolt M8 × 30", sku: "HB-M8-30", unit: "pcs", counts: ["400", "-20"] },
  { name: "Weld wire 0.9 mm", sku: "WW-09", unit: "kg", counts: ["15", "12"] }
]

const belowZero = (month: string, onHand: string) =>
  onHand.trim().startsWith("-")
    ? Problem.make({ kind: "below", column: "onHand", reason: `On hand "${onHand}" for ${month} is below zero.` })
    : undefined

const monthRows: ReadonlyArray<ReviewRow> = monthItems.flatMap((item, index) =>
  item.counts.map((onHand, part) => {
    const line = index + 2
    const month = part === 0 ? "Jan" : "Feb"
    const problem = belowZero(month, onHand)
    return ReviewRow.make({
      id: `line-${line}.${part + 1}`,
      line,
      label: `${line} · ${month}`,
      cells: { name: item.name, sku: item.sku, month, unit: item.unit, onHand },
      ...(problem === undefined ? {} : { problem })
    })
  })
)

/** The item's own answer on each of its months: every record of its line goes. An atom, as the region takes it. */
const leaveItemOut = Atom.make(
  O.some((row: ReviewRow) => ({
    label: `Leave ${row.cells.name ?? "the item"} out, every month`,
    onSelect: () => toast(`Would leave every month of line ${row.line} out`)
  }))
)

/** Which state the gallery shows, first from the address (`?state=`). */
const galleryState = Atom.make<GalleryState>(readState())

/** The made-up rows of the state shown, made once per state. */
const galleryRows = Atom.map(galleryState, (state): ReadonlyArray<ReviewRow> =>
  state === "empty" || state === "loading" || state === "error" || state === "parent" || state === "months"
    ? []
    : state === "settled"
      ? storedRows
      : [
          ...makeRows({
            size: state === "big" ? 5000 : 178,
            clean: state === "clear",
            withoutUnit: state === "unmatched"
          }),
          ...(state === "stored" ? storedRows : []),
          ...(state === "elsewhere" ? elsewhereRows : [])
        ]
)

// What the regions are given, as the atoms they follow.
const galleryColumns = Atom.map(galleryState, (state) => (state === "unmatched" ? columnsUnmatched : columns))
const galleryRecheck = Atom.make(O.some(recheck))
const galleryKinds = Atom.map(galleryState, (state): ReadonlyArray<ProblemKind> =>
  state === "elsewhere" ? elsewhereKinds : problemKinds
)
const monthKinds = Atom.make<ReadonlyArray<ProblemKind>>(problemKinds)
const galleryLooking = Atom.map(galleryState, (state) => state === "readonly")
const monthColumnsAtom = Atom.make(monthColumns)
const monthRowsAtom = Atom.make(monthRows)
const monthRecheck = Atom.make(
  O.some((asked: { row: ReviewRow; cells: Readonly<Record<string, string>> }) =>
    belowZero(asked.cells.month ?? "", asked.cells.onHand ?? asked.row.cells.onHand ?? "")
  )
)
const monthDecisions = Atom.make(proposing(monthRows))

/** The decisions of the state shown: each state starts from its own rows' proposals, and keeps what was decided. */
const galleryHeld = Atom.make<O.Option<{ readonly of: GalleryState; readonly state: ReviewState }>>(O.none())
const galleryStart = Atom.map(galleryRows, proposing)
const galleryDecisions = Atom.writable(
  (get): ReviewState => {
    const of = get(galleryState)
    const held = get(galleryHeld)
    return O.isSome(held) && held.value.of === of ? held.value.state : get(galleryStart)
  },
  (ctx, next: ReviewState) => ctx.set(galleryHeld, O.some({ of: ctx.get(galleryState), state: next }))
)

/**
 * Development only. The review region driven by made-up fabrication-shop stock, one state at a time
 * (`/gallery/review?state=unmatched`), and the shop's jobs with their lines as records with a parent
 * (`?state=parent`). `App.tsx` loads this page only when `import.meta.env.DEV`.
 */
export default function ReviewGallery() {
  const [state, setState] = useAtom(galleryState)
  const rows = useAtomValue(galleryRows)
  const choose = (next: GalleryState) => {
    window.history.replaceState(null, "", `?state=${next}`)
    setState(next)
  }
  return (
    <AppShell
      fill
      title="Review gallery"
      actions={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Gallery state">
              <LayoutGridIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={state}
              onValueChange={(next) =>
                O.map(
                  A.findFirst(states, ([id]) => id === next),
                  ([id]) => choose(id)
                )
              }
            >
              {states.map(([id, label]) => (
                <DropdownMenuRadioItem key={id} value={id}>
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    >
      {state === "parent" ? (
        <JobsReview />
      ) : state === "months" ? (
        <ReviewRegion
          title="Review stock by month.csv"
          noun={["record", "records"]}
          columns={monthColumnsAtom}
          rows={monthRowsAtom}
          decisions={monthDecisions}
          problemKinds={monthKinds}
          summary={[`${monthItems.length} rows in the file, ${monthRows.length} records`]}
          recheck={monthRecheck}
          rowAction={leaveItemOut}
          onImport={(result) => toast(`Would import ${result.ready.length} records and hold ${result.held.length}`)}
        />
      ) : (
        <ReviewRegion
          key={state}
          title="Review items.csv"
          noun={["item", "items"]}
          columns={galleryColumns}
          rows={galleryRows}
          decisions={galleryDecisions}
          problemKinds={galleryKinds}
          summary={[]}
          activity={activity(rows.length)}
          recheck={galleryRecheck}
          state={state === "loading" ? "loading" : state === "error" ? "error" : "ready"}
          error="The file could not be read: the first sheet has no header row. Check the file and upload it again."
          onRetry={() => choose("default")}
          readOnly={galleryLooking}
          importNote="Each row becomes a new item; nothing already in stock is updated."
          readOnlyNote="View only. An editor can import."
          emptyAction={
            <Button variant="outline" size="sm" onClick={() => choose("default")}>
              Choose another file
            </Button>
          }
          onMatchColumn={(columnId, source) => {
            toast(`${source} matched to ${columnId}`)
            choose("default")
          }}
          onImport={(result) => toast(`Would import ${result.ready.length} items and hold ${result.held.length}`)}
        />
      )}
    </AppShell>
  )
}
