// `release` on a small repository of its own: a real git history in a temporary folder, the check a stand-in that
// answers green or red. Each guard is shown refusing and leaving nothing made: no branch, no tag, no file changed.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Str from "effect/String"
import {
  notesOf,
  next,
  type ReleaseCheck,
  type ReleaseKind,
  release,
  releaseSentence,
  tagSentence,
  verifyTag,
  versionOf
} from "../src/commands/Release/Release.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree, json, printed } from "./support/tree.ts"

const green: ReleaseCheck = { run: Effect.succeed(0) }
const red: ReleaseCheck = { run: Effect.succeed(1) }

/** git, in the repository the test made; a step that fails fails the test with what git said. */
const git = Effect.fn("test.git")(function* (...args: ReadonlyArray<string>) {
  const repo = yield* Repo
  const answer = yield* repo.run("git", args)
  expect(answer.code, `git ${A.join(args, " ")}: ${answer.stderr}`).toBe(0)
  return Str.trim(answer.stdout)
})

/** A commit of one file with this subject. */
const commit = Effect.fn("test.commit")(function* (file: string, subject: string) {
  const repo = yield* Repo
  yield* repo.write(repo.join(repo.root, file), `${subject}\n`)
  yield* git("add", file)
  yield* git("commit", "-q", "-m", subject)
})

/** A repository on main with the app at 0.6.1 and two commits after its first. */
const started = Effect.gen(function* () {
  yield* git("init", "-q", "-b", "main")
  yield* git("config", "user.name", "Test")
  yield* git("config", "user.email", "test@example.test")
  yield* git("config", "commit.gpgsign", "false")
  yield* git("config", "tag.gpgsign", "false")
  yield* git("add", "--all")
  yield* git("commit", "-q", "-m", "chore: the app as submitted")
  yield* commit("a.txt", "feat: a staging stage")
  yield* commit("b.txt", "fix(ui): the grid keeps the key")
})

const files = {
  "apps/inventory/package.json": json({ name: "@inventory/app", version: "0.6.1", private: true })
}

/** What `release` prints, and the state git is left in. */
const releasing = Effect.fn("test.releasing")(function* (kind: ReleaseKind, check: ReleaseCheck = green) {
  const found = yield* release(kind, check)
  const lines = printed(render(releaseSentence)(found))
  const branch = yield* git("rev-parse", "--abbrev-ref", "HEAD")
  const tags = yield* git("tag", "--list")
  const branches = yield* git("branch", "--format=%(refname:short)")
  return { lines, branch, tags: A.filter(Str.split("\n")(tags), Str.isNonEmpty), branches: Str.split("\n")(branches) }
})

const appVersion = Effect.gen(function* () {
  const repo = yield* Repo
  const text = yield* repo.text(repo.join(repo.root, "apps/inventory/package.json"))
  return O.match(Str.match(/"version":\s*"([^"]*)"/)(text), { onNone: () => "", onSome: (found) => `${found[1]}` })
})

