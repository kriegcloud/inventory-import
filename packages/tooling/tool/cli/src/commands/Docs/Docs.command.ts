/**
 * `docs`: the repository's documents as Open Knowledge Format bundles.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { okf } from "./Okf.rules.ts"

const verbose = Flag.Boolean("verbose").pipe(
  Flag.withDescription("Print the validator's full report for every bundle"),
  Flag.withDefault(false)
)

/** `docs check`: `docs/`, `explorations/` and `goals/` are each a conformant OKF bundle. */
export const docsCheckCommand = Command.make("check", { verbose }, (flags) =>
  Effect.flatMap(okf(flags.verbose), emit)
).pipe(Command.withDescription("docs/, explorations/ and goals/ are each a conformant OKF v0.2 bundle"))

/** The `docs` group. */
export const docsCommand = Command.make("docs").pipe(
  Command.withDescription("The repository's documents"),
  Command.withSubcommands([docsCheckCommand])
)
