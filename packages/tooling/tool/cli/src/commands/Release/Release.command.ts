/**
 * `release cut <major|minor|patch>` cuts a release and tags it, and never pushes; `release verify-head <branch>
 * <commit>` is the production deploy's guard, and `release verify <tag>` asks the same of one tag by hand
 * (`docs/releasing.md`).
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Argument from "effect/cli/Argument"
import * as Command from "effect/cli/Command"
import * as Flag from "effect/cli/Flag"
import { emit } from "../../Report.schema.ts"
import { Repo } from "../../Repo.service.ts"
import { checkFull, deployable, release, releaseSentence, tagSentence, verifyHead, verifyTag } from "./Release.rules.ts"

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

const tag = Argument.String("tag").pipe(Argument.withDescription("A release tag, v<major>.<minor>.<patch>"))

/** `release verify <tag>`: whether one tag may deploy, asked by hand. */
export const releaseVerifyCommand = Command.make("verify", { tag }, (args) =>
  Effect.flatMap(verifyTag(args.tag), emit(tagSentence))
).pipe(
  Command.withDescription(
    "Whether a tag may deploy production: an annotated v<major>.<minor>.<patch> on origin/release/<major>.<minor>"
  )
)

const branch = Argument.String("branch").pipe(Argument.withDescription("The release branch CI passed on"))
const commit = Argument.String("commit").pipe(Argument.withDescription("The commit CI checked, its full hash"))
const output = Flag.String("output").pipe(
  Flag.withDescription("A file to add `tag=<tag>` to when the commit may deploy: a workflow step's $GITHUB_OUTPUT"),
  Flag.optional
)

/**
 * `release verify-head <branch> <commit>`: the deploy workflow's guard, run from main's copy of the code after CI
 * passed on a release branch. It says whether that commit carries a release tag that may deploy, and tells the
 * workflow which.
 */
export const releaseVerifyHeadCommand = Command.make("verify-head", { branch, commit, output }, (args) =>
  Effect.gen(function* () {
    const repo = yield* Repo
    const findings = yield* verifyHead({ branch: args.branch, commit: args.commit })
    const tag = deployable(findings)
    if (O.isSome(args.output) && O.isSome(tag)) {
      const file = repo.resolve(args.output.value)
      const before = (yield* repo.exists(file)) ? yield* repo.text(file) : ""
      yield* repo.write(file, `${before}tag=${tag.value}\n`)
    }
    return yield* emit(tagSentence)(findings)
  })
).pipe(
  Command.withDescription(
    "Whether the head of a release branch carries a release tag that may deploy production; none is not an error"
  )
)

/** The `release` group. */
export const releaseCommand = Command.make("release").pipe(
  Command.withDescription("Releases: cut one, and check the tag a production deploy starts from"),
  Command.withSubcommands([releaseCutCommand, releaseVerifyCommand, releaseVerifyHeadCommand])
)
