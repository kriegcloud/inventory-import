/**
 * `deps update`: every dependency of every package moved to the newest version its registry calls `latest`, except
 * the ones held back, each with its reason.
 *
 * - **Every package.** The root's `package.json` and every workspace's are read, the root's `catalog` too when
 *   versions are kept there once. A dependency keeps the way it is written: an exact version stays exact, `^1.2.3`
 *   stays a caret range, `~1.2.3` a tilde range.
 * - **Held.** `.syncpackrc.json` lists the dependencies that do not move by themselves (`updateGroups` with
 *   `isIgnored`), each group's `label` being its reason. `deps:outdated` (syncpack) reads the same list, so the two
 *   agree. A held dependency is named every time the command runs, with the registry's newest, and its group with
 *   the reason and, when the label ends " To move: ...", with what moves it by hand: one run says all an update needs.
 * - **Effect moves together.** `effect` and every `@effect/*` package released with it are at one exact version.
 *   When the registry's newest version is the same for all of them they all move to it; when it is not (one was
 *   published later than the others), none of them moves, and the command says which is behind.
 * - **What cannot be compared stays.** An address (`https://...tgz`), a file, a tag or a range of several parts is
 *   not a version the registry can be asked about, and is named as skipped.
 * - **A patched dependency stops the update.** A patch is made for one version (docs/patches.md). When a dependency
 *   the repository patches has a newer version, nothing is moved, and the command names the patches to re-make for
 *   the new version or to drop: moved along with the rest, bun would install it unpatched with one warning line.
 *
 * The plan is a pure function of the files' text, the held list and the registry's answers, so it is tested with no
 * network. Writing changes the files, runs `bun install`, and then `version-sync --write`, so the places a moved
 * version is repeated follow it.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as MutableHashMap from "effect/MutableHashMap"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, Line, out } from "../../Report.schema.ts"
import { decodeJsonc, fits, type Found, lineAt, objectOf, stringsIn } from "../../Sync.rules.ts"
import { Drift, type Mode, Plan, settle, type SyncFinding, syncSentence } from "../../Sync.schema.ts"
import { patchesFolder } from "../Patches/Patches.schema.ts"
import { headerOf, isKeptFile, readPatches } from "../Patches/PatchesRead.rules.ts"
import { versionSyncPlan } from "../VersionSync/VersionSync.rules.ts"

const $I = $RepoCliId.create("commands/Deps/Deps.rules")

/**
 * The parts of `.syncpackrc.json` that say which dependencies are held back, and why.
 *
 * @category schemas
 */
export class SyncpackFile extends S.Class<SyncpackFile, { readonly brand: unique symbol }>($I`SyncpackFile`)(
  {
    updateGroups: S.Array(
      S.Struct({
        label: S.optionalKey(S.String).pipe(S.annotateKey({ description: "Why the group is held: shown at each run" })),
        dependencies: S.String.pipe(
          S.Array,
          S.optionalKey,
          S.annotateKey({ description: "The names it holds, `*` and `**` allowed" })
        ),
        isIgnored: S.optionalKey(S.Boolean).pipe(S.annotateKey({ description: "true: an update never moves them" }))
      })
    ).pipe(S.optionalKey, S.annotateKey({ description: "The groups an update treats differently" }))
  },
  $I.annote("SyncpackFile", { description: "The dependencies .syncpackrc.json holds back, each group with its reason" })
) {}

/** A dependency held back: the pattern its name fits and the reason written beside it. */
export interface Hold {
  readonly pattern: string
  readonly reason: string
  /** How the group is moved by hand, when its label says (" To move: ..." at its end). */
  readonly move: O.Option<string>
  /** Which group of the list it belongs to, so a group's reason is said once for all it holds. */
  readonly group: number
}

/**
 * A held group's label as its reason and, after " To move: ", what moves it by hand.
 *
 * @example
 * heldBecause("Pinned as one set. To move: `bun run alchemy:repin -- main`")
 * // { reason: "Pinned as one set.", move: some("`bun run alchemy:repin -- main`") }
 *
 * @category rules
 */
