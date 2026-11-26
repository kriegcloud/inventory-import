/**
 * Which secrets a stage takes from 1Password, and where their references are written.
 *
 * The references live in one file, `env/op.env`: lines `NAME=op://vault/item/field`, references only. A stack reads
 * that file and asks 1Password for the ones its stage needs, through Alchemy's provider; no code holds a reference
 * and no process but that one is ever given a value.
 *
 * Must not break: a line that is not a reference is never handed on, so a value typed into that file by mistake
 * reaches nothing; and a stage is asked only for what its plan names, so a test stage asks 1Password for nothing.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import * as S from "effect/Schema"
import { $InfraId } from "./internal/identity.ts"
import type { StagePlan } from "./Stage.schema.ts"
import { previewPasswordVariable, testPasswordOf } from "./StagePlan.rules.ts"

const $I = $InfraId.create("OpReferences")

/** An env-file line, with only its surrounding whitespace removed. */
const ReferenceLine = S.Trim.pipe(
  $I.annoteSchema("ReferenceLine", { description: "An env-file line without surrounding whitespace" })
)

/** The file of references, from this package's folder. */
export const opEnvFile = "env/op.env"

/**
 * The owner's own references, from this package's folder: a file git ignores, so the names of his vault and items
 * stay out of the repository. Its lines are read after `op.env`'s, so a name in both takes this file's.
 */
export const ownEnvFile = "env/op.env.local"

/**
 * The reference a line's value is, without its quotes; none when it is anything else. A name with a space is
 * allowed only in quotes, and the template's `<vault>` is not a reference.
 */
const referenceOf = (value: string): O.Option<string> => {
  const bare = /^op:\/\/[^\s<>"/]+\/[^\s<>"/]+\/[^\s<>"]+$/.test(value)
  const quoted = /^"op:\/\/[^<>"/]+\/[^<>"/]+\/[^<>"]+"$/.test(value)
  if (bare) return O.some(value)
  return quoted ? O.some(Str.slice(1, -1)(value)) : O.none()
}

/**
 * The references `op.env` gives for the names asked for. A name with no line, a commented line, or a line that is
 * not a reference is left out; the last line of a name wins, as in any env file.
 *
 * @example
 * referencesIn({ text: "A=op://v/i/f\n# B=op://v/i/g\nC=hunter2", names: ["A", "B", "C"] }) // { A: "op://v/i/f" }
 */
export const referencesIn = (input: {
  readonly text: string
  readonly names: ReadonlyArray<string>
}): Record<string, string> => {
  const lines = A.filterMap(Str.split("\n")(input.text), (line) => S.decodeResult(ReferenceLine)(line))
  return R.getSomes(
    R.fromEntries(
      A.map(input.names, (name) => [
        name,
        A.findLast(lines, Str.startsWith(`${name}=`)).pipe(
          O.flatMap((line) => referenceOf(Str.slice(name.length + 1)(line)))
        )
      ])
    )
  )
}

/**
 * The variables a stage's deploy reads as secrets: the model key where the plan names one, and the previews'
 * password where the stage's test accounts are given theirs.
 *
 * @example
 * secretNamesOf(planOfProd) // ["OPENROUTER_API_KEY"]
 */
export const secretNamesOf = (plan: StagePlan): ReadonlyArray<string> => [
  ...(plan.modelKey.from === "environment" ? [plan.modelKey.variable] : []),
  ...(testPasswordOf(plan) === "given" ? [previewPasswordVariable] : [])
]
