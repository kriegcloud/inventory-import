// The whole model under Verify: every proof again, then a search of every sequence of up to three commands through
// its Api, each event delivered twice, and 200 longer walks of commands picked at random, each run on the real model
// as a story. Three kinds of rule come back, and this test says which is which by name, so nothing is read as more
// than it is: 135 are proved for every state and every input; the seven over every instance at once are only
// searched; and the eleven that say a command can be taken are reached, which means one sequence was found.
//
// The lock file beside this test keeps every rule as it is written. A rule that is taken out, or whose text changes,
// fails here; in CI a rule the file does not list fails too, and nothing is written. To change a rule on purpose, run
// this once with UPDATE_VERIFY_LOCK=1 and commit the file: never to make a failing run pass.
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { Catalog, CatalogApi } from "../src/Catalog.model.ts"
import {
  decidingGroupRules,
  decidingRules,
  groupRules,
  importRules,
  reachedRules,
  relationRules,
  rowRules,
  searchedRules,
  undoingGroupRules,
  undoingRules
} from "./rules.ts"

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
      expect(
        A.map(report.rules, (rule) => `${rule.standing}  ${rule.name}`),
        said
      ).toEqual([
        ...A.map(importRules, (name) => `proved  Import.${name}`),
        ...A.map(rowRules, (name) => `proved  Row.${name}`),
        ...A.map(groupRules, (name) => `proved  Group.${name}`),
        ...A.map(decidingRules, (name) => `proved  DecideRow.${name}`),
        ...A.map(undoingRules, (name) => `proved  UndoRowStep.${name}`),
        ...A.map(decidingGroupRules, (name) => `proved  DecideGroup.${name}`),
        ...A.map(undoingGroupRules, (name) => `proved  UndoGroup.${name}`),
        ...A.map(searchedRules, (name) => `checked  ${name}`),
        ...A.map(relationRules, (name) => `proved  ${name}`),
        ...A.map(reachedRules, (name) => `reached  ${name}`)
      ])
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
