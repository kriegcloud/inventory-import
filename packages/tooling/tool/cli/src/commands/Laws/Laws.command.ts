/**
 * `laws`: the repository's rules over its own source.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { boundaries, boundariesSentence } from "./Boundaries.rules.ts"
import { effectImports } from "./EffectImports.rules.ts"
import { effectImportsSentence } from "./EffectImports.schema.ts"
import { exactExports, exportsSentence } from "./Exports.rules.ts"
import { keys, keysSentence } from "./Keys.rules.ts"
import { refCallbacks, refCallbacksSentence } from "./RefCallbacks.rules.ts"
import { screens, screensSentence } from "./Screens.rules.ts"
import { tags, tagsSentence } from "./Tags.rules.ts"

/** `laws exports`: the package in the current folder has exact exports, one per component and hook. */
export const exportsCommand = Command.make("exports", {}, () =>
  Effect.flatMap(exactExports(), emit(exportsSentence))
).pipe(Command.withDescription("The package in this folder has exact exports, one for every component and hook"))

/** `laws boundaries`: every workspace imports only what its row allows and what it declares. */
export const boundariesCommand = Command.make("boundaries", {}, () =>
  Effect.flatMap(boundaries(), emit(boundariesSentence))
).pipe(Command.withDescription("Every workspace imports only what it declares and what its family and layer allow"))

/** `laws screens`: every package with screens is in both lists Tailwind reads class names from. */
export const screensCommand = Command.make("screens", {}, () => Effect.flatMap(screens(), emit(screensSentence))).pipe(
  Command.withDescription("Every package with screens is in both lists the stylesheet is built from")
)

/** `laws keys`: no key-shaped string in any file git would commit. */
export const keysCommand = Command.make("keys", {}, () => Effect.flatMap(keys(), emit(keysSentence))).pipe(
  Command.withDescription("No key-shaped string is in any file git would commit")
)

/** `laws ref-callbacks`: every ref is a DOM ref or a callback that stays the same across draws. */
export const refCallbacksCommand = Command.make("ref-callbacks", {}, () =>
  Effect.flatMap(refCallbacks(), emit(refCallbacksSentence))
).pipe(Command.withDescription("Every ref is a DOM ref or a callback that stays the same across draws"))

/** `laws tags`: no `_tag` is told apart or built by hand in our own code and every test, with no file excepted. */
export const tagsCommand = Command.make("tags", {}, () => Effect.flatMap(tags(), emit(tagsSentence))).pipe(
  Command.withDescription(
    "No _tag is told apart or built by hand in our own code and every test, with no file excepted"
  )
)

const write = Flag.Boolean("write").pipe(
  Flag.withDescription("Repair the code that can be repaired mechanically, then check"),
  Flag.withDefault(false)
)
const check = Flag.Boolean("check").pipe(
  Flag.withDescription("Check only: what the command does without --write, said aloud as beep-effect's does"),
  Flag.withDefault(false)
)
const files = Argument.String("file").pipe(
  Argument.withDescription("Only these files; every file when none is named"),
  Argument.variadic()
)

/** `laws effect-imports [--write] [files]`: every Effect import from its own path under its own name. */
export const effectImportsCommand = Command.make("effect-imports", { write, check, files }, (flags) =>
  Effect.flatMap(effectImports(flags.write, flags.files), emit(effectImportsSentence))
).pipe(Command.withDescription("Every Effect import comes from its module's own path under its one name"))

/** The `laws` group. */
export const lawsCommand = Command.make("laws").pipe(
  Command.withDescription("The repository's rules over its own source"),
  Command.withSubcommands([
    boundariesCommand,
    effectImportsCommand,
    exportsCommand,
    keysCommand,
    refCallbacksCommand,
    screensCommand,
    tagsCommand
  ])
)