export const heldBecause = (label: string): { readonly reason: string; readonly move: O.Option<string> } => {
  const parts = Str.split(" To move: ")(label)
  return parts.length < 2
    ? { reason: Str.trim(label), move: O.none() }
    : { reason: Str.trim(parts[0] ?? ""), move: O.some(Str.trim(A.join(A.drop(parts, 1), " To move: "))) }
}

/** One place a package.json asks for a dependency. */
export interface Ask {
  readonly file: string
  readonly name: string
  readonly spec: Found
  readonly line: number
}

/** A version's numbers, and what follows a hyphen when it is a pre-release. */
export interface Version {
  readonly numbers: readonly [number, number, number]
  readonly pre: O.Option<string>
}

/**
 * A plain version (`1.2.3`, `1.2.3-beta.4`) read into its parts; anything else is none.
 *
 * @category rules
 */
export const versionOf = (text: string): O.Option<Version> =>
  O.map(O.fromNullishOr(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(text)), (match) => ({
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])] as const,
    pre: O.fromNullishOr(match[4])
  }))

const numeric = /^\d+$/
const byIdentifier = Order.make<string>((a, b) => {
  if (a === b) return 0
  if (numeric.test(a) && numeric.test(b)) return Order.Number(Number(a), Number(b))
  return numeric.test(a) ? -1 : numeric.test(b) ? 1 : Order.String(a, b)
})
const byIdentifiers = A.makeOrder(byIdentifier)
const byPre = Order.make<O.Option<string>>((a, b) =>
  O.isNone(a)
    ? O.isNone(b)
      ? 0
      : 1
    : O.isNone(b)
      ? -1
      : byIdentifiers(Str.split(".")(a.value), Str.split(".")(b.value))
)

/** Versions in the order they are released: by their numbers, and a pre-release before the version it leads to. */
const byRelease: Order.Order<Version> = Order.combine(
  Order.mapInput(Order.Tuple([Order.Number, Order.Number, Order.Number]), (version: Version) => version.numbers),
  Order.mapInput(byPre, (version: Version) => version.pre)
)

/**
 * Whether a version was released after another.
 *
 * @example
 * O.zipWith(versionOf("4.1.5"), versionOf("4.1.4"), (candidate, current) => newerThan(current)(candidate)) // some(true)
 *
 * @category rules
 */
export const newerThan =
  (current: Version) =>
  (candidate: Version): boolean =>
    Order.isGreaterThan(byRelease)(candidate, current)

/**
 * How a dependency is written: what leads its version (`^`, `~`, or nothing for an exact one) and the version.
 * A workspace or catalog reference, an address, a tag and a range of several parts are none.
 *
 * @category rules
 */
export const writtenAs = (spec: string): O.Option<{ readonly lead: string; readonly version: Version }> =>
  O.flatMap(O.fromNullishOr(/^(\^|~)?(.+)$/.exec(spec)), (match) =>
    O.map(versionOf(match[2] ?? ""), (version) => ({ lead: match[1] ?? "", version }))
  )

const dependency = S.String.pipe(S.annotateKey({ description: "The dependency's name" }))
const count = S.Int.pipe(S.annotateKey({ description: "In how many package.json files it is written" }))

/**
 * What `deps update` says about a dependency: it moves, it is held, it cannot be compared, or its family cannot
 * move together.
 *
 * @category schemas
 */
