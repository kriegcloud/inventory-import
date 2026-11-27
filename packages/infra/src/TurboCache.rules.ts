/**
 * The shared turbo cache, as the repository's stack writes it to GitHub (goals/ci-speed, step 9). The cache Worker is
 * beep-effect's, and this repository is its team `inventory` (decision "CI speed: the split, the seeds, the cache and
 * the run counts", 3): a pull request's run reads with one token, a push to main writes with another, and the
 * workstation writes with its own (decision "who writes to the cache", 1).
 *
 * Must not break: the write token is only ever an environment's secret, in an environment only main may use, so no
 * pull request's run holds it; and settings given in part stop the stack, rather than leave CI with a cache that
 * answers every request with a refusal.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import { $InfraId } from "./internal/identity.ts"

const $I = $InfraId.create("TurboCache")

/**
 * This repository's team on the cache Worker: beep-effect's `cachePolicy` names it, and a token of it is refused for
 * any other team.
 *
 * @category constants
 */
export const cacheTeam = "inventory"

/**
 * The variable of the cache Worker's address: a GitHub variable the workflow reads, and what the stack reads it from.
 *
 * @category constants
 */
export const cacheApiVariable = "TURBO_CACHE_API"

/**
 * The GitHub variable that names the team, written from {@link cacheTeam}.
 *
 * @category constants
 */
export const cacheTeamVariable = "TURBO_CACHE_TEAM"

/**
 * The variable of the read token (principal `ci-pr`): a repository secret, which GitHub never hands a fork's run.
 *
 * @category constants
 */
export const cacheReadTokenVariable = "TURBO_CACHE_READ_TOKEN"

/**
 * The variable of the write token (principal `ci-main`): a secret of {@link cacheWriteEnvironment} alone.
 *
 * @category constants
 */
export const cacheWriteTokenVariable = "TURBO_CACHE_WRITE_TOKEN"

/**
 * The environment that holds the write token, which only a run for main may use: a push to main writes its results
 * there, and nothing else does.
 *
 * @category constants
 */
export const cacheWriteEnvironment = "turbo-cache-write"

/**
 * The repository's stack was given some of the cache's settings and not all of them.
 *
 * @category errors
 */
export class IncompleteCacheSettings extends S.TaggedError<IncompleteCacheSettings, { readonly brand: unique symbol }>(
  $I`IncompleteCacheSettings`
)(
  "IncompleteCacheSettings",
  {
    missing: S.Array(S.String).pipe(S.annotateKey({ description: "The variables that were not given" }))
  },
  $I.annoteError<IncompleteCacheSettings>("IncompleteCacheSettings", {
    description: "The repository's stack was given the shared cache's settings in part"
  })
) {
  /** What is missing, and where each is written. */
  override get message(): string {
    return (
      `The repository's stack was given part of the shared turbo cache's settings: ${A.join(this.missing, ", ")} ` +
      `${this.missing.length === 1 ? "is" : "are"} not set, and CI would hold a cache it cannot use. Write the two ` +
      `tokens as references in packages/infra/env/op.env.local (${cacheReadTokenVariable} and ` +
      `${cacheWriteTokenVariable}="op://<vault>/<item>/<field>", the inventory team's ci-pr and ci-main tokens) and ` +
      `the Worker's address as ${cacheApiVariable} in the root's .env, then deploy the stack again. To deploy without ` +
      `the cache, set none of the three.`
    )
  }
}

/**
 * The cache's settings from what the owner gave: all three, none (the stack then writes no cache setting, and CI
 * runs with turbo's local cache only), or a refusal naming what is missing.
 *
 * @example
 * cacheSettingsOf({ api: O.some("https://cache.example"), read: O.some(r), write: O.some(w) }) // Result.succeed(O.some(...))
 * @example
 * cacheSettingsOf({ api: O.none(), read: O.none(), write: O.none() }) // Result.succeed(O.none())
 * @example
 * cacheSettingsOf({ api: O.some("https://cache.example"), read: O.none(), write: O.none() })
 * // Result.fail(IncompleteCacheSettings { missing: ["TURBO_CACHE_READ_TOKEN", "TURBO_CACHE_WRITE_TOKEN"] })
 */
export const cacheSettingsOf = <Token>(given: {
  readonly api: O.Option<string>
  readonly read: O.Option<Token>
  readonly write: O.Option<Token>
}): Result.Result<
  O.Option<{ readonly api: string; readonly read: Token; readonly write: Token }>,
  IncompleteCacheSettings
> => {
  const absent: ReadonlyArray<readonly [string, boolean]> = [
    [cacheApiVariable, O.isNone(given.api)],
    [cacheReadTokenVariable, O.isNone(given.read)],
    [cacheWriteTokenVariable, O.isNone(given.write)]
  ]
  const missing = A.filterMap(absent, ([variable, isAbsent]) => (isAbsent ? Result.succeed(variable) : Result.failVoid))
  if (missing.length === 3) return Result.succeed(O.none())
  return missing.length === 0
    ? Result.succeed(O.all({ api: given.api, read: given.read, write: given.write }))
    : Result.fail(IncompleteCacheSettings.make({ missing }))
}
