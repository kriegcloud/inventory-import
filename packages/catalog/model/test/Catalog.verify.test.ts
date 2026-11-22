// The whole model under Verify: every proof again, then a search of every sequence of up to three commands through
// its Api, each event delivered twice, and 200 longer walks of commands picked at random, each run on the real model
// as a story. Three kinds of rule come back: an aggregate's, a decision's and a relation's are proved for every
// state and every input; the model's own invariants, over every instance at once, are only searched; and the rules
// that say a command can be taken are reached, which means one sequence was found.
//
// Two things of the library's hold the rules (Benjamin, 2026-11-22: "Lock plus the library's proved list"). The lock
// file beside this test keeps every rule as it is written: a rule taken out or renamed fails here, and so does one
// whose text changes, except an aggregate's invariant that still says at least as much, which is locked again as
// written. In CI a rule the file does not list fails too, and nothing is written. To change a rule on purpose, run
// this once with UPDATE_VERIFY_LOCK=1 and commit the file: never to make a failing run pass. And Verify's
// `require.proved` names every rule that must stay proved: one whose text is unchanged but which is no longer proved
// (a check removed from a `decide` can leave it only searched) fails there. The names it is given are the lock's
// rules of the kinds a proof covers, so the two never disagree and nothing is listed twice.
import { Story } from "@alchemy.run/domain/Story"
import * as Verify from "@alchemy.run/domain/Verify"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { Catalog, CatalogApi } from "../src/Catalog.model.ts"

/** The lock file as Verify writes it: each rule's kind and text, under the model's name. */
const LockFile = S.fromJsonString(
  S.Struct({
    version: S.Literal(1),
    rules: S.Record(S.String, S.Record(S.String, S.Struct({ kind: S.String, source: S.String })))
  })
).annotate({ description: "The lock file Verify keeps beside this test" })

/** The kinds of rule a proof covers: an aggregate's invariant and transition, a decision's rule, a relation. */
const provedKinds = ["invariant", "transition", "relation"]

/** The rules the lock keeps that must stay proved, by the names the report gives them. */
const lockedProved = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const file = yield* path.fromFileUrl(new URL("./Catalog.lock.json", import.meta.url))
  const lock = yield* fs.readFileString(file).pipe(Effect.flatMap(S.decodeEffect(LockFile)))
  const rules = yield* Effect.fromOption(R.get(lock.rules, Catalog.modelName))
  const proved = A.map(
    A.filter(R.toEntries(rules), ([, rule]) => A.contains(provedKinds, rule.kind)),
    ([name]) => name
  )
  // An empty list would require nothing: a lock with no rule a proof covers is a broken lock, not a pass.
  return yield* A.isReadonlyArrayNonEmpty(proved) ? Effect.succeed(proved) : Effect.die("the lock names no proved rule")
}, Effect.orDie)

/**
 * How many commands deep the search goes. Verify's own default is two, and at two a command that takes three to
 * reach (a take-back, a reopening, an undo) is "never reached" though nothing is wrong.
 */
const DEPTH = 3

layer(NodeServices.layer)("Catalog", (it) => {
  it.effect(
    "every rule the lock keeps of a kind a proof covers is proved, the others hold in every sequence of up to three commands, and every command can be taken",
    Effect.fnUntraced(function* () {
      const proved = yield* lockedProved()
      // The number docs/verify.md states for the rules that must stay proved. It is read from the lock as it stood
      // before this run: a rule added or taken out on purpose changes it here and there, with the lock.
      expect(proved.length).toBe(144)
      const report = yield* Verify.report(Catalog, {
        apis: [CatalogApi],
        story: Story.make(Catalog),
        source: new URL("../src/Catalog.model.ts", import.meta.url),
        depth: DEPTH,
        lock: "./Catalog.lock.json",
        require: { proved }
      })
      const said = Verify.render(report)
      // The bound a checked rule and a reached rule stand on.
      expect(report.explored.depth, said).toBe(DEPTH)
      // Nothing is left undone: no rule broken, none the lock holds differently, none required to be proved and only
      // searched, no command never accepted.
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
