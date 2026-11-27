// The model's rules over every import, row and group at once, searched again each night on more orderings than the
// search in `verify` takes: every sequence of up to three commands, then 5,000 walks of commands picked at random, on
// a seed taken from the day, so each night walks a different way. A rule a walk breaks fails here, with the sequence
// written as the steps of a `Story`, to paste into `Group.story.test.ts` as its regression (with each `new X(...)`
// written `X.make(...)`), and the seed, to run the same walks again: `EXPLORE_SEED=<seed> bun run --cwd
// packages/catalog/model explore`. Only the nightly runs it (`.github/workflows/proofs-nightly.yml`).
//
// What it is, and what it is not: still a search, never a proof. A walk stops after four refused tries at a command,
// so it is five commands long on average and about a dozen at most, and in 1,000 walks measured none reached an undo:
// it tries many more short orderings, not deeper ones (goals/alchemy-domain-uptake/INVENTORY.md, tests-04). The
// one thing not to break: the depth stays three, or the undos are never reached and the search is not complete.
import * as Explore from "@alchemy.run/domain/Explore"
import * as NodeServices from "@effect/platform-node/NodeServices"
import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Clock from "effect/Clock"
import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import { CatalogApi } from "../src/Catalog.api.ts"
import { Catalog } from "../src/Catalog.model.ts"

/** How many commands deep every sequence goes, as in `Catalog.verify.test.ts`: an undo takes three to reach. */
const DEPTH = 3

/** How many walks a night. */
const WALKS = 5000

/** The day since 1970, which picks the night's walks; `EXPLORE_SEED` picks a night's again. */
const seedOfTheDay = Effect.fnUntraced(function* () {
  const now = yield* Clock.currentTimeMillis
  return yield* Config.Int("EXPLORE_SEED").pipe(Config.withDefault(Math.floor(now / 86_400_000)))
}, Effect.orDie)

// The real clock, not the test clock: the day picks the walks.
layer(NodeServices.layer, { excludeTestServices: true })("Catalog, explored", (it) => {
  it.effect(
    "no walk of the night breaks a rule over every import, row and group, and every command is reached",
    Effect.fnUntraced(function* () {
      const seed = yield* seedOfTheDay()
      yield* Effect.log(`Explore seed ${seed}`)
      const report = yield* Explore.report(Catalog, {
        source: new URL("../src/Catalog.model.ts", import.meta.url),
        apis: [CatalogApi],
        depth: DEPTH,
        walks: { count: WALKS, seed }
      })
      const said = `seed ${seed}\n${Explore.render(report)}`
      // Each rule broken, as the steps of a story that breaks it.
      const broken = A.flatMap([...report.invariants, ...report.rules, ...report.eventually], (rule) =>
        A.fromOption(
          O.map(O.fromUndefinedOr(rule.broken), (story) => `${rule.name}, seed ${seed}:\n${Explore.script(story)}`)
        )
      )
      expect(broken, said).toEqual([])
      expect(report.walks.count, said).toBe(WALKS)
      // Nothing of the search left undone: every command reached, nothing unread, the solver never gave up.
      expect(Explore.undone(report, {}), said).toEqual([])
    }),
    5_400_000
  )
})
