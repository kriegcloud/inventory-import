/**
 * A version or a date written in more than one place has one source, named here, and every other place is made
 * equal to it.
 *
 * | What | Its one source | The places that follow it |
 * | --- | --- | --- |
 * | bun | `.bun-version` | `packageManager`; a `bun-version:` in a workflow; "Bun 1.2.3" in the standing documents |
 * | Node | `engines.node` of the root's package.json (its major) | `node-version:` in every workflow; "Node 22 or newer" in the documents; the major of every `@types/node` (a problem, since only the registry knows the newest of a major) |
 * | Effect | the `effect` every package.json states (the root's `catalog` when there is one) | every `@effect/*` package that is released with it; "Effect 4.1" and "effect 4.1.4" in the documents; the versions `vendor sync` writes into a vendored package |
 * | `@effect/tsgo`, TypeScript, Better Auth | the one version the package.json files state | their name followed by a version in the documents |
 * | Alchemy | `alchemy` in the package.json files; `vendor/alchemy/sources.json` when the packages are kept as files | every `@alchemy.run/*` dependency; with kept files, each dependency's `<version>-<commit>` and each override's file |
 * | the Cloudflare compatibility date | the app's `wrangler.jsonc` | every other `wrangler*.jsonc`; `compatibility: { date }` in a package that declares `alchemy` |
 * | a GitHub action's version | `.github/workflows/ci.yml` | the same action in every other workflow |
 * | the CLI's version | its package.json | `version` in its `src/bin.ts` |
 * | the Effect language service's schema | the installed `@effect/tsgo` | a `$schema` that names the library's repository instead |
 *
 * The standing documents are `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/` (its evidence folders `docs/qa` and
 * `docs/session` left out) and `.claude/agents`. A version is read only after its own name, and after a name written
 * small only when it is whole: "Effect 4.1" and "effect 4.1.4" are versions, "no effect 1.5 s later" is not. `explorations/`, `goals/` and the root's `DECISIONS.md` are records
 * of what was true when they were written, and are never rewritten.
 *
 * Two sources that disagree (a package at another `effect` than the rest) are a problem the command names and does
 * not repair: `deps:lint` says which package, and a person decides which version is meant.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Repo, type Workspace } from "../../Repo.service.ts"
import {
  blankComments,
  decodeJsonc,
  type Found,
  type FoundBlock,
  lineAt,
  literally,
  entriesOf,
  objectOf,
  stringValues
} from "../../Sync.rules.ts"
import { Drift, mergePlans, type Mode, Plan, Problem, settle } from "../../Sync.schema.ts"

const $I = $RepoCliId.create("commands/VersionSync/VersionSync.rules")

const versions = S.Record(S.String, S.String)

/**
 * The parts of a `package.json` a version is read from.
 *
 * @category schemas
 */
export class VersionedPackage extends S.Class<VersionedPackage, { readonly brand: unique symbol }>(
  $I`VersionedPackage`
)(
  {
    name: S.optionalKey(S.String).pipe(S.annotateKey({ description: "The package's name" })),
    version: S.optionalKey(S.String).pipe(S.annotateKey({ description: "The package's own version" })),
    engines: S.Struct({ node: S.optionalKey(S.String) }).pipe(
      S.optionalKey,
      S.annotateKey({ description: "The runtimes it needs: the root states the oldest Node" })
    ),
    dependencies: S.optionalKey(versions).pipe(S.annotateKey({ description: "Run-time dependencies" })),
    devDependencies: S.optionalKey(versions).pipe(S.annotateKey({ description: "Development dependencies" })),
    peerDependencies: S.optionalKey(versions).pipe(S.annotateKey({ description: "Peer dependencies" })),
    optionalDependencies: S.optionalKey(versions).pipe(S.annotateKey({ description: "Optional dependencies" })),
    catalog: S.optionalKey(versions).pipe(
      S.annotateKey({ description: "The root's catalog, when versions are kept there once" })
    )
  },
  $I.annote("VersionedPackage", { description: "A package.json's own version, its Node and the versions it asks for" })
) {}

/**
 * The record of the Alchemy packages kept as files: the commit they were built from, and each package's version and
 * file.
 *
 * @category schemas
 */