export const DepsFinding = S.TaggedUnion({
  Summary: {
    packages: S.Int.pipe(S.annotateKey({ description: "How many package.json files were read" })),
    dependencies: S.Int.pipe(S.annotateKey({ description: "How many different dependencies they ask for" })),
    moving: S.Int.pipe(S.annotateKey({ description: "How many have a newer version" })),
    held: S.Int.pipe(S.annotateKey({ description: "How many are held back" })),
    skipped: S.Int.pipe(S.annotateKey({ description: "How many cannot be compared with the registry" })),
    written: S.Boolean.pipe(S.annotateKey({ description: "Whether the files were changed" }))
  },
  Held: {
    name: dependency,
    spec: S.String.pipe(S.annotateKey({ description: "How it is written today" })),
    latest: S.OptionFromOptionalKey(S.String).pipe(S.annotateKey({ description: "The registry's newest, if asked" }))
  },
  HeldBecause: { reason: S.String.pipe(S.annotateKey({ description: "Why the dependencies above are held" })) },
  HeldMoves: { how: S.String.pipe(S.annotateKey({ description: "What moves them by hand" })) },
  Skipped: {
    name: dependency,
    spec: S.String.pipe(S.annotateKey({ description: "How it is written today" })),
    why: S.String.pipe(S.annotateKey({ description: "Why the registry cannot be asked about it" }))
  },
  Together: {
    family: S.String.pipe(S.annotateKey({ description: "The packages that move together" })),
    versions: S.Array(S.String).pipe(S.annotateKey({ description: "Each package with the registry's newest" }))
  },
  Move: {
    name: dependency,
    from: S.String.pipe(S.annotateKey({ description: "How it was written" })),
    to: S.String.pipe(S.annotateKey({ description: "How it is written now" })),
    files: count,
    written: S.Boolean.pipe(S.annotateKey({ description: "Whether the files were changed" }))
  },
  Patched: {
    name: dependency,
    to: S.String.pipe(S.annotateKey({ description: "How it would be written after the move" })),
    appliesTo: S.String.pipe(S.annotateKey({ description: "The version its patches were made for" })),
    folder: S.String.pipe(S.annotateKey({ description: "The folder of its patches, from the root" }))
  },
  Installed: {},
  InstallFailed: {
    files: S.Int.pipe(S.annotateKey({ description: "How many written files were put back" })),
    output: S.String.pipe(S.annotateKey({ description: "What bun said, its last lines" }))
  },
  Synced: {
    line: Line.pipe(S.annotateKey({ description: "A line version-sync printed after the move" }))
  }
}).pipe($I.annoteSchema("DepsFinding", { description: "A dependency that moves, is held, is skipped, or waits" }))

/**
 * The decoded value of `DepsFinding`.
 *
 * @category models
 */
export type DepsFinding = typeof DepsFinding.Type

/** A dependency the repository patches: the version its patches were made for, and where they are. */
export interface PatchedDependency {
  readonly name: string
  readonly appliesTo: string
  readonly folder: string
}

/** What the plan is made from, with no file or network left to read. */
export interface DepsInput {
  readonly asks: ReadonlyArray<Ask>
  readonly holds: ReadonlyArray<Hold>
  /** The dependencies from a registry that the repository patches; none when left out. */
  readonly patched?: ReadonlyArray<PatchedDependency>
  /** The registry's newest version of each dependency that was asked about. */
  readonly latest: Readonly<Record<string, string>>
  /** Whether the files are being changed: the lines then say moved, not to move. */
  readonly written: boolean
}

/** What `deps update` planned: what it says, and each place to rewrite. */
export interface DepsPlan {
  readonly findings: ReadonlyArray<DepsFinding>
  readonly drifts: ReadonlyArray<Drift>
}

const isReference = (spec: string) => Str.startsWith("workspace:")(spec) || Str.startsWith("catalog:")(spec)
const holdOf = (holds: ReadonlyArray<Hold>) => (name: string) => A.findFirst(holds, (hold) => fits(hold.pattern)(name))
const apart = ["@effect/tsgo", "@effect/language-service"]

/** Whether a dependency is released with `effect` at the same version. */
export const movesWithEffect = (name: string): boolean =>
  name === "effect" || (Str.startsWith("@effect/")(name) && !A.contains(apart, name))

/**
 * The dependencies the registry has to be asked about: every one written as a version, the held ones too, so a
 * held dependency is shown with how far behind it is.
 *
 * @category rules
 */
