import { useAtom, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Atom from "effect/reactivity/Atom"
import { toast } from "sonner"
import { StatusPill } from "@inventory/ui/StatusPill"
import { ReviewRegion } from "@inventory/review/ReviewRegion"
import type { ReviewRow, SavedDecisions } from "@inventory/review/ReviewTypes"
import { Button } from "@inventory/ui/components/button"
import { type RecordColumn, RecordsTable } from "@inventory/ui/components/data-table/data-table-records"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@inventory/ui/components/item"
import { ToggleGroup, ToggleGroupItem } from "@inventory/ui/components/toggle-group"
import { isNarrow } from "@inventory/ui/ContentWidth"
import {
  type JobReview,
  lineColumns,
  lineKinds,
  makeJobs,
  questionRows,
  recheckLine,
  reviewJobs
} from "../../../../../../packages/review/test/fixtures/jobs.ts"

type View = "jobs" | "questions"
type JobFilter = "waiting" | "ready" | "out" | "all"

const jobs = makeJobs()
const whole = new Intl.NumberFormat("en-US")
// The page's words, once: its own tabs and pills and the region's tabs say these (`words` on the region).
const pageWords = { needs: "Waiting on you", ready: "Ready", out: "Left out", all: "All" } as const
const statusWords = { ready: pageWords.ready, waiting: pageWords.needs, out: pageWords.out } as const
const statusTone = { ready: "info", waiting: "warning", out: "neutral" } as const

/** Which view is open, which jobs it lists, the region's decisions and the jobs left out. */
const jobsView = Atom.make<View>("jobs")
const jobsFilter = Atom.make<JobFilter>("waiting")
const jobDecisions = Atom.make<SavedDecisions>({})
const jobsLeftOut = Atom.make<ReadonlyArray<string>>([])

/** Every job as it stands after the decisions and the jobs left out. */
const jobReviews = Atom.readable((get) => reviewJobs({ jobs, decisions: get(jobDecisions), leftOut: get(jobsLeftOut) }))

/** The questions on the lines of the jobs still in. */
const jobQuestionRows = Atom.map(jobsLeftOut, (leftOut) => questionRows(jobs, leftOut))

/** "Leave job … out" on every question's row: one function for the region, kept the same between draws. */
const leaveJobAction = Atom.readable((get) => (row: ReviewRow) => {
  const code = row.cells.job
  return code === undefined
    ? undefined
    : {
        label: `Leave job ${code} out`,
        onSelect: () =>
          get.registry.update(jobsLeftOut, (before) =>
            A.append(
              A.filter(before, (at) => at !== code),
              code
            )
          )
      }
})

/**
 * Records with a parent, the way `docs/review-table.md` says to build them: the page's own table of jobs (each with
 * what it becomes and why, on one line, in the app's data table) holds the counts and the import button; the
 * questions on their lines are an
 * embedded `ReviewRegion` in a second view, with picks that have no default, a labelled group, and "Leave job … out"
 * on every row. Switching views unmounts the region; its decisions and its undo come back through `savedDecisions`.
 */
export function JobsReview() {
  const narrow = useAtomValue(isNarrow)
  const [view, setView] = useAtom(jobsView)
  const [filter, setFilter] = useAtom(jobsFilter)
  const [decisions, setDecisions] = useAtom(jobDecisions)
  const [, setLeftOut] = useAtom(jobsLeftOut)
  const reviews = useAtomValue(jobReviews)
  const rows = useAtomValue(jobQuestionRows)
  const rowAction = useAtomValue(leaveJobAction)

  const tally = { ready: 0, waiting: 0, out: 0 }
  for (const review of reviews) tally[review.status] += 1
  const questions = reviews.reduce((total, review) => total + review.waiting, 0)
  const linesIn = reviews.reduce((total, review) => total + review.importing, 0)
  const linesAll = jobs.reduce((total, job) => total + job.lines.length, 0)
  const shown = filter === "all" ? reviews : reviews.filter((review) => review.status === filter)
  const filters: ReadonlyArray<{ id: JobFilter; label: string; n: number }> = [
    { id: "waiting", label: pageWords.needs, n: tally.waiting },
    { id: "ready", label: pageWords.ready, n: tally.ready },
    ...(tally.out > 0 || filter === "out" ? [{ id: "out" as const, label: pageWords.out, n: tally.out }] : []),
    { id: "all", label: pageWords.all, n: reviews.length }
  ]
  const held = tally.waiting + tally.out

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-12 flex-none items-center gap-3 px-4 sm:px-9">
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight">Review jobs.csv</h1>
      </div>
      {/* The views and the job filters share one row on a desk, so the table keeps the height; a phone stacks them. */}
      <div
        className={
          narrow
            ? "flex flex-none flex-col items-start gap-2 px-4 pb-2"
            : "flex h-11 flex-none items-center gap-3 px-4 pb-1 sm:px-9"
        }
      >
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="View"
          value={view}
          onValueChange={(next) => {
            if (next !== "") setView(next as View)
          }}
        >
          <ToggleGroupItem value="jobs">
            Jobs <span className="text-muted-foreground tabular-nums">{whole.format(reviews.length)}</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="questions">
            Questions <span className="text-muted-foreground tabular-nums">{whole.format(questions)}</span>
          </ToggleGroupItem>
        </ToggleGroup>
        {view === "jobs" ? (
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="Show jobs"
            value={filter}
            onValueChange={(next) => {
              if (next !== "") setFilter(next as JobFilter)
            }}
          >
            {filters.map((entry) => (
              <ToggleGroupItem key={entry.id} value={entry.id}>
                {entry.label} <span className="text-muted-foreground tabular-nums">{whole.format(entry.n)}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
      </div>

      {view === "jobs" && narrow ? (
        // A phone gets a list, not the table scrolled sideways: each job with its status, its reason and its answer.
        <div role="region" aria-label="Jobs in jobs.csv" className="min-h-0 flex-1 overflow-y-auto border-y">
          <ItemGroup>
            {shown.map((review) => (
              <Item key={review.job.code} size="sm" data-row-id={review.job.code}>
                <ItemContent className="min-w-0">
                  <ItemTitle>
                    <span className="font-mono">{review.job.code}</span> {review.job.making}
                  </ItemTitle>
                  <ItemDescription>{review.reason}</ItemDescription>
                </ItemContent>
                <ItemActions className="flex-col items-end">
                  <StatusPill tone={statusTone[review.status]}>{statusWords[review.status]}</StatusPill>
                  {review.status === "waiting" ? (
                    <Button variant="outline" size="touch" onClick={() => setView("questions")}>
                      Answer {review.waiting}
                      <span className="sr-only"> for {review.job.code}</span>
                    </Button>
                  ) : review.status === "out" ? (
                    <Button
                      variant="ghost"
                      size="touch"
                      onClick={() => setLeftOut((before) => before.filter((code) => code !== review.job.code))}
                    >
                      Bring back<span className="sr-only"> {review.job.code}</span>
                    </Button>
                  ) : null}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        </div>
      ) : view === "jobs" ? (
        <RecordsTable
          key={filter}
          caption={`Jobs in jobs.csv: ${filters.find((entry) => entry.id === filter)?.label ?? "All"}`}
          columns={jobColumns({
            onAnswer: () => setView("questions"),
            onLeaveOut: (code) =>
              setLeftOut((before) =>
                A.append(
                  A.filter(before, (at) => at !== code),
                  code
                )
              ),
            onBringBack: (code) => setLeftOut((before) => before.filter((at) => at !== code))
          })}
          rows={shown}
          rowKey={(review) => review.job.code}
          empty={
            <>
              No job here.{" "}
              <Button variant="link" size="sm" onClick={() => setFilter("all")}>
                Show all {reviews.length}
              </Button>
            </>
          }
        />
      ) : (
        <div className="min-h-0 flex-1">
          <ReviewRegion
            embedded
            title="Lines waiting on you"
            noun={["line", "lines"]}
            columns={lineColumns}
            rows={rows}
            problemKinds={lineKinds}
            summary={[]}
            recheck={recheckLine}
            // A line's own "ready" is an answered question: the job it belongs to is what is Ready.
            words={{ needs: pageWords.needs, ready: "Answered", out: pageWords.out }}
            savedDecisions={decisions}
            onDecisionsChange={setDecisions}
            rowAction={rowAction}
            onImport={() => undefined}
          />
        </div>
      )}

      {/* The page counts, not the region: every number here comes from the page's own review of the jobs. */}
      <div className="flex h-16 flex-none items-center gap-2 border-t px-4 sm:px-9">
        <p role="status" className="min-w-0 flex-1 truncate text-sm text-muted-foreground tabular-nums">
          {held === 0
            ? `All ${reviews.length} jobs ready · ${linesIn} of ${linesAll} lines`
            : `${tally.ready} jobs ready, ${held} won't be imported (${[
                ...(tally.waiting > 0 ? [`${tally.waiting} waiting on you`] : []),
                ...(tally.out > 0 ? [`${tally.out} left out`] : [])
              ].join(", ")}) · ${linesIn} of ${linesAll} lines`}
        </p>
        <Button
          variant={tally.waiting > 0 ? "outline" : "default"}
          className="flex-none"
          disabled={tally.ready === 0}
          onClick={() => toast(`Would import ${tally.ready} jobs and ${linesIn} lines`)}
        >
          {held === 0 ? `Import ${tally.ready} jobs` : `Import ${tally.ready}, skip ${held}`}
        </Button>
      </div>
    </div>
  )
}

/** The jobs' columns: what each becomes and why on one line, and the one answer that fits it. */
function jobColumns(actions: {
  onAnswer: () => void
  onLeaveOut: (code: string) => void
  onBringBack: (code: string) => void
}): ReadonlyArray<RecordColumn<JobReview>> {
  return [
    {
      id: "job",
      label: "Job",
      width: 120,
      cell: (review) => <span className="font-mono">{review.job.code}</span>,
      title: (review) => review.job.code,
      sort: (review) => review.job.code
    },
    {
      id: "making",
      label: "Making",
      width: 208,
      cell: (review) => review.job.making,
      sort: (review) => review.job.making
    },
    {
      id: "due",
      label: "Due",
      width: 112,
      cell: (review) => <span className="tabular-nums">{review.job.due}</span>,
      title: (review) => review.job.due,
      sort: (review) => review.job.due
    },
    {
      id: "lines",
      label: "Lines",
      width: 96,
      align: "right",
      cell: (review) => `${review.status === "out" ? 0 : review.importing} of ${review.job.lines.length}`,
      sort: (review) => review.job.lines.length
    },
    {
      id: "status",
      label: "Status",
      width: 150,
      cell: (review) => <StatusPill tone={statusTone[review.status]}>{statusWords[review.status]}</StatusPill>,
      title: (review) => statusWords[review.status],
      sort: (review) => statusWords[review.status]
    },
    // One line in a 36 px row; the whole sentence on hover.
    {
      id: "why",
      label: "Why",
      cell: (review) => <span className="text-muted-foreground">{review.reason}</span>,
      title: (review) => review.reason
    },
    {
      id: "answer",
      label: "Answer",
      width: 136,
      cell: (review) =>
        review.status === "waiting" ? (
          <Button variant="outline" size="xs" onClick={actions.onAnswer}>
            Answer {review.waiting}
            <span className="sr-only"> for {review.job.code}</span>
          </Button>
        ) : review.status === "out" ? (
          <Button variant="ghost" size="xs" onClick={() => actions.onBringBack(review.job.code)}>
            Bring back<span className="sr-only"> {review.job.code}</span>
          </Button>
        ) : (
          <Button variant="quiet" size="xs" onClick={() => actions.onLeaveOut(review.job.code)}>
            Leave out<span className="sr-only"> {review.job.code}</span>
          </Button>
        ),
      title: () => ""
    }
  ]
}
