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
import { assertions, assertionsLedger, assertionsSentence } from "./Assertions.rules.ts"
import { boundaries, boundariesSentence } from "./Boundaries.rules.ts"
import { deprecatedApis, deprecatedApisSentence } from "./DeprecatedApis.rules.ts"
import { diagnostics, diagnosticsSentence } from "./Diagnostics.rules.ts"
import { effectImports } from "./EffectImports.rules.ts"
import { effectImportsSentence } from "./EffectImports.schema.ts"
import { exactExports, exportsSentence } from "./Exports.rules.ts"
import { fastRefresh, fastRefreshSentence } from "./FastRefresh.rules.ts"
import { keys, keysSentence } from "./Keys.rules.ts"
import { privatePaths, privatePathsSentence } from "./PrivatePaths.rules.ts"
import { promises, promiseSentence } from "./Promises.rules.ts"
import { refCallbacks, refCallbacksSentence } from "./RefCallbacks.rules.ts"
import { screens, screensSentence } from "./Screens.rules.ts"
import { dualHelpers, dualSentence, readonlyProperties, readonlySentence } from "./Shapes.rules.ts"
import { tags, tagsSentence } from "./Tags.rules.ts"
import { tryStatements, trySentence } from "./Try.rules.ts"

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

/** `laws deprecated-apis`: no deprecated API is used, in any code file git would commit outside `.agents`. */
export const deprecatedApisCommand = Command.make("deprecated-apis", {}, () =>
  Effect.flatMap(deprecatedApis(), emit(deprecatedApisSentence))
).pipe(Command.withDescription("No deprecated API is used, in any code file git would commit outside .agents"))

/** `laws keys`: no key-shaped string in any file git would commit. */
export const keysCommand = Command.make("keys", {}, () => Effect.flatMap(keys(), emit(keysSentence))).pipe(
  Command.withDescription("No key-shaped string is in any file git would commit")
)

/** `laws private-paths`: no home path or private folder named in the scratchpad. */
export const privatePathsCommand = Command.make("private-paths", {}, () =>
  Effect.flatMap(privatePaths(), emit(privatePathsSentence))
).pipe(Command.withDescription("No home path or private folder is named in any file of the scratchpad"))

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

/** `laws try`: no `try` statement in any code file git would commit, its doc comments' examples included. */
export const tryCommand = Command.make("try", {}, () => Effect.flatMap(tryStatements(), emit(trySentence))).pipe(
  Command.withDescription(
    "No try statement is written, in any code file git would commit or its doc comments' examples"
  )
)

/** `laws assertions`: the type-assertion ban's lists only shrink, and no comment turns its rule off. */
export const assertionsCommand = Command.make("assertions", {}, () =>
  Effect.flatMap(assertions(assertionsLedger), emit(assertionsSentence))
).pipe(Command.withDescription("The type-assertion ban's lists only shrink, and no comment turns its rule off"))

/** `laws promises`: no Promise is written, but in what its three lists name. */
export const promisesCommand = Command.make("promises", {}, () =>
  Effect.flatMap(promises(), emit(promiseSentence))
).pipe(
  Command.withDescription("No Promise is written: no async, await, new Promise, Promise.*, Promise type or .then chain")
)

/** `laws diagnostics`: no `@effect-diagnostics` directive turns a rule off, but in the files listed. */
export const diagnosticsCommand = Command.make("diagnostics", {}, () =>
  Effect.flatMap(diagnostics(), emit(diagnosticsSentence))
).pipe(Command.withDescription("No @effect-diagnostics directive turns a rule off, in any code file git would commit"))

/** `laws dual`: every helper declared with two values or more takes the one it acts on first and is dual. */
export const dualCommand = Command.make("dual", {}, () => Effect.flatMap(dualHelpers, emit(dualSentence))).pipe(
  Command.withDescription("Every helper takes the value it acts on first and is dual, but in the files listed")
)

/** `laws readonly`: every property of an object type or an interface is readonly. */
export const readonlyCommand = Command.make("readonly", {}, () =>
  Effect.flatMap(readonlyProperties, emit(readonlySentence))
).pipe(Command.withDescription("Every property of an object type or an interface is readonly, but in the files listed"))

/** `laws fast-refresh`: every file of screens exports components only, but in the files its ledger names. */
export const fastRefreshCommand = Command.make("fast-refresh", {}, () =>
  Effect.flatMap(fastRefresh(), emit(fastRefreshSentence))
).pipe(Command.withDescription("Every file of screens exports components only, so fast refresh keeps its state"))

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
    assertionsCommand,
    boundariesCommand,
    deprecatedApisCommand,
    diagnosticsCommand,
    dualCommand,
    effectImportsCommand,
    exportsCommand,
    fastRefreshCommand,
    keysCommand,
    privatePathsCommand,
    promisesCommand,
    readonlyCommand,
    refCallbacksCommand,
    screensCommand,
    tagsCommand,
    tryCommand
  ])
)
