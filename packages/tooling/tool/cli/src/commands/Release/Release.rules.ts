/**
 * Cuts a release, as Benjamin decided (2026-11-22, "releases and deploys"): work lands on `main`; a release is a
 * branch `release/<major>.<minor>` cut from `main`, and a tag `v<major>.<minor>.<patch>` on that branch is what
 * deploys production. A fix to a released version lands on `main` first and is cherry-picked onto its branch, then
 * tagged with the next patch. One version, the app's (`apps/inventory/package.json`); the packages are internal.
 *
 * Must not break: a tag is made only on a `release/*` branch whose major and minor are the tag's; a version only goes
 * up; nothing is made on a tree with changes or after a red check; a patch carries only commits already on `main`.
 * It never pushes: it prints the two commands that do.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Order from "effect/Order"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Release/Release.rules")

/** The file that holds the app's version. */
export const versionFile = "apps/inventory/package.json"

/** The file the release notes are written to, newest first. */
export const notesFile = "CHANGELOG.md"

/**
 * Which part of the version a release moves: a major or a minor release cuts a new branch from `main`; a patch is
 * tagged on the release branch it is run on.
 *
 * @category schemas
 */
export const ReleaseKind = LiteralKit(["major", "minor", "patch"]).pipe(
  $I.annoteSchema("ReleaseKind", { description: "Which part of the version a release moves" })
)

/**
 * The decoded value of `ReleaseKind`.
 *
 * @category models
 */
export type ReleaseKind = typeof ReleaseKind.Type

/**
 * A version, `<major>.<minor>.<patch>`.
 *
 * @category models
 */
export interface Version {
  readonly major: number
  readonly minor: number
  readonly patch: number
}

/**
 * A version from its text, with or without the tag's `v`.
 *
 * @example versionOf("v0.7.1") // O.some({ major: 0, minor: 7, patch: 1 })
 * @example versionOf("0.7") // O.none()
 */
