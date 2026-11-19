/**
 * `quality`: the measurements a package's strictness is held to.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { ceilings } from "./Ceilings.rules.ts"
import { strict } from "./Strict.rules.ts"

/** `quality ceilings`: the packages' recorded ceilings add up to at most the cap. */
export const ceilingsCommand = Command.make("ceilings", {}, () => Effect.flatMap(ceilings(), emit)).pipe(
  Command.withDescription("The stage C ceilings of the packages with screens add up to at most the cap")
)

const ceilingFile = Argument.String("ceiling-file").pipe(
  Argument.withDescription("The package's ceiling file, usually strict-ceiling.json"),
  Argument.optional
)
const all = Flag.Boolean("all").pipe(
  Flag.withDescription("List every finding, not the first three of each rule"),
  Flag.withDefault(false)
)

/** `quality strict <ceiling file>`: the package in the current folder still has exactly its recorded findings. */
export const strictCommand = Command.make("strict", { ceilingFile, all }, (flags) =>
  Effect.flatMap(strict(flags.ceilingFile, flags.all), emit)
).pipe(
  Command.withDescription(
    "The package in this folder has the root's plugin options, and exactly the style findings its ceiling records"
  )
)

/** The `quality` group. */
export const qualityCommand = Command.make("quality").pipe(
  Command.withDescription("What a package's strictness is measured against"),
  Command.withSubcommands([ceilingsCommand, strictCommand])
)
