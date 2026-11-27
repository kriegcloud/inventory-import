// Proves the allowance's eight rules for its one command, for every state and every input: never more than forty
// calls in a UTC day, a day's count rising by one and a new day starting at one, a day moving only forward, the
// organization kept, only its own organization and only an editor or an admin (a viewer for the assistant's call)
// taking one, and every call saying who asked and for what. It also says that some state lets the command record,
// that no event is left to anything but the command, and that the code did what the prover read. Seconds, in `prove`.
import * as Prove from "@alchemy.run/domain/Prove"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import { Allowance } from "../src/Allowance/Allowance.aggregate.ts"

/** How a rule stands after its proof, in the report's own words. Only "proved" is a proof for every state and input. */
const standingOf = (verdict: Prove.Verdict): string =>
  Match.valueTags(verdict, {
    Proved: () => "proved",
    Bounded: () => "proved for short lists only",
    Violated: () => "violated",
    Unconfirmed: () => "not proved",
    Misread: () => "read wrongly",
    NotTranslated: () => "not read",
    Unknown: () => "not decided"
  })

layer(NodeServices.layer)("Allowance", (it) => {
  it.effect(
    "its command keeps every rule, for every state and every input",
    Effect.fnUntraced(function* () {
      const report = yield* Prove.report(Allowance, {
        source: new URL("../src/Allowance/Allowance.aggregate.ts", import.meta.url)
      })
      const said = Prove.render(report)
      // Each rule, for each command, as one line: its standing and its name.
      const rules = A.flatMap([...report.invariants, ...report.transitions], (rule) =>
        A.map(rule.commands, (proof) => `${standingOf(proof.verdict)}  ${rule.name}  ${proof.command}`)
      )
      expect(rules, said).toEqual([
        "proved  NeverMoreThanFortyInADay  TakeCall",
        "proved  WithinADayTheCountRisesByOne  TakeCall",
        "proved  ANewDayStartsAtOne  TakeCall",
        "proved  ADayChangesOnlyForward  TakeCall",
        "proved  AnAllowanceNeverChangesOrganization  TakeCall",
        "proved  OnlyItsOwnOrganizationTakesACall  TakeCall",
        "proved  AViewerTakesOnlyTheAssistantsCall  TakeCall",
        "proved  EveryCallSaysWhoAndWhatFor  TakeCall"
      ])
      // The starting state is one its schema and the invariant allow.
      expect(report.initial, said).toBe(true)
      expect(
        A.every(report.invariants, (rule) => rule.initial === true),
        said
      ).toBe(true)
      // The command leaves a state its schema allows, and some state lets it record.
      expect(
        A.map(report.commands, (command) => [command.command, standingOf(command.schema), command.accepted]),
        said
      ).toEqual([["TakeCall", "proved", true]])
      // Past 4,096 paths the prover proves nothing: a rule or a check that adds paths shows here first. 35 since the
      // role is asked before the organization, as the catalog asks them (31 when the organization came first).
      expect(
        A.map(report.commands, (command) => command.paths),
        said
      ).toEqual([35])
      // `CallTaken` is recorded by `TakeCall`, so no event is left to a decision.
      expect(report.outside).toEqual([])
      // Every check of every schema is one the prover reads, and the code did what it read.
      expect(report.unread).toEqual([])
      expect(report.unkept).toEqual([])
      expect(report.agreement.differs, said).toEqual([])
    }),
    600_000
  )
})