export class KeptPackages extends S.Class<KeptPackages, { readonly brand: unique symbol }>($I`KeptPackages`)(
  {
    commit: S.String.pipe(S.annotateKey({ description: "The commit of the library the files were built from" })),
    packages: S.Array(
      S.Struct({
        package: S.String.pipe(S.annotateKey({ description: "The package's name" })),
        version: S.String.pipe(S.annotateKey({ description: "The version its own package.json states" })),
        file: S.String.pipe(S.annotateKey({ description: "Its file, beside the record" }))
      })
    ).pipe(S.annotateKey({ description: "The packages kept as files" }))
  },
  $I.annote("KeptPackages", { description: "The commit and files the Alchemy packages are pinned to" })
) {}

/** A file's text with where it is, from the root and on disk. */
interface Text {
  readonly file: string
  readonly absolute: string
  readonly text: string
}

/** A `package.json`, its text and what it says. */
interface PackageText extends Text {
  readonly decoded: VersionedPackage
}

const blocks = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies", "catalog"] as const
const nothing = Plan.make({ checked: 0, drifts: [], problems: [] })
const inside = (block: FoundBlock) => (found: Found) => found.start > block.start && found.end < block.end
const numbered = (spec: string) => Str.replace(/^[\^~<>=\s]+/, "")(spec)
const isRegistryVersion = (spec: string) => !Str.startsWith("workspace:")(spec) && !Str.startsWith("catalog:")(spec)

/**
 * The places of one file where a pattern's capture, which ends the match, states a value, each compared with what
 * belongs there.
 *
 * @category rules
 */
export const places =
  (site: {
    readonly at: Text
    readonly what: string
    readonly expected: (found: string) => string
    /** A match that is not a place after all, from its whole text and what it captured. */
    readonly unless?: (whole: string, found: string) => boolean
  }) =>
  (pattern: RegExp): Plan => {
    const { at, what, expected } = site
    const matches = A.filter(
      A.fromIterable(Str.matchAll(pattern)(withoutComments(at.file)(at.text))),
      (match) => site.unless === undefined || !site.unless(match[0], match[1] ?? "")
    )
    return Plan.make({
      checked: matches.length,
      problems: [],
      drifts: A.flatMap(matches, (match) => {
        const found = match[1] ?? ""
        const end = (match.index ?? 0) + match[0].length
        const wanted = expected(found)
        return found === wanted
          ? []
          : [
              Drift.make({
                file: at.file,
                line: lineAt(at.text)(end - found.length),
                what,
                found,
                expected: wanted,
                start: end - found.length,
                end,
                text: wanted
              })
            ]
      })
    })
  }

/** The packages named `@effect/*` that are not released with `effect`. */
const apart = ["@effect/tsgo", "@effect/language-service"]

/** Whether a dependency is released with `effect`, at its version. */
const movesWithEffect = (name: string): boolean =>
  name === "effect" || (Str.startsWith("@effect/")(name) && !A.contains(apart, name))

/**
 * A file's text with its comments turned into spaces, so a value in a comment is never a place and every offset is
 * the file's own: `//` and `/* *\/` in JSON with comments and in code, `#` to the end of a line in YAML. A document's
 * text is read whole: its sentences are the places.
 *
 * @category rules
 */
export const withoutComments =
  (file: string) =>
  (text: string): string =>
    /\.(jsonc?|[cm]?[jt]sx?)$/.test(file)
      ? blankComments(text)
      : /\.ya?ml$/.test(file)
        ? A.join(
            A.map(Str.split("\n")(text), (line) => {
              const comment = /(^|[ \t])#/.exec(line)
              if (comment === null) return line
              const from = comment.index + (comment[1] ?? "").length
              return `${Str.slice(0, from)(line)}${Str.repeat(line.length - from)(" ")}`
            }),
            "\n"
          )
        : text

/**
 * A name followed by a version in a sentence: "Effect 4.1", "`effect` 4.1.4's source", "Better Auth 1.7.22".
 *
 * @category rules
 */
export const named = (names: ReadonlyArray<string>): RegExp =>
  new RegExp(
    `(?<![\\w@/.-])(?:${A.join(A.map(names, literally), "|")})\`?(?:'s)?\\s+v?(\\d+\\.\\d+(?:\\.\\d+)?(?:-[0-9A-Za-z]+(?:\\.[0-9A-Za-z]+)*)?)(?![\\w])`,
    "g"
  )

