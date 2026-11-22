/**
 * `release cut <major|minor|patch>` cuts a release and tags it, and never pushes; `release verify <tag>` is the
 * production deploy's guard (`docs/releasing.md`).
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import { emit } from "../../Report.schema.ts"
import { checkFull, release, releaseSentence, tagSentence, verifyTag } from "./Release.rules.ts"

const kind = Argument.ChoiceWithValue("kind", [
  ["major", "major"],
  ["minor", "minor"],
  ["patch", "patch"]
] as const).pipe(
  Argument.withDescription(
    "major or minor: cut release/<major>.<minor> from main; patch: tag the next patch on the release branch you are on"
  )
)

/** `release cut <kind>`, which `bun run release <kind>` runs. */
export const releaseCutCommand = Command.make("cut", { kind }, (args) =>
  Effect.flatMap(release(args.kind, checkFull), emit(releaseSentence))
).pipe(
  Command.withDescription(
    "Cut a release: bump the app's version, write the notes, run check:full, commit and tag. Nothing is pushed"
  )
)

const tag = Argument.String("tag").pipe(Argument.withDescription("The tag a production deploy was started from"))

/** `release verify <tag>`: the deploy job's guard. */
export const releaseVerifyCommand = Command.make("verify", { tag }, (args) =>
  Effect.flatMap(verifyTag(args.tag), emit(tagSentence))
).pipe(
  Command.withDescription(
    "Whether a tag may deploy production: an annotated v<major>.<minor>.<patch> on origin/release/<major>.<minor>"
  )
)

/** The `release` group. */
export const releaseCommand = Command.make("release").pipe(
  Command.withDescription("Releases: cut one, and check the tag a production deploy starts from"),
  Command.withSubcommands([releaseCutCommand, releaseVerifyCommand])
)