export const toAsk = (asks: ReadonlyArray<Ask>): ReadonlyArray<string> =>
  A.sort(
    A.dedupe(
      A.map(
        A.filter(asks, (ask) => O.isSome(writtenAs(ask.spec.value))),
        (ask) => ask.name
      )
    ),
    Order.String
  )

/**
 * What moves and what does not, from the files' text, the held list and the registry's answers.
 *
 * @category rules
 */
export const depsPlan = (input: DepsInput): DepsPlan => {
  const asks = A.filter(input.asks, (ask) => !isReference(ask.spec.value))
  const byName = A.sort(
    R.toEntries(A.groupBy(asks, (ask) => ask.name)),
    Order.mapInput(Order.String, (entry: readonly [string, ReadonlyArray<Ask>]) => entry[0])
  )
  const judged = A.map(byName, ([name, uses]) => {
    const specs = A.dedupe(A.map(uses, (use) => use.spec.value))
    const spec = A.join(specs, ", ")
    const hold = holdOf(input.holds)(name)
    if (O.isSome(hold)) {
      return {
        name,
        uses,
        moves: A.empty<{ readonly ask: Ask; readonly to: string }>(),
        newest: O.none<string>(),
        held: O.some(hold.value),
        said: A.of<DepsFinding>(DepsFinding.cases.Held.make({ name, spec, latest: R.get(input.latest, name) }))
      }
    }
    const newest = O.flatMap(R.get(input.latest, name), (text) =>
      O.map(versionOf(text), (version) => ({ text, version }))
    )
    const comparable = A.filter(uses, (use) => O.isSome(writtenAs(use.spec.value)))
    if (comparable.length === 0) {
      return {
        name,
        uses,
        moves: A.empty<{ readonly ask: Ask; readonly to: string }>(),
        newest: O.none<string>(),
        held: O.none<Hold>(),
        said: A.of<DepsFinding>(
          DepsFinding.cases.Skipped.make({
            name,
            spec,
            why: "not written as a version the registry can be asked about"
          })
        )
      }
    }
    if (O.isNone(newest)) {
      return {
        name,
        uses,
        moves: A.empty<{ readonly ask: Ask; readonly to: string }>(),
        newest: O.none<string>(),
        held: O.none<Hold>(),
        said: A.of<DepsFinding>(
          DepsFinding.cases.Skipped.make({ name, spec, why: "the registry named no newest version for it" })
        )
      }
    }
    const moves = A.flatMap(comparable, (ask) =>
      O.match(writtenAs(ask.spec.value), {
        onNone: () => A.empty<{ readonly ask: Ask; readonly to: string }>(),
        onSome: (now) =>
          newerThan(now.version)(newest.value.version) ? [{ ask, to: `${now.lead}${newest.value.text}` }] : []
      })
    )
    return {
      name,
      uses,
      moves,
      newest: O.some(newest.value.text),
      held: O.none<Hold>(),
      said: A.empty<DepsFinding>()
    }
  })

  // Effect and the packages released with it move to one version, or not at all.
  const family = A.filter(judged, (one) => movesWithEffect(one.name) && O.isSome(one.newest))
  const newestOfFamily = A.dedupe(A.flatMap(family, (one) => O.toArray(one.newest)))
  const split = newestOfFamily.length > 1
  const waiting: ReadonlyArray<DepsFinding> = split
    ? [
        DepsFinding.cases.Together.make({
          family: "effect and the @effect/* packages released with it",
          versions: A.map(family, (one) => `${one.name} ${O.getOrElse(one.newest, () => "")}`)
        })
      ]
    : []
  const moving = A.flatMap(judged, (one) => (split && movesWithEffect(one.name) ? [] : one.moves))
  // A patch is made for one version: a patched dependency that would move stops every move, so the lockfile is
  // never made from a tree in which bun leaves a patch out.
  const stops = A.flatMap(input.patched ?? [], (patched) =>
    O.match(
      A.findFirst(moving, (move) => move.ask.name === patched.name),
      {
        onNone: () => A.empty<DepsFinding>(),
        onSome: (move) => [
          DepsFinding.cases.Patched.make({
            name: patched.name,
            to: move.to,
            appliesTo: patched.appliesTo,
            folder: patched.folder
          })
        ]
      }
    )
  )
  const stopped = stops.length > 0
  const written = input.written && !stopped

  const moves = A.map(
    R.toEntries(A.groupBy(moving, (move) => `${move.ask.name}\n${move.ask.spec.value}\n${move.to}`)),
    ([, same]): DepsFinding => {
      const first = A.headNonEmpty(same)
      return DepsFinding.cases.Move.make({
        name: first.ask.name,
        from: first.ask.spec.value,
        to: first.to,
        files: A.dedupe(A.map(same, (move) => move.ask.file)).length,
        written
      })
    }
  )
  // A group's dependencies together, then once why they are held and what moves them.
  const heldGroups = A.sort(
    R.toEntries(
      A.groupBy(
        A.flatMap(judged, (one) =>
          O.match(one.held, { onNone: () => [], onSome: (hold) => [{ hold, said: one.said }] })
        ),
        (one) => String(one.hold.group)
      )
    ),
    Order.mapInput(Order.Number, (entry: readonly [string, unknown]) => Number(entry[0]))
  )
  const heldSaid = A.flatMap(heldGroups, ([, members]) => {
    const first = A.headNonEmpty(members).hold
    return A.flatten<ReadonlyArray<ReadonlyArray<DepsFinding>>>([
      A.flatMap(members, (member) => member.said),
      [DepsFinding.cases.HeldBecause.make({ reason: first.reason })],
      O.match(first.move, { onNone: () => [], onSome: (how) => [DepsFinding.cases.HeldMoves.make({ how })] })
    ])
  })
  const said = A.appendAll(
    heldSaid,
    A.flatMap(judged, (one) => (O.isSome(one.held) ? [] : one.said))
  )
  const summary = DepsFinding.cases.Summary.make({
    packages: A.dedupe(A.map(input.asks, (ask) => ask.file)).length,
    dependencies: byName.length,
    moving: A.dedupe(A.map(moving, (move) => move.ask.name)).length,
    held: A.filter(said, DepsFinding.guards.Held).length,
    skipped: A.filter(said, DepsFinding.guards.Skipped).length,
    written
  })
  return {
    findings: A.flatten<ReadonlyArray<ReadonlyArray<DepsFinding>>>([[summary], said, waiting, moves, stops]),
    drifts: A.map(stopped ? [] : moving, ({ ask, to }) =>
      Drift.make({
        file: ask.file,
        line: ask.line,
        what: `\`${ask.name}\`, from the registry's newest`,
        found: ask.spec.value,
        expected: to,
        start: ask.spec.start,
        end: ask.spec.end,
        text: to
      })
    )
  }
}

