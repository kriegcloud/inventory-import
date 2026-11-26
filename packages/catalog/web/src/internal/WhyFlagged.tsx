// "Why flagged?" for the rows on screen: each row named, with every reason it has (not only the first the table
// shows), and what is proposed for it with its evidence. Answered by the same rules the review and the confirm run,
// so it works with no model, and says so. The one thing not to break: every sentence here is the domain's own
// (`Problem.message`, `Proposal.basis`); nothing is reworded or guessed.
import { Code } from "@inventory/ui/Code"
import type { ReviewRow } from "@inventory/review/ReviewTypes"
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as O from "effect/Option"
import { problemKinds, type Proposal, type Review, rowPlace } from "@inventory/catalog-model/Review"

/** How many rows the panel lists in full; past it, it says how many more and how to narrow the view. */
const listed = 100

const kindLabel = (id: string): string =>
  O.match(
    A.findFirst(problemKinds, (kind) => kind.id === id),
    { onNone: () => id, onSome: (kind) => kind.label }
  )

const proposalWords = (proposal: Proposal): string => {
  const who = proposal.by === "model" ? "The model" : "A rule"
  const values = A.map(A.prepend(proposal.alternatives, proposal.to), (value, at) =>
    O.match(A.get(proposal.labels, at), { onNone: () => value, onSome: (label) => label })
  )
  return proposal.confidence === "low"
    ? `${who} asks: ${values.map((value) => (value === "" ? "empty" : value)).join(" or ")}?`
    : `${who} proposes ${values[0] === "" ? "empty" : values[0]} (${proposal.confidence} confidence).`
}

/** Every reason of each flagged row on screen, the rows named, counted by kind first. */
export function WhyFlagged(props: { rows: ReadonlyArray<ReviewRow>; current: Review }) {
  const found = A.getSomes(
    A.map(props.rows, (row) =>
      O.flatMap(
        A.findFirst(props.current.rows, (candidate) => candidate.id === row.id),
        (reviewed) => {
          // A form-only fix already in force is not a reason the row waits: it is listed under the row's changes.
          const open = reviewed.problems.filter(
            (problem) =>
              !O.exists(
                problem.proposal,
                (proposal) =>
                  proposal.lossless &&
                  O.exists(O.fromNullOr(problem.field), (field) => reviewed.values[field] === proposal.to)
              )
          )
          return open.length === 0 ? O.none() : O.some({ ...reviewed, problems: open })
        }
      )
    )
  )
  const byKind = new Intl.NumberFormat("en-US")
  const counts = R.map(
    A.groupBy(
      A.flatMap(found, (row) => A.map(row.problems, (problem) => problem.kind)),
      (kind): string => kind
    ),
    (problems) => problems.length
  )
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
              Row {rowPlace({ rowNumber: row.rowNumber, label: O.map(row.part, (part) => part.label) })}
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
                <li
                  key={O.match(O.fromNullOr(problem.field), {
                    onNone: () => `${problem.kind}::${at}`,
                    onSome: (field) => `${problem.kind}:${field}:${at}`
                  })}
                  className="list-disc"
                >
                  <span className="text-muted-foreground">{kindLabel(problem.kind)}: </span>
                  {problem.message}
                  {O.match(problem.proposal, {
                    onNone: () => null,
                    onSome: (proposal) => (
                      <span className="block text-muted-foreground">
                        {proposalWords(proposal)} {proposal.basis}
                      </span>
                    )
                  })}
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