export const versionOf = (text: string): O.Option<Version> =>
  O.map(Str.match(/^v?(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/)(Str.trim(text)), (found) => ({
    major: Number(found[1]),
    minor: Number(found[2]),
    patch: Number(found[3])
  }))

/** A version as it is written, without the `v`. */
export const written = (version: Version) => `${version.major}.${version.minor}.${version.patch}`

/** The branch a version is released from. */
export const branchOf = (version: Version) => `release/${version.major}.${version.minor}`

/** The order of versions, lowest first. */
const byVersion: Order.Order<Version> = Order.combineAll([
  Order.mapInput(Order.Number, (version: Version) => version.major),
  Order.mapInput(Order.Number, (version: Version) => version.minor),
  Order.mapInput(Order.Number, (version: Version) => version.patch)
])

/**
 * The next version: a major or a minor release after the highest version anywhere; a patch after the highest on its
 * own branch.
 *
 * @example next({ kind: "minor", from: { major: 0, minor: 6, patch: 1 } }) // { major: 0, minor: 7, patch: 0 }
 */
export const next = (input: { readonly kind: ReleaseKind; readonly from: Version }): Version =>
  ReleaseKind.match(input.kind, {
    major: () => ({ major: input.from.major + 1, minor: 0, patch: 0 }),
    minor: () => ({ major: input.from.major, minor: input.from.minor + 1, patch: 0 }),
    patch: () => ({ major: input.from.major, minor: input.from.minor, patch: input.from.patch + 1 })
  })

/**
 * The major and minor a release branch is for, when the branch is one.
 *
 * @example releaseLineOf("release/0.7") // O.some({ major: 0, minor: 7 })
 * @example releaseLineOf("main") // O.none()
 */
export const releaseLineOf = (branch: string): O.Option<{ readonly major: number; readonly minor: number }> =>
  O.map(Str.match(/^release\/(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/)(branch), (found) => ({
    major: Number(found[1]),
    minor: Number(found[2])
  }))

/** The commit kinds the notes name, in the order they are listed. */
const sections: ReadonlyArray<readonly [string, string]> = [
  ["feat", "Added"],
  ["fix", "Fixed"],
  ["perf", "Faster"],
  ["refactor", "Changed underneath"],
  ["docs", "Documents"],
  ["test", "Tests"],
  ["chore", "Upkeep"]
]

/**
 * The release notes from the subjects of the commits since the last release, grouped by their conventional type. A
 * subject that has none is listed under "Other"; a merge's subject is left out (its commits are listed).
 *
 * @example notesOf({ tag: "v0.7.0", date: "2026-11-22", subjects: ["feat: a staging stage", "fix(ui): the key"] })
 * // "## v0.7.0 — 2026-11-22\n\nAdded\n\n- a staging stage\n\nFixed\n\n- the key\n"
 */
export const notesOf = (input: {
  readonly tag: string
  readonly date: string
  readonly subjects: ReadonlyArray<string>
}): string => {
  const kept = A.filter(input.subjects, (subject) => !Str.startsWith("Merge ")(subject))
  const typed = A.map(kept, (subject) =>
    O.match(Str.match(/^([a-z]+)(?:\([^)]*\))?!?: (.+)$/)(subject), {
      onNone: () => ({ type: "other", text: subject }),
      onSome: (found) => ({ type: `${found[1]}`, text: `${found[2]}` })
    })
  )
  const known = A.map(sections, ([type]) => type)
  const groups = A.append(
    A.map(sections, ([type, title]) => [title, A.filter(typed, (one) => one.type === type)] as const),
    ["Other", A.filter(typed, (one) => !A.contains(known, one.type))] as const
  )
  const listed = A.filter(groups, ([, commits]) => A.isReadonlyArrayNonEmpty(commits))
  const body = A.isReadonlyArrayNonEmpty(listed)
    ? A.join(
        A.map(
          listed,
          ([title, commits]) =>
            `${title}\n\n${A.join(
              A.map(commits, (one) => `- ${one.text}`),
              "\n"
            )}\n`
        ),
        "\n"
      )
    : "Nothing but the version.\n"
  return `## ${input.tag} — ${input.date}\n\n${body}`
}

/**
 * What `release` finds: the release it made, or why it made none.
 *
 * @category schemas
 */
export const ReleaseFinding = S.TaggedUnion({
  Released: {
    tag: S.String.pipe(S.annotateKey({ description: "The annotated tag made, v<major>.<minor>.<patch>" })),
    branch: S.String.pipe(S.annotateKey({ description: "The release branch it is on" })),
    cut: S.Boolean.pipe(S.annotateKey({ description: "Whether the branch was made by this run" }))
  },
  Dirty: {
    files: S.Array(S.String).pipe(S.annotateKey({ description: "The files with changes not committed" }))
  },
  WrongBranch: {
    branch: S.String.pipe(S.annotateKey({ description: "The branch the command was run on" })),
    kind: ReleaseKind.pipe(S.annotateKey({ description: "The release asked for" }))
  },
  NotHigher: {
    version: S.String.pipe(S.annotateKey({ description: "The version the release would have" })),
    highest: S.String.pipe(S.annotateKey({ description: "The highest version already released" }))
  },
  NoPatchBase: {
    branch: S.String.pipe(S.annotateKey({ description: "The release branch, with no tag of its own yet" }))
  },
  NothingNew: {
    tag: S.String.pipe(S.annotateKey({ description: "The last tag on the branch, which HEAD already is" }))
  },
  NotOnMain: {
    commits: S.Array(S.String).pipe(S.annotateKey({ description: "Each commit as its short hash and subject" }))
  },
  CheckFailed: {
    code: S.Int.pipe(S.annotateKey({ description: "What `bun run check:full` exited with" }))
  },
  GitFailed: {
    step: S.String.pipe(S.annotateKey({ description: "What git was asked to do" })),
    said: S.String.pipe(S.annotateKey({ description: "What git said" }))
  }
}).pipe($I.annoteSchema("ReleaseFinding", { description: "The release made, or why none was" }))

/**
 * The decoded value of `ReleaseFinding`.
 *
 * @category models
 */
export type ReleaseFinding = typeof ReleaseFinding.Type

const refused = (lines: ReadonlyArray<string>): Line =>
  err(
    A.join(
      A.map(lines, (one, n) => (n === 0 ? `release FAIL  ${one}` : `  ${one}`)),
      "\n"
    )
  )

/**
 * What each finding prints: one line, several for a list.
 *
 * @category rendering
 */
export const releaseSentence: (finding: ReleaseFinding) => Line = ReleaseFinding.match({
  Released: ({ branch, cut, tag }) =>
    out(
      A.join(
        [
          `release OK  ${tag} is tagged on ${branch}${cut ? ", a new branch from main" : ""}. Nothing was pushed.`,
          "  Push the branch, then the tag. The tag deploys production once the production environment's reviewer approves:",
          `  git push origin ${branch}`,
          `  git push origin ${tag}`
        ],
        "\n"
      )
    ),
  Dirty: ({ files }) =>
    refused(["the tree has changes not committed, so nothing was made: commit them or set them aside first", ...files]),
  WrongBranch: ({ branch, kind }) =>
    refused([
      kind === "patch"
        ? `a patch is tagged on its release branch (release/<major>.<minor>), and this is ${branch}: switch to it`
        : `a ${kind} release is cut from main, and ${branch} is not where main is: run it on main, with no release branch of that version left behind`
    ]),
  NotHigher: ({ highest, version }) =>
    refused([`v${version} is not above v${highest}, already released: a version only goes up`]),
  NoPatchBase: ({ branch }) =>
    refused([
      `${branch} has no release tag yet, so there is nothing to patch: its first release is a minor or major one`
    ]),
  NothingNew: ({ tag }) =>
    refused([`nothing has landed on this branch since ${tag}: cherry-pick a fix from main first`]),
  NotOnMain: ({ commits }) =>
    refused([
      "a patch carries only fixes already on main, and these are not (land each on main, then `git cherry-pick -x` it here):",
      ...commits
    ]),
  CheckFailed: ({ code }) =>
    refused([
      `\`bun run check:full\` failed (exit ${code}), so nothing was made: a release is cut only from a green check`
    ]),
  GitFailed: ({ said, step }) => refused([`git could not ${step}: ${said}`])
})

/**
 * The check a release must pass, run on the tree it would tag. A test gives its own, so it runs nothing.
 *
 * @category services
 */
export interface ReleaseCheck {
  readonly run: Effect.Effect<number, RepoError, Repo>
}

/**
 * `bun run check:full`, from the root, its output shown as it runs.
 *
 * @category rules
 */
export const checkFull: ReleaseCheck = {
  run: Effect.gen(function* () {
    const repo = yield* Repo
    const answer = yield* repo.run("bun", ["run", "check:full"])
    yield* Effect.logInfo(Str.trim(`${answer.stdout}\n${answer.stderr}`))
    return answer.code
  })
}

/**
 * A release that stopped, with the finding that says why. Each guard fails with one; `release` turns it into what it
 * prints, so nothing after a refused guard runs.
 *
 * @category errors
 */
export class ReleaseStopped extends S.TaggedError<ReleaseStopped, { readonly brand: unique symbol }>(
  $I`ReleaseStopped`
)(
  "ReleaseStopped",
  { finding: ReleaseFinding.pipe(S.annotateKey({ description: "Why the release stopped" })) },
  $I.annoteError<ReleaseStopped>("ReleaseStopped", { description: "A release that a guard stopped" })
) {}

const stop = (finding: ReleaseFinding) => Effect.fail(ReleaseStopped.make({ finding }))

/** One git step: what it printed, or a stop that says what git said. */
const git = Effect.fn("Release.git")(function* (step: string, args: ReadonlyArray<string>) {
  const repo = yield* Repo
  const answer = yield* repo.run("git", args)
  if (answer.code !== 0) {
    return yield* stop(ReleaseFinding.cases.GitFailed.make({ step, said: Str.trim(answer.stderr) }))
  }
  return Str.trim(answer.stdout)
})

/** Whether git answers yes (exit 0) to a question. */
const holds = Effect.fn("Release.holds")(function* (args: ReadonlyArray<string>) {
  const repo = yield* Repo
  const answer = yield* repo.run("git", args)
  return answer.code === 0
})

/** The lines of git's answer, none for an empty one. */
const linesOf = (text: string) => A.filter(Str.split("\n")(text), Str.isNonEmpty)

/** One release tag git knows, with its version. */
interface Tagged {
  readonly tag: string
  readonly version: Version
}

/** The release tags git knows, each with its version. */
const releaseTags = Effect.gen(function* () {
  const listed = yield* git("list the tags", ["tag", "--list", "v*"])
  return A.flatMap(linesOf(listed), (tag): ReadonlyArray<Tagged> =>
    O.match(versionOf(tag), { onNone: () => [], onSome: (version) => [{ tag, version }] })
  )
})

/** The highest of some versions, if any. */
const highest = (versions: ReadonlyArray<Version>): O.Option<Version> =>
  A.reduce(versions, O.none<Version>(), (best, one) =>
    O.isSome(best) && Order.isGreaterThanOrEqualTo(byVersion)(best.value, one) ? best : O.some(one)
  )

/** The app's version file with another version, every other byte as it was. */
const withVersion = (text: string, version: Version) =>
  Str.replace(/("version"\s*:\s*")[^"]*(")/, `$1${written(version)}$2`)(text)

/** The version the app's file says, if it says one. */
const versionInFile = (text: string): O.Option<Version> =>
  O.flatMap(Str.match(/"version"\s*:\s*"([^"]*)"/)(text), (found) => versionOf(`${found[1]}`))

/** What a release will make: its version, its branch, whether it cuts that branch, and where its notes start. */
interface Planned {
  readonly version: Version
  readonly branch: string
  readonly cut: boolean
  readonly since: string
}

/** A major or a minor release, from `main`: the next version after the highest anywhere, on a new branch. */
const fromMain = Effect.fn("Release.fromMain")(function* (
  branch: string,
  kind: ReleaseKind,
  everything: ReadonlyArray<Version>,
  tags: ReadonlyArray<Tagged>
) {
  if (branch !== "main") return yield* stop(ReleaseFinding.cases.WrongBranch.make({ branch, kind }))
  const version = next({ kind, from: O.getOrElse(highest(everything), () => ({ major: 0, minor: 0, patch: 0 })) })
  const target = branchOf(version)
  // A branch left by a run that stopped is taken up again when it is still exactly where main is.
  const exists = yield* holds(["rev-parse", "--verify", "--quiet", `refs/heads/${target}`])
  if (exists) {
    const behind = yield* holds(["merge-base", "--is-ancestor", target, "HEAD"])
    const ahead = yield* holds(["merge-base", "--is-ancestor", "HEAD", target])
    if (!behind || !ahead) return yield* stop(ReleaseFinding.cases.WrongBranch.make({ branch: target, kind }))
  }
  // The notes start where main left the last release's branch: that branch's tags are not on main.
  const last = highest(A.map(tags, (one) => one.version))
  const since = O.isSome(last)
    ? `${yield* git("find where the last release left main", ["merge-base", "HEAD", `v${written(last.value)}`])}..HEAD`
    : "HEAD"
  const planned: Planned = { version, branch: target, cut: !exists, since }
  return planned
})

/**
 * A patch, on the release branch it is run on: the next patch after that branch's last tag, made only of commits
 * already on `main` (`git cherry` compares each commit's change, not its hash, so a cherry-pick counts).
 */
const onReleaseBranch = Effect.fn("Release.onReleaseBranch")(function* (branch: string, tags: ReadonlyArray<Tagged>) {
  const line = releaseLineOf(branch)
  if (O.isNone(line)) return yield* stop(ReleaseFinding.cases.WrongBranch.make({ branch, kind: "patch" }))
  const own = highest(
    A.flatMap(tags, (one) =>
      one.version.major === line.value.major && one.version.minor === line.value.minor ? [one.version] : []
    )
  )
  if (O.isNone(own)) return yield* stop(ReleaseFinding.cases.NoPatchBase.make({ branch }))
  const lastTag = `v${written(own.value)}`
  const since = yield* git("list the commits since the last tag", ["rev-list", `${lastTag}..HEAD`])
  if (A.isReadonlyArrayEmpty(linesOf(since))) {
    return yield* stop(ReleaseFinding.cases.NothingNew.make({ tag: lastTag }))
  }
  const cherry = yield* git("compare the branch with main", ["cherry", "-v", "main", "HEAD", lastTag])
  const missing = A.flatMap(linesOf(cherry), (one) => (Str.startsWith("+ ")(one) ? [Str.slice(2)(one)] : []))
  if (A.isReadonlyArrayNonEmpty(missing)) {
    return yield* stop(ReleaseFinding.cases.NotOnMain.make({ commits: missing }))
  }
  const planned: Planned = {
    version: next({ kind: "patch", from: own.value }),
    branch,
    cut: false,
    since: `${lastTag}..HEAD`
  }
  return planned
})

/**
 * Cuts a release: a major or minor one from `main` (on a new branch), a patch on the release branch it is run on. It
 * runs the check on the tree it would tag, then bumps the app's version, writes the notes, commits and makes an
 * annotated tag. Nothing is pushed.
 *
 * @category rules
 */
export const release = Effect.fn("Release.release")(function* (kind: ReleaseKind, check: ReleaseCheck) {
  const repo = yield* Repo
  const steps = Effect.gen(function* () {
    const status = yield* git("read the tree's state", ["status", "--porcelain"])
    const changed = linesOf(status)
    if (A.isReadonlyArrayNonEmpty(changed)) {
      return yield* stop(
        ReleaseFinding.cases.Dirty.make({ files: A.map(changed, (one) => Str.replace(/^\s*\S+\s+/, "")(one)) })
      )
    }
    const branch = yield* git("name the branch", ["rev-parse", "--abbrev-ref", "HEAD"])
    const tags = yield* releaseTags
    const appText = yield* repo.text(repo.join(repo.root, versionFile))
    const everything = A.appendAll(
      A.fromOption(versionInFile(appText)),
      A.map(tags, (one) => one.version)
    )
    const planned = yield* ReleaseKind.match(kind, {
      major: () => fromMain(branch, kind, everything, tags),
      minor: () => fromMain(branch, kind, everything, tags),
      patch: () => onReleaseBranch(branch, tags)
    })

    // The tag goes only on a release branch whose major and minor are its own.
    const line = releaseLineOf(planned.branch)
    const matches = O.exists(line, (one) => one.major === planned.version.major && one.minor === planned.version.minor)
    if (!matches) return yield* stop(ReleaseFinding.cases.WrongBranch.make({ branch: planned.branch, kind }))
    // A version only goes up: above every release for a major or minor one, above its own line's for a patch.
    const compared =
      kind === "patch"
        ? A.filter(everything, (one) => one.major === planned.version.major && one.minor === planned.version.minor)
        : everything
    const top = highest(compared)
    if (O.isSome(top) && !Order.isGreaterThan(byVersion)(planned.version, top.value)) {
      return yield* stop(
        ReleaseFinding.cases.NotHigher.make({ version: written(planned.version), highest: written(top.value) })
      )
    }

    // The check runs on the tree it would tag, before anything is made.
    const code = yield* check.run
    if (code !== 0) return yield* stop(ReleaseFinding.cases.CheckFailed.make({ code }))

    const tag = `v${written(planned.version)}`
    yield* git(
      `switch to ${planned.branch}`,
      planned.cut ? ["switch", "-c", planned.branch] : ["switch", planned.branch]
    )
    const subjects = yield* git("read the commits since the last release", ["log", "--format=%s", planned.since])
    const date = yield* Effect.map(DateTime.now, DateTime.formatIsoDateUtc)
    const notes = notesOf({ tag, date, subjects: linesOf(subjects) })
    yield* repo.write(repo.join(repo.root, versionFile), withVersion(appText, planned.version))
    const notesPath = repo.join(repo.root, notesFile)
    const before = (yield* repo.exists(notesPath)) ? yield* repo.text(notesPath) : "# Releases\n"
    const [heading, ...rest] = Str.split("\n")(before)
    const older = Str.trim(A.join(rest, "\n"))
    yield* repo.write(notesPath, `${heading}\n\n${notes}${Str.isNonEmpty(older) ? `\n${older}\n` : ""}`)
    yield* git("stage the version and the notes", ["add", versionFile, notesFile])
    yield* git("commit the release", ["commit", "-m", `chore: release ${tag}`])
    yield* git(`make the tag ${tag}`, ["tag", "-a", tag, "-m", `${tag}\n\n${notes}`])
    return A.of<ReleaseFinding>(ReleaseFinding.cases.Released.make({ tag, branch: planned.branch, cut: planned.cut }))
  })
  return yield* steps.pipe(Effect.catchTag("ReleaseStopped", (stopped) => Effect.succeed(A.of(stopped.finding))))
})

/**
 * What `release verify` finds about a tag a deploy was started from: that it may deploy production, or why not.
 *
 * @category schemas
 */
export const TagFinding = S.TaggedUnion({
  MayDeploy: {
    tag: S.String.pipe(S.annotateKey({ description: "The tag, v<major>.<minor>.<patch>" })),
    branch: S.String.pipe(S.annotateKey({ description: "The release branch its commit is on" }))
  },
  NotAVersion: { tag: S.String.pipe(S.annotateKey({ description: "The ref the deploy was started from" })) },
  NotAnnotated: { tag: S.String.pipe(S.annotateKey({ description: "A tag that is not one `release` makes" })) },
  NotOnBranch: {
    tag: S.String.pipe(S.annotateKey({ description: "The tag" })),
    branch: S.String.pipe(S.annotateKey({ description: "The release branch its commit is not on, or that is missing" }))
  },
  OnMain: { tag: S.String.pipe(S.annotateKey({ description: "A tag whose commit is on main" })) }
}).pipe($I.annoteSchema("TagFinding", { description: "Whether a tag may deploy production" }))

/**
 * The decoded value of `TagFinding`.
 *
 * @category models
 */
export type TagFinding = typeof TagFinding.Type

/**
 * What each tag finding prints.
 *
 * @category rendering
 */
export const tagSentence: (finding: TagFinding) => Line = TagFinding.match({
  MayDeploy: ({ branch, tag }) => out(`release verify OK  ${tag} is an annotated release tag on ${branch}`),
  NotAVersion: ({ tag }) =>
    refused([`"${tag}" is not a release tag (v<major>.<minor>.<patch>): only a release tag deploys production`]),
  NotAnnotated: ({ tag }) =>
    refused([`${tag} is a lightweight tag: \`bun run release\` makes an annotated one, and only that deploys`]),
  NotOnBranch: ({ branch, tag }) =>
    refused([`${tag} is not on ${branch}: a release tag deploys only from its own release branch, never from main`]),
  OnMain: ({ tag }) =>
    refused([
      `${tag} is on a commit main holds: main never deploys production, and a release commit is on its release branch only`
    ])
})

/**
 * Whether a tag may deploy production: it is a version, annotated (as `release` makes it), its commit is on the
 * release branch of its major and minor as the remote holds it (`origin/release/<major>.<minor>`), and that commit is
 * not one `main` holds: a release branch is cut from main, so main's commits are on it too, and a release commit,
 * which `release` makes on the branch, never is on main. The deploy job runs
 * this before anything is deployed, so a `v*` tag pushed anywhere else stops there, whatever the trigger matched.
 *
 * @category rules
 */
export const verifyTag = Effect.fn("Release.verifyTag")(function* (tag: string) {
  const repo = yield* Repo
  const version = versionOf(tag)
  if (O.isNone(version) || !Str.startsWith("v")(tag)) {
    return A.of<TagFinding>(TagFinding.cases.NotAVersion.make({ tag }))
  }
  const branch = branchOf(version.value)
  const kind = yield* repo.run("git", ["cat-file", "-t", `refs/tags/${tag}`])
  if (kind.code !== 0 || Str.trim(kind.stdout) !== "tag") {
    return A.of<TagFinding>(TagFinding.cases.NotAnnotated.make({ tag }))
  }
  const onBranch = yield* repo.run("git", [
    "merge-base",
    "--is-ancestor",
    `refs/tags/${tag}^{commit}`,
    `refs/remotes/origin/${branch}`
  ])
  if (onBranch.code !== 0) return A.of<TagFinding>(TagFinding.cases.NotOnBranch.make({ tag, branch }))
  const onMain = yield* repo.run("git", [
    "merge-base",
    "--is-ancestor",
    `refs/tags/${tag}^{commit}`,
    "refs/remotes/origin/main"
  ])
  if (onMain.code === 0) return A.of<TagFinding>(TagFinding.cases.OnMain.make({ tag }))
  return A.of<TagFinding>(TagFinding.cases.MayDeploy.make({ tag, branch }))
})
