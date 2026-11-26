// What the Prove tests share: a report as one line a rule, how it stands and its name, so a failure names the rule;
// the report itself, with the counterexample the solver found, is the message printed beside it.
import type * as Prove from "@alchemy.run/domain/Prove"
import * as A from "effect/Array"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"

/**
 * The parts of a rendered report that say something is wrong: its first line, then each rule that is not proved with
 * the lines under it, which hold the state, the command and the events the solver found. A proved rule's lines are
 * left out, so a failure reads as what broke and not as ninety rules that did not.
 */
export const whatBroke = (rendered: string): string =>
  A.join(
    A.reduce(Str.split("\n")(rendered), { kept: A.empty<string>(), under: false }, (read, line, index) => {
      const under = Str.startsWith("✗")(line) || (read.under && Str.startsWith(" ")(line))
      return { kept: index === 0 || under ? A.append(read.kept, line) : read.kept, under }
    }).kept,
    "\n"
  )

/** The lines of a report that do not say "proved": empty when every rule is. */
export const notProved = (lines: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(lines, (line) => !Str.startsWith("proved  ")(line))

/** How a rule stands after its proof, in the report's own words. Only "proved" is a proof for every state and input. */
export const standingOf = (verdict: Prove.Verdict): string =>
  Match.valueTags(verdict, {
    Proved: () => "proved",
    Bounded: () => "proved for short lists only",
    Violated: () => "violated",
    Unconfirmed: () => "not proved",
    Misread: () => "read wrongly",
    NotTranslated: () => "not read",
    Unknown: () => "not decided"
  })

/** One line for each rule a decision must keep: how it stands, then its name. */
export const standings = (report: Prove.DecisionReport): ReadonlyArray<string> =>
  A.map(report.rules, (rule) => `${standingOf(rule.verdict)}  ${rule.name}`)

/**
 * The rules about who may change an instance of an aggregate with no command of its own, by the event that changes
 * it. Each decision that records one of these events states the rules under these names (`CLAUDE.md`, "The model's
 * blocks: what Verify reads"). They are asked by event and not by aggregate, so that a rule is asked only of a
 * decision in which it can fail: "nobody clears another person's decision" says nothing of a decision that records
 * `RowDecided`, which always leaves a decision there, and it is not asked of one.
 */
export const ruleOfWhoMayChange: Readonly<Record<string, ReadonlyArray<string>>> = {
  RowDecided: ["OnlyItsOwnOrganizationChangesTheRow", "AViewerChangesNoRow"],
  StepUndone: ["NobodyClearsAnotherPersonsDecision", "OnlyItsOwnOrganizationChangesTheRow", "AViewerChangesNoRow"],
  GroupDecided: ["OnlyItsOwnOrganizationChangesTheGroup", "AViewerChangesNoGroup"],
  GroupUndone: ["NobodyUndoesAnotherPersonsGroup", "OnlyItsOwnOrganizationChangesTheGroup", "AViewerChangesNoGroup"]
}

/**
 * What the check below reads of a decision: the events its command may record, and each aggregate it reads with the
 * commands and the events that aggregate has. All of it is the library's own, as the decision's class holds it.
 */
export interface RecordingDecision {
  readonly command: { readonly events: ReadonlyArray<{ readonly tag: string }> }
  readonly reads: Readonly<
    Record<
      string,
      {
        readonly definition: {
          readonly commands: ReadonlyArray<unknown>
          readonly events: ReadonlyArray<{ readonly tag: string }>
        }
      }
    >
  >
}

/**
 * The events a decision records on an aggregate that has no command of its own: taken from the decision's command and
 * from the aggregates it reads, never typed where the check is called, so a name cannot be left out or misspelt there.
 */
export const recordsWithNoCommand = (decision: RecordingDecision): ReadonlyArray<string> =>
  A.dedupe(
    A.flatMap(R.values(decision.reads), (aggregate) =>
      A.isReadonlyArrayNonEmpty(aggregate.definition.commands)
        ? []
        : A.filter(
            A.map(aggregate.definition.events, (event) => event.tag),
            (tag) => A.some(decision.command.events, (event) => event.tag === tag)
          )
    )
  )

/**
 * What a decision's report lacks: for each aggregate it reads, at least one rule of that aggregate (so an
 * aggregate whose rules the prover reads no names from shows), and, for each event it records on an aggregate with
 * no command of its own (a row, a group), the rules about who may change it that the decision must state itself. An
 * event of that kind with no entry in `ruleOfWhoMayChange` is missing too: the list cannot fall behind a new event.
 * Empty when nothing is missing.
 *
 * Ours, and no rule's standing: the lock and `require.proved` hold the rules a decision has, but only as written, and
 * nothing in the library asks whether a decision that records on a Row or a Group says whose act it records. A Row or
 * a Group has no command, so no middleware of its own: a decision added later that records on one
 * and states none of these would lock and prove, and let anyone change the row.
 */
export const missingRules = (proof: {
  readonly report: Pick<Prove.DecisionReport, "reads" | "rules">
  readonly decision: RecordingDecision
}): ReadonlyArray<string> => [
  ...A.flatMap(proof.report.reads, (read) =>
    A.some(proof.report.rules, (rule) => Str.startsWith(`${read.aggregate}.`)(rule.name))
      ? []
      : [`no rule of ${read.aggregate}`]
  ),
  ...A.flatMap(recordsWithNoCommand(proof.decision), (event) =>
    O.match(R.get(ruleOfWhoMayChange, event), {
      onNone: () => A.of(`no rule of who may change is listed for ${event}`),
      onSome: (names) =>
        A.map(
          A.filter(names, (name) => !A.some(proof.report.rules, (rule) => rule.name === name)),
          (name) => `does not state ${name}`
        )
    })
  )
]
