// `release` on a small repository of its own: a real git history in a temporary folder with a remote of its own (a
// bare repository inside its `.git`), the check a stand-in that answers green or red. Each guard is shown refusing and
// leaving nothing made: no branch, no tag, no file changed. "Main" in a guard is the remote's, so a test says what was
// pushed and what was not.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import {
  checkFull,
  comparedOf,
  notesOf,
  next,
  type ReleaseCheck,
  type ReleaseKind,
  release,
  releaseSentence,
  deployable,
  tagSentence,
  verifyHead,
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

/** A commit on main, pushed: what "landed on main" means to a guard. Its hash. */
const landed = Effect.fn("test.landed")(function* (file: string, subject: string) {
  yield* commit(file, subject)
  yield* git("push", "-q", "origin", "main")
  return yield* git("rev-parse", "HEAD")
})

/**
 * A fix on main that does not apply to release/0.7 as it is, picked there with `-x` and its conflict resolved by
 * hand: the commit on the branch differs from main's and names it. The checkout is left on release/0.7.
 */
const pickedWithChanges = Effect.gen(function* () {
  const repo = yield* Repo
  yield* git("switch", "-q", "main")
  yield* landed("a.txt", "refactor: the count is reworded")
  const fix = yield* landed("a.txt", "fix: the count is right")
  yield* git("switch", "-q", "release/0.7")
  const picked = yield* repo.run("git", ["cherry-pick", "-x", fix])
  expect(picked.code, "the pick is meant to conflict").not.toBe(0)
  yield* repo.write(repo.join(repo.root, "a.txt"), "fix: the count is right, as it fits this line\n")
  yield* git("add", "a.txt")
  yield* git("-c", "core.editor=true", "cherry-pick", "--continue")
  return fix
})

/** Every branch and tag here, pushed: what a person does after a release. */
const published = Effect.gen(function* () {
  yield* git("push", "-q", "origin", "--all")
  yield* git("push", "-q", "origin", "--tags")
})

/** The app's version file with this version, as `json` writes it. */
const appFile = (version: string) => json({ name: "@inventory/app", version, private: true })

/** A repository on main with the app at 0.6.1 and two commits after its first, all of it pushed to its remote. */
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
  yield* git("init", "-q", "--bare", ".git/origin.git")
  yield* git("remote", "add", "origin", ".git/origin.git")
  yield* git("push", "-q", "origin", "main")
})

const files = {
  "apps/inventory/package.json": appFile("0.6.1")
}

