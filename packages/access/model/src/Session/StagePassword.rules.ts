/**
 * The password the test accounts take on a deployed stage. Benjamin's decision "infra, the test accounts' password":
 * the password written in the repository opens the test accounts only on a developer's own machine. A deployed test
 * or preview stage is given one of its own (the `TEST_ACCOUNT_PASSWORD` setting, minted by its stack), and there the
 * repository's password is refused for every account.
 *
 * The seeded rows hold the hash of the repository's password, so the rule answers with what to hold against the
 * stored hash: the stage's password stands in for the repository's, and the repository's own stands for nothing.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as Str from "effect/String"

/** Whether two texts are the same, taking the same steps wherever they first differ. */
const codes = (text: string): ReadonlyArray<number> =>
  A.map(Str.split("")(text), (char) => O.getOrElse(Str.codePointAt(0)(char), () => 0))

const sameText = (a: string, b: string): boolean => {
  const right = codes(b)
  const differences = A.reduce(
    codes(a),
    a.length ^ b.length,
    (sum, code, index) => sum | (code ^ O.getOrElse(A.get(right, index), () => 0))
  )
  return differences === 0
}

/**
 * What to hold against an account's stored hash for the password a person typed, or none when it is refused
 * without looking.
 *
 * @example passwordToVerify({ stage: O.none(), repository: "local-test-password", typed: "local-test-password" }) // O.some("local-test-password"): a developer's machine
 * @example passwordToVerify({ stage: O.some("4f1c"), repository: "local-test-password", typed: "4f1c" }) // O.some("local-test-password"): the stage's password opens a test account
 * @example passwordToVerify({ stage: O.some("4f1c"), repository: "local-test-password", typed: "local-test-password" }) // O.none(): refused on a deployed stage
 */
export const passwordToVerify = (input: {
  /** The stage's own password for its test accounts; none on a developer's machine and in production. */
  readonly stage: O.Option<string>
  /** The password written in the repository, whose hash the seeded test accounts hold. */
  readonly repository: string
  readonly typed: string
}): O.Option<string> =>
  O.match(input.stage, {
    onNone: () => O.some(input.typed),
    onSome: (stage) => {
      // Both are always compared, so the answer takes as long whichever one was typed.
      const isStage = sameText(input.typed, stage)
      const isRepository = sameText(input.typed, input.repository)
      if (isStage) return O.some(input.repository)
      return isRepository ? O.none() : O.some(input.typed)
    }
  })
