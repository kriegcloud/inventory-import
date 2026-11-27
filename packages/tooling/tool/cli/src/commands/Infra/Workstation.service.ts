import { dual } from "effect/Function"
import * as P from "effect/Predicate"
/**
 * The owner's workstation as `infra setup` uses it: what the command says to him, the tools it reads an answer from,
 * the tools it hands his terminal to, and the questions it asks him.
 *
 * Every tool the setup starts goes through this one service, so a test can stand in for all of them and read back,
 * in order, what was said, what was run and with which arguments.
 *
 * Must not break: a tool that shows or asks for something secret (a login, a plan, a minted password) is handed the
 * terminal and its output is never read here; the one tool that makes a secret (`quiet`) has its output thrown away
 * before this process sees it.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Console from "effect/Console"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import type * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import type * as Path from "effect/Path"
import * as Stream from "effect/Stream"
import * as Terminal from "effect/Terminal"
import * as Prompt from "effect/cli/Prompt"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"

const $I = $RepoCliId.create("commands/Infra/Workstation.service")

/** What a tool answered when its output was read. */
export interface Answer {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

/** One thing he can pick: what he reads and what the command gets. */
export interface Choice {
  readonly title: string
  readonly value: string
}

/** Variables given to one tool beside the process's own. Names and values that are not secrets. */
export type Given = Readonly<Record<string, string>>

const notStarted = (command: string) => (cause: unknown) =>
  RepoError.make({ path: command, message: `${command} could not be run: ${String(cause)}` })

/**
 * The owner's terminal and tools.
 *
 * @category services
 */
export class Workstation extends Context.Service<
  Workstation,
  {
    /** Says one line to him. */
    readonly say: (line: string) => Effect.Effect<void>
    /** Runs a tool and reads what it says. For tools whose answer holds nothing secret. */
    readonly ask: {
      (args: ReadonlyArray<string>): (self: string) => Effect.Effect<Answer, RepoError>
      (self: string, args: ReadonlyArray<string>): Effect.Effect<Answer, RepoError>
    }
    /** Runs a tool with its standard output thrown away unread; what it says on failure and its exit code. */
    readonly quiet: {
      (args: ReadonlyArray<string>): (self: string) => Effect.Effect<Pick<Answer, "stderr" | "code">, RepoError>
      (self: string, args: ReadonlyArray<string>): Effect.Effect<Pick<Answer, "stderr" | "code">, RepoError>
    }
    /** Hands his terminal to a tool until it ends: he sees and answers it, this process reads nothing. Its exit code. */
    readonly hand: {
      (args: ReadonlyArray<string>, given?: Given): (self: string) => Effect.Effect<number, RepoError>
      (self: string, args: ReadonlyArray<string>, given?: Given): Effect.Effect<number, RepoError>
    }
    /** A yes or no from him. Leaving the question is a no. */
    readonly confirm: (question: string) => Effect.Effect<boolean>
    /** One of several, picked by him. Leaving the question is a `RepoError`. */
    readonly choose: {
      (choices: A.NonEmptyReadonlyArray<Choice>): (self: string) => Effect.Effect<string, RepoError>
      (self: string, choices: A.NonEmptyReadonlyArray<Choice>): Effect.Effect<string, RepoError>
    }
  }
>()($I`Workstation`) {
  /** The real workstation: the process's own terminal, and tools started from the repository's root. */
  static readonly layer: Layer.Layer<
    Workstation,
    never,
    Repo | ChildProcessSpawner.ChildProcessSpawner | Terminal.Terminal | FileSystem.FileSystem | Path.Path
  > = Layer.effect(
    Workstation,
    Effect.gen(function* () {
      const repo = yield* Repo
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const prompting = yield* Effect.context<Terminal.Terminal | FileSystem.FileSystem | Path.Path>()

      const hand = (command: string, args: ReadonlyArray<string>, given: Given = {}) =>
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make(command, args, {
              cwd: repo.root,
              stdin: "inherit",
              stdout: "inherit",
              stderr: "inherit",
              env: given,
              extendEnv: true
            })
          )
          return yield* handle.exitCode
        }).pipe(Effect.scoped, Effect.mapError(notStarted(command)))

      const quiet = (command: string, args: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          const handle = yield* spawner.spawn(
            ChildProcess.make(command, args, { cwd: repo.root, stdin: "inherit", stdout: "ignore", extendEnv: true })
          )
          const [stderr, code] = yield* Effect.all(
            [handle.stderr.pipe(Stream.decodeText, Stream.mkString), handle.exitCode],
            { concurrency: "unbounded" }
          )
          return { stderr, code }
        }).pipe(Effect.scoped, Effect.mapError(notStarted(command)))

      const say = (line: string) => Console.log(line)
      const ask = (command: string, args: ReadonlyArray<string>) => repo.run(command, args, { stdin: "" })
      // A question left with Ctrl-C or Escape is a no. The prompt then ends without its line, so one is written:
      // what the run says next starts on a line of its own, not after "(y/N)".
      const confirm = (question: string) =>
        Prompt.run(Prompt.Confirm({ message: question, initial: false })).pipe(
          Effect.provideContext(prompting),
          Effect.catch(() => Console.log("").pipe(Effect.as(false)))
        )
      const choose = (question: string, choices: A.NonEmptyReadonlyArray<Choice>) =>
        Prompt.run(Prompt.Select({ message: question, choices: A.map(choices, (one) => ({ ...one })) })).pipe(
          Effect.provideContext(prompting),
          Effect.mapError(() => RepoError.make({ path: "terminal", message: `Stopped: "${question}" was left.` }))
        )

      return {
        say,
        ask: dual(2, (self: string, args: ReadonlyArray<string>) => ask(self, args)),
        quiet: dual(2, (self: string, args: ReadonlyArray<string>) => quiet(self, args)),
        hand: dual(
          (args) => P.isString(args[0]),
          (self: string, args: ReadonlyArray<string>, given?: Given) => hand(self, args, given)
        ),
        confirm,
        choose: dual(2, (self: string, choices: A.NonEmptyReadonlyArray<Choice>) => choose(self, choices))
      }
    })
  )
}
