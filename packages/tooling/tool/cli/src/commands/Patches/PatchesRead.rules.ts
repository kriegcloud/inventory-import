/**
 * What every `patches` command reads and runs: the patches as they are kept, a package without its patches in a
 * folder of its own, and `git apply`, which says whether a patch applies there.
 *
 * @packageDocumentation
 */
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { literally } from "../../Sync.rules.ts"
import { type PatchHeader, type PatchRead, patchesFolder, readPatch } from "./Patches.schema.ts"

/** One patch file: one defect. */
export interface PatchFile {
  /** Its file name, which orders it among its package's patches (`01-computed-instance-id.patch`). */
  readonly name: string
  /** Its path from the root. */
  readonly file: string
  readonly absolute: string
  readonly text: string
  readonly read: PatchRead
}

/** The patches of one package: a folder of them, and the file bun reads beside it. */
export interface PatchSet {
  /** The folder's name (`alchemy-domain`). */
  readonly name: string
  /** The file bun reads, from the root (`packages/patches/alchemy-domain.patch`). */
  readonly built: string
  readonly patches: ReadonlyArray<PatchFile>
}

/** Everything under the patches workspace: each package's patches, and every file bun could be given. */
export interface Patches {
  readonly sets: ReadonlyArray<PatchSet>
  /** The `.patch` files beside the folders, from the root. */
  readonly builtFiles: ReadonlyArray<string>
}

const isPatch = Str.endsWith(".patch")
const byName = Order.mapInput(Order.String, (entry: { readonly name: string }) => entry.name)

/**
 * Reads the patches workspace. A folder with no patch in it is no package's patches, so a package whose last patch
 * was dropped leaves nothing behind but its folder.
 *
 * @category rules
 */
export const readPatches = Effect.fn("Patches.readPatches")(function* () {
  const repo = yield* Repo
  const home = repo.join(repo.root, patchesFolder)
  const entries = yield* repo.entries(home)
  const folders = A.sort(
    A.filter(
      entries,
      (entry) =>
        entry.directory && entry.name !== "test" && entry.name !== "node_modules" && !Str.startsWith(".")(entry.name)
    ),
    byName
  )
  const sets = yield* Effect.forEach(
    folders,
    Effect.fnUntraced(function* (folder) {
      const inside = yield* repo.entries(folder.path)
      const files = A.sort(
        A.filter(inside, (entry) => !entry.directory && isPatch(entry.name)),
        byName
      )
      const patches = yield* Effect.forEach(
        files,
        Effect.fnUntraced(function* (entry) {
          const text = yield* repo.text(entry.path)
          return {
            name: entry.name,
            file: `${patchesFolder}/${folder.name}/${entry.name}`,
            absolute: entry.path,
            text,
            read: readPatch(text)
          } satisfies PatchFile
        }),
        { concurrency: 1 }
      )
      return { name: folder.name, built: `${patchesFolder}/${folder.name}.patch`, patches } satisfies PatchSet
    }),
    { concurrency: 1 }
  )
  return {
    sets: A.filter(sets, (set) => set.patches.length > 0),
    builtFiles: A.map(
      A.sort(
        A.filter(entries, (entry) => !entry.directory && isPatch(entry.name)),
        byName
      ),
      (entry) => `${patchesFolder}/${entry.name}`
    )
  } satisfies Patches
})

/**
 * The file bun reads for a package: its patches one after another, in the order of their names, each with its
 * header. bun and `git apply` both read past the text above a diff.
 *
 * @category rules
 */
export const builtText = (set: PatchSet): string =>
  A.join(
    A.map(set.patches, (patch) => (Str.endsWith("\n")(patch.text) ? patch.text : `${patch.text}\n`)),
    ""
  )

/**
 * The header a package's patches share, when each has one and all name the same package and the same resolution.
 *
 * @category rules
 */
export const headerOf = (set: PatchSet): O.Option<PatchHeader> => {
  const headers = A.getSomes(A.map(set.patches, (patch) => patch.read.header))
  const first = A.head(headers)
  return O.filter(
    first,
    (header) =>
      headers.length === set.patches.length &&
      A.every(headers, (other) => other.package === header.package && other.appliesTo === header.appliesTo)
  )
}

/**
 * Whether a resolution names a file kept in the repository (`vendor/alchemy/alchemy.run-domain-734c27a.tgz`), and
 * not a version of a registry.
 *
 * @category rules
 */
export const isKeptFile = (appliesTo: string): boolean => Str.endsWith(".tgz")(appliesTo)