const plural = (number: number, one: string, many: string) => `${number} ${number === 1 ? one : many}`

/**
 * The line each finding prints.
 *
 * @category rendering
 */
export const depsSentence: (finding: DepsFinding) => Line = DepsFinding.match({
  Summary: ({ packages, dependencies, moving, held, skipped, written }) =>
    out(
      `deps:update  ${plural(packages, "package.json", "package.json files")}, ${plural(dependencies, "dependency", "dependencies")}: ${moving} ${
        written ? "moved" : "to move"
      }, ${held} held, ${skipped} not compared${written ? "" : " (nothing written)"}`
    ),
  Held: ({ name, spec, latest }) =>
    out(`  held  ${name} ${spec}${O.match(latest, { onNone: () => "", onSome: (newest) => ` (newest ${newest})` })}`),
  HeldBecause: ({ reason }) => out(`        why: ${reason}`),
  HeldMoves: ({ how }) => out(`        to move: ${how}`),
  Skipped: ({ name, spec, why }) => out(`  skip  ${name} ${spec}: ${why}`),
  Together: ({ family, versions }) =>
    out(
      `  wait  ${family} are not at one newest version (${A.join(versions, ", ")}): none of them moves until they are`
    ),
  Move: ({ name, from, to, files, written }) =>
    out(
      `  ${written ? "moved" : "move "}  ${name} ${from} -> ${to} (${plural(files, "package.json", "package.json files")})`
    ),
  Patched: ({ name, to, appliesTo, folder }) =>
    err(
      `deps:update STOP  ${name} would move to ${to}, and ${folder} holds patches made for ${appliesTo}. Nothing was moved: bun would install ${name} unpatched. Re-make each patch for the new version or drop it (docs/patches.md, "When a patched dependency moves"), then run \`bun run deps:update\` again`
    ),
  Installed: () => out("deps:update  bun install ran: bun.lock and node_modules follow the new versions"),
  InstallFailed: ({ files, output }) =>
    err(
      `deps:update FAIL  bun install did not finish, so the ${files} files written (the package.json files, what version-sync brought along, bun.lock) are put back as they were. node_modules may be half installed: \`bun install\` puts it back. Fix what bun said, then run \`bun run deps:update\` again. bun said:\n${output}`
    ),
  Synced: ({ line }) => line
})