describe("release", () => {
  it.effect(
    "a minor release from main cuts release/0.7, writes 0.7.0 and the notes, commits and tags, and pushes nothing",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          const result = yield* releasing("minor")
          expect(result.lines).toEqual([
            A.join(
              [
                "out: release OK  v0.7.0 is tagged on release/0.7, a new branch from main. Nothing was pushed.",
                "  Push the branch, then the tag. The tag deploys production once the production environment's reviewer approves:",
                "  git push origin release/0.7",
                "  git push origin v0.7.0"
              ],
              "\n"
            )
          ])
          expect([result.branch, result.tags]).toEqual(["release/0.7", ["v0.7.0"]])
          const seen1 = yield* appVersion
          expect(seen1).toBe("0.7.0")
          // An annotated tag, on the release commit, which is on the release branch and not on main.
          const seen2 = yield* git("cat-file", "-t", "v0.7.0")
          expect(seen2).toBe("tag")
          const seen3 = yield* git("log", "-1", "--format=%s", "v0.7.0")
          expect(seen3).toBe("chore: release v0.7.0")
          const repo = yield* Repo
          const onMain = yield* repo.run("git", ["merge-base", "--is-ancestor", "v0.7.0", "main"])
          expect(onMain.code).toBe(1)
          const notes = yield* repo.text(repo.join(repo.root, "CHANGELOG.md"))
          expect(Str.replace(/\d{4}-\d{2}-\d{2}/, "<date>")(notes)).toBe(
            "# Releases\n\n## v0.7.0 — <date>\n\nAdded\n\n- a staging stage\n\nFixed\n\n- the grid keeps the key\n\nUpkeep\n\n- the app as submitted\n"
          )
          const seen4 = yield* git("status", "--porcelain")
          expect(seen4).toBe("")
        })
      )
  )

  it.effect("refuses a tree with changes, and makes nothing", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        const repo = yield* Repo
        yield* repo.write(repo.join(repo.root, "a.txt"), "changed\n")
        const result = yield* releasing("minor")
        expect(result.lines).toEqual([
          "err: release FAIL  the tree has changes not committed, so nothing was made: commit them or set them aside first\n  a.txt"
        ])
        expect([result.branch, result.tags, result.branches]).toEqual(["main", [], ["main"]])
      })
    )
  )

  it.effect("refuses after a red check, and makes nothing", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        const result = yield* releasing("minor", red)
        expect(result.lines).toEqual([
          "err: release FAIL  `bun run check:full` failed (exit 1), so nothing was made: a release is cut only from a green check"
        ])
        expect([result.branch, result.tags, result.branches]).toEqual(["main", [], ["main"]])
        const seen5 = yield* appVersion
        expect(seen5).toBe("0.6.1")
      })
    )
  )

  it.effect("cuts a major or minor release only from main", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* git("switch", "-q", "-c", "work")
        const result = yield* releasing("major")
        expect(Str.startsWith("err: release FAIL  a major release is cut from main")(`${result.lines[0]}`)).toBe(true)
        expect([result.tags, result.branches]).toEqual([[], ["main", "work"]])
      })
    )
  )

  it.effect("tags a patch only on a release branch, not on main or another branch", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        const onMain = yield* releasing("patch")
        expect(onMain.lines).toEqual([
          "err: release FAIL  a patch is tagged on its release branch (release/<major>.<minor>), and this is main: switch to it"
        ])
        yield* git("switch", "-q", "-c", "release-0.7")
        const elsewhere = yield* releasing("patch")
        expect(Str.includes("and this is release-0.7: switch to it")(`${elsewhere.lines[0]}`)).toBe(true)
        expect(elsewhere.tags).toEqual([])
      })
    )
  )

  it.effect("a patch carries a fix cherry-picked from main and is tagged with the next patch on its own branch", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* releasing("minor")
        yield* git("switch", "-q", "main")
        yield* commit("c.txt", "fix: a waited row is never written over")
        const fix = yield* git("rev-parse", "HEAD")
        yield* git("switch", "-q", "release/0.7")
        yield* git("cherry-pick", "-x", fix)
        const result = yield* releasing("patch")
        expect(
          Str.startsWith("out: release OK  v0.7.1 is tagged on release/0.7. Nothing was pushed.")(`${result.lines[0]}`)
        ).toBe(true)
        expect(result.tags).toEqual(["v0.7.0", "v0.7.1"])
        const seen6 = yield* appVersion
        expect(seen6).toBe("0.7.1")
        const seen7 = yield* git("tag", "--list", "--format=%(contents:subject)", "v0.7.1")
        expect(seen7).toBe("v0.7.1")
        const body = yield* git("tag", "--list", "--format=%(contents:body)", "v0.7.1")
        expect(Str.includes("- a waited row is never written over")(body)).toBe(true)
      })
    )
  )

  it.effect("refuses a patch that carries a commit not on main, and tags nothing", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* releasing("minor")
        yield* commit("d.txt", "fix: only on the release branch")
        const result = yield* releasing("patch")
        expect(Str.replace(/[0-9a-f]{7,40} /, "<hash> ")(`${result.lines[0]}`)).toBe(
          "err: release FAIL  a patch carries only fixes already on main, and these are not (land each on main, then `git cherry-pick -x` it here):\n  <hash> fix: only on the release branch"
        )
        expect(result.tags).toEqual(["v0.7.0"])
        const seen8 = yield* appVersion
        expect(seen8).toBe("0.7.0")
      })
    )
  )

  it.effect("refuses a patch with nothing new, and one on a branch never tagged", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* releasing("minor")
        const nothing = yield* releasing("patch")
        expect(nothing.lines).toEqual([
          "err: release FAIL  nothing has landed on this branch since v0.7.0: cherry-pick a fix from main first"
        ])
        yield* git("switch", "-q", "main")
        yield* git("switch", "-q", "-c", "release/0.9")
        const untagged = yield* releasing("patch")
        expect(untagged.lines).toEqual([
          "err: release FAIL  release/0.9 has no release tag yet, so there is nothing to patch: its first release is a minor or major one"
        ])
      })
    )
  )

  it.effect(
    "a version only goes up: a minor release goes above every release on any branch, and above the app's own",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* releasing("minor")
          yield* git("switch", "-q", "main")
          const second = yield* releasing("minor")
          expect(Str.startsWith("out: release OK  v0.8.0 is tagged on release/0.8")(`${second.lines[0]}`)).toBe(true)
          // The app's file says 0.9.4 on main, above every tag: the next minor goes above it.
          yield* git("switch", "-q", "main")
          const repo = yield* Repo
          yield* repo.write(
            repo.join(repo.root, "apps/inventory/package.json"),
            json({ name: "@inventory/app", version: "0.9.4", private: true })
          )
          yield* git("commit", "-q", "-am", "chore: a version by hand")
          const third = yield* releasing("minor")
          expect(Str.startsWith("out: release OK  v0.10.0 is tagged on release/0.10")(`${third.lines[0]}`)).toBe(true)
          expect(third.tags).toEqual(["v0.10.0", "v0.7.0", "v0.8.0"])
        })
      )
  )

  it.effect("takes up a release branch left by a run that stopped, and refuses one that moved on", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* git("branch", "release/0.7")
        const takenUp = yield* releasing("minor")
        expect(
          Str.startsWith("out: release OK  v0.7.0 is tagged on release/0.7. Nothing was pushed.")(`${takenUp.lines[0]}`)
        ).toBe(true)
      })
    ).pipe(
      Effect.andThen(
        inTree(
          files,
          Effect.gen(function* () {
            yield* started
            yield* git("switch", "-q", "-c", "release/0.7")
            yield* commit("f.txt", "fix: on the branch")
            yield* git("switch", "-q", "main")
            const moved = yield* releasing("minor")
            expect(Str.includes("release/0.7 is not where main is")(`${moved.lines[0]}`)).toBe(true)
            expect(moved.tags).toEqual([])
          })
        )
      )
    )
  )
})

