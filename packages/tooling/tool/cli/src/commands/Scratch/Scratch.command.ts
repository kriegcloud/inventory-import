/**
 * `scratch`: the scratchpad's experiments, made, listed, checked and ended.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import * as O from "effect/Option"
import { emit } from "../../Report.schema.ts"
import {
  bunInstall,
  bunTypes,
  scratchCheck,
  scratchEnd,
  scratchList,
  scratchNew,
  scratchSentence
} from "./Scratch.rules.ts"
import { Template, templates } from "./Scratch.templates.ts"

const name = Argument.String("name").pipe(
  Argument.withDescription("The experiment's name: small letters, digits and hyphens (stock-count)")
)
const template = Flag.Literals("template", templates).pipe(
  Flag.withDescription("What it starts from: a probe, a service with a test layer, a screen, or a Verify model"),
  Flag.withDefault(Template.Enum.probe)
)
const question = Flag.String("question").pipe(
  Flag.withDescription("What the experiment is trying to find out, for its NOTE.md"),
  Flag.withDefault("")
)

/** `scratch new <name> [--template probe|service|screen|verify]`: an experiment whose test already passes. */
export const scratchNewCommand = Command.make("new", { name, template, question }, (flags) =>
  Effect.flatMap(scratchNew(flags, bunInstall), emit(scratchSentence))
).pipe(Command.withDescription("Start an experiment in its own folder of the scratchpad, from a template that runs"))

/** `scratch list`: what is open, what is past a limit, and what the ended ones taught. */
export const scratchListCommand = Command.make("list", {}, () =>
  Effect.flatMap(scratchList(), emit(scratchSentence))
).pipe(Command.withDescription("The open experiments with their age and size, and the log of the ended ones"))

/** `scratch check`: the scratchpad's own rules, then the type-checker with the Effect diagnostics. */
export const scratchCheckCommand = Command.make("check", {}, () =>
  Effect.flatMap(scratchCheck(bunTypes), emit(scratchSentence))
).pipe(
  Command.withDescription(
    "No install inside an experiment, a note for each, and the type-checker with the Effect diagnostics over all of them"
  )
)

const learned = Flag.String("learned").pipe(Flag.withDescription("What was learned, in one line: all that stays"))
const to = Flag.String("to").pipe(
  Flag.withDescription("Where the experiment's code now is: a file or folder of the repository, outside the scratchpad")
)

/** `scratch graduate <name> --to <path> --learned <line>`: the code has moved into a package; the folder goes. */
export const scratchGraduateCommand = Command.make("graduate", { name, to, learned }, (flags) =>
  Effect.flatMap(
    scratchEnd({ name: flags.name, to: O.some(flags.to), learned: flags.learned }, bunInstall),
    emit(scratchSentence)
  )
).pipe(Command.withDescription("End an experiment whose code moved into a package: delete its folder and log it"))

/** `scratch drop <name> --learned <line>`: the idea is not pursued; the folder goes. */
export const scratchDropCommand = Command.make("drop", { name, learned }, (flags) =>
  Effect.flatMap(
    scratchEnd({ name: flags.name, to: O.none(), learned: flags.learned }, bunInstall),
    emit(scratchSentence)
  )
).pipe(Command.withDescription("End an experiment that is not pursued: delete its folder and log what it taught"))

/** The `scratch` group. */
export const scratchCommand = Command.make("scratch").pipe(
  Command.withDescription(
    "The scratchpad: experiments tried against the repository's packages, apart from every check"
  ),
  Command.withSubcommands([
    scratchCheckCommand,
    scratchDropCommand,
    scratchGraduateCommand,
    scratchListCommand,
    scratchNewCommand
  ])
)
