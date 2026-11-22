/**
 * A stack's `secrets` entry: the references of `env/op.env` that the stage needs, read by Alchemy's 1Password
 * provider (Benjamin, 2026-11-22: "use alchemy's built in 1password"). On a workstation the 1Password app asks its
 * owner to authorize the run; the values go to the stack's configuration only, never to the process's environment
 * or to disk.
 *
 * Must not break: in a workflow (`CI` set) this entry does nothing and 1Password is never contacted, because a
 * deploy job is given its secrets by its GitHub environment; and a stage that needs no secret asks for none.
 *
 * @packageDocumentation
 */
import * as OnePassword from "@alchemy.run/1password"
import type * as Secrets from "alchemy/Secrets"
import { Stage } from "alchemy/Stage"
import * as Config from "effect/Config"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import { opEnvFile, ownEnvFile, referencesIn } from "./OpReferences.rules.ts"

/** A `secrets` entry that reads this package's `env/op.env`. */
export class OpEnvReferences extends Data.TaggedClass("@beep/infra/SecretProvider::OpEnvReferences")<{
  readonly layer: Secrets.SecretsLayer
}> {}

/**
 * The references to ask 1Password for: none in a workflow, none when neither file is there, else the ones `op.env`
 * and the owner's own `op.env.local` give for these names.
 */
export const referencesWanted = Effect.fn("OpReferences.referencesWanted")(function* (names: ReadonlyArray<string>) {
  const inWorkflow = yield* Config.Boolean("CI").pipe(Config.withDefault(false))
  if (inWorkflow) return R.empty<string, string>()
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const textOf = (file: string) =>
    fs.readFileString(path.resolve(import.meta.dirname, "..", file)).pipe(Effect.orElseSucceed(() => ""))
  const committed = yield* textOf(opEnvFile)
  const own = yield* textOf(ownEnvFile)
  return referencesIn({ text: `${committed}\n${own}`, names })
})

/**
 * The entry for a stack: `names` says which variables a stage reads as secrets.
 *
 * @category secrets
 */
export const opEnvReferences = (names: (stage: string) => ReadonlyArray<string>): OpEnvReferences =>
  new OpEnvReferences({
    layer: Layer.unwrap(
      Effect.gen(function* () {
        const stage = yield* Stage
        const references = yield* referencesWanted(names(stage))
        // The library types a provider's failure as unknown. A stack's only typed failure is a missing setting, so
        // 1Password refusing (not unlocked, a reference it does not know) stops the stack as a defect, printed whole.
        if (R.isEmptyRecord(references)) return Layer.empty
        // The unknown is the library's own type for a provider's layer, and it is made a defect on the same line.
        // @effect-diagnostics-next-line anyUnknownInErrorContext:off
        return OnePassword.SecretReferences({ references }).layer.pipe(Layer.orDie)
      })
    )
  })