/**
 * Every resolution `bun.lock` holds for a package, from the lockfile's text: what follows `name@` at the start of
 * a package's entry.
 *
 * @example
 * resolutionsOf("effect")('"effect": ["effect@4.1.5", "", {}, "sha512-…"],') // ["4.1.5"]
 *
 * @category rules
 */
export const resolutionsOf =
  (name: string) =>
  (lock: string): ReadonlyArray<string> =>
    A.dedupe(
      A.flatMap(A.fromIterable(Str.matchAll(new RegExp(`\\["${literally(name)}@([^"]+)"`, "g"))(lock)), (match) =>
        O.toArray(O.fromNullishOr(match[1]))
      )
    )

/** What a tool wrote, as one line a person can read beside a path: its first line that says something. */
export const firstLine = (said: string): string =>
  O.getOrElse(A.findFirst(A.map(Str.split("\n")(said), Str.trim), Str.isNonEmpty), () => "it said nothing")

const failed = (path: string, what: string) => (said: string) =>
  RepoError.make({ path, message: `${path}: ${what}: ${firstLine(said)}` })

/**
 * Runs `use` with a new empty folder outside the repository, and removes the folder afterwards whatever happened.
 *
 * @category rules
 */
export const inTempFolder = <Value, E, R>(
  use: (dir: string) => Effect.Effect<Value, E, R>
): Effect.Effect<Value, E | RepoError, R | Repo> =>
  Effect.gen(function* () {
    const repo = yield* Repo
    return yield* Effect.acquireUseRelease(
      Effect.gen(function* () {
        const made = yield* repo.run("mktemp", ["-d"])
        const dir = Str.trim(made.stdout)
        if (made.code !== 0 || dir === "") return yield* failed("mktemp", "no temporary folder")(made.stderr)
        return dir
      }),
      use,
      (dir) => Effect.ignore(repo.remove(dir))
    )
  })

/**
 * Unpacks a kept file (an npm tarball, whose files are under `package/`) into a folder, as the package's root.
 *
 * @category rules
 */
export const unpack = Effect.fn("Patches.unpack")(function* (keptFile: string, into: string) {
  const repo = yield* Repo
  const made = yield* repo.run("mkdir", ["-p", into])
  if (made.code !== 0) return yield* failed(into, "could not be made")(made.stderr)
  const answer = yield* repo.run("tar", ["-xzf", repo.join(repo.root, keptFile), "-C", into, "--strip-components=1"])
  if (answer.code !== 0) return yield* failed(keptFile, "could not be unpacked")(answer.stderr)
})

/**
 * `git apply` in a folder that is a package's root. The folder is never read as part of a repository, the one
 * around it included: inside one, git leaves out every path it thinks is outside the folder it was started in.
 *
 * @category rules
 */
export const gitApply = Effect.fn("Patches.gitApply")(function* (
  dir: string,
  flags: ReadonlyArray<string>,
  patch: string
) {
  const repo = yield* Repo
  return yield* repo.run("git", ["apply", ...flags, patch], {
    cwd: dir,
    env: { GIT_CEILING_DIRECTORIES: repo.dirname(dir) }
  })
})

/** The first patch of a package that does not apply in a folder, with what git said; none when every one does. */
export interface Refused {
  readonly patch: PatchFile
  readonly said: string
}

/**
 * Applies a package's patches in a folder, one after another, as bun does. It stops at the first that does not
 * apply and names it.
 *
 * @category rules
 */
export const applyEach = Effect.fn("Patches.applyEach")(function* (set: PatchSet, dir: string) {
  return yield* Effect.reduce(
    set.patches,
    () => O.none<Refused>(),
    (refused, patch) =>
      O.isSome(refused)
        ? Effect.succeed(refused)
        : gitApply(dir, [], patch.absolute).pipe(
            Effect.map((answer) =>
              answer.code === 0 ? O.none<Refused>() : O.some<Refused>({ patch, said: firstLine(answer.stderr) })
            )
          )
  )
})

/** Where a package is installed, from the root. */
export const installedAt = (name: string): string => `node_modules/${name}`

/**
 * Whether what is installed for a package holds every change a file bun applies writes: the file comes back out of
 * it cleanly. An install made before the file last changed does not, and neither does one bun made without it.
 *
 * @category rules
 */
export const holdsPatches = Effect.fn("Patches.holdsPatches")(function* (name: string, built: string) {
  const repo = yield* Repo
  const installed = repo.join(repo.root, installedAt(name))
  if (!(yield* repo.exists(installed))) return false
  const answer = yield* gitApply(installed, ["--check", "--reverse"], repo.join(repo.root, built))
  return answer.code === 0
})
