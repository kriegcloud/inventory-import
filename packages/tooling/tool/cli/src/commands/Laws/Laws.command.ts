/**
 * `laws`: the repository's rules over its own source.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import { emit } from "../../Report.schema.ts"
import { exactExports } from "./Exports.rules.ts"

/** `laws exports`: the package in the current folder has exact exports, one per component and hook. */
export const exportsCommand = Command.make("exports", {}, () => Effect.flatMap(exactExports(), emit)).pipe(
  Command.withDescription("The package in this folder has exact exports, one for every component and hook")
)

/** The `laws` group. */
export const lawsCommand = Command.make("laws").pipe(
  Command.withDescription("The repository's rules over its own source"),
  Command.withSubcommands([exportsCommand])
)
