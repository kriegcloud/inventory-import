/**
 * Cuts a release, as Benjamin decided (2026-11-22, "releases and deploys"): work lands on `main`; a release is a
 * branch `release/<major>.<minor>` cut from `main`, and a tag `v<major>.<minor>.<patch>` on that branch is what
 * deploys production. A fix to a released version lands on `main` first and is cherry-picked onto its branch, then
 * tagged with the next patch. One version, the app's (`apps/inventory/package.json`); the packages are internal.
 *
 * Must not break: a tag is made only on a `release/*` branch whose major and minor are the tag's; a version only goes
 * up; nothing is made on a tree with changes or after a red check; a major or minor release is cut from `main` exactly
 * as the remote holds it; a patch carries only commits whose change `origin/main` already holds, and no merge. "Main"
 * is always `origin/main`, fetched by the command itself: a local `main` proves nothing about what landed. It never
 * pushes: it prints the commands that do.
 *
 * `release verify`, the production deploy's guard, holds the same rules again on the tagged commit, so a tag made by
 * hand passes only if `release` could have made it.
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
import * as ChildProcess from "effect/process/ChildProcess"
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner"
import { RepoError } from "../../Cli.errors.ts"
import { Repo } from "../../Repo.service.ts"
import { err, type Line, out } from "../../Report.schema.ts"

const $I = $RepoCliId.create("commands/Release/Release.rules")

/** The file that holds the app's version. */
export const versionFile = "apps/inventory/package.json"

/**
 * The file the release notes are written to, newest first. It lives on release branches only (a release commit is
 * never on main): a new line's file starts from the last release's, so it holds every release before its cut.
 */
export const notesFile = "CHANGELOG.md"

/** The lockfile, which repeats the app's version: a release commit moves both, so an install leaves the tree clean. */
export const lockFile = "bun.lock"

/** `main` as the remote holds it: the only main a release is judged against. */
const originMain = "refs/remotes/origin/main"

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

/**
 * The heading over the commits a patch carries that differ from main's (Benjamin's decision of 2026-11-22, "Accept,
 * and name it"): in the notes, the tag's message and what the command and the deploy guard print.
 */