const blocks = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "catalog"] as const

/**
 * Every place a `package.json` asks for a dependency, from its text.
 *
 * @category rules
 */
export const asksIn =
  (file: string) =>
  (text: string): ReadonlyArray<Ask> =>
    A.flatMap(blocks, (block) =>
      O.match(objectOf(block)(text), {
        onNone: () => A.empty<Ask>(),
        onSome: (found) => {
          const strings = stringsIn(found)(text)
          // Inside a block of names and versions the strings alternate: a name, then how it is written.
          return A.flatMap(A.chunksOf(strings, 2), (pair) => {
            const name = pair[0]
            const spec = pair[1]
            return name === undefined || spec === undefined
              ? []
              : [{ file, name: name.value, spec, line: lineAt(text)(spec.start) }]
          })
        }
      })
    )

/**
 * What `deps update` needs from the package manager: the registry's newest version of a dependency (none when it has
 * no such package), and an install that brings the lockfile and `node_modules` to what the files now say. A test
 * gives its own, so it asks no registry and installs nothing.
 */
export interface PackageManager {
  readonly newest: (name: string) => Effect.Effect<O.Option<string>, RepoError, Repo>
  readonly install: Effect.Effect<{ readonly code: number; readonly output: string }, RepoError, Repo>
}

/**
 * bun: `bun info <name> version` asks the registry it is configured for, `bun install` installs.
 *
 * @category rules
 */
export const bun: PackageManager = {
  newest: Effect.fn("Deps.bun.newest")(function* (name: string) {
    const repo = yield* Repo
    const answer = yield* repo.run("bun", ["info", name, "version"])
    const version = Str.trim(answer.stdout)
    return answer.code === 0 && O.isSome(versionOf(version)) ? O.some(version) : O.none<string>()
  }),
  install: Effect.gen(function* () {
    const repo = yield* Repo
    const answer = yield* repo.run("bun", ["install"])
    return { code: answer.code, output: Str.trim(`${answer.stdout}\n${answer.stderr}`) }
  })
}

/**
 * `deps update`: reads every package.json and the held list, asks the registry, and in `write` mode rewrites the
 * versions, installs, and brings the places that repeat a version along.
 *
 * @category rules
 */
