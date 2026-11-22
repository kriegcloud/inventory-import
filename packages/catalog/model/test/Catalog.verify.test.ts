// The whole model under Verify: every proof again, then a search of every sequence of up to three commands through
// its Api, each event delivered twice, and 200 longer walks of commands picked at random, each run on the real model
// as a story. Three kinds of rule come back: an aggregate's, a decision's and a relation's are proved for every
// state and every input; the model's own invariants, over every instance at once, are only searched; and the rules
// that say a command can be taken are reached, which means one sequence was found.
//
// Which rules there are is held by the lock file beside this test, which keeps every rule as it is written: a rule
// taken out or renamed fails here, and so does one whose text changes, except an aggregate's invariant that still
// says at least as much, which is locked again as written. In CI a rule the file does not list fails too, and nothing
// is written. To change a rule on purpose, run this once with UPDATE_VERIFY_LOCK=1 and commit the file: never to make a
// failing run pass. How each rule stands is what the lock does not hold, so this test asserts it, by kind: a rule
// whose text is unchanged can stop being proved (a check removed from a `decide` can leave a rule only searched,
// with nothing undone), and only this assertion then fails (Benjamin, 2026-11-22: "The library's lock file").
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as R from "effect/Record"
import { Catalog, CatalogApi } from "../src/Catalog.model.ts"
import { whoMayChange } from "./proving.ts"

/**
 * How a rule of each kind must stand. A model's invariant holds over every instance at once, and an `eventually` rule
 * once every reaction has run: the search checks both and nothing proves them. A `sometimes` rule is reached by one
 * sequence. Every other rule is proved.
 */
const expectedStanding = (kind: string): string =>
  kind === "model invariant" || kind === "eventually" ? "checked" : kind === "sometimes" ? "reached" : "proved"

/** The names of the aggregates a decision reads, and records on. */
const aggregatesOf = (reads: Readonly<Record<string, { readonly aggregateName: string }>>): ReadonlyArray<string> =>
  A.map(R.values(reads), (aggregate) => aggregate.aggregateName)

/**
 * How many commands deep the search goes. Verify's own default is two, and at two a command that takes three to
 * reach (a take-back, a reopening, an undo) is "never reached" though nothing is wrong.
 */
const DEPTH = 3

layer(NodeServices.layer)("Catalog", (it) => {
  it.effect(
    "135 rules are proved, seven hold in every sequence of up to three commands, and every command can be taken",
    Effect.fnUntraced(function* () {
      const report = yield* Verify.report(Catalog, {
        apis: [CatalogApi],
        story: Story.make(Catalog),
        source: new URL("../src/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock: "./Catalog.lock.json"
      })
      const said = Verify.render(report)
      // Every rule stands as its kind says it must, and the lines that do not name the rule and how it stands.
      expect(
        A.map(
          A.filter(report.rules, (rule) => rule.standing !== expectedStanding(rule.kind)),
          (rule) => `${rule.standing}  ${rule.name}`
        ),
        said
      ).toEqual([])
      // A row and a group have no command, so who may change one is stated by every decision that records on it. The
      // lock knows a decision's rules only as written: a new decision that left one of these out would pass it.
      expect(
        A.flatMap(Catalog.decisions, (decision) =>
          A.flatMap(aggregatesOf(decision.reads), (aggregate) =>
            A.map(
              A.filter(
                whoMayChange(aggregate),
                (rule) => !A.some(report.rules, (stated) => stated.name === `${decision.decisionName}.${rule}`)
              ),
              (rule) => `${decision.decisionName} does not state ${rule}`
            )
          )
        ),
        said
      ).toEqual([])
      // The bound a checked rule and a reached rule stand on.
      expect(report.explored.depth, said).toBe(DEPTH)
      // Nothing is left undone: no rule broken, none the lock holds differently, no command never accepted.
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      // Set only by UPDATE_VERIFY_LOCK=1: a run that relocked a rule is not a run that checked it.
      expect(report.relocked, said).toEqual([])
      // What every line above takes for granted, in Verify's own words. The fourth is why the session is tested
      // apart: a proof holds for every actor the schema allows, and says nothing of who is let in.
      expect(report.assumptions).toEqual([
        "whole numbers are exact: a number stays within ±2^53, and a bigint has no limit",
        "a list an input holds has up to 2 items more than its schema asks for",
        "an external system answers what its schema allows, and nothing else",
        "middleware lets every caller in: who sends a command is anyone its request context allows",
        "what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given",
        "a decision's events commit on every instance it recorded on, or on none: how a platform commits them is not checked"
      ])
    }),
    3_000_000
  )
})
