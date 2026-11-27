// The whole usage model under Verify: the allowance's proof again, then a search of every sequence of up to three
// commands through its Apis, each event delivered twice, and 200 longer walks of commands picked at random, each run
// on the real model as a story. The allowance's rules are proved for every state and every input; the `sometimes`
// rule is only reached, which means one sequence was found; the view is only searched.
//
// Two things of the library's hold the rules (Benjamin, 2026-11-22: "Lock plus the library's proved list"). The lock
// file beside this test keeps every rule as it is written: a rule taken out or renamed fails here, and so does one
// whose text changes, except an aggregate's invariant that still says at least as much, which is locked again as
// written. In CI a rule the file does not list fails too, and nothing is written. To change a rule on purpose, run
// this once with UPDATE_VERIFY_LOCK=1 and commit the file: never to make a failing run pass. And Verify's
// `require.proved` names every rule that must stay proved, given as the lock's rules of the kinds a proof covers, so
// the two never disagree and nothing is listed twice.
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
import { AllowanceTodayAnyone } from "./session.ts"
import { UsageServerApi } from "../src/Usage.api.ts"
import { Usage } from "../src/Usage.model.ts"
import { UsageMemberApi } from "../src/UsageMember.api.ts"

/**
 * How many commands deep the search goes. Verify's own default is two; three is what the catalog's search runs, and
 * the allowance's forty-first call is out of reach of any short search: its refusal is proved, and told as a story.
 */
const DEPTH = 3

/**
 * Each sequence the search finds, run as a story. The allowance's `decide` reads `now` for its day, and the search
 * runs a short sequence at the solver's first time, the epoch: the repository's patch
 * `packages/patches/alchemy-domain/04-a-found-sequence-keeps-its-time.patch` makes the story set that clock first.
 */
const story = Story.make(Usage, { layer: AllowanceTodayAnyone })

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
  const file = yield* path.fromFileUrl(new URL("./Usage.lock.json", import.meta.url))
  const lock = yield* fs.readFileString(file).pipe(Effect.flatMap(S.decodeEffect(LockFile)))
  const rules = yield* Effect.fromOption(R.get(lock.rules, Usage.modelName))
  const proved = A.map(
    A.filter(R.toEntries(rules), ([, rule]) => A.contains(provedKinds, rule.kind)),
    ([name]) => name
  )
  // An empty list would require nothing: a lock with no rule a proof covers is a broken lock, not a pass.
  return yield* A.isReadonlyArrayNonEmpty(proved) ? Effect.succeed(proved) : Effect.die("the lock names no proved rule")
}, Effect.orDie)

layer(NodeServices.layer)("Usage", (it) => {
  it.effect(
    "every rule the lock keeps of a kind a proof covers is proved, the others hold in every sequence of up to three commands, and every command can be taken",
    Effect.fnUntraced(function* () {
      const proved = yield* lockedProved()
      // The allowance's eight rules: one invariant and seven transitions. A rule added or taken out on purpose changes
      // this number, with the lock.
      expect(proved.length).toBe(8)
      const report = yield* Verify.report(Usage, {
        apis: [UsageServerApi, UsageMemberApi],
        story,
        source: new URL("../src/Usage.model.ts", import.meta.url),
        depth: DEPTH,
        lock: "./Usage.lock.json",
        require: { proved }
      })
      const said = Verify.render(report)
      // The bound a checked rule and a reached rule stand on.
      expect(report.explored.depth, said).toBe(DEPTH)
      // Nothing is left undone: no rule broken, none the lock holds differently, none required to be proved and only
      // searched, no command never accepted, no sequence that does something else when run as a story.
      expect(report.undone, said).toEqual([])
      expect(Verify.verified(report), said).toBe(true)
      // Set only by UPDATE_VERIFY_LOCK=1: a run that relocked a rule is not a run that checked it.
      expect(report.relocked, said).toEqual([])
      // What every line above takes for granted, in Verify's own words. The fifth is why the session is tested apart
      // (`UsageApi.test.ts`): a proof holds for every actor the schema allows, and says nothing of who is let in.
      expect(report.assumptions).toEqual([
        "whole numbers are exact: a number stays within ±2^53, and a bigint has no limit",
        "a duration an input holds is a whole number of milliseconds",
        "a list, a hash set or a hash map an input holds has up to 2 items more than its schema asks for",
        "an external system answers what its schema allows, and nothing else",
        "middleware lets every caller in: who sends a command is anyone its request context allows",
        "what a projection writes, and what a stream or a query gives, is not checked: only what a projection is given"
      ])
    }),
    3_000_000
  )
})
