/**
 * `deps`: the dependencies of every package, moved together.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { bun, depsSentence, depsUpdate } from "./Deps.rules.ts"

const dryRun = Flag.Boolean("dry-run").pipe(
  Flag.withDescription("Say what would move and what is held, and write nothing"),
  Flag.withDefault(false)
)

/** `deps update [--dry-run]`: moves every dependency that is not held to the registry's newest version. */
export const depsUpdateCommand = Command.make("update", { dryRun }, (flags) =>
  Effect.flatMap(depsUpdate(flags.dryRun ? "dry-run" : "write", bun), emit(depsSentence))
).pipe(
  Command.withDescription(
    "Move every dependency of every package to its newest version, except the ones .syncpackrc.json holds back"
  )
)

/** The `deps` group. */
export const depsCommand = Command.make("deps").pipe(
  Command.withDescription("The dependencies of every package"),
  Command.withSubcommands([depsUpdateCommand])
)