export const pickedTitle = "Picked with changes"

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
  /** Each commit that was picked from main with changes, as the release names it. */
  readonly changed?: ReadonlyArray<string>
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
  const changed = input.changed ?? []
  const picked = A.isReadonlyArrayNonEmpty(changed)
    ? `\n${pickedTitle}\n\n${A.join(
        A.map(changed, (one) => `- ${one}`),
        "\n"
      )}\n`
    : ""
  return `## ${input.tag} — ${input.date}\n\n${body}${picked}`
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
    cut: S.Boolean.pipe(S.annotateKey({ description: "Whether the branch was made by this run" })),
    changed: S.Array(S.String).pipe(
      S.annotateKey({ description: "Each commit picked from main with changes: the approver reads these" })
    )
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
  Merged: {
    commits: S.Array(S.String).pipe(S.annotateKey({ description: "Each merge commit as its short hash and subject" }))
  },
  NotOriginMain: {
    here: S.String.pipe(S.annotateKey({ description: "The commit main is at here, short" })),
    there: S.String.pipe(S.annotateKey({ description: "The commit origin/main is at, short" }))
  },
  Behind: {
    branch: S.String.pipe(S.annotateKey({ description: "The release branch as it is here" })),
    tag: S.String.pipe(S.annotateKey({ description: "The line's last release, which the branch here does not hold" }))
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

/** The lines that name the commits picked with changes, none when there are none. */
const pickedLines = (changed: ReadonlyArray<string>) =>
  A.isReadonlyArrayNonEmpty(changed)
    ? [
        `  ${pickedTitle}: each differs from the commit on main it names, so read it before approving the deploy:`,
        ...A.map(changed, (one) => `    ${one}`)
      ]
    : []

/**
 * What each finding prints: one line, several for a list.
 *
 * @category rendering
 */
export const releaseSentence: (finding: ReleaseFinding) => Line = ReleaseFinding.match({
  Released: ({ branch, changed, cut, tag }) =>
    out(
      A.join(
        [
          `release OK  ${tag} is tagged on ${branch}${cut ? ", a new branch from main" : ""}. Nothing was pushed.`,
          ...pickedLines(changed),
          "  Push the branch and the tag together. Production deploys once CI passes on the branch and the production environment's reviewer approves:",
          `  git push --atomic origin ${branch} ${tag}`
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
      "a patch carries only fixes already on origin/main, and these are not (land each on main, then `git cherry-pick -x` it here):",
      ...commits
    ]),
  Merged: ({ commits }) =>
    refused([
      "a patch is made of cherry-picks, and these are merges, whose changes cannot be compared with main's (take them off the branch, then `git cherry-pick -x` each fix):",
      ...commits
    ]),
  NotOriginMain: ({ here, there }) =>
    refused([
      `main here (${here}) is not where origin/main is (${there}): a release is cut from main as the remote holds it. Pull, or land what is only here through a pull request, then run it again`
    ]),
  Behind: ({ branch, tag }) =>
    refused([`${branch} here does not hold ${tag}, the last release of its line: pull the branch, then run it again`]),
  CheckFailed: ({ code }) =>
    refused([
      `\`bun run check:full\` failed (exit ${code}), so nothing was made: a release is cut only from a green check`
    ]),
  GitFailed: ({ said, step }) => refused([`git could not ${step}: ${said}`])
})

/**
 * The check a release must pass, run on the commit the release is made from, before anything is written. A test gives
 * its own, so it runs nothing.
 *
 * @category services
 */
export interface ReleaseCheck<R = never> {
  readonly run: Effect.Effect<number, RepoError, R>
}

/**
 * `bun run check:full`, from the root. It writes to the terminal the command was started in, as it runs: the check
 * takes a minute or more, and a check that hangs must not look like one that is running.
 *
 * @category rules
 */
export const checkFull: ReleaseCheck<Repo | ChildProcessSpawner.ChildProcessSpawner> = {
  run: Effect.gen(function* () {
    const repo = yield* Repo
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
    const handle = yield* spawner.spawn(
      ChildProcess.make("bun", ["run", "check:full"], { cwd: repo.root, stdout: "inherit", stderr: "inherit" })
    )
    return yield* handle.exitCode
  }).pipe(
    Effect.scoped,
    Effect.mapError((cause) => RepoError.make({ path: "bun", message: `bun could not be run: ${String(cause)}` }))
  )
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

/** The lockfile with the app's version moved, every other byte as it was. */
const lockWithVersion = (text: string, version: Version) =>
  Str.replace(/("apps\/inventory":\s*\{[^{}]*?"version":\s*")[^"]*(")/, `$1${written(version)}$2`)(text)

/** What a release will make: its version, its branch, whether it cuts that branch, and what its notes list. */
interface Planned {
  readonly version: Version
  readonly branch: string
  readonly cut: boolean
  /** The subjects of the commits this release is the first to carry, newest first. */
  readonly subjects: ReadonlyArray<string>
  /** The notes of the releases before it, from the last release's own file when a new line is cut. */
  readonly older: O.Option<string>
  /** Each commit picked from main with changes, as the release names it. */
  readonly changed: ReadonlyArray<string>
}

/** The commits `git cherry -v` marks `+`: the upstream holds no commit with the same change. */
const plusOf = (cherry: string) =>
  A.flatMap(linesOf(cherry), (one) =>
    O.match(Str.match(/^\+ ([0-9a-f]{7,64}) (.*)$/)(one), {
      onNone: () => [],
      onSome: (found) => [{ sha: `${found[1]}`, subject: `${found[2]}` }]
    })
  )

/** A commit's hash as it is printed: its first seven characters. */
const short = (sha: string) => Str.slice(0, 7)(sha)

/**
 * What the commits after `base`, up to `head`, carry that `origin/main` does not hold.
 *
 * - `merges`: `git cherry` never lists a merge, so anything could ride in on one. Always refused.
 * - `missing`: a commit whose change main does not hold and that names no commit of main. Always refused.
 * - `changed`: a commit whose change differs from main's (`git cherry` compares each commit's change, so a pick that
 *   applied as it was is not here) and whose message carries `git cherry-pick -x`'s line naming a commit that is on
 *   `origin/main`. By Benjamin's decision of 2026-11-22 ("Accept, and name it") it counts, and is named wherever
 *   the release is: the fix landed on main first, and what differs is shown to the approver, not hidden.
 */
const beyondMain = Effect.fn("Release.beyondMain")(function* (base: string, head: string) {
  const merges = yield* git("list the merges since the last release", [
    "log",
    "--merges",
    "--format=%h %s",
    `${base}..${head}`
  ])
  const cherry = yield* git("compare the commits with origin/main", ["cherry", "-v", originMain, head, base])
  const judged = yield* Effect.forEach(
    plusOf(cherry),
    Effect.fnUntraced(function* (one) {
      const message = yield* git("read a commit's message", ["log", "-1", "--format=%B", one.sha])
      // The last such line is the pick that made this commit; a commit that cannot be found is not on main.
      const named = A.last(
        A.map(
          A.fromIterable(Str.matchAll(/\(cherry picked from commit ([0-9a-f]{40})\)/g)(message)),
          (found) => `${found[1]}`
        )
      )
      if (O.isNone(named)) return { ...one, from: O.none<string>() }
      const onMain = yield* holds(["merge-base", "--is-ancestor", named.value, originMain])
      return { ...one, from: onMain ? named : O.none<string>() }
    }),
    { concurrency: 1 }
  )
  return {
    merges: linesOf(merges),
    missing: A.flatMap(judged, (one) => (O.isNone(one.from) ? [`${short(one.sha)} ${one.subject}`] : [])),
    changed: A.flatMap(judged, (one) =>
      O.isSome(one.from) ? [`${one.subject} (${short(one.sha)} here, ${short(one.from.value)} on main)`] : []
    )
  }
})

/** A major or a minor release, from `main`: the next version after the highest anywhere, on a new branch. */
const fromMain = Effect.fn("Release.fromMain")(function* (
  branch: string,
  kind: ReleaseKind,
  everything: ReadonlyArray<Version>,
  tags: ReadonlyArray<Tagged>
) {
  if (branch !== "main") return yield* stop(ReleaseFinding.cases.WrongBranch.make({ branch, kind }))
  // Main as the remote holds it, not as it happens to be here: nothing unpushed is released, and nothing is missed.
  const here = yield* git("read where main is", ["rev-parse", "HEAD"])
  const there = yield* git("read where origin/main is", ["rev-parse", "--verify", `${originMain}^{commit}`])
  if (here !== there) {
    return yield* stop(
      ReleaseFinding.cases.NotOriginMain.make({ here: Str.slice(0, 7)(here), there: Str.slice(0, 7)(there) })
    )
  }
  const version = next({ kind, from: O.getOrElse(highest(everything), () => ({ major: 0, minor: 0, patch: 0 })) })
  const target = branchOf(version)
  // A branch left by a run that stopped is taken up again when it is still exactly where main is.
  const exists = yield* holds(["rev-parse", "--verify", "--quiet", `refs/heads/${target}`])
  if (exists) {
    const behind = yield* holds(["merge-base", "--is-ancestor", target, "HEAD"])
    const ahead = yield* holds(["merge-base", "--is-ancestor", "HEAD", target])
    if (!behind || !ahead) return yield* stop(ReleaseFinding.cases.WrongBranch.make({ branch: target, kind }))
  }
  // The notes list what the last release does not carry. Its tag is not on main, and a fix it shipped as a patch is
  // on main under another hash, so the commits are compared by their change: a fix already released is not listed
  // again.
  const last = O.map(highest(A.map(tags, (one) => one.version)), (one) => `v${written(one)}`)
  const listed = O.isSome(last)
    ? yield* git("list what the last release does not carry", ["cherry", "-v", last.value, "HEAD"])
    : yield* git("read the commits", ["log", "--no-merges", "--format=%s", "HEAD"])
  const subjects = O.isSome(last) ? A.reverse(A.map(plusOf(listed), (one) => one.subject)) : linesOf(listed)
  const repo = yield* Repo
  const kept = O.isSome(last) ? yield* repo.run("git", ["show", `${last.value}:${notesFile}`]) : undefined
  const planned: Planned = {
    version,
    branch: target,
    cut: !exists,
    subjects,
    older: kept !== undefined && kept.code === 0 ? O.some(kept.stdout) : O.none(),
    changed: []
  }
  return planned
})

/**
 * A patch, on the release branch it is run on: the next patch after that branch's last tag, which the branch here
 * must hold, made of no merge and only of commits whose change `origin/main` already holds, or that differ from the
 * commit of main their `cherry-pick -x` line names (those are named in the release).
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
  // The tag is the highest git knows, fetched or made here: a branch that was not pulled does not hold it, and a
  // patch tagged there would leave that release's fix out.
  const held = yield* holds(["merge-base", "--is-ancestor", `refs/tags/${lastTag}^{commit}`, "HEAD"])
  if (!held) return yield* stop(ReleaseFinding.cases.Behind.make({ branch, tag: lastTag }))
  const since = yield* git("list the commits since the last tag", ["rev-list", `${lastTag}..HEAD`])
  if (A.isReadonlyArrayEmpty(linesOf(since))) {
    return yield* stop(ReleaseFinding.cases.NothingNew.make({ tag: lastTag }))
  }
  const beyond = yield* beyondMain(lastTag, "HEAD")
  if (A.isReadonlyArrayNonEmpty(beyond.merges)) {
    return yield* stop(ReleaseFinding.cases.Merged.make({ commits: beyond.merges }))
  }
  if (A.isReadonlyArrayNonEmpty(beyond.missing)) {
    return yield* stop(ReleaseFinding.cases.NotOnMain.make({ commits: beyond.missing }))
  }
  const subjects = yield* git("read the commits since the last release", ["log", "--format=%s", `${lastTag}..HEAD`])
  const planned: Planned = {
    version: next({ kind: "patch", from: own.value }),
    branch,
    cut: false,
    subjects: linesOf(subjects),
    older: O.none(),
    changed: beyond.changed
  }
  return planned
})

/**
 * Cuts a release: a major or minor one from `main` (on a new branch), a patch on the release branch it is run on. It
 * fetches from the remote first, holds the guards, runs the check on the commit the release is made from, and only
 * then writes: the app's version, the lockfile's copy of it and the notes, in one commit that changes nothing else
 * (`release verify` holds that), with an annotated tag on it. Nothing is pushed.
 *
 * @category rules
 */
export const release = Effect.fn("Release.release")(function* <R>(kind: ReleaseKind, check: ReleaseCheck<R>) {
  const repo = yield* Repo
  const steps = Effect.gen(function* () {
    const status = yield* git("read the tree's state", ["status", "--porcelain"])
    const changed = linesOf(status)
    if (A.isReadonlyArrayNonEmpty(changed)) {
      return yield* stop(
        ReleaseFinding.cases.Dirty.make({ files: A.map(changed, (one) => Str.replace(/^\s*\S+\s+/, "")(one)) })
      )
    }
    // Main, the release branches and every release tag as the remote holds them now. A fetch that fails stops the
    // release: without it every guard below would judge against whatever was fetched last.
    yield* git("fetch main, the release branches and the tags from origin", ["fetch", "--quiet", "--tags", "origin"])
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
    // A version only goes up: above every release for a major or minor one, above its own line's for a patch. A major
    // or minor version is worked out as the next above all of them, so only a patch can be refused here: when the
    // app's file on the branch already says a version at or above the next patch.
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

    // The check runs on the commit the release is made from, before anything is made.
    const code = yield* check.run
    if (code !== 0) return yield* stop(ReleaseFinding.cases.CheckFailed.make({ code }))

    const tag = `v${written(planned.version)}`
    yield* git(
      `switch to ${planned.branch}`,
      planned.cut ? ["switch", "-c", planned.branch] : ["switch", planned.branch]
    )
    const date = yield* Effect.map(DateTime.now, DateTime.formatIsoDateUtc)
    const notes = notesOf({ tag, date, subjects: planned.subjects, changed: planned.changed })
    yield* repo.write(repo.join(repo.root, versionFile), withVersion(appText, planned.version))
    const lockPath = repo.join(repo.root, lockFile)
    const locked = yield* repo.exists(lockPath)
    if (locked) {
      const lockText = yield* repo.text(lockPath)
      yield* repo.write(lockPath, lockWithVersion(lockText, planned.version))
    }
    const notesPath = repo.join(repo.root, notesFile)
    const onBranch = (yield* repo.exists(notesPath)) ? yield* repo.text(notesPath) : "# Releases\n"
    const before = O.getOrElse(planned.older, () => onBranch)
    const [heading, ...rest] = Str.split("\n")(before)
    const older = Str.trim(A.join(rest, "\n"))
    yield* repo.write(notesPath, `${heading}\n\n${notes}${Str.isNonEmpty(older) ? `\n${older}\n` : ""}`)
    yield* git("stage the version and the notes", ["add", versionFile, notesFile, ...(locked ? [lockFile] : [])])
    yield* git("commit the release", ["commit", "-m", `chore: release ${tag}`])
    yield* git(`make the tag ${tag}`, ["tag", "-a", tag, "-m", `${tag}\n\n${notes}`])
    return A.of<ReleaseFinding>(
      ReleaseFinding.cases.Released.make({ tag, branch: planned.branch, cut: planned.cut, changed: planned.changed })
    )
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
    branch: S.String.pipe(S.annotateKey({ description: "The release branch its commit is on" })),
    changed: S.Array(S.String).pipe(
      S.annotateKey({ description: "Each commit under it picked from main with changes: the approver reads these" })
    )
  },
  NoTag: {
    branch: S.String.pipe(S.annotateKey({ description: "The release branch CI passed on" })),
    commit: S.String.pipe(S.annotateKey({ description: "The commit CI checked, short" }))
  },
  Moved: {
    branch: S.String.pipe(S.annotateKey({ description: "The release branch" })),
    commit: S.String.pipe(S.annotateKey({ description: "The commit CI checked, which is no longer its head, short" }))
  },
  NotAReleaseBranch: { branch: S.String.pipe(S.annotateKey({ description: "The branch CI passed on" })) },
  SeveralTags: {
    commit: S.String.pipe(S.annotateKey({ description: "The commit, short" })),
    tags: S.Array(S.String).pipe(S.annotateKey({ description: "The release tags on it" }))
  },
  NotAVersion: { tag: S.String.pipe(S.annotateKey({ description: "The ref the deploy was started from" })) },
  NotAnnotated: { tag: S.String.pipe(S.annotateKey({ description: "A tag that is not one `release` makes" })) },
  NotOnBranch: {
    tag: S.String.pipe(S.annotateKey({ description: "The tag" })),
    branch: S.String.pipe(S.annotateKey({ description: "The release branch its commit is not on, or that is missing" }))
  },
  OnMain: { tag: S.String.pipe(S.annotateKey({ description: "A tag whose commit is on main" })) },
  NotAReleaseCommit: {
    tag: S.String.pipe(S.annotateKey({ description: "The tag" })),
    why: S.String.pipe(S.annotateKey({ description: "What its commit is, that a release commit is not" }))
  },
  CarriesMore: {
    tag: S.String.pipe(S.annotateKey({ description: "The tag" })),
    commits: S.Array(S.String).pipe(
      S.annotateKey({ description: "Each commit under the tag that origin/main does not hold, short hash and subject" })
    )
  },
  CannotTell: {
    tag: S.String.pipe(S.annotateKey({ description: "The tag" })),
    said: S.String.pipe(S.annotateKey({ description: "What git was asked and what it said" }))
  }
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
  MayDeploy: ({ branch, changed, tag }) =>
    out(A.join([`release verify OK  ${tag} is an annotated release tag on ${branch}`, ...pickedLines(changed)], "\n")),
  NoTag: ({ branch, commit }) =>
    out(
      `release verify NONE  ${branch} is at ${commit}, which carries no release tag: nothing deploys. A release is pushed as branch and tag together`
    ),
  Moved: ({ branch, commit }) =>
    out(`release verify NONE  ${commit} is no longer the head of ${branch}: nothing deploys for it`),
  NotAReleaseBranch: ({ branch }) =>
    refused([
      `"${branch}" is not a release branch (release/<major>.<minor>): only a release branch deploys production`
    ]),
  SeveralTags: ({ commit, tags }) =>
    refused([`${commit} carries more than one release tag, and a release commit carries one: ${A.join(tags, ", ")}`]),
  NotAVersion: ({ tag }) =>
    refused([`"${tag}" is not a release tag (v<major>.<minor>.<patch>): only a release tag deploys production`]),
  NotAnnotated: ({ tag }) =>
    refused([`${tag} is a lightweight tag: \`bun run release\` makes an annotated one, and only that deploys`]),
  NotOnBranch: ({ branch, tag }) =>
    refused([`${tag} is not on ${branch}: a release tag deploys only from its own release branch, never from main`]),
  OnMain: ({ tag }) =>
    refused([
      `${tag} is on a commit main holds: main never deploys production, and a release commit is on its release branch only`
    ]),
  NotAReleaseCommit: ({ tag, why }) =>
    refused([`${tag} is not on a release commit as \`bun run release\` makes one: ${why}`]),
  CarriesMore: ({ commits, tag }) =>
    refused([
      `${tag} carries what origin/main does not hold, and a release carries only what landed on main:`,
      ...commits
    ]),
  CannotTell: ({ said, tag }) => refused([`whether ${tag} may deploy could not be told, so it may not: ${said}`])
})

/** One question to git in `release verify`: its exit code, what it printed and what it said. */
const asked = Effect.fn("Release.asked")(function* (args: ReadonlyArray<string>) {
  const repo = yield* Repo
  const answer = yield* repo.run("git", args)
  return { code: answer.code, printed: Str.trim(answer.stdout), said: Str.trim(answer.stderr) }
})

/**
 * Whether a tag may deploy production. Every rule `release` holds when it makes a tag is held here again on the
 * tagged commit, against the remote's refs, so a tag made by hand passes only if `release` could have made it:
 *
 * - it is a version, and annotated;
 * - its commit is on the release branch of its major and minor (`origin/release/<major>.<minor>`) and is not one
 *   `origin/main` holds: a release branch is cut from main, so main's commits are on it too, and a release commit
 *   never is on main;
 * - its commit is a release commit: one parent, the app's version file there says the tag's version, and it changes
 *   nothing but that file, the lockfile and the notes;
 * - what is under it landed on main: for `<major>.<minor>.0` its parent is a commit of `origin/main`; for a patch the
 *   line's release before it is under it, and the commits between are no merge and each a change `origin/main`
 *   holds, or a pick with changes that names its commit on main (listed in what this prints).
 *
 * A question git cannot answer (a ref that was not fetched) refuses the tag: it never counts as "no".
 *
 * The deploy job runs `main`'s copy of this, never the tagged commit's (`verifyHead` below is what it calls).
 *
 * @category rules
 */
export const verifyTag = Effect.fn("Release.verifyTag")(function* (tag: string) {
  const version = versionOf(tag)
  if (O.isNone(version) || !Str.startsWith("v")(tag)) {
    return A.of<TagFinding>(TagFinding.cases.NotAVersion.make({ tag }))
  }
  const cannotTell = (step: string, said: string) =>
    A.of<TagFinding>(TagFinding.cases.CannotTell.make({ tag, said: `git could not ${step}: ${said}` }))
  const notRelease = (why: string) => A.of<TagFinding>(TagFinding.cases.NotAReleaseCommit.make({ tag, why }))
  const branch = branchOf(version.value)
  const commit = `refs/tags/${tag}^{commit}`
  const kind = yield* asked(["cat-file", "-t", `refs/tags/${tag}`])
  if (kind.code !== 0 || kind.printed !== "tag") return A.of<TagFinding>(TagFinding.cases.NotAnnotated.make({ tag }))
  const onBranch = yield* asked(["merge-base", "--is-ancestor", commit, `refs/remotes/origin/${branch}`])
  if (onBranch.code !== 0) return A.of<TagFinding>(TagFinding.cases.NotOnBranch.make({ tag, branch }))
  // `--is-ancestor` answers 0 for yes and 1 for no; anything else is git failing to answer, which is not a no.
  const onMain = yield* asked(["merge-base", "--is-ancestor", commit, originMain])
  if (onMain.code === 0) return A.of<TagFinding>(TagFinding.cases.OnMain.make({ tag }))
  if (onMain.code !== 1) return cannotTell("look for the commit on origin/main", onMain.said)

  // The commit itself: what `release` commits, and nothing more.
  const parents = yield* asked(["rev-list", "--parents", "-n", "1", commit])
  if (parents.code !== 0) return cannotTell("read the commit's parents", parents.said)
  if (A.length(Str.split(" ")(parents.printed)) !== 2) {
    return notRelease("its commit is a merge or has no parent, and a release commit has exactly one")
  }
  const file = yield* asked(["show", `${commit}:${versionFile}`])
  if (file.code !== 0) return cannotTell(`read ${versionFile} at the tag`, file.said)
  const says = versionInFile(file.printed)
  if (!O.exists(says, (one) => written(one) === written(version.value))) {
    return notRelease(
      `${versionFile} there says ${O.match(says, { onNone: () => "no version", onSome: written })}, not ${written(version.value)}`
    )
  }
  const under = `${commit}~1`
  const touched = yield* asked(["diff", "--name-only", under, commit])
  if (touched.code !== 0) return cannotTell("read what the commit changes", touched.said)
  const others = A.filter(linesOf(touched.printed), (one) => !A.contains([versionFile, notesFile, lockFile], one))
  if (A.isReadonlyArrayNonEmpty(others)) {
    return notRelease(`its commit changes more than the version and the notes: ${A.join(others, ", ")}`)
  }

  // What is under it: only what landed on main.
  const rest = Effect.gen(function* () {
    if (version.value.patch === 0) {
      const cut = yield* asked(["merge-base", "--is-ancestor", under, originMain])
      if (cut.code === 0) return A.of<TagFinding>(TagFinding.cases.MayDeploy.make({ tag, branch, changed: [] }))
      if (cut.code !== 1) return cannotTell("look for the release's parent on origin/main", cut.said)
      const extra = yield* git("list what main does not hold", ["log", "--format=%h %s", `${originMain}..${under}`])
      return A.of<TagFinding>(TagFinding.cases.CarriesMore.make({ tag, commits: linesOf(extra) }))
    }
    const tags = yield* releaseTags
    const before = highest(
      A.flatMap(tags, (one) =>
        one.version.major === version.value.major &&
        one.version.minor === version.value.minor &&
        one.version.patch < version.value.patch
          ? [one.version]
          : []
      )
    )
    if (O.isNone(before)) return notRelease(`there is no release of ${branch} before it to patch`)
    const base = `refs/tags/v${written(before.value)}^{commit}`
    const held = yield* asked(["merge-base", "--is-ancestor", base, under])
    if (held.code === 1) return notRelease(`it does not hold v${written(before.value)}, the release before it`)
    if (held.code !== 0) return cannotTell("look for the release before it", held.said)
    const beyond = yield* beyondMain(base, under)
    const more = A.appendAll(beyond.merges, beyond.missing)
    return A.isReadonlyArrayNonEmpty(more)
      ? A.of<TagFinding>(TagFinding.cases.CarriesMore.make({ tag, commits: more }))
      : A.of<TagFinding>(TagFinding.cases.MayDeploy.make({ tag, branch, changed: beyond.changed }))
  })
  return yield* rest.pipe(
    Effect.catchTag("ReleaseStopped", (stopped) =>
      Effect.succeed(
        ReleaseFinding.guards.GitFailed(stopped.finding)
          ? cannotTell(stopped.finding.step, stopped.finding.said)
          : cannotTell("answer", "the release rules stopped")
      )
    )
  )
})

/**
 * Whether the commit CI just passed on, on a release branch, may deploy production (Benjamin's decision of
 * 2026-11-22, "After CI on the release branch"). The deploy workflow runs this from `main`'s copy of the code, so a
 * release branch cannot bring its own guard:
 *
 * - the branch is `release/<major>.<minor>` and the commit is still its head as the remote holds it (an older
 *   commit's turn has passed: nothing deploys for it);
 * - the commit carries exactly one `v*` tag. None is not a refusal: fixes are
 *   pushed to a release branch before they are tagged, and nothing deploys until the tag is on the head;
 * - that tag passes `verifyTag`.
 *
 * @category rules
 */
export const verifyHead = Effect.fn("Release.verifyHead")(function* (input: {
  readonly branch: string
  readonly commit: string
}) {
  const { branch } = input
  if (O.isNone(releaseLineOf(branch))) return A.of<TagFinding>(TagFinding.cases.NotAReleaseBranch.make({ branch }))
  const commit = short(input.commit)
  const cannotTell = (step: string, said: string) =>
    A.of<TagFinding>(TagFinding.cases.CannotTell.make({ tag: commit, said: `git could not ${step}: ${said}` }))
  if (O.isNone(Str.match(/^[0-9a-f]{40}$/)(input.commit))) {
    return cannotTell("read the commit", `"${input.commit}" is not a commit's full hash`)
  }
  const head = yield* asked(["rev-parse", "--verify", `refs/remotes/origin/${branch}^{commit}`])
  if (head.code !== 0) return cannotTell(`read where origin/${branch} is`, head.said)
  if (head.printed !== input.commit) return A.of<TagFinding>(TagFinding.cases.Moved.make({ branch, commit }))
  const listed = yield* asked(["tag", "--points-at", input.commit, "--list", "v*"])
  if (listed.code !== 0) return cannotTell("list the tags on the commit", listed.said)
  const tags = linesOf(listed.printed)
  const [tag, ...more] = tags
  if (tag === undefined) return A.of<TagFinding>(TagFinding.cases.NoTag.make({ branch, commit }))
  if (A.isReadonlyArrayNonEmpty(more)) return A.of<TagFinding>(TagFinding.cases.SeveralTags.make({ commit, tags }))
  // A tag of another line is refused by `verifyTag`: its commit is not on its own line's branch.
  return yield* verifyTag(tag)
})

/**
 * The tag that may deploy, when the findings say one may.
 *
 * @category rules
 */
export const deployable = (findings: ReadonlyArray<TagFinding>): O.Option<string> =>
  O.map(A.findFirst(findings, TagFinding.guards.MayDeploy), (found) => found.tag)
