/**
 * The two ways a command ends other than well: a rule found problems and said so, or the command could not do its
 * work at all.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as S from "effect/Schema"

const $I = $RepoCliId.create("Cli.errors")

/**
 * A rule found problems. Its sentences are already printed; this only makes the process exit with 1, and is never
 * reported again.
 *
 * @category errors
 */
export class CheckFailed extends S.TaggedError<CheckFailed, { readonly brand: unique symbol }>($I`CheckFailed`)(
  "CheckFailed",
  {},
  $I.annote("CheckFailed", { description: "A rule found problems and printed them: exit with 1" })
) {}

/**
 * The command could not do its work: a file it needs cannot be read or does not decode, or a tool it runs is not
 * installed. `message` is the whole sentence for the person, naming the path.
 *
 * @category errors
 */
export class RepoError extends S.TaggedError<RepoError, { readonly brand: unique symbol }>($I`RepoError`)(
  "RepoError",
  {
    path: S.String.pipe(S.annotateKey({ description: "The file, folder or tool the command could not use" })),
    message: S.String.pipe(S.annotateKey({ description: "The sentence for the person, naming the path" }))
  },
  $I.annote("RepoError", { description: "A file or tool the command needs could not be used" })
) {}
