// Which references a stack asks 1Password for: only lines of `env/op.env` that are references, only the names its
// stage's plan reads as secrets, and none at all in a workflow. 1Password itself is never contacted here: the tests
// stop at the references that would be handed to Alchemy's provider.
import { describe, expect, it, layer } from "@effect/vitest"
import { vi } from "vitest"
import * as A from "effect/Array"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import { referencesIn, secretNamesOf } from "@beep/infra/OpReferences"
import { referencesWanted } from "@beep/infra/OpReferencesSecrets"
import { planFor } from "@beep/infra/StagePlan"

/** A value that must reach nothing. */
const secret = "sk-live-do-not-hand-on"

const names = (stage: string) => planFor(stage).pipe(Result.getOrThrow, secretNamesOf)

/**
 * `referencesWanted` with this text in place of `env/op.env` and this one in place of the owner's own `op.env.local`.
 * The configuration it is handed holds nothing, as the one Alchemy hands a `secrets` entry holds nothing of the
 * process's environment: what a workflow sets is set where a workflow sets it, in the process.
 */
const wanted = (text: string, own = "") =>
  referencesWanted(["OPENROUTER_API_KEY", "PREVIEW_TEST_ACCOUNT_PASSWORD", "PREVIEW_CLOUDFLARE_API_TOKEN"]).pipe(
    Effect.provideService(
      FileSystem.FileSystem,
      FileSystem.makeNoop({
        readFileString: (file) => Effect.succeed(Str.endsWith("op.env.local")(file) ? own : text)
      })
    ),
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: {} }))
  )

/** The process's environment for one case, put back afterwards. */
const inProcess = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      // This check itself may run in a workflow: every case states the `CI` it means.
      vi.stubEnv("CI", "")
      A.forEach(R.toEntries(env), ([name, value]) => vi.stubEnv(name, value))
    }),
    () => effect,
    () => Effect.sync(() => vi.unstubAllEnvs())
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
  const text =
    "OPENROUTER_API_KEY=op://vault/model/credential\nPREVIEW_TEST_ACCOUNT_PASSWORD=op://vault/preview/password\n"
  const both = {
    OPENROUTER_API_KEY: "op://vault/model/credential",
    PREVIEW_TEST_ACCOUNT_PASSWORD: "op://vault/preview/password"
  }

  it.effect("on a workstation the file's references are wanted; with nothing filled in, none", () =>
    Effect.gen(function* () {
      const atDesk = yield* inProcess({}, wanted(text))
      const unfilled = yield* inProcess({}, wanted("# nothing filled in yet\n"))
      expect(atDesk).toEqual(both)
      expect(unfilled).toEqual({})
    })
  )

  it.effect(
    "in a workflow, which sets CI in the process and nowhere else, none are wanted whatever the files hold",
    () =>
      Effect.gen(function* () {
        const inWorkflow = yield* inProcess({ CI: "true" }, wanted(text, "PREVIEW_CLOUDFLARE_API_TOKEN=op://v/i/f\n"))
        const notOne = yield* inProcess({ CI: "false" }, wanted(text))
        expect(inWorkflow).toEqual({})
        expect(notOne).toEqual(both)
      })
  )

  it.effect("a variable the process already holds is not asked of 1Password", () =>
    Effect.gen(function* () {
      const exported = yield* inProcess({ PREVIEW_TEST_ACCOUNT_PASSWORD: "given in the shell" }, wanted(text))
      expect(exported).toEqual({ OPENROUTER_API_KEY: "op://vault/model/credential" })
    })
  )

  it.effect("a variable exported empty is held too: Alchemy would rank the empty one over 1Password's answer", () =>
    Effect.gen(function* () {
      const empty = yield* inProcess({ OPENROUTER_API_KEY: "" }, wanted(text))
      expect(empty).toEqual({ PREVIEW_TEST_ACCOUNT_PASSWORD: "op://vault/preview/password" })
    })
  )

  it.effect("his own file is read too, after the committed one: a name in both takes his", () =>
    Effect.gen(function* () {
      const withOwn = yield* inProcess(
        {},
        wanted(
          text,
          'PREVIEW_CLOUDFLARE_API_TOKEN="op://A Vault/Second Account/TOKEN"\nOPENROUTER_API_KEY=op://vault/own/key\n'
        )
      )
      expect(withOwn).toEqual({
        OPENROUTER_API_KEY: "op://vault/own/key",
        PREVIEW_TEST_ACCOUNT_PASSWORD: "op://vault/preview/password",
        PREVIEW_CLOUDFLARE_API_TOKEN: "op://A Vault/Second Account/TOKEN"
      })
    })
  )
})
