// Which references a stack asks 1Password for: only lines of `env/op.env` that are references, only the names its
// stage's plan reads as secrets, and none at all in a workflow. 1Password itself is never contacted here: the tests
// stop at the references that would be handed to Alchemy's provider.
import { describe, expect, it, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Result from "effect/Result"
import { referencesIn, secretNamesOf } from "@beep/infra/OpReferences"
import { referencesWanted } from "@beep/infra/OpReferencesSecrets"
import { planFor } from "@beep/infra/StagePlan"

/** A value that must reach nothing. */
const secret = "sk-live-do-not-hand-on"

const names = (stage: string) => planFor(stage).pipe(Result.getOrThrow, secretNamesOf)

/** `referencesWanted` with this file's text in place of `env/op.env`, and these variables as the environment. */
const wanted = (text: string, env: Record<string, string>) =>
  referencesWanted(["OPENROUTER_API_KEY", "PREVIEW_TEST_ACCOUNT_PASSWORD"]).pipe(
    Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({ readFileString: () => Effect.succeed(text) })),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
  )

describe("the references a stack asks 1Password for", () => {
  it("only a line that is a reference is handed on: no comment, no template, no value typed by mistake", () => {
    const text = A.join(
      [
        "# OPENROUTER_API_KEY=op://vault/item/commented",
        "A=op://vault/item/field",
        'B="op://A Vault/An Item/section/field"',
        "C=op://A Vault/An Item/field",
        "D=op://<vault>/<item>/<field>",
        `E=${secret}`,
        "F=op://vault/item/first",
        "  F=op://vault/item/last  ",
        "G=op://vault/item/not-asked-for"
      ],
      "\n"
    )
    expect(referencesIn({ text, names: ["OPENROUTER_API_KEY", "A", "B", "C", "D", "E", "F", "H"] })).toEqual({
      A: "op://vault/item/field",
      B: "op://A Vault/An Item/section/field",
      F: "op://vault/item/last"
    })
  })

  it("a stage is asked only for what its plan reads: a test stage for nothing, production for its model key", () => {
    expect(names("prod")).toEqual(["OPENROUTER_API_KEY"])
    expect(names("pr-42")).toEqual(["PREVIEW_TEST_ACCOUNT_PASSWORD"])
    expect(names("staging")).toEqual(["PREVIEW_TEST_ACCOUNT_PASSWORD"])
    expect(names("test_ben")).toEqual([])
  })
})

layer(Path.layer)("the references a stack asks 1Password for, read from the file", (it) => {
  it.effect("on a workstation the file's references are wanted; in a workflow none are, whatever the file holds", () =>
    Effect.gen(function* () {
      const text =
        "OPENROUTER_API_KEY=op://vault/model/credential\nPREVIEW_TEST_ACCOUNT_PASSWORD=op://vault/preview/password\n"
      const atDesk = yield* wanted(text, {})
      const inWorkflow = yield* wanted(text, { CI: "true" })
      const unfilled = yield* wanted("# nothing filled in yet\n", {})
      expect(atDesk).toEqual({
        OPENROUTER_API_KEY: "op://vault/model/credential",
        PREVIEW_TEST_ACCOUNT_PASSWORD: "op://vault/preview/password"
      })
      expect(inWorkflow).toEqual({})
      expect(unfilled).toEqual({})
    })
  )
})
