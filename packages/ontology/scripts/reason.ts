// @effect-diagnostics nodeBuiltinImport:off
// `bun run reason`, gate 9: the machine `src/Reason.ts` asks its questions of, and nothing else. It finds the Javas
// (JAVA_HOME, then `java` on the PATH, then each folder of /usr/lib/jvm, so a machine whose default Java is newer
// still finds the pinned one), keeps the jar outside the repository, under the user's cache folder by its release,
// fetches it from the pinned address when it is not there, and runs ROBOT on one document at a time in a temporary
// folder it removes. What a run must come to, and every refusal, is decided in `src/Reason.ts`. The script exits 1
// when the gate fails: it never skips.
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import * as A from "effect/Array"
import * as Config from "effect/Config"
import * as Console from "effect/Console"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientResponse from "effect/http/HttpClientResponse"
import { JarNotFetched, Machine, reason, refusalSentence, robotPin, type JavaFound } from "../src/Reason.ts"

const vendorFolder = "/usr/lib/jvm"

/** What `java -version` says there, or none when nothing answers. It prints to the error stream. */
const versionAt = (where: string): JavaFound => {
  const asked = spawnSync(where, ["-version"], { encoding: "utf8" })
  const version =
    asked.error === undefined && asked.status === 0 ? Str.match(/version "([^"]+)"/)(asked.stderr) : O.none()
  return { where, version: O.flatMap(version, (match) => O.fromUndefinedOr(match[1])) }
}

const javas = Effect.gen(function* () {
  const home = yield* Config.schema(S.String, "JAVA_HOME").pipe(Config.option, Effect.orDie)
  const installed = yield* Effect.orElseSucceed(
    Effect.tryPromise({ try: () => readdir(vendorFolder), catch: () => "none" as const }),
    (): ReadonlyArray<string> => []
  )
  const places = [
    ...A.fromOption(O.map(home, (folder) => join(folder, "bin", "java"))),
    "java",
    ...A.map(A.sort(installed, Str.Order), (folder) => join(vendorFolder, folder, "bin", "java"))
  ]
  return A.map(A.dedupe(places), versionAt)
})

const machine = Effect.gen(function* () {
  const pin = yield* robotPin
  const client = yield* HttpClient.HttpClient
  const cacheHome = yield* Config.schema(S.String, "XDG_CACHE_HOME").pipe(Config.option, Effect.orDie)
  const cache = O.getOrElse(cacheHome, () => join(homedir(), ".cache"))
  const folder = join(cache, "inventory-import", "robot", pin.release)
  const jar = join(folder, pin.file)

  const held = Effect.map(
    Effect.option(Effect.tryPromise({ try: () => readFile(jar), catch: () => "none" as const })),
    O.map((bytes) => ({ sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.byteLength }))
  )

  const fetch = Effect.fn("reason.fetch")(function* (url: string) {
    const refused = (cause: unknown) => JarNotFetched.make({ url, reason: String(cause) })
    const response = yield* Effect.mapError(Effect.flatMap(client.get(url), HttpClientResponse.filterStatusOk), refused)
    const bytes = yield* Effect.mapError(response.arrayBuffer, refused)
    // Written beside its place and moved there whole, so a fetch that stops halfway leaves no jar.
    yield* Effect.tryPromise({
      try: () =>
        mkdir(folder, { recursive: true })
          .then(() => writeFile(`${jar}.part`, new Uint8Array(bytes)))
          .then(() => rename(`${jar}.part`, jar)),
      catch: refused
    })
  })

  const robot = Effect.fn("reason.robot")(function* (input: {
    readonly java: string
    readonly command: "validate-profile" | "reason"
    readonly document: string
  }) {
    const work = yield* Effect.orDie(
      Effect.tryPromise({ try: () => mkdtemp(join(tmpdir(), "reason-")), catch: String })
    )
    const document = join(work, "run.ttl")
    const report = join(work, "profile.txt")
    yield* Effect.orDie(Effect.tryPromise({ try: () => writeFile(document, input.document, "utf8"), catch: String }))
    const flags =
      input.command === "validate-profile" ? ["--profile", "DL", "--output", report] : ["--reasoner", "hermit"]
    const ran = spawnSync(input.java, ["-jar", jar, input.command, "--input", document, ...flags], {
      cwd: work,
      encoding: "utf8",
      // A run takes under a second. One that hangs is stopped and counted failed, as a Java that did not start is.
      timeout: 300_000
    })
    const written = yield* Effect.orElseSucceed(
      Effect.tryPromise({ try: () => readFile(report, "utf8"), catch: () => "none" as const }),
      () => ""
    )
    yield* Effect.orDie(Effect.tryPromise({ try: () => rm(work, { recursive: true, force: true }), catch: String }))
    return {
      // A Java that could not be started is a failed command, never a pass.
      code: ran.error === undefined ? (ran.status ?? 1) : 1,
      output: A.join(
        A.filter([ran.stdout, ran.stderr, written, ran.error === undefined ? "" : String(ran.error)], Str.isNonEmpty),
        "\n"
      )
    }
  })

  return Machine.of({ javas, jar: held, fetch, robot })
})

const live = Layer.provide(Layer.effect(Machine, Effect.orDie(machine)), FetchHttpClient.layer)

// The script is the entry point: the one place the machine is provided.
// @effect-diagnostics-next-line strictEffectProvide:off
const main = Effect.matchEffect(Effect.provide(reason(), live), {
  onSuccess: (lines) => Console.log(A.join(["reason OK  gate 9, the reasoner:", ...lines], "\n")),
  onFailure: (refusal) =>
    Effect.andThen(
      Console.error(`reason FAIL  gate 9, the reasoner:\n${refusalSentence(refusal)}`),
      Effect.sync(() => {
        process.exitCode = 1
      })
    )
})

void Effect.runPromise(main)
