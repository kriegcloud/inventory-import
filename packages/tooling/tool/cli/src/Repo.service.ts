/**
 * The repository as the rules see it: where its root is, where the command was started, its workspaces, and the few
 * ways a rule reads it (a file's text, a JSON file through a schema, the files under a folder, a tool's answer).
 *
 * Every rule reads the tree through this one service, so the root is found once and a test can point it at a folder
 * it wrote.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Num from "effect/Number"
import * as O from "effect/Option"
import * as Path from "effect/Path"
import * as S from "effect/Schema"
import * as Stream from "effect/Stream"
import * as Str from "effect/String"
import * as Digest from "effect/crypto/Digest"
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { RepoError } from "./Cli.errors.ts"
import { Manifest } from "./Repo.schema.ts"

const $I = $RepoCliId.create("Repo.service")

/** One workspace: its folder (absolute) and its decoded `package.json`. */
export interface Workspace {
  readonly dir: string
  readonly manifest: Manifest
}

/** What a tool answered: its two streams as text and its exit code. */
export interface ToolAnswer {
  /** Standard output as the bytes the tool wrote. */
  readonly bytes: Uint8Array
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

/** How a tool is run: from which folder (the root), with what on standard input and which variables beside its own. */
export interface RunOptions {
  readonly cwd?: string
  /** Standard input, as text: none when left out. */
  readonly stdin?: string
  /** Variables added to the process's own environment. */
  readonly env?: Readonly<Record<string, string>>
}

/** One entry of a folder: its name and whether it is a folder itself. */
export interface Entry {
  readonly name: string
  readonly path: string
  readonly directory: boolean
}

const decoder = new TextDecoder()

/** Chunks of bytes as one array. */
const joined = (chunks: ReadonlyArray<Uint8Array>): Uint8Array => {
  const whole = new Uint8Array(Num.sumAll(A.map(chunks, (chunk) => chunk.length)))
  A.reduce(chunks, 0, (offset, chunk) => {
    whole.set(chunk, offset)
    return offset + chunk.length
  })
  return whole
}

const unreadable = (path: string) => (cause: unknown) =>
  RepoError.make({ path, message: `${path} could not be read: ${String(cause)}` })

/**
 * The repository's files and tools.
 *
 * @category services
 */
export class Repo extends Context.Service<
  Repo,
  {
    /** The repository's root, absolute. */
    readonly root: string
    /** The folder the command was started in, absolute. */
    readonly cwd: string
    /** Joins path segments. */
    readonly join: (...segments: ReadonlyArray<string>) => string
    /** `path` as seen from `from`. */
    readonly relative: (from: string, path: string) => string
    /** The folder a path is in. */
    readonly dirname: (path: string) => string
    /** An absolute path from segments, the first of which may be relative to the starting folder. */
    readonly resolve: (...segments: ReadonlyArray<string>) => string
    /** Whether a file or folder exists. */
    readonly exists: (path: string) => Effect.Effect<boolean>
    /** A file's text. */
    readonly text: (path: string) => Effect.Effect<string, RepoError>
    /** A file's bytes. */
    readonly bytes: (path: string) => Effect.Effect<Uint8Array, RepoError>
    /** Writes a file's text, making its folder first. */
    readonly write: (path: string, text: string) => Effect.Effect<void, RepoError>
    /** Writes a file's bytes, making its folder first. */
    readonly writeBytes: (path: string, data: Uint8Array) => Effect.Effect<void, RepoError>
    /** Removes a file or a whole folder; one that is not there is not an error. */
    readonly remove: (path: string) => Effect.Effect<void, RepoError>
    /** A path with its `.` and `..` segments resolved, still relative if it was. */
    readonly normalize: (path: string) => string
    /** A JSON file decoded through a schema. */
    readonly json: <Sch extends S.Constraint>(
      schema: Sch
    ) => (path: string) => Effect.Effect<Sch["Type"], RepoError, Sch["DecodingServices"]>
    /** A folder's entries, in the order the file system gives them. A folder that does not exist has none. */
    readonly entries: (dir: string) => Effect.Effect<ReadonlyArray<Entry>, RepoError>
    /** Every path under a folder, files and folders, each from that folder. A folder that does not exist has none. */
    readonly tree: (dir: string) => Effect.Effect<ReadonlyArray<string>, RepoError>
    /** Every file under a folder, depth first, in the order the file system gives them. */
    readonly files: (dir: string) => Effect.Effect<ReadonlyArray<string>, RepoError>
    /** Every workspace under `apps` and `packages`: a folder with a `package.json`, found at most five folders deep. */
    readonly workspaces: Effect.Effect<ReadonlyArray<Workspace>, RepoError>
    /** The SHA-256 of some bytes, in hexadecimal. */
    readonly sha256: (data: Uint8Array) => Effect.Effect<string>
    /** Runs a tool and waits for it. A tool that cannot be started is a `RepoError`; a non-zero exit is an answer. */
    readonly run: (
      command: string,
      args: ReadonlyArray<string>,
      options?: RunOptions
    ) => Effect.Effect<ToolAnswer, RepoError>
  }
>()($I`Repo`) {
  /**
   * The repository around a starting folder (the process's own when none is given): the nearest folder upward whose
   * `package.json` has `workspaces`.
   */
  static readonly layer = (
    options: { readonly cwd?: string } = {}
  ): Layer.Layer<
    Repo,
    RepoError,
    FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | Digest.Digest
  > =>
    Layer.effect(
      Repo,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem
        const path = yield* Path.Path
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
        const digest = yield* Digest.Digest
        const cwd = path.resolve(options.cwd ?? ".")

        const exists = (file: string) => fs.exists(file).pipe(Effect.orElseSucceed(() => false))
        const text = (file: string) => fs.readFileString(file).pipe(Effect.mapError(unreadable(file)))
        const bytes = (file: string) => fs.readFile(file).pipe(Effect.mapError(unreadable(file)))
        const write = (file: string, content: string) =>
          fs.makeDirectory(path.dirname(file), { recursive: true }).pipe(
            Effect.andThen(fs.writeFileString(file, content)),
            Effect.mapError((cause) =>
              RepoError.make({ path: file, message: `${file} could not be written: ${String(cause)}` })
            )
          )
        const unwritable = (file: string) => (cause: unknown) =>
          RepoError.make({ path: file, message: `${file} could not be written: ${String(cause)}` })
        const writeBytes = (file: string, data: Uint8Array) =>
          fs
            .makeDirectory(path.dirname(file), { recursive: true })
            .pipe(Effect.andThen(fs.writeFile(file, data)), Effect.mapError(unwritable(file)))
        const remove = (file: string) =>
          fs.remove(file, { recursive: true, force: true }).pipe(Effect.mapError(unwritable(file)))
        const json =
          <Sch extends S.Constraint>(schema: Sch) =>
          (file: string): Effect.Effect<Sch["Type"], RepoError, Sch["DecodingServices"]> =>
            text(file).pipe(
              Effect.flatMap((content) =>
                S.decodeEffect(S.fromJsonString(schema))(content).pipe(
                  Effect.mapError((cause) =>
                    RepoError.make({ path: file, message: `${file} is not what was expected: ${cause.message}` })
                  )
                )
              )
            )
        const entries = Effect.fn("Repo.entries")(function* (dir: string) {
          if (!(yield* exists(dir))) return A.empty<Entry>()
          const names = yield* fs.readDirectory(dir).pipe(Effect.mapError(unreadable(dir)))
          return yield* Effect.forEach(
            names,
            (name) => {
              const full = path.join(dir, name)
              return fs.stat(full).pipe(
                Effect.mapBoth({
                  onSuccess: (info): Entry => ({ name, path: full, directory: info.type === "Directory" }),
                  onFailure: unreadable(full)
                })
              )
            },
            { concurrency: 1 }
          )
        })
        const files: (dir: string) => Effect.Effect<ReadonlyArray<string>, RepoError> = Effect.fn("Repo.files")(
          function* (dir: string) {
            const found = yield* entries(dir)
            const nested = yield* Effect.forEach(
              found,
              (entry) => (entry.directory ? files(entry.path) : Effect.succeed(A.of(entry.path))),
              { concurrency: 1 }
            )
            return A.flatten(nested)
          }
        )
        const tree = Effect.fn("Repo.tree")(function* (dir: string) {
          if (!(yield* exists(dir))) return A.empty<string>()
          return yield* fs.readDirectory(dir, { recursive: true }).pipe(Effect.mapError(unreadable(dir)))
        })
        const manifestOf = json(Manifest)

        const rootFrom: (dir: string) => Effect.Effect<string, RepoError> = Effect.fn("Repo.rootFrom")(function* (
          dir: string
        ) {
          const file = path.join(dir, "package.json")
          if (yield* exists(file)) {
            const manifest = yield* manifestOf(file)
            if (manifest.workspaces !== undefined) return dir
          }
          const parent = path.dirname(dir)
          if (parent === dir) {
            return yield* RepoError.make({
              path: cwd,
              message: `${cwd} is not inside a repository: no package.json with workspaces above it`
            })
          }
          return yield* rootFrom(parent)
        })
        const root = yield* rootFrom(cwd)

        const walk: (dir: string, depth: number) => Effect.Effect<ReadonlyArray<Workspace>, RepoError> = Effect.fn(
          "Repo.walk"
        )(function* (dir: string, depth: number) {
          if (depth > 4) return A.empty<Workspace>()
          const found = yield* entries(dir)
          const nested = yield* Effect.forEach(
            A.filter(
              found,
              (entry) => entry.directory && entry.name !== "node_modules" && !Str.startsWith(".")(entry.name)
            ),
            Effect.fnUntraced(function* (entry) {
              const file = path.join(entry.path, "package.json")
              if (yield* exists(file)) return A.of<Workspace>({ dir: entry.path, manifest: yield* manifestOf(file) })
              return yield* walk(entry.path, depth + 1)
            }),
            { concurrency: 1 }
          )
          return A.flatten(nested)
        })
        const workspaces = Effect.all([walk(path.join(root, "apps"), 0), walk(path.join(root, "packages"), 0)], {
          concurrency: 1
        }).pipe(Effect.map(A.flatten))

        const run = (command: string, args: ReadonlyArray<string>, runOptions: RunOptions = {}) =>
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(
              ChildProcess.make(command, args, {
                cwd: O.getOrElse(O.fromUndefinedOr(runOptions.cwd), () => root),
                ...(runOptions.stdin === undefined
                  ? {}
                  : { stdin: Stream.make(runOptions.stdin).pipe(Stream.encodeText) }),
                // Every tool is run to read what it says, so it says it without colour, in a terminal or on CI
                // (where a tool colours its output because `CI` is set): a caller's own variables come after.
                env: { NO_COLOR: "1", FORCE_COLOR: "0", ...runOptions.env },
                extendEnv: true
              })
            )
            const [chunks, stderr, code] = yield* Effect.all(
              [
                Stream.runCollect(handle.stdout),
                handle.stderr.pipe(Stream.decodeText, Stream.mkString),
                handle.exitCode
              ],
              { concurrency: "unbounded" }
            )
            const bytes = joined(chunks)
            return { bytes, stdout: decoder.decode(bytes), stderr, code }
          }).pipe(
            Effect.scoped,
            Effect.mapError((cause) =>
              RepoError.make({ path: command, message: `${command} could not be run: ${String(cause)}` })
            )
          )

        return {
          root,
          cwd,
          join: (...segments) => path.join(...segments),
          relative: (from, to) => path.relative(from, to),
          dirname: (file) => path.dirname(file),
          resolve: (...segments) => path.resolve(cwd, ...segments),
          exists,
          text,
          bytes,
          write,
          writeBytes,
          remove,
          normalize: (file) => path.normalize(file),
          json,
          entries,
          tree,
          files,
          workspaces,
          sha256: Effect.fn("Repo.sha256")((data: Uint8Array) => digest.digestHex(Digest.sha256, data)),
          run
        }
      })
    )
}