describe("release's rules", () => {
  it("reads a version with or without its v, and nothing else", () => {
    expect([versionOf("v0.7.1"), versionOf("0.7.1"), versionOf("0.7"), versionOf("v01.2.3")]).toEqual([
      O.some({ major: 0, minor: 7, patch: 1 }),
      O.some({ major: 0, minor: 7, patch: 1 }),
      O.none(),
      O.none()
    ])
  })

  it("moves the version by the kind", () => {
    const from = { major: 1, minor: 4, patch: 2 }
    expect(A.map(["major", "minor", "patch"] as const, (kind) => next({ kind, from }))).toEqual([
      { major: 2, minor: 0, patch: 0 },
      { major: 1, minor: 5, patch: 0 },
      { major: 1, minor: 4, patch: 3 }
    ])
  })

  it("groups the notes by kind and leaves merges out", () => {
    expect(
      notesOf({ tag: "v1.0.0", date: "2026-11-22", subjects: ["Merge main", "feat!: one", "a subject with no type"] })
    ).toBe("## v1.0.0 — 2026-11-22\n\nAdded\n\n- one\n\nOther\n\n- a subject with no type\n")
  })
})

describe("release verify, the production deploy's guard", () => {
  const verified = (tag: string) => Effect.map(verifyTag(tag), (found) => printed(render(tagSentence)(found)))

  it.effect("passes an annotated release tag whose commit is on its release branch as the remote holds it", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* releasing("minor")
        // What a checkout with every branch fetched holds: the remote's release branch.
        yield* git("update-ref", "refs/remotes/origin/release/0.7", "release/0.7")
        yield* git("update-ref", "refs/remotes/origin/main", "main")
        const said = yield* verified("v0.7.0")
        expect(said).toEqual(["out: release verify OK  v0.7.0 is an annotated release tag on release/0.7"])
      })
    )
  )

  it.effect(
    "refuses a tag on main's commit, a tag on another line's branch, a lightweight tag and a name that is no version",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* releasing("minor")
          yield* git("update-ref", "refs/remotes/origin/release/0.7", "release/0.7")
          yield* git("update-ref", "refs/remotes/origin/main", "main")
          yield* git("switch", "-q", "main")
          yield* git("tag", "-a", "v0.7.9", "-m", "on main")
          yield* git("tag", "-a", "v0.8.0", "-m", "on release/0.7, but for 0.8", "release/0.7")
          yield* git("tag", "v0.7.8", "release/0.7")
          const onMain = yield* verified("v0.7.9")
          const otherLine = yield* verified("v0.8.0")
          const light = yield* verified("v0.7.8")
          const names = yield* Effect.forEach(["main", "v0.7", "0.7.0", "release/0.7"], verified, { concurrency: 1 })
          expect([onMain, otherLine, light]).toEqual([
            [
              "err: release FAIL  v0.7.9 is on a commit main holds: main never deploys production, and a release commit is on its release branch only"
            ],
            [
              "err: release FAIL  v0.8.0 is not on release/0.8: a release tag deploys only from its own release branch, never from main"
            ],
            [
              "err: release FAIL  v0.7.8 is a lightweight tag: `bun run release` makes an annotated one, and only that deploys"
            ]
          ])
          expect(
            A.map(names, (lines) => A.length(lines) === 1 && Str.includes("is not a release tag")(`${lines[0]}`))
          ).toEqual([true, true, true, true])
        })
      )
  )
})
