/**
 * `patches`: the repository's patches to its dependencies (docs/patches.md). One file a defect, each with a header
 * and a test that fails without it.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import { emit } from "../../Report.schema.ts"
import { patchesBuild, patchesBuildSentence } from "./PatchesBuild.rules.ts"
import { patchesCarry, patchesCarrySentence } from "./PatchesCarry.rules.ts"
import { patchesCheck, patchesCheckSentence } from "./PatchesCheck.rules.ts"
import { patchesProve, patchesProveSentence } from "./PatchesProve.rules.ts"

/** `patches check`: every patch has its header and test, is for what is installed, applies, and is installed. */
export const patchesCheckCommand = Command.make("check", {}, () =>
  Effect.flatMap(patchesCheck(), emit(patchesCheckSentence))
).pipe(
  Command.withDescription(
    "Every patch has its header and its test, is for what bun.lock holds, applies, and is what is installed"
  )
)

/** `patches build`: writes the file bun reads for each package from the package's patches. */
export const patchesBuildCommand = Command.make("build", {}, () =>
  Effect.flatMap(patchesBuild(), emit(patchesBuildSentence))
).pipe(Command.withDescription("Write the file bun reads for each patched package from the package's patches"))

/** `patches prove`: each patch's test fails when it is run without the patch. */
export const patchesProveCommand = Command.make("prove", {}, () =>
  Effect.flatMap(patchesProve(), emit(patchesProveSentence))
).pipe(Command.withDescription("Each patch's test fails when it is run beside the package without its patches"))

/** `patches carry`: after a re-pin's new files, carries each kept package's patches to its new file, or stops. */
export const patchesCarryCommand = Command.make("carry", {}, () =>
  Effect.flatMap(patchesCarry(), emit(patchesCarrySentence))
).pipe(
  Command.withDescription(
    "Carry the patches of a kept package to the file it is now redirected to, or stop on one that does not apply"
  )
)

/** The `patches` group. */
export const patchesCommand = Command.make("patches").pipe(
  Command.withDescription("The repository's patches to its dependencies"),
  Command.withSubcommands([patchesBuildCommand, patchesCarryCommand, patchesCheckCommand, patchesProveCommand])
)
