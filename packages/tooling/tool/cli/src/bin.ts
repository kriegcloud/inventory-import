#!/usr/bin/env bun
/**
 * The entry: `bun run beep <group> <command>` from the root, `beep-cli <group> <command>` from a package.
 *
 * A rule that found problems has printed them and fails with `CheckFailed`, which only sets the exit code. A command
 * that could not do its work prints its one sentence. Anything else is a defect and is printed whole.
 *
 * @packageDocumentation
 */
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Cause from "effect/Cause"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stdio from "effect/Stdio"
import { changedCheckArguments } from "./commands/Check/CheckChanged.schema.ts"
import * as Command from "effect/cli/Command"
import * as Digest from "effect/crypto/Digest"
import { Workstation } from "./commands/Infra/Workstation.service.ts"
import { Vitest } from "./commands/Mutants/Vitest.service.ts"
import { Repo } from "./Repo.service.ts"
import { rootCommand } from "./Root.command.ts"

/** What every command runs with: the workstation's tools, vitest, the repository, Bun's services and a digest. */
const services = Layer.merge(Workstation.layer, Vitest.layer).pipe(
  Layer.provideMerge(Repo.layer()),
  Layer.provideMerge(BunServices.layer),
  Layer.provide(Digest.layerWebCrypto)
)

// The entry point: the services are built once, for the run, and the command is given what they made.
Layer.build(services).pipe(
  Effect.flatMap((context) =>
    Stdio.Stdio.use(({ args }) =>
      args.pipe(
        Effect.flatMap((args) => Command.runWith(rootCommand, { version: "0.0.0" })(changedCheckArguments(args)))
      )
    ).pipe(Effect.provideContext(context))
  ),
  Effect.scoped,
  Effect.tapErrorTag("RepoError", (error) => Console.error(error.message)),
  Effect.tapDefect((defect) => Console.error(Cause.die(defect).pipe(Cause.pretty))),
  BunRuntime.runMain({ disableErrorReporting: true })
)