/** What `release` prints, and the state git is left in. */
const releasing = Effect.fn("test.releasing")(function* <R = never>(kind: ReleaseKind, check: ReleaseCheck<R> = green) {
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

/**
 * A first release cut from main and pushed, branch and tag: a patch stands on a release the remote holds, since
 * `release patch` judges that release as the deploy guard will.
 */
const cutAndPushed = Effect.gen(function* () {
  const result = yield* releasing("minor")
  yield* git("push", "-q", "origin", "HEAD", "--tags")
  return result
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
                "  Push the branch and the tag together. Production deploys once CI passes on the branch and the production environment's reviewer approves:",
                "  git push --atomic origin release/0.7 v0.7.0"
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

  it.effect("the real check is `bun run check:full` from the root, and what it exits with stops the release", () =>
    inTree(
      {
        ...files,
        "package.json": json({ name: "root", workspaces: ["packages/*"], scripts: { "check:full": "exit 3" } })
      },
      Effect.gen(function* () {
        yield* started
        const result = yield* releasing("minor", checkFull)
        expect(result.lines).toEqual([
          "err: release FAIL  `bun run check:full` failed (exit 3), so nothing was made: a release is cut only from a green check"
        ])
        expect([result.tags, result.branches]).toEqual([[], ["main"]])
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
        yield* cutAndPushed
        yield* git("switch", "-q", "main")
        const fix = yield* landed("c.txt", "fix: a waited row is never written over")
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
        yield* cutAndPushed
        yield* commit("d.txt", "fix: only on the release branch")
        const result = yield* releasing("patch")
        expect(Str.replace(/[0-9a-f]{7,40} /, "<hash> ")(`${result.lines[0]}`)).toBe(
          "err: release FAIL  a patch carries only fixes already on origin/main, and these are not (land each on main, then `git cherry-pick -x` it here):\n  <hash> fix: only on the release branch"
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
        yield* cutAndPushed
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
          yield* repo.write(repo.join(repo.root, "apps/inventory/package.json"), appFile("0.9.4"))
          yield* git("commit", "-q", "-am", "chore: a version by hand")
          yield* git("push", "-q", "origin", "main")
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

  it.effect("cuts a major or minor release only from main as the remote holds it: not ahead of it, not behind", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* commit("u.txt", "feat: never pushed")
        const ahead = yield* releasing("minor")
        expect(Str.replace(/\([0-9a-f]{7}\)/g, "(<hash>)")(`${ahead.lines[0]}`)).toBe(
          "err: release FAIL  main here (<hash>) is not where origin/main is (<hash>): a release is cut from main as the remote holds it. Pull, or land what is only here through a pull request, then run it again"
        )
        yield* git("reset", "-q", "--hard", "HEAD~2")
        const behind = yield* releasing("minor")
        expect(Str.includes("is not where origin/main is")(`${behind.lines[0]}`)).toBe(true)
        expect([behind.tags, behind.branches]).toEqual([[], ["main"]])
      })
    )
  )

  it.effect("refuses when the remote cannot be fetched, and makes nothing", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* git("remote", "remove", "origin")
        const result = yield* releasing("minor")
        expect(
          Str.startsWith("err: release FAIL  git could not fetch main, the release branches and the tags from origin:")(
            `${result.lines[0]}`
          )
        ).toBe(true)
        expect([result.tags, result.branches]).toEqual([[], ["main"]])
      })
    )
  )

  it.effect(
    "a fix counts as on main only once the remote's main holds it, whatever main is here: unpushed is refused, and a main here that is behind does not refuse",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          yield* git("switch", "-q", "main")
          yield* commit("c.txt", "fix: only on main here")
          const fix = yield* git("rev-parse", "HEAD")
          yield* git("switch", "-q", "release/0.7")
          yield* git("cherry-pick", "-x", fix)
          const unpushed = yield* releasing("patch")
          expect(Str.includes("a patch carries only fixes already on origin/main")(`${unpushed.lines[0]}`)).toBe(true)
          expect(unpushed.tags).toEqual(["v0.7.0"])
          // Landed on the remote's main, and main here put back behind it: the fix is on main all the same.
          yield* git("push", "-q", "origin", "main")
          yield* git("branch", "-f", "main", "main~1")
          const landedNow = yield* releasing("patch")
          expect(Str.startsWith("out: release OK  v0.7.1 is tagged on release/0.7.")(`${landedNow.lines[0]}`)).toBe(
            true
          )
        })
      )
  )

  it.effect("refuses a patch that carries a merge, whose changes cannot be compared with main's", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* cutAndPushed
        yield* git("switch", "-q", "main")
        const fix = yield* landed("c.txt", "fix: a waited row is never written over")
        yield* git("switch", "-q", "release/0.7")
        // A merge of a commit main holds, with a change of its own riding in on it.
        yield* git("merge", "-q", "--no-ff", "--no-commit", fix)
        const repo = yield* Repo
        yield* repo.write(repo.join(repo.root, "sneaky.txt"), "not on main\n")
        yield* git("add", "sneaky.txt")
        yield* git("commit", "-q", "-m", "Merge a fix, and more")
        const result = yield* releasing("patch")
        expect(Str.replace(/[0-9a-f]{7,40} /, "<hash> ")(`${result.lines[0]}`)).toBe(
          "err: release FAIL  a patch is made of cherry-picks, and these are merges, whose changes cannot be compared with main's (take them off the branch, then `git cherry-pick -x` each fix):\n  <hash> Merge a fix, and more"
        )
        expect(result.tags).toEqual(["v0.7.0"])
        const seen = yield* appVersion
        expect(seen).toBe("0.7.0")
      })
    )
  )

  it.effect(
    "a fix that needed changes when it was picked counts when it names its commit on main, and the release names it: in what is printed, the notes and the tag",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          yield* pickedWithChanges
          const result = yield* releasing("patch")
          const hashes = Str.replace(/[0-9a-f]{7} (here|on main)/g, "<hash> $1")
          expect(A.map(result.lines, hashes)).toEqual([
            A.join(
              [
                "out: release OK  v0.7.1 is tagged on release/0.7. Nothing was pushed.",
                "  Picked with changes: each differs from the commit on main its message names. Nothing compares the two, so read each commit before approving the deploy:",
                "    fix: the count is right (<hash> here, <hash> on main)",
                "  Push the branch and the tag together. Production deploys once CI passes on the branch and the production environment's reviewer approves:",
                "  git push --atomic origin release/0.7 v0.7.1"
              ],
              "\n"
            )
          ])
          const named =
            "Fixed\n\n- the count is right\n\nPicked with changes\n\n- fix: the count is right (<hash> here, <hash> on main)\n"
          const repo = yield* Repo
          const notes = yield* repo.text(repo.join(repo.root, "CHANGELOG.md"))
          expect(Str.includes(named)(hashes(notes))).toBe(true)
          const body = yield* git("tag", "--list", "--format=%(contents:body)", "v0.7.1")
          expect(Str.includes(named)(hashes(`${body}\n`))).toBe(true)
        })
      )
  )

  it.effect(
    "a commit that differs from main's is still refused when the commit it names is not on the remote's main, or when it names none",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          // A commit that exists, on a branch that never reached main.
          yield* git("switch", "-q", "-c", "elsewhere", "main")
          yield* commit("e.txt", "fix: never landed")
          const elsewhere = yield* git("rev-parse", "HEAD")
          yield* git("switch", "-q", "release/0.7")
          const repo = yield* Repo
          yield* repo.write(repo.join(repo.root, "d.txt"), "only here\n")
          yield* git("add", "d.txt")
          yield* git(
            "commit",
            "-q",
            "-m",
            `fix: names a commit main does not hold\n\n(cherry picked from commit ${elsewhere})`
          )
          const forged = yield* releasing("patch")
          expect(Str.includes("a patch carries only fixes already on origin/main")(`${forged.lines[0]}`)).toBe(true)
          expect(Str.includes("fix: names a commit main does not hold")(`${forged.lines[0]}`)).toBe(true)
          expect(forged.tags).toEqual(["v0.7.0"])
        })
      )
  )

  it.effect("refuses a patch on a branch that does not hold its line's last release", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* cutAndPushed
        yield* git("switch", "-q", "main")
        const first = yield* landed("c.txt", "fix: the first")
        yield* git("switch", "-q", "release/0.7")
        yield* git("cherry-pick", "-x", first)
        yield* releasing("patch")
        yield* published
        // The branch as a checkout that fetched v0.7.1 but never pulled it holds it: at v0.7.0, with a new pick.
        yield* git("reset", "-q", "--hard", "v0.7.0")
        yield* git("switch", "-q", "main")
        const second = yield* landed("d.txt", "fix: the second")
        yield* git("switch", "-q", "release/0.7")
        yield* git("cherry-pick", "-x", second)
        const result = yield* releasing("patch")
        expect(result.lines).toEqual([
          "err: release FAIL  release/0.7 here does not hold v0.7.1, the last release of its line: pull the branch, then run it again"
        ])
        expect(result.tags).toEqual(["v0.7.0", "v0.7.1"])
      })
    )
  )

  it.effect(
    "refuses a patch whose version would not go up: the app's file on the branch already says a higher one",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          yield* git("switch", "-q", "main")
          const repo = yield* Repo
          const versionPath = repo.join(repo.root, "apps/inventory/package.json")
          // Main's file is moved by hand to what the branch says, then above it, so the second change applies there.
          yield* repo.write(versionPath, appFile("0.7.0"))
          yield* git("commit", "-q", "-am", "chore: main says 0.7.0")
          yield* repo.write(versionPath, appFile("0.7.5"))
          yield* git("commit", "-q", "-am", "chore: main says 0.7.5")
          yield* git("push", "-q", "origin", "main")
          const above = yield* git("rev-parse", "HEAD")
          yield* git("switch", "-q", "release/0.7")
          yield* git("cherry-pick", "-x", above)
          const result = yield* releasing("patch")
          expect(result.lines).toEqual([
            "err: release FAIL  v0.7.1 is not above v0.7.5, already released: a version only goes up"
          ])
          expect(result.tags).toEqual(["v0.7.0"])
        })
      )
  )

  it.effect(
    "a new line's notes keep every release before it, and do not list again a fix a patch already released",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          yield* git("switch", "-q", "main")
          const fix = yield* landed("c.txt", "fix: a waited row is never written over")
          yield* git("switch", "-q", "release/0.7")
          yield* git("cherry-pick", "-x", fix)
          yield* releasing("patch")
          yield* git("switch", "-q", "main")
          yield* landed("p.txt", "feat: a new page")
          const result = yield* releasing("minor")
          expect(result.branch).toBe("release/0.8")
          const repo = yield* Repo
          const notes = yield* repo.text(repo.join(repo.root, "CHANGELOG.md"))
          expect(Str.replace(/\d{4}-\d{2}-\d{2}/g, "<date>")(notes)).toBe(
            A.join(
              [
                "# Releases\n",
                "## v0.8.0 — <date>\n\nAdded\n\n- a new page\n",
                "## v0.7.1 — <date>\n\nFixed\n\n- a waited row is never written over\n",
                "## v0.7.0 — <date>\n\nAdded\n\n- a staging stage\n\nFixed\n\n- the grid keeps the key\n\nUpkeep\n\n- the app as submitted\n"
              ],
              "\n"
            )
          )
          const body = yield* git("tag", "--list", "--format=%(contents:body)", "v0.8.0")
          expect(Str.includes("a waited row")(body)).toBe(false)
        })
      )
  )

  it.effect(
    "a commit with no message is compared with main like any other: a patch over one is refused, by the command and by the deploy guard",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          const repo = yield* Repo
          yield* repo.write(repo.join(repo.root, "evil.txt"), "never on main\n")
          yield* git("add", "evil.txt")
          yield* git("commit", "-q", "--allow-empty-message", "-m", "")
          const result = yield* releasing("patch")
          expect(A.map(result.lines, Str.replace(/[0-9a-f]{7} /, "<hash> "))).toEqual([
            "err: release FAIL  a patch carries only fixes already on origin/main, and these are not (land each on main, then `git cherry-pick -x` it here):\n  <hash> (no message)"
          ])
          expect(result.tags).toEqual(["v0.7.0"])
          // The same commit under a release commit made by hand.
          yield* repo.write(repo.join(repo.root, "apps/inventory/package.json"), appFile("0.7.1"))
          yield* git("commit", "-q", "-am", "chore: release v0.7.1")
          yield* git("tag", "-a", "v0.7.1", "-m", "v0.7.1")
          yield* published
          const found = yield* verifyTag("v0.7.1")
          expect(A.map(printed(render(tagSentence)(found)), Str.replace(/[0-9a-f]{7} /, "<hash> "))).toEqual([
            "err: release FAIL  v0.7.1 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> (no message)"
          ])
        })
      )
  )

  it.effect(
    "the line that names main's commit counts only alone on a line, as `cherry-pick -x` writes it: the same words inside a sentence do not",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          const onMain = yield* git("rev-parse", "main")
          const repo = yield* Repo
          yield* repo.write(repo.join(repo.root, "d.txt"), "only here\n")
          yield* git("add", "d.txt")
          yield* git(
            "commit",
            "-q",
            "-m",
            `fix: only here\n\nSee (cherry picked from commit ${onMain}) for what this is not.`
          )
          const result = yield* releasing("patch")
          expect(Str.includes("a patch carries only fixes already on origin/main")(`${result.lines[0]}`)).toBe(true)
          expect(result.tags).toEqual(["v0.7.0"])
        })
      )
  )

  it.effect(
    "refuses a patch on top of a release the deploy guard refuses, and says what the guard says: what is under a tag made by hand is not forgotten",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* cutAndPushed
          // A commit main never held, with a release commit and a tag made by hand on top of it.
          yield* commit("x.txt", "fix: never on main")
          const repo = yield* Repo
          yield* repo.write(repo.join(repo.root, "apps/inventory/package.json"), appFile("0.7.1"))
          yield* git("commit", "-q", "-am", "chore: release v0.7.1")
          yield* git("tag", "-a", "v0.7.1", "-m", "v0.7.1")
          yield* published
          // Then a real fix, picked as it should be.
          yield* git("switch", "-q", "main")
          const fix = yield* landed("c.txt", "fix: a waited row is never written over")
          yield* git("switch", "-q", "release/0.7")
          yield* git("cherry-pick", "-x", fix)
          const result = yield* releasing("patch")
          expect(A.map(result.lines, Str.replace(/[0-9a-f]{7} /, "<hash> "))).toEqual([
            "err: release FAIL  v0.7.1, the release this patch would stand on, is not one that may deploy, so nothing on top of it may. If it was never pushed, push it with its branch; if it was made by hand, an admin deletes or replaces it. Then run it again. The deploy guard says:\n  release FAIL  v0.7.1 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> fix: never on main"
          ])
          expect(result.tags).toEqual(["v0.7.0", "v0.7.1"])
        })
      )
  )

  it.effect("the release commit moves the lockfile's copy of the app's version, and nothing else in it", () =>
    inTree(
      {
        ...files,
        "bun.lock": `{\n  "workspaces": {\n    "apps/inventory": {\n      "name": "@inventory/app",\n      "version": "0.6.1",\n      "dependencies": { "x": "1" },\n    },\n    "packages/a": { "name": "a", "version": "0.6.1" },\n  },\n}\n`
      },
      Effect.gen(function* () {
        yield* started
        yield* releasing("minor")
        const repo = yield* Repo
        const lock = yield* repo.text(repo.join(repo.root, "bun.lock"))
        expect(lock).toBe(
          `{\n  "workspaces": {\n    "apps/inventory": {\n      "name": "@inventory/app",\n      "version": "0.7.0",\n      "dependencies": { "x": "1" },\n    },\n    "packages/a": { "name": "a", "version": "0.6.1" },\n  },\n}\n`
        )
        const committed = yield* git("show", "--name-only", "--format=", "v0.7.0^{commit}")
        expect(Str.split("\n")(committed)).toEqual(["CHANGELOG.md", "apps/inventory/package.json", "bun.lock"])
        const status = yield* git("status", "--porcelain")
        expect(status).toBe("")
      })
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

  it("reads `git cherry`'s lines as a sign and a full hash, and names the first line that is anything else: none is skipped", () => {
    const sha = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
    expect(Result.getOrThrow(comparedOf(`+ ${sha}\n- ${sha}`))).toEqual([
      { sha, held: false },
      { sha, held: true }
    ])
    expect(
      A.map([`+ ${sha}\n+ 4b825dc`, `+ ${sha} fix: a subject`, `+ ${sha}\n? ${sha}`, `+${sha}`], (text) =>
        Result.match(comparedOf(text), { onFailure: (line) => line, onSuccess: () => "read" })
      )
    ).toEqual(["+ 4b825dc", `+ ${sha} fix: a subject`, `? ${sha}`, `+${sha}`])
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

  /** v0.7.0 cut and pushed, and the checkout on release/0.7. */
  const released = Effect.gen(function* () {
    yield* started
    yield* releasing("minor")
    yield* published
  })

  /** A release commit made by hand on the branch the checkout is on: the version file, and a tag on it. */
  const byHand = Effect.fn("test.byHand")(function* (version: string, more: ReadonlyArray<string> = []) {
    const repo = yield* Repo
    yield* repo.write(repo.join(repo.root, "apps/inventory/package.json"), appFile(version))
    yield* Effect.forEach(more, (file) => repo.write(repo.join(repo.root, file), "more\n"), {
      concurrency: 1,
      discard: true
    })
    yield* git("add", "--all")
    yield* git("commit", "-q", "-m", `chore: release v${version}`)
    yield* git("tag", "-a", `v${version}`, "-m", `v${version}`)
    yield* published
  })

  it.effect("passes the tags `release` makes, a first release and a patch, once their branch is pushed", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* released
        yield* git("switch", "-q", "main")
        const fix = yield* landed("c.txt", "fix: a waited row is never written over")
        yield* git("switch", "-q", "release/0.7")
        yield* git("cherry-pick", "-x", fix)
        yield* releasing("patch")
        yield* published
        const first = yield* verified("v0.7.0")
        const patch = yield* verified("v0.7.1")
        expect([first, patch]).toEqual([
          ["out: release verify OK  v0.7.0 is an annotated release tag on release/0.7"],
          ["out: release verify OK  v0.7.1 is an annotated release tag on release/0.7"]
        ])
      })
    )
  )

  it.effect(
    "refuses a tag on main's commit, a tag on another line's branch, a lightweight tag and a name that is no version",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* released
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
              "err: release FAIL  v0.8.0 is not on release/0.8 as the remote holds it: a release tag deploys only from its own release branch, never from main"
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

  it.effect("passes a patch with a fix picked with changes, and names it for the approver", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* released
        yield* pickedWithChanges
        yield* releasing("patch")
        yield* published
        const said = yield* verified("v0.7.1")
        expect(A.map(said, Str.replace(/[0-9a-f]{7} (here|on main)/g, "<hash> $1"))).toEqual([
          "out: release verify OK  v0.7.1 is an annotated release tag on release/0.7\n  Picked with changes: each differs from the commit on main its message names. Nothing compares the two, so read each commit before approving the deploy:\n    fix: the count is right (<hash> here, <hash> on main)"
        ])
      })
    )
  )

  it.effect(
    "refuses a tag when it cannot tell whether main holds its commit: a main that was not fetched is not a no",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* released
          yield* git("update-ref", "-d", "refs/remotes/origin/main")
          const said = yield* verified("v0.7.0")
          expect(
            Str.startsWith(
              "err: release FAIL  whether v0.7.0 may deploy could not be told, so it may not: git could not look for the commit on origin/main:"
            )(`${said[0]}`)
          ).toBe(true)
        })
      )
  )

  it.effect(
    "refuses a tag made by hand on a commit that is not a release commit: another version in the app's file, or more files changed",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* released
          // A fix committed on the branch, tagged as it is: the app's file still says 0.7.0.
          yield* commit("d.txt", "fix: only on the release branch")
          yield* git("tag", "-a", "v0.7.1", "-m", "by hand")
          yield* published
          const version = yield* verified("v0.7.1")
          expect(version).toEqual([
            "err: release FAIL  v0.7.1 is not on a release commit as `bun run release` makes one: apps/inventory/package.json there says 0.7.0, not 0.7.1"
          ])
          // The version moved in a commit that also carries a change of its own.
          yield* byHand("0.7.2", ["extra.txt"])
          const more = yield* verified("v0.7.2")
          expect(more).toEqual([
            "err: release FAIL  v0.7.2 is not on a release commit as `bun run release` makes one: its commit changes more than the version and the notes: extra.txt"
          ])
        })
      )
  )

  it.effect(
    "refuses a patch tag made by hand over a commit main does not hold, or over a merge, however right its release commit looks",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* released
          yield* commit("d.txt", "fix: only on the release branch")
          yield* byHand("0.7.1")
          const said = yield* verified("v0.7.1")
          expect(Str.replace(/[0-9a-f]{7} /, "<hash> ")(`${said[0]}`)).toBe(
            "err: release FAIL  v0.7.1 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> fix: only on the release branch"
          )
        })
      ).pipe(
        Effect.andThen(
          inTree(
            files,
            Effect.gen(function* () {
              yield* released
              yield* git("switch", "-q", "main")
              yield* landed("g.txt", "feat: not for a patch")
              yield* git("switch", "-q", "release/0.7")
              yield* git("merge", "-q", "--no-ff", "-m", "Merge main", "main")
              yield* byHand("0.7.1")
              const said = yield* verified("v0.7.1")
              expect(Str.replace(/[0-9a-f]{7} /, "<hash> ")(`${said[0]}`)).toBe(
                "err: release FAIL  v0.7.1 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> Merge main"
              )
            })
          )
        )
      )
  )

  it.effect(
    "refuses a release commit made by hand that changes more inside a file a release may touch: a script beside the version, another line of the lockfile, a file renamed into the notes, a file made executable",
    () => {
      /** release/0.7 cut by hand from main, with what `change` does in its one release commit, tagged v0.7.0. */
      const cutByHand = <E>(change: Effect.Effect<void, E, Repo>) =>
        inTree(
          {
            ...files,
            "bun.lock": `{\n  "workspaces": {\n    "apps/inventory": {\n      "name": "@inventory/app",\n      "version": "0.6.1",\n      "dependencies": { "x": "1" },\n    },\n    "packages/a": { "name": "a", "version": "0.6.1" },\n  },\n}\n`
          },
          Effect.gen(function* () {
            yield* started
            yield* git("switch", "-q", "-c", "release/0.7")
            yield* change
            yield* git("add", "--all")
            yield* git("commit", "-q", "-m", "chore: release v0.7.0")
            yield* git("tag", "-a", "v0.7.0", "-m", "v0.7.0")
            yield* published
            const said = yield* verified("v0.7.0")
            return A.join(A.drop(Str.split(": ")(`${said[0]}`), 2), ": ")
          })
        )
      const lockAt = (version: string, x: string) =>
        `{\n  "workspaces": {\n    "apps/inventory": {\n      "name": "@inventory/app",\n      "version": "${version}",\n      "dependencies": { "x": "${x}" },\n    },\n    "packages/a": { "name": "a", "version": "0.6.1" },\n  },\n}\n`
      const wrote = Effect.fn("test.wrote")(function* (file: string, text: string) {
        const repo = yield* Repo
        yield* repo.write(repo.join(repo.root, file), text)
      })
      return Effect.gen(function* () {
        const asReleaseWrites = yield* cutByHand(
          Effect.andThen(
            wrote("apps/inventory/package.json", appFile("0.7.0")),
            wrote("bun.lock", lockAt("0.7.0", "1"))
          )
        )
        const script = yield* cutByHand(
          Effect.andThen(
            wrote(
              "apps/inventory/package.json",
              json({ name: "@inventory/app", version: "0.7.0", private: true, scripts: { postinstall: "anything" } })
            ),
            wrote("bun.lock", lockAt("0.7.0", "1"))
          )
        )
        const resolution = yield* cutByHand(
          Effect.andThen(
            wrote("apps/inventory/package.json", appFile("0.7.0")),
            wrote("bun.lock", lockAt("0.7.0", "2"))
          )
        )
        const renamed = yield* cutByHand(
          Effect.gen(function* () {
            yield* wrote("apps/inventory/package.json", appFile("0.7.0"))
            yield* wrote("bun.lock", lockAt("0.7.0", "1"))
            yield* git("mv", "a.txt", "CHANGELOG.md")
          })
        )
        const executable = yield* cutByHand(
          Effect.gen(function* () {
            yield* wrote("apps/inventory/package.json", appFile("0.7.0"))
            yield* wrote("bun.lock", lockAt("0.7.0", "1"))
            yield* git("config", "core.filemode", "false")
            yield* git("update-index", "--chmod=+x", "bun.lock")
          })
        )
        expect([asReleaseWrites, script, resolution, renamed, executable]).toEqual([
          "",
          "apps/inventory/package.json there differs from its parent's in more than the version",
          "bun.lock there differs from its parent's in more than the app's version",
          "its commit changes more than the version and the notes: a.txt",
          "a release commit edits apps/inventory/package.json and bun.lock and edits or adds CHANGELOG.md, each a plain file, and this one does otherwise to bun.lock"
        ])
      })
    }
  )

  it.effect(
    "refuses a patch whose release before it the guard refuses, though the patch's own commits are right: every release under a tag is judged, down to the line's first",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* released
          yield* commit("x.txt", "fix: never on main")
          yield* byHand("0.7.1")
          yield* git("switch", "-q", "main")
          const fix = yield* landed("c.txt", "fix: a waited row is never written over")
          yield* git("switch", "-q", "release/0.7")
          yield* git("cherry-pick", "-x", fix)
          yield* byHand("0.7.2")
          const said = yield* verified("v0.7.2")
          expect(A.map(said, Str.replace(/[0-9a-f]{7} /, "<hash> "))).toEqual([
            "err: release FAIL  v0.7.2 stands on v0.7.1, which is not a release that may deploy (the next line says why), so v0.7.2 may not either: an admin deletes or replaces v0.7.1",
            "err: release FAIL  v0.7.1 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> fix: never on main"
          ])
        })
      )
  )

  it.effect(
    "refuses a tag on a merge, a patch tag on a line with no release before it, a patch that does not hold the release before it, and a patch over a pick whose line names a commit main does not have",
    () =>
      Effect.gen(function* () {
        const why = (lines: ReadonlyArray<string>) => Str.replace(/[0-9a-f]{7} /, "<hash> ")(`${lines[0]}`)
        const merge = yield* inTree(
          files,
          Effect.gen(function* () {
            yield* released
            yield* git("switch", "-q", "main")
            yield* landed("g.txt", "feat: lands on main")
            yield* git("switch", "-q", "release/0.7")
            yield* git("merge", "-q", "--no-ff", "--no-commit", "main")
            const repo = yield* Repo
            yield* repo.write(repo.join(repo.root, "apps/inventory/package.json"), appFile("0.7.1"))
            yield* git("add", "--all")
            yield* git("commit", "-q", "-m", "chore: release v0.7.1")
            yield* git("tag", "-a", "v0.7.1", "-m", "v0.7.1")
            yield* published
            const said = yield* verified("v0.7.1")
            return why(said)
          })
        )
        const noneBefore = yield* inTree(
          files,
          Effect.gen(function* () {
            yield* started
            yield* git("switch", "-q", "-c", "release/0.9")
            yield* byHand("0.9.1")
            const said = yield* verified("v0.9.1")
            return why(said)
          })
        )
        const notHeld = yield* inTree(
          files,
          Effect.gen(function* () {
            yield* released
            // v0.7.1 exists, on a commit this line's branch never held.
            yield* git("switch", "-q", "-c", "side", "main")
            yield* commit("s.txt", "fix: on a side branch")
            yield* git("tag", "-a", "v0.7.1", "-m", "v0.7.1")
            yield* git("switch", "-q", "release/0.7")
            yield* byHand("0.7.2")
            const said = yield* verified("v0.7.2")
            return why(said)
          })
        )
        const forged = yield* inTree(
          files,
          Effect.gen(function* () {
            yield* released
            const offMain = yield* git("rev-parse", "HEAD")
            const repo = yield* Repo
            yield* repo.write(repo.join(repo.root, "d.txt"), "only here\n")
            yield* git("add", "d.txt")
            yield* git(
              "commit",
              "-q",
              "-m",
              `fix: names a commit main does not hold\n\n(cherry picked from commit ${offMain})`
            )
            yield* byHand("0.7.1")
            const said = yield* verified("v0.7.1")
            return why(said)
          })
        )
        expect([merge, noneBefore, notHeld, forged]).toEqual([
          "err: release FAIL  v0.7.1 is not on a release commit as `bun run release` makes one: its commit is a merge or has no parent, and a release commit has exactly one",
          "err: release FAIL  v0.9.1 is not on a release commit as `bun run release` makes one: there is no release of release/0.9 before it to patch",
          "err: release FAIL  v0.7.2 is not on a release commit as `bun run release` makes one: it does not hold v0.7.1, the release before it",
          "err: release FAIL  v0.7.1 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> fix: names a commit main does not hold"
        ])
      })
  )

  it.effect("refuses a first release cut by hand from commits the remote's main does not hold", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* commit("u.txt", "feat: never pushed to main")
        yield* git("switch", "-q", "-c", "release/0.7")
        yield* byHand("0.7.0")
        // Everything was pushed but main, which the remote still holds without the commit.
        yield* git("update-ref", "refs/remotes/origin/main", "main~1")
        const said = yield* verified("v0.7.0")
        expect(Str.replace(/[0-9a-f]{7} /, "<hash> ")(`${said[0]}`)).toBe(
          "err: release FAIL  v0.7.0 carries what origin/main does not hold, and a release carries only what landed on main:\n  <hash> feat: never pushed to main"
        )
      })
    )
  )
})