/**
 * Two numbers after a name written small ("no effect 1.5 s later") are a figure, not a version: after such a name
 * only a whole version is read.
 */
const aFigure = (whole: string, found: string): boolean => /^[a-z]/.test(whole) && /^\d+\.\d+$/.test(found)

/**
 * A version as precisely as a sentence states it: "4.1" stays two numbers, anything longer is the whole version.
 *
 * @example
 * asWritten("4.2.0")("4.1") // "4.2"
 * asWritten("4.2.0")("4.1.4") // "4.2.0"
 *
 * @category rules
 */
export const asWritten =
  (version: string) =>
  (found: string): string =>
    /^\d+\.\d+$/.test(found) ? A.join(A.take(Str.split(".")(version), 2), ".") : version

/**
 * Compares every place a version or date is repeated with its source, and writes nothing.
 *
 * @category rules
 */
export const versionSyncPlan = Effect.fn("VersionSync.plan")(function* () {
  const repo = yield* Repo
  const read = Effect.fn("VersionSync.read")(function* (absolute: string) {
    const text = yield* repo.text(absolute)
    return { file: repo.relative(repo.root, absolute), absolute, text } satisfies Text
  })
  const readIfThere = Effect.fn("VersionSync.readIfThere")(function* (absolute: string) {
    if (!(yield* repo.exists(absolute))) return O.none<Text>()
    const at = yield* read(absolute)
    return O.some(at)
  })
  const readPackage = Effect.fn("VersionSync.readPackage")(function* (absolute: string) {
    const at = yield* read(absolute)
    const decoded = yield* decodeJsonc(VersionedPackage)(at.file, at.text)
    return { ...at, decoded } satisfies PackageText
  })
  const filesIn = Effect.fn("VersionSync.filesIn")(function* (dir: string, wanted: (name: string) => boolean) {
    const entries = yield* repo.entries(dir)
    return yield* Effect.forEach(
      A.filter(entries, (entry) => !entry.directory && wanted(entry.name)),
      (entry) => read(entry.path),
      { concurrency: 1 }
    )
  })

  const byFolder = Order.mapInput(Order.String, (workspace: Workspace) => workspace.dir)
  const unsorted = yield* repo.workspaces
  const workspaces = A.sort(unsorted, byFolder)
  const rootPackage = yield* readPackage(repo.join(repo.root, "package.json"))
  const workspacePackages = yield* Effect.forEach(
    workspaces,
    (workspace) => readPackage(repo.join(workspace.dir, "package.json")),
    { concurrency: 1 }
  )
  const packages = A.prepend(workspacePackages, rootPackage)

  // The standing documents and the workflows.
  const rootDocuments = yield* filesIn(repo.root, (name) => A.contains(["CLAUDE.md", "AGENTS.md", "README.md"], name))
  const docsDir = repo.join(repo.root, "docs")
  const underDocs = yield* repo.files(docsDir)
  const docsDocuments = yield* Effect.forEach(
    A.filter(underDocs, (file) => {
      const within = repo.relative(docsDir, file)
      return Str.endsWith(".md")(file) && !Str.startsWith("qa/")(within) && !Str.startsWith("session/")(within)
    }),
    read,
    { concurrency: 1 }
  )
  const agentDocuments = yield* filesIn(repo.join(repo.root, ".claude", "agents"), Str.endsWith(".md"))
  const documents = A.flatten([rootDocuments, docsDocuments, agentDocuments])
  const workflowsDir = repo.join(repo.root, ".github", "workflows")
  const workflows = yield* filesIn(workflowsDir, (name) => Str.endsWith(".yml")(name) || Str.endsWith(".yaml")(name))

  /** Every place a package.json asks for a dependency by a registry version. */
  const asked = (name: string) =>
    A.flatMap(packages, (at) =>
      A.flatMap(blocks, (block) =>
        O.match(objectOf(block)(at.text), {
          onNone: () => A.empty<{ readonly at: PackageText; readonly found: Found; readonly block: string }>(),
          onSome: (found) =>
            A.map(
              A.filter(A.filter(stringValues(name)(at.text), inside(found)), (value) => isRegistryVersion(value.value)),
              (value) => ({ at, found: value, block })
            )
        })
      )
    )
  /** The one version the package.json files state for a dependency: the root's catalog first, else what all agree on. */
  const stated = (name: string): { readonly spec: O.Option<string>; readonly problems: ReadonlyArray<Problem> } => {
    const all = asked(name)
    const catalogued = A.findFirst(all, (one) => one.block === "catalog")
    if (O.isSome(catalogued)) return { spec: O.some(catalogued.value.found.value), problems: [] }
    const bySpec = R.toEntries(A.groupBy(all, (one) => one.found.value))
    if (bySpec.length <= 1) return { spec: A.head(A.map(bySpec, ([spec]) => spec)), problems: [] }
    return {
      spec: O.none(),
      problems: [
        Problem.make({
          file: "package.json",
          message: `\`${name}\` is asked for at more than one version (${A.join(
            A.map(bySpec, ([spec, uses]) => `${spec} in ${A.join(A.dedupe(A.map(uses, (use) => use.at.file)), ", ")}`),
            "; "
          )}): nothing can follow it until they agree. \`bun run deps:lint\` names them`
        })
      ]
    }
  }
  // The catalog: a dependency it names has its version there and nowhere else. One written as a version in a
  // package.json beside it would be installed as a second copy, and nothing that follows the catalog would say so.
  const names = O.match(objectOf("catalog")(rootPackage.text), {
    onNone: () => A.empty<string>(),
    onSome: (catalog) => A.map(entriesOf(catalog)(rootPackage.text), ([name]) => name.value)
  })
  const cataloguedPlan = (): Plan => {
    const beside = A.flatMap(names, (name) =>
      A.map(
        A.filter(asked(name), (one) => one.block !== "catalog"),
        (one) => ({ ...one, name })
      )
    )
    return Plan.make({
      checked: names.length,
      problems: [],
      drifts: A.map(beside, ({ at, found, name }) =>
        Drift.make({
          file: at.file,
          line: lineAt(at.text)(found.start),
          what: `\`${name}\`, which the catalog of the root's package.json holds (then \`bun install\`)`,
          found: found.value,
          expected: "catalog:",
          start: found.start,
          end: found.end,
          text: "catalog:"
        })
      )
    })
  }
  // A version that follows another. For a name the catalog holds, only the catalog's own entry follows: a version
  // written beside it is `cataloguedPlan`'s to name, once, with the one thing to write there.
  const following = (name: string, spec: string, what: string): Plan => {
    const held = A.contains(names, name)
    const uses = A.filter(asked(name), (one) => !held || one.block === "catalog")
    return Plan.make({
      checked: uses.length,
      problems: [],
      drifts: A.flatMap(uses, ({ at, found }) =>
        found.value === spec
          ? []
          : [
              Drift.make({
                file: at.file,
                line: lineAt(at.text)(found.start),
                what,
                found: found.value,
                expected: spec,
                start: found.start,
                end: found.end,
                text: spec
              })
            ]
      )
    })
  }
  const inDocuments = (label: string, names: ReadonlyArray<string>, version: string, source: string): Plan =>
    mergePlans(
      A.map(documents, (at) =>
        places({
          at,
          what: `${label}'s version, from ${source}`,
          expected: asWritten(version),
          unless: aFigure
        })(named(names))
      )
    )
  const dependencyNames = A.dedupe(
    A.flatMap(packages, (at) =>
      A.flatMap(
        [
          at.decoded.dependencies,
          at.decoded.devDependencies,
          at.decoded.peerDependencies,
          at.decoded.optionalDependencies
        ],
        (block) => R.keys(block ?? {})
      )
    )
  )

  // bun: `.bun-version`.
  const bunPlan = Effect.fn("VersionSync.bun")(function* () {
    const source = yield* readIfThere(repo.join(repo.root, ".bun-version"))
    if (O.isNone(source)) return nothing
    const version = Str.trim(source.value.text)
    const same = () => version
    return mergePlans(
      A.flatten([
        [
          places({ at: rootPackage, what: "`packageManager`, from .bun-version", expected: same })(
            /"packageManager"\s*:\s*"bun@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?)(?=["+])/g
          )
        ],
        A.map(workflows, (at) =>
          places({ at: at, what: "`bun-version`, from .bun-version", expected: same })(
            /\bbun-version:\s*["']?([\w.-]+)/g
          )
        ),
        [inDocuments("bun", ["Bun", "bun"], version, ".bun-version")]
      ])
    )
  })

  // Node: the oldest the root's package.json allows.
  const nodePlan = (): Plan => {
    const major = O.flatMap(O.fromUndefinedOr(rootPackage.decoded.engines?.node), (range) =>
      O.fromNullishOr(/\d+/.exec(range)?.[0])
    )
    if (O.isNone(major)) return nothing
    const same = () => major.value
    const what = "Node's version, from `engines.node` of the root's package.json"
    // Node's types are for the Node that runs the code: their major is the major `engines.node` names. Which version
    // of that major is newest only the registry knows, so a wrong major is a problem, not a repair.
    const types = asked("@types/node")
    const typesProblems = A.flatMap(types, ({ at, found }) => {
      const typesMajor = /^[\^~]?(\d+)\./.exec(found.value)?.[1]
      return typesMajor === major.value
        ? []
        : [
            Problem.make({
              file: at.file,
              message: `line ${lineAt(at.text)(found.start)}: @types/node ${found.value} is not for Node ${major.value}, which \`engines.node\` and the workflows name: write the newest ${major.value}.x (\`bun info @types/node@${major.value} version\`), then \`bun install\``
            })
          ]
    })
    return mergePlans(
      A.flatten([
        A.map(workflows, (at) =>
          places({ at: at, what: what, expected: same })(/\bnode-version:\s*["']?(\d+(?:\.[\dx]+)*)(?![\w/*])/g)
        ),
        A.map(documents, (at) =>
          places({ at: at, what: what, expected: same })(/\bNode(?:\.js)?\s+(\d+)(?= or newer)/g)
        ),
        [Plan.make({ checked: types.length, drifts: [], problems: typesProblems })]
      ])
    )
  }

  // A dependency whose version is also written in sentences.
  const written = (label: string, name: string, names: ReadonlyArray<string>): Plan => {
    const source = stated(name)
    return O.match(source.spec, {
      onNone: () => Plan.make({ checked: 0, drifts: [], problems: source.problems }),
      onSome: (spec) => inDocuments(label, names, numbered(spec), `the \`${name}\` the package.json files state`)
    })
  }

  // Effect: the packages released with it, the documents, and what `vendor sync` writes.
  const effectPlan = Effect.fn("VersionSync.effect")(function* () {
    const source = stated("effect")
    if (O.isNone(source.spec)) return Plan.make({ checked: 0, drifts: [], problems: source.problems })
    const spec = source.spec.value
    const family = A.filter(dependencyNames, (name) => Str.startsWith("@effect/")(name) && !A.contains(apart, name))
    const cli = A.findFirst(workspaces, (workspace) => workspace.manifest.name === "@beep/repo-cli")
    const vendorSync = yield* O.match(cli, {
      onNone: () => Effect.succeed(O.none<Text>()),
      onSome: (workspace) => readIfThere(repo.join(workspace.dir, "src", "commands", "Vendor", "VendorSync.rules.ts"))
    })
    const pinnedInCode = ["effect", "@effect/vitest", "@effect/platform-node", "@types/node", "vitest"]
    const inVendorSync = O.match(vendorSync, {
      onNone: () => A.empty<Plan>(),
      onSome: (at) =>
        A.map(pinnedInCode, (name) => {
          // An Effect package follows `effect`, as the same plan moves it in every package.json: read from the
          // files before the write, it would lag one run behind.
          const own = movesWithEffect(name) ? { spec: O.some(spec), problems: [] } : stated(name)
          return O.match(own.spec, {
            onNone: () => Plan.make({ checked: 0, drifts: [], problems: own.problems }),
            onSome: (ownSpec) =>
              places({
                at: at,
                what: `the \`${name}\` a vendored package is given, from the package.json files`,
                expected: () => ownSpec
              })(new RegExp(`\\["${literally(name)}",\\s*"([^"]+)(?=")`, "g"))
          })
        })
    })
    // `vendor sync` gives a vendored package type-fest at the version the packages ask for.
    const typeFest = stated("type-fest")
    const typeFestInVendorSync = O.match(vendorSync, {
      onNone: () => A.empty<Plan>(),
      onSome: (at) => [
        O.match(typeFest.spec, {
          onNone: () => Plan.make({ checked: 0, drifts: [], problems: typeFest.problems }),
          onSome: (wanted) =>
            places({
              at,
              what: "the `type-fest` a vendored package is given, from the package.json files",
              expected: () => wanted
            })(/name === "type-fest" \? "([^"]+)(?=")/g)
        })
      ]
    })
    return mergePlans(
      A.flatten([
        A.map(family, (name) => following(name, spec, "an Effect package's version, from `effect`")),
        [inDocuments("Effect", ["Effect", "effect"], numbered(spec), "the `effect` the package.json files state")],
        inVendorSync,
        typeFestInVendorSync
      ])
    )
  })

  // Alchemy: one version for its packages, or the commit and files they are kept at.
  const alchemyPlan = Effect.fn("VersionSync.alchemy")(function* () {
    const record = yield* readIfThere(repo.join(repo.root, "vendor", "alchemy", "sources.json"))
    const family = A.filter(dependencyNames, Str.startsWith("@alchemy.run/"))
    if (O.isNone(record)) {
      const source = stated("alchemy")
      if (O.isNone(source.spec)) return Plan.make({ checked: 0, drifts: [], problems: source.problems })
      const spec = source.spec.value
      return mergePlans(
        A.append(
          A.map(family, (name) => following(name, spec, "an Alchemy package's version, from `alchemy`")),
          inDocuments("Alchemy", ["Alchemy", "alchemy"], numbered(spec), "the `alchemy` the package.json files state")
        )
      )
    }
    const kept = yield* decodeJsonc(KeptPackages)(record.value.file, record.value.text)
    const overrides = objectOf("overrides")(rootPackage.text)
    return mergePlans(
      A.flatMap(kept.packages, (one) => {
        const pinned = following(
          one.package,
          `${one.version}-${kept.commit}`,
          "a kept package's version and commit, from vendor/alchemy/sources.json"
        )
        const file = `file:vendor/alchemy/${one.file}`
        const overridden = O.match(overrides, {
          onNone: () => A.empty<Found>(),
          onSome: (block) => A.filter(stringValues(one.package)(rootPackage.text), inside(block))
        })
        return [
          pinned,
          Plan.make({
            checked: overridden.length,
            problems: [],
            drifts: A.flatMap(overridden, (found) =>
              found.value === file
                ? []
                : [
                    Drift.make({
                      file: rootPackage.file,
                      line: lineAt(rootPackage.text)(found.start),
                      what: "a kept package's override, from vendor/alchemy/sources.json",
                      found: found.value,
                      expected: file,
                      start: found.start,
                      end: found.end,
                      text: file
                    })
                  ]
            )
          })
        ]
      })
    )
  })

  // The Cloudflare compatibility date: the app's wrangler.jsonc.
  const isWrangler = (name: string) => /^wrangler[\w.-]*\.jsonc?$/.test(name)
  const datePlan = Effect.fn("VersionSync.date")(function* () {
    const perWorkspace = yield* Effect.forEach(workspaces, (workspace) => filesIn(workspace.dir, isWrangler), {
      concurrency: 1
    })
    const configs = A.flatten(perWorkspace)
    const stating = A.filter(configs, (at) => stringValues("compatibility_date")(at.text).length > 0)
    const source = O.orElse(
      A.findFirst(stating, (at) => Str.startsWith("apps/")(at.file) && Str.endsWith("/wrangler.jsonc")(at.file)),
      () => A.head(stating)
    )
    if (O.isNone(source)) return nothing
    const date = A.head(stringValues("compatibility_date")(source.value.text))
    if (O.isNone(date)) return nothing
    const same = () => date.value.value
    const what = `the compatibility date, from ${source.value.file}`
    const stacks = yield* Effect.forEach(
      A.filter(workspacePackages, (at) =>
        R.has({ ...at.decoded.dependencies, ...at.decoded.devDependencies }, "alchemy")
      ),
      Effect.fnUntraced(function* (at) {
        const sources = yield* repo.files(repo.join(repo.dirname(at.absolute), "src"))
        return yield* Effect.forEach(A.filter(sources, Str.endsWith(".ts")), read, { concurrency: 1 })
      }),
      { concurrency: 1 }
    )
    return mergePlans(
      A.appendAll(
        A.map(
          A.filter(stating, (at) => at.file !== source.value.file),
          (at) => places({ at: at, what: what, expected: same })(/"compatibility_date"\s*:\s*"([^"]+)(?=")/g)
        ),
        A.map(A.flatten(stacks), (at) =>
          places({ at: at, what: what, expected: same })(/\bcompatibility:\s*\{\s*date:\s*"([^"]+)(?=")/g)
        )
      )
    )
  })

  // A GitHub action: the version the check's workflow uses.
  // An action pinned by a commit is left alone: its version comment would go stale, and a commit is a choice.
  const uses = /\buses:\s*([\w./-]+)@(?![0-9a-f]{40}\b)([\w.-]+)/g
  const actionsPlan = (): Plan => {
    const source = A.findFirst(workflows, (at) => Str.endsWith("/ci.yml")(at.file))
    if (O.isNone(source)) return nothing
    const pinned = R.fromEntries(
      A.map(A.fromIterable(Str.matchAll(uses)(source.value.text)), (match) => [match[1] ?? "", match[2] ?? ""] as const)
    )
    return mergePlans(
      A.flatMap(
        A.filter(workflows, (at) => at.file !== source.value.file),
        (at: Text) =>
          A.map(R.toEntries(pinned), ([action, version]) =>
            places({ at: at, what: `${action}'s version, from ${source.value.file}`, expected: () => version })(
              new RegExp(`\\buses:\\s*${literally(action)}@(?![0-9a-f]{40}\\b)([\\w.-]+)`, "g")
            )
          )
      )
    )
  }

  // The CLI's version, and the Effect language service's schema.
  const cliPlan = Effect.fn("VersionSync.cli")(function* () {
    const own = A.findFirst(workspacePackages, (at) => at.decoded.name === "@beep/repo-cli")
    if (O.isNone(own)) return nothing
    const version = O.fromUndefinedOr(own.value.decoded.version)
    const entry = yield* readIfThere(repo.join(repo.dirname(own.value.absolute), "src", "bin.ts"))
    if (O.isNone(version) || O.isNone(entry)) return nothing
    return places({
      at: entry.value,
      what: `the CLI's version, from ${own.value.file}`,
      expected: () => version.value
    })(/\bversion:\s*"([^"]+)(?=")/g)
  })
  const schemaPlan = Effect.fn("VersionSync.schema")(function* () {
    const installed = repo.join(repo.root, "node_modules", "@effect", "tsgo", "schema.json")
    if (!(yield* repo.exists(installed))) return nothing
    const dirs = A.prepend(
      A.map(workspaces, (workspace) => workspace.dir),
      repo.root
    )
    const perDir = yield* Effect.forEach(
      dirs,
      (dir) => filesIn(dir, (name) => Str.startsWith("tsconfig")(name) && Str.endsWith(".json")(name)),
      { concurrency: 1 }
    )
    return mergePlans(
      A.map(A.flatten<ReadonlyArray<ReadonlyArray<Text>>>(perDir), (at) => {
        const relative = repo.relative(repo.dirname(at.absolute), installed)
        const local = Str.startsWith(".")(relative) ? relative : `./${relative}`
        return places({
          at: at,
          what: "the Effect language service's schema, from the installed @effect/tsgo",
          expected: () => local
        })(/"\$schema"\s*:\s*"(https:\/\/raw\.githubusercontent\.com\/Effect-TS\/tsgo\/[^"]+)(?=")/g)
      })
    )
  })

  const bun = yield* bunPlan()
  const effect = yield* effectPlan()
  const alchemy = yield* alchemyPlan()
  const date = yield* datePlan()
  const cli = yield* cliPlan()
  const schema = yield* schemaPlan()
  return mergePlans([
    bun,
    nodePlan(),
    cataloguedPlan(),
    effect,
    written("@effect/tsgo", "@effect/tsgo", ["@effect/tsgo"]),
    written("TypeScript", "typescript", ["TypeScript", "typescript"]),
    written("Better Auth", "better-auth", ["Better Auth", "better-auth"]),
    alchemy,
    date,
    actionsPlan(),
    cli,
    schema
  ])
})

/**
 * `version-sync`: plans, then names, writes or lists what differs, as the mode asks.
 *
 * @category rules
 */
export const versionSync = Effect.fn("VersionSync.versionSync")(function* (mode: Mode) {
  const plan = yield* versionSyncPlan()
  return yield* settle({ command: "version-sync", repair: "bun run version-sync -- --write", mode }, plan)
})
