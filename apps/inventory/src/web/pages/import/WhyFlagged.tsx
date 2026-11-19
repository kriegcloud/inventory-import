// "Why flagged?" for the rows on screen: each row named, with every reason it has (not only the first the table
// shows), and what is proposed for it with its evidence. Answered by the same rules the review and the confirm run,
// so it works with no model, and says so. The one thing not to break: every sentence here is the domain's own
// (`Problem.message`, `Proposal.basis`); nothing is reworded or guessed.
import { Code } from "@inventory/ui/Code"
import type { ReviewRow } from "../../components/review/types.ts"
import { problemKinds, type Proposal, type Review, rowPlace } from "../../../domain/ItemImport.ts"

/** How many rows the panel lists in full; past it, it says how many more and how to narrow the view. */
const listed = 100

const kindLabel = (id: string): string => problemKinds.find((kind) => kind.id === id)?.label ?? id

const proposalWords = (proposal: Proposal): string => {
  const who = proposal.by === "model" ? "The model" : "A rule"
  const values = [proposal.to, ...proposal.alternatives].map((value, at) => proposal.labels[at] ?? value)
  return proposal.confidence === "low"
    ? `${who} asks: ${values.map((value) => (value === "" ? "empty" : value)).join(" or ")}?`
    : `${who} proposes ${values[0] === "" ? "empty" : values[0]} (${proposal.confidence} confidence).`
}

/** Every reason of each flagged row on screen, the rows named, counted by kind first. */
export function WhyFlagged(props: { rows: ReadonlyArray<ReviewRow>; current: Review }) {
  const found = props.rows.flatMap((row) => {
    const reviewed = props.current.rows.find((candidate) => candidate.id === row.id)
    if (reviewed === undefined) return []
    // A form-only fix already in force is not a reason the row waits: it is listed under the row's changes.
    const open = reviewed.problems.filter(
      (problem) =>
        problem.proposal === null ||
        !problem.proposal.lossless ||
        problem.field === null ||
        reviewed.values[problem.field] !== problem.proposal.to
    )
    return open.length === 0 ? [] : [{ ...reviewed, problems: open }]
  })
  const byKind = new Intl.NumberFormat("en-US")
  const counts = found
    .flatMap((row) => row.problems.map((problem) => problem.kind))
    .reduce<Record<string, number>>((tally, kind) => ({ ...tally, [kind]: (tally[kind] ?? 0) + 1 }), {})
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        {byKind.format(found.length)} {found.length === 1 ? "row" : "rows"}:{" "}
        {Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([kind, n]) => `${kindLabel(kind)} ${byKind.format(n)}`)
          .join(" · ")}
      </p>
      <ol className="flex flex-col gap-3">
        {found.slice(0, listed).map((row) => (
          <li key={row.id} className="flex flex-col gap-1 border-b pb-3 last:border-b-0">
            <span className="font-medium">
              Row {rowPlace({ rowNumber: row.rowNumber, label: row.partLabel ?? null })}
              {" · "}
              {row.file.name.trim() === "" ? <span className="text-muted-foreground">no name</span> : row.file.name}
              {row.file.sku.trim() === "" ? null : (
                <>
                  {" · "}
                  <Code>{row.file.sku}</Code>
                </>
              )}
            </span>
            <ul className="flex flex-col gap-1.5 pl-4">
              {row.problems.map((problem, at) => (
                <li key={`${problem.kind}:${problem.field ?? ""}:${at}`} className="list-disc">
                  <span className="text-muted-foreground">{kindLabel(problem.kind)}: </span>
                  {problem.message}
                  {problem.proposal === null ? null : (
                    <span className="block text-muted-foreground">
                      {proposalWords(problem.proposal)} {problem.proposal.basis}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {found.length <= listed ? null : (
        <p className="text-muted-foreground">
          {byKind.format(found.length - listed)} more rows are not listed here. Choose a problem kind or search to ask
          about fewer.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Answered by the rules: the same checks the review and the confirm run.
      </p>
    </div>
  )
}
