// `bun run reason`, gate 9: the machine `src/Reason.ts` asks its questions of, and nothing else. It finds the Javas
// (JAVA_HOME, then `java` on the PATH, then each folder of /usr/lib/jvm, so a machine whose default Java is newer
// still finds the pinned one), keeps the jar outside the repository, under the user's cache folder by its release,
// fetches it from the pinned address when it is not there, and runs ROBOT on one document at a time in a temporary
// folder it removes. What a run must come to, and every refusal, is decided in `src/Reason.ts`. The script exits 1
// when the gate fails: it never skips.
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Console from "effect/Console"
import * as Digest from "effect/crypto/Digest"
import * as Duration from "effect/Duration"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Path from "effect/Path"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import * as S from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Str from "effect/String"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import {
  JarFound,
  JarNotFetched,
  JavaFound,
  Machine,
  reason,
  refusalSentence,
  robotPin,
  RobotResult
} from "../src/Reason.ts"

const vendorFolder = "/usr/lib/jvm"

/** A run takes under a second. One that hangs is stopped and counted failed, as a Java that did not start is. */
const runLimit = Duration.minutes(5)
/** A command stopped at the limit is asked to end, then killed: one that ignores the request would hold the gate open. */
const killAfter = Duration.seconds(5)

const machine = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
  const digest = yield* Digest.Digest
  const client = yield* HttpClient.HttpClient
  const pin = yield* robotPin
  const cache = yield* Config.schema(S.String, "XDG_CACHE_HOME").pipe(
    Config.orElse(() => Config.map(Config.schema(S.String, "HOME"), (home) => path.join(home, ".cache"))),
    Effect.orDie
  )
  const folder = path.join(cache, "inventory-import", "robot", pin.release)
  const jar = path.join(folder, pin.file)
  // Where a Java is asked its version: the folder the script runs in, which is there. The jar's folder may not be yet.
  const here = path.resolve(".")

  /** One command run to its end: its exit code and what it printed. A command that could not start, or ran past the
   * limit, is a failed command, never a pass. */
  const run = (command: string, args: ReadonlyArray<string>, cwd: string) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make(command, args, { cwd, stdin: "ignore", forceKillAfter: killAfter })
        )
        const [stdout, stderr, code] = yield* Effect.all(
          [
            handle.stdout.pipe(Stream.decodeText, Stream.mkString),
            handle.stderr.pipe(Stream.decodeText, Stream.mkString),
            handle.exitCode
          ],
          { concurrency: "unbounded" }
        )
        return { code: Number(code), stdout, stderr, error: "" }
      })
    ).pipe(
      Effect.timeoutOption(runLimit),
      Effect.map(
        O.match({
          onNone: () => ({ code: 1, stdout: "", stderr: "", error: `stopped after ${Duration.format(runLimit)}` }),
          onSome: (ran) => ran
        })
      ),
      Effect.catch((error) => Effect.succeed({ code: 1, stdout: "", stderr: "", error: String(error) })),
      // A place that cannot hold a command at all (a file where a folder was expected, as GitHub's runner keeps in
      // /usr/lib/jvm) stops the spawn itself: that too is a command that did not start, not a stop of the gate.
      Effect.catchDefect((stopped) => Effect.succeed({ code: 1, stdout: "", stderr: "", error: String(stopped) }))
    )

  /** What `java -version` says there, or none when nothing answers. It prints to the error stream. */
  const versionAt = (where: string) =>
    Effect.map(run(where, ["-version"], here), (asked) =>
      JavaFound.make({
        where,
        version: asked.code === 0 ? O.flatMap(Str.match(/version "([^"]+)"/)(asked.stderr), A.get(1)) : O.none<string>()
      })
    )

  const javas = Effect.gen(function* () {
    const home = yield* Config.schema(S.String, "JAVA_HOME").pipe(Config.option, Effect.orDie)
    const installed = yield* Effect.orElseSucceed(fs.readDirectory(vendorFolder), (): ReadonlyArray<string> => [])
    const places = [
      ...A.fromOption(O.map(home, (where) => path.join(where, "bin", "java"))),
      "java",
      ...A.map(A.sort(installed, Str.Order), (where) => path.join(vendorFolder, where, "bin", "java"))
    ]
    return yield* Effect.forEach(A.dedupe(places), versionAt, { concurrency: 1 })
  })

  const held = Effect.flatMap(Effect.option(fs.readFile(jar)), (read) =>
    O.match(read, {
      onNone: () => Effect.succeedNone,
      onSome: (bytes) =>
        Effect.map(digest.digestHex(Digest.sha256, bytes), (sha256) =>
          O.some(JarFound.make({ sha256, bytes: bytes.byteLength }))
        )
    })
  )

  const fetch = Effect.fn("reason.fetch")(function* (url: string) {
    const refused = (cause: unknown) => JarNotFetched.make({ url, reason: String(cause) })
    const response = yield* Effect.mapError(Effect.flatMap(client.get(url), HttpClientResponse.filterStatusOk), refused)
    const bytes = yield* Effect.mapError(response.arrayBuffer, refused)
    // Written beside its place and moved there whole, so a fetch that stops halfway leaves no jar.
    yield* Effect.mapError(
      Effect.andThen(
        fs.makeDirectory(folder, { recursive: true }),
        Effect.andThen(fs.writeFile(`${jar}.part`, new Uint8Array(bytes)), fs.rename(`${jar}.part`, jar))
      ),
      refused
    )
  })

  const robot = Effect.fn("reason.robot")(function* (input: {
    readonly java: string
    readonly command: "validate-profile" | "reason"
    readonly document: string
  }) {
    // The temporary folder is removed when the run's scope closes.
    return yield* Effect.scoped(
      Effect.gen(function* () {
        const work = yield* Effect.orDie(fs.makeTempDirectoryScoped({ prefix: "reason-" }))
        const document = path.join(work, "run.ttl")
        const report = path.join(work, "profile.txt")
        yield* Effect.orDie(fs.writeFileString(document, input.document))
        const flags =
          input.command === "validate-profile" ? ["--profile", "DL", "--output", report] : ["--reasoner", "hermit"]
        const ran = yield* run(input.java, ["-jar", jar, input.command, "--input", document, ...flags], work)
        const written = yield* Effect.orElseSucceed(fs.readFileString(report), () => "")
        return RobotResult.make({
          code: ran.code,
          output: A.join(A.filter([ran.stdout, ran.stderr, written, ran.error], Str.isNonEmpty), "\n")
        })
      })
    )
  })

  return Machine.of({ javas, jar: held, fetch, robot })
})

/** The machine on Bun's services, the fetch client and Web Crypto's digest. */
const services = Layer.effect(Machine, Effect.orDie(machine)).pipe(
  Layer.provide(Layer.mergeAll(BunServices.layer, FetchHttpClient.layer, Digest.layerWebCrypto))
)

// The script is the entry point: the machine is built once, for the run. A refusal is printed and fails the run,
// which sets the exit code to 1. So does a stop that is no refusal (a pin that does not decode, no home folder for
// the cache): it is printed too, since the runtime's own report is off.
Layer.build(services).pipe(
  Effect.flatMap((context) => reason().pipe(Effect.provideContext(context))),
  Effect.scoped,
  Effect.tap((lines) => Console.log(A.join(["reason OK  gate 9, the reasoner:", ...lines], "\n"))),
  Effect.tapError((refusal) => Console.error(`reason FAIL  gate 9, the reasoner:\n${refusalSentence(refusal)}`)),
  Effect.tapDefect((stopped) => Console.error(`reason FAIL  gate 9, the reasoner stopped:\n${String(stopped)}`)),
  BunRuntime.runMain({ disableErrorReporting: true })
)
