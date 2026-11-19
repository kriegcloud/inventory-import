/**
 * `laws`: the repository's rules over its own source.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Command from "effect/cli/Command"
import { emit } from "../../Report.schema.ts"
import { boundaries } from "./Boundaries.rules.ts"
import { exactExports } from "./Exports.rules.ts"
import { keys } from "./Keys.rules.ts"
import { screens } from "./Screens.rules.ts"

/** `laws exports`: the package in the current folder has exact exports, one per component and hook. */
export const exportsCommand = Command.make("exports", {}, () => Effect.flatMap(exactExports(), emit)).pipe(
  Command.withDescription("The package in this folder has exact exports, one for every component and hook")
)

/** `laws boundaries`: every workspace imports only what its row allows and what it declares. */
export const boundariesCommand = Command.make("boundaries", {}, () => Effect.flatMap(boundaries(), emit)).pipe(
  Command.withDescription("Every workspace imports only what it declares and what its family and layer allow")
)

/** `laws screens`: every package with screens is in both lists Tailwind reads class names from. */
export const screensCommand = Command.make("screens", {}, () => Effect.flatMap(screens(), emit)).pipe(
  Command.withDescription("Every package with screens is in both lists the stylesheet is built from")
)

/** `laws keys`: no key-shaped string in any file git would commit. */
export const keysCommand = Command.make("keys", {}, () => Effect.flatMap(keys(), emit)).pipe(
  Command.withDescription("No key-shaped string is in any file git would commit")
)

/** The `laws` group. */
export const lawsCommand = Command.make("laws").pipe(
  Command.withDescription("The repository's rules over its own source"),
  Command.withSubcommands([boundariesCommand, exportsCommand, keysCommand, screensCommand])
)
