// What the Prove tests share: a decision's report as one line a rule, and the lines a proved decision must give. A
// test compares the two as lists, so the failure names the rule; the report itself, with the counterexample the solver
// found, is the message printed beside it.
import type * as Prove from "@alchemy.run/domain/Prove"
import * as A from "effect/Array"
import * as Match from "effect/Match"
import * as Str from "effect/String"
import { groupRules, importRules, rowRules } from "./rules.ts"

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
 * The lines of a decision that keeps every rule of the import, every rule of the row or the group it also records on,
 * and every rule of its own.
 */
export const allProved = (decision: {
  readonly recordsOn: "Row" | "Group"
  readonly own: ReadonlyArray<string>
}): ReadonlyArray<string> =>
  A.map(
    [
      ...A.map(importRules, (name) => `Import.${name}`),
      ...Match.value(decision.recordsOn).pipe(
        Match.when("Row", () => A.map(rowRules, (name) => `Row.${name}`)),
        Match.when("Group", () => A.map(groupRules, (name) => `Group.${name}`)),
        Match.exhaustive
      ),
      ...decision.own
    ],
    (name) => `proved  ${name}`
  )