describe("release verify-head, what the deploy runs after CI passed on a release branch", () => {
  const head = (branch: string, commit: string) =>
    Effect.map(verifyHead({ branch, commit }), (found) => ({
      said: A.map(printed(render(tagSentence)(found)), Str.replace(/\b[0-9a-f]{7}\b/g, "<hash>")),
      tag: O.getOrElse(deployable(found), () => "none")
    }))

  it.effect("lets the head of a release branch deploy when it carries its release tag, and says which tag", () =>
    inTree(
      files,
      Effect.gen(function* () {
        yield* started
        yield* releasing("minor")
        yield* published
        const commit = yield* git("rev-parse", "HEAD")
        const result = yield* head("release/0.7", commit)
        expect(result).toEqual({
          said: ["out: release verify OK  v0.7.0 is an annotated release tag on release/0.7"],
          tag: "v0.7.0"
        })
      })
    )
  )

  it.effect(
    "the command the workflow runs writes the tag where the workflow reads it, only when the head may deploy, and exits with a failure only on a refusal",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* releasing("minor")
          yield* published
          const repo = yield* Repo
          const tagged = yield* git("rev-parse", "HEAD")
          const onMain = yield* git("rev-parse", "main")
          const bin = new URL("../src/bin.ts", import.meta.url).pathname
          const ran = Effect.fn("test.ran")(function* (branch: string, commit: string) {
            const output = repo.join(repo.root, ".git/output")
            yield* repo.write(output, "")
            const answer = yield* repo.run("bun", [bin, "release", "verify-head", branch, commit, "--output", output])
            const wrote = yield* repo.text(output)
            return { code: answer.code, wrote }
          })
          const deploys = yield* ran("release/0.7", tagged)
          yield* git("commit", "-q", "--allow-empty", "-m", "fix: pushed before it is tagged")
          yield* published
          const untagged = yield* git("rev-parse", "HEAD")
          const nothing = yield* ran("release/0.7", untagged)
          const refused = yield* ran("main", onMain)
          expect([deploys, nothing, refused]).toEqual([
            { code: 0, wrote: "tag=v0.7.0\n" },
            { code: 0, wrote: "" },
            { code: 1, wrote: "" }
          ])
        })
      )
  )

  it.effect(
    "deploys nothing, and refuses nothing, for a head with no tag yet (fixes pushed before they are tagged) and for a commit that is no longer the head",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* releasing("minor")
          yield* published
          const tagged = yield* git("rev-parse", "HEAD")
          yield* git("switch", "-q", "main")
          const fix = yield* landed("c.txt", "fix: a waited row is never written over")
          yield* git("switch", "-q", "release/0.7")
          yield* git("cherry-pick", "-x", fix)
          yield* published
          const picked = yield* git("rev-parse", "HEAD")
          const untagged = yield* head("release/0.7", picked)
          const older = yield* head("release/0.7", tagged)
          expect([untagged, older]).toEqual([
            {
              said: [
                "out: release verify NONE  release/0.7 is at <hash>, which carries no release tag: nothing deploys. A release is pushed as branch and tag together"
              ],
              tag: "none"
            },
            {
              said: ["out: release verify NONE  <hash> is no longer the head of release/0.7: nothing deploys for it"],
              tag: "none"
            }
          ])
        })
      )
  )

  it.effect(
    "refuses a branch that is no release branch, a tag of another line, two release tags on one commit, a tag `release` would not have made, and a branch it cannot read",
    () =>
      inTree(
        files,
        Effect.gen(function* () {
          yield* started
          yield* releasing("minor")
          yield* published
          const tagged = yield* git("rev-parse", "HEAD")
          const onMain = yield* git("rev-parse", "main")
          const notRelease = yield* head("main", onMain)
          const injected = yield* head("release/0.7; echo", tagged)
          const unread = yield* head("release/0.9", tagged)
          const notAHash = yield* head("release/0.7", "HEAD")
          // A second release tag on the release commit, of another line.
          yield* git("tag", "-a", "v0.8.0", "-m", "by hand")
          const two = yield* head("release/0.7", tagged)
          // A commit made on the branch and tagged by hand: the app's file still says 0.7.0.
          yield* commit("d.txt", "fix: only on the release branch")
          yield* git("tag", "-a", "v0.7.1", "-m", "by hand")
          yield* published
          const made = yield* git("rev-parse", "HEAD")
          const byHand = yield* head("release/0.7", made)
          // A new branch pointed at an old release's commit: the commit is on its own line's branch too, so only
          // the comparison of the branch CI passed on with the tag's line refuses it.
          yield* git("tag", "-d", "v0.8.0")
          yield* git("branch", "release/0.9", tagged)
          yield* published
          const otherLine = yield* head("release/0.9", tagged)
          expect(
            A.map([notRelease, injected, unread, notAHash, two, byHand, otherLine], (one) => [
              A.join(A.take(Str.split(":")(`${one.said[0]}`), 2), ":"),
              one.tag
            ])
          ).toEqual([
            ['err: release FAIL  "main" is not a release branch (release/<major>.<minor>)', "none"],
            ['err: release FAIL  "release/0.7; echo" is not a release branch (release/<major>.<minor>)', "none"],
            ["err: release FAIL  whether <hash> may deploy could not be told, so it may not", "none"],
            ["err: release FAIL  whether HEAD may deploy could not be told, so it may not", "none"],
            ["err: release FAIL  <hash> carries more than one release tag, and a release commit carries one", "none"],
            ["err: release FAIL  v0.7.1 is not on a release commit as `bun run release` makes one", "none"],
            ["err: release FAIL  v0.7.0 is not a release of release/0.9, the branch CI passed on", "none"]
          ])
        })
      )
  )
})
