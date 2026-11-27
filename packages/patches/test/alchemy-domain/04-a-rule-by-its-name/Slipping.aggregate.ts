// The same tally with its transition changed where it is declared, under the lock the first was kept in.
import * as Domain from "@alchemy.run/domain"
import * as S from "effect/Schema"
import * as TallyRules from "./Tally.rules.ts"
import { ACountFallsByOneAtMost as ACountNeverFalls } from "./Tally.rules.ts"

/** One more was counted. */
export class Slipped extends Domain.Event("Slipped", { count: S.Int }) {}

/** Count one more. */
export class SlipOne extends Domain.Command("SlipOne", { input: { tallyId: S.String }, events: [Slipped] }) {}

/** One tally. */
export class Slipping extends Domain.Aggregate("Slipping", {
  id: S.String,
  state: S.Struct({ count: S.Int }),
  initial: { count: 0 },
  invariants: { ACountIsNeverNegative: TallyRules.ACountIsNeverNegative },
  transitions: { ACountNeverFalls },
  commands: [SlipOne],
  keyOf: (cmd) => cmd.tallyId,
  decide: { SlipOne: (tally) => [Slipped.make({ count: tally.count + 1 })] },
  evolve: { Slipped: (_tally, event) => ({ count: event.count }) }
}) {}