export const depsUpdate = Effect.fn("Deps.depsUpdate")(function* (mode: Mode, packages: PackageManager) {
  const repo = yield* Repo
  const workspaces = yield* repo.workspaces
  const files = A.prepend(
    A.map(workspaces, (workspace) => repo.join(workspace.dir, "package.json")),
    repo.join(repo.root, "package.json")
  )
  const perFile = yield* Effect.forEach(
    files,
    Effect.fnUntraced(function* (absolute) {
      const text = yield* repo.text(absolute)
      return asksIn(repo.relative(repo.root, absolute))(text)
    }),
    { concurrency: 1 }
  )
  const asks = A.flatten(perFile)

  const configFile = repo.join(repo.root, ".syncpackrc.json")
  const hasConfig = yield* repo.exists(configFile)
  const configText = hasConfig ? yield* repo.text(configFile) : "{}"
  const config = yield* decodeJsonc(SyncpackFile)(".syncpackrc.json", configText)
  const holds = A.flatMap(config.updateGroups ?? [], (group, index) =>
    group.isIgnored === true
      ? A.map(group.dependencies ?? [], (pattern): Hold => ({
          pattern,
          ...heldBecause(group.label ?? "held in .syncpackrc.json, with no reason written"),
          group: index
        }))
      : []
  )

  const names = toAsk(asks)
  const answers = yield* Effect.forEach(
    names,
    (name) => Effect.map(packages.newest(name), (newest) => O.map(newest, (version) => [name, version] as const)),
    { concurrency: 8 }
  )
  const known = A.getSomes(answers)
  if (names.length > 0 && known.length === 0) {
    return yield* RepoError.make({
      path: "bun info",
      message: `deps:update could not learn the newest version of any of the ${names.length} dependencies it asked about: \`bun info <name> version\` answered for none. Is the registry reachable? Nothing was written`
    })
  }
  const patches = yield* readPatches()
  const patched = A.flatMap(patches.sets, (set) =>
    O.match(headerOf(set), {
      onNone: () => A.empty<PatchedDependency>(),
      onSome: (header) =>
        isKeptFile(header.appliesTo)
          ? []
          : [{ name: header.package, appliesTo: header.appliesTo, folder: `${patchesFolder}/${set.name}` }]
    })
  )
  const plan = depsPlan({ asks, holds, patched, latest: R.fromEntries(known), written: mode === "write" })
  if (mode !== "write" || plan.drifts.length === 0) return plan.findings

  // Every file is written before the one install, so the lockfile is made from what the files finally say: the
  // moves, then what version-sync brings along (the scratchpad, the documents, the pins in code). What each held
  // before is kept, and if the install fails all of it goes back, the lockfile too: a second run then finds the same
  // moves, not a tree half moved.
  const kept = MutableHashMap.empty<string, string>()
  const keep = Effect.fn("Deps.keep")(function* (file: string) {
    const absolute = repo.join(repo.root, file)
    if (MutableHashMap.has(kept, absolute) || !(yield* repo.exists(absolute))) return
    const text = yield* repo.text(absolute)
    MutableHashMap.set(kept, absolute, text)
  })
  yield* keep("bun.lock")
  yield* Effect.forEach(plan.drifts, (drift) => keep(drift.file), { concurrency: 1, discard: true })
  yield* settle(
    { command: "deps:update", repair: "bun run deps:update", mode },
    Plan.make({ checked: asks.length, drifts: plan.drifts, problems: [] })
  )
  const following = yield* versionSyncPlan()
  yield* Effect.forEach(following.drifts, (drift) => keep(drift.file), { concurrency: 1, discard: true })
  const synced = yield* settle(
    { command: "version-sync", repair: "bun run version-sync -- --write", mode: "write" },
    following
  )
  const install = yield* packages.install
  if (install.code !== 0) {
    yield* Effect.forEach(A.fromIterable(kept), ([absolute, text]) => repo.write(absolute, text), {
      concurrency: 1,
      discard: true
    })
    const lines = Str.split("\n")(install.output)
    return A.append<DepsFinding, DepsFinding>(
      plan.findings,
      DepsFinding.cases.InstallFailed.make({
        files: MutableHashMap.size(kept),
        output: A.join(A.takeRight(lines, 12), "\n")
      })
    )
  }
  return A.flatten<ReadonlyArray<ReadonlyArray<DepsFinding>>>([
    plan.findings,
    A.map(synced, (finding: SyncFinding) => DepsFinding.cases.Synced.make({ line: syncSentence(finding) })),
    [DepsFinding.cases.Installed.make({})]
  ])
})
