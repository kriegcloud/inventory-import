/**
 * `quality`: the measurements a package's strictness is held to.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import { emit } from "../../Report.schema.ts"
import { ceilings } from "./Ceilings.rules.ts"

/** `quality ceilings`: the packages' recorded ceilings add up to at most the cap. */
export const ceilingsCommand = Command.make("ceilings", {}, () => Effect.flatMap(ceilings(), emit)).pipe(
  Command.withDescription("The stage C ceilings of the packages with screens add up to at most the cap")
)

/** The `quality` group. */
export const qualityCommand = Command.make("quality").pipe(
  Command.withDescription("What a package's strictness is measured against"),
  Command.withSubcommands([ceilingsCommand])
)
