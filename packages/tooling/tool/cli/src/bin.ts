#!/usr/bin/env bun
/**
 * The entry: `bun run beep <group> <command>` from the root, `beep-cli <group> <command>` from a package.
 *
 * A rule that found problems has printed them and fails with `CheckFailed`, which only sets the exit code. A command
 * that could not do its work prints its one sentence. Anything else is a defect and is printed whole.
 *
 * @packageDocumentation
 */
// The entry point is where the layers are provided.
// @effect-diagnostics strictEffectProvide:off
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Command from "effect/cli/Command"
import * as Digest from "effect/crypto/Digest"
import { Workstation } from "./commands/Infra/Workstation.service.ts"
import { Repo } from "./Repo.service.ts"
import { rootCommand } from "./Root.command.ts"

Command.run(rootCommand, { version: "0.0.0" }).pipe(
  Effect.provide(
    Workstation.layer.pipe(
      Layer.provideMerge(Repo.layer()),
      Layer.provideMerge(BunServices.layer),
      Layer.provide(Digest.layerWebCrypto)
    )
  ),
  Effect.tapErrorTag("RepoError", (error) => Console.error(error.message)),
  Effect.tapDefect((defect) => Console.error(Cause.die(defect).pipe(Cause.pretty))),
  BunRuntime.runMain({ disableErrorReporting: true })
)
