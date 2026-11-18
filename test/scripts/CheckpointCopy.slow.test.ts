// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Array as Arr, Option, pipe, String as Str } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// The frozen copy (scripts/checkpoint-copy.mjs): made from a tag, kept beside the next one and stopped by the one after
// it, removed by stop, and never in the zip. Slow: it runs git, a server and the pack on a small fixture project in a temporary folder, with a stand-in
// for Vite (build writes dist/, preview and dev answer every request with their mode and folder).

const fakeVite = `import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
const args = process.argv.slice(2)
if (args[0] === "build") {
  mkdirSync("dist", { recursive: true })
  writeFileSync("dist/index.html", "built")
} else {
  const port = Number(args[args.indexOf("--port") + 1])
  const mode = args[0] === "preview" ? "preview" : "dev"
  // A version holding refuse-preview stands for a production build that will not start: it answers 500.
  const refuses = mode === "preview" && existsSync("refuse-preview")
  createServer((request, response) => {
    response.statusCode = refuses ? 500 : 200
    response.end(mode + " " + process.cwd())
  }).listen(port, "localhost")
}
`
const fakeMigrate = `import { mkdirSync, writeFileSync } from "node:fs"
mkdirSync(".wrangler/state", { recursive: true })
writeFileSync(".wrangler/state/migrated", process.cwd())
`
// A fixture key file: a made-up value, never a real key.
const fixtureKey = "FIXTURE_KEY=fixture-value-for-the-copy-test-0123456789\n"

let base = ""
let project = ""
const run = (command: string, args: ReadonlyArray<string>, cwd?: string) => {
  const result = spawnSync(command, args, { cwd: cwd ?? project, encoding: "utf8" })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}
const git = (...args: ReadonlyArray<string>) =>
  run("git", [
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "-c",
    "commit.gpgsign=false",
    ...args
  ])
// Its own range of ports: a real checkpoint's copy may be starting on 5273 and up while this runs in its clean copy.
const copyScript = (...args: ReadonlyArray<string>) =>
  run("env", ["CHECKPOINT_COPY_PORT=6273", process.execPath, "scripts/checkpoint-copy.mjs", ...args])
const fetchText = (url: string) => run("curl", ["-s", "--max-time", "5", url]).out
const urlOf = (out: string) =>
  pipe(
    Str.match(/at (http:\/\/localhost:\d+)/)(out),
    Option.flatMap((found) => Arr.get(found, 1)),
    Option.getOrElse(() => "no address printed")
  )
/** The text after a marker, or nothing: the address of the copy a status line names second. */
const after = (text: string, marker: string) =>
  pipe(
    Arr.get(Str.split(text, marker), 1),
    Option.getOrElse(() => "")
  )
const write = (path: string, text: string) => {
  mkdirSync(join(project, path, ".."), { recursive: true })
  writeFileSync(join(project, path), text)
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "checkpoint-copy-"))
  project = join(base, "fixture")
  mkdirSync(project)
  write("package.json", '{ "name": "fixture", "version": "0.1.0", "private": true }\n')
  write(".gitignore", "node_modules\n.frozen/\n.dev.vars\nsubmit/\n.wrangler\ndist\n")
  write("README.md", "# Fixture\n")
  write("DECISIONS.md", "# Decisions\n")
  write("scripts/migrate-local.mjs", fakeMigrate)
  // The test accounts' file in the shape scripts/dev-accounts.mjs writes it: the copy reads its sign-in from there.
  write(
    "scripts/dev-accounts.sql",
    "-- Every account's password is 'fixture-password'.\nINSERT OR IGNORE INTO \"user\" (id, name, email) VALUES ('usr_a', 'Ann Example', 'ann@fixture.test');\n"
  )
  for (const name of ["checkpoint-copy.mjs", "checkpoint-rules.mjs", "checkpoint.mjs", "session-log.mjs"])
    copyFileSync(join("scripts", name), join(project, "scripts", name))
  copyFileSync("scripts/pack.sh", join(project, "scripts/pack.sh"))
  write("node_modules/vite/package.json", '{ "name": "vite", "type": "module" }\n')
  write("node_modules/vite/bin/vite.js", fakeVite)
  write("node_modules/left-pad/index.js", "export default 1\n")
  write("node_modules/.vite/deps/cache.txt", "the project's own cache\n")
  write(".dev.vars", fixtureKey)
  expect(run("git", ["init", "-q", "-b", "main"]).status).toBe(0)
  git("add", "-A")
  git("commit", "-q", "-m", "chore: fixture")
  git("tag", "-a", "--no-sign", "-m", "v0.1.0", "v0.1.0")
  write("package.json", '{ "name": "fixture", "version": "0.2.0", "private": true }\n')
  git("commit", "-q", "-am", "feat: second version")
  git("tag", "-a", "--no-sign", "-m", "v0.2.0", "v0.2.0")
  write("package.json", '{ "name": "fixture", "version": "0.3.0", "private": true }\n')
  git("commit", "-q", "-am", "feat: third version")
  git("tag", "-a", "--no-sign", "-m", "v0.3.0", "v0.3.0")
})

afterAll(() => {
  copyScript("stop")
  rmSync(base, { recursive: true, force: true })
})

describe("the frozen copy of a checkpoint", () => {
  it("is a worktree of the tag with linked modules, the key file and its own database, and answers on its own port", () => {
    const started = copyScript("start", "0.1.0")
    expect(started.status).toBe(0)
    expect(started.out).toContain("Frozen copy: v0.1.0 at http://localhost:")
    const copy = join(project, ".frozen", "v0.1.0")
    expect(run("git", ["-C", copy, "rev-parse", "HEAD"]).out).toBe(git("rev-parse", "v0.1.0^{commit}").out)
    expect(lstatSync(join(copy, "node_modules", "left-pad")).isSymbolicLink()).toBe(true)
    expect(existsSync(join(copy, "node_modules", ".vite"))).toBe(false)
    expect(readFileSync(join(copy, ".dev.vars")).equals(readFileSync(join(project, ".dev.vars")))).toBe(true)
    expect(readFileSync(join(copy, ".wrangler", "state", "migrated"), "utf8")).toBe(copy)
    expect(existsSync(join(project, ".wrangler"))).toBe(false)
    expect(fetchText(urlOf(started.out))).toBe(`preview ${copy}`)
    // A production build shows only its sign-in page: the line says how to sign in, from the copy's test accounts.
    expect(started.out).toContain("sign in as ann@fixture.test, password fixture-password")
    expect(existsSync(join(project, ".frozen", "v0.1.0.pid"))).toBe(true)
    expect(git("status", "--porcelain").out).toBe("")
  })

  it("keeps the copy before it running beside the next checkpoint's copy, so a pass on it can finish", () => {
    const first = urlOf(copyScript("status").out)
    const started = copyScript("start", "0.2.0")
    expect(started.status).toBe(0)
    const copy = join(project, ".frozen", "v0.2.0")
    expect(fetchText(urlOf(started.out))).toBe(`preview ${copy}`)
    expect(fetchText(first)).toBe(`preview ${join(project, ".frozen", "v0.1.0")}`)
    expect(started.out).toContain(`v0.1.0 still runs at ${first} for a pass on it; the next checkpoint stops it.`)
    const worktrees = git("worktree", "list", "--porcelain").out
    expect(worktrees).toContain("/.frozen/v0.2.0")
    expect(worktrees).toContain("/.frozen/v0.1.0")
    expect(copyScript("status").out).toContain("Frozen copy: v0.2.0 at http://localhost:")
  })

  it("stops a copy two versions back: its folder and worktree are gone, the one before stays", () => {
    const first = urlOf(after(copyScript("status").out, "v0.1.0 still runs"))
    const second = urlOf(copyScript("status").out)
    const started = copyScript("start", "0.3.0")
    expect(started.status).toBe(0)
    expect(fetchText(urlOf(started.out))).toBe(`preview ${join(project, ".frozen", "v0.3.0")}`)
    expect(fetchText(first)).toBe("")
    expect(fetchText(second)).toBe(`preview ${join(project, ".frozen", "v0.2.0")}`)
    expect(existsSync(join(project, ".frozen", "v0.1.0"))).toBe(false)
    const worktrees = git("worktree", "list", "--porcelain").out
    expect(worktrees).toContain("/.frozen/v0.3.0")
    expect(worktrees).toContain("/.frozen/v0.2.0")
    expect(worktrees).not.toContain("/.frozen/v0.1.0")
    expect(readFileSync(join(project, "node_modules", "left-pad", "index.js"), "utf8")).toBe("export default 1\n")
    expect(copyScript("status").out).toContain("Frozen copy: v0.3.0 at http://localhost:")
    expect(copyScript("status").out).toContain("v0.2.0 still runs at")
  })

  it("never reaches the zip, even while it runs", () => {
    expect(copyScript("status").out).toContain("v0.3.0")
    const packed = run("env", ["-u", "TAKEHOME_PRIVATE_MARKERS", "bash", "scripts/pack.sh", "--quick"])
    expect(packed.status).toBe(0)
    const entries = Str.split(run("unzip", ["-Z1", join(project, "submit", "fixture-v0.3.0.zip")]).out, "\n")
    expect(entries).toContain("fixture/package.json")
    const unwanted = [".frozen", ".git/worktrees", ".dev.vars"]
    expect(Arr.filter(entries, (entry) => Arr.some(unwanted, (part) => Str.includes(part)(entry)))).toEqual([])
  })

  it("is not removed while an agent has marked it in use, unless that is overridden", () => {
    const checkpoint = (...args: ReadonlyArray<string>) =>
      run("env", ["CHECKPOINT_COPY_PORT=6273", process.execPath, "scripts/checkpoint.mjs", ...args])
    expect(checkpoint("--use", "v0.3.0", "qa").out).toContain("v0.3.0 marked in use by qa")
    expect(copyScript("status").out).toContain("In use: v0.3.0 by qa.")
    for (const step of [["--stop"], ["--final", "Write-up done"]]) {
      const refused = checkpoint(...step)
      expect(refused.status).toBe(1)
      expect(refused.out).toContain("removes every frozen copy, and one is in use:")
      expect(refused.out).toContain("v0.3.0 in use by qa, marked 0 min ago")
    }
    expect(existsSync(join(project, ".frozen", "v0.3.0"))).toBe(true)
    // A mark on a copy that no longer runs is stale: named, and it stops nothing.
    expect(checkpoint("--use", "v0.1.0", "reviewer").status).toBe(0)
    expect(checkpoint("--in-use").out).toContain("v0.1.0 marked by reviewer: STALE (its copy is not running)")
    expect(checkpoint("--done", "v0.1.0", "reviewer").out).toContain("no longer in use by reviewer")
    expect(checkpoint("--done", "v0.3.0", "qa").out).toContain("v0.3.0 no longer in use by qa")
    expect(checkpoint("--in-use").out).toContain("none marked in use")
    // Marked again, then overridden in Benjamin's words: the copies go, the marks with them.
    checkpoint("--use", "v0.3.0", "qa")
    const overridden = checkpoint("--stop", "--override-in-use")
    expect(overridden.status).toBe(0)
    expect(overridden.out).toContain("--override-in-use: removing the frozen copies")
    expect(existsSync(join(project, ".frozen"))).toBe(false)
    // The next test stops copies itself: start them again as they were.
    expect(copyScript("start", "0.2.0").status).toBe(0)
    expect(copyScript("start", "0.3.0").status).toBe(0)
  })

  it("is stopped and removed by stop, leaving the project as it was", () => {
    const status = copyScript("status").out
    const url = urlOf(status)
    const before = urlOf(after(status, "v0.2.0 still runs"))
    expect(copyScript("stop").out).toContain("every copy stopped and removed")
    expect(fetchText(url)).toBe("")
    expect(fetchText(before)).toBe("")
    expect(existsSync(join(project, ".frozen"))).toBe(false)
    expect(git("worktree", "list", "--porcelain").out).not.toContain(".frozen")
    expect(existsSync(join(project, "node_modules", "left-pad", "index.js"))).toBe(true)
    expect(existsSync(join(project, "node_modules", ".vite", "deps", "cache.txt"))).toBe(true)
    expect(copyScript("status").out).toBe("Frozen copy: none running.\n")
  })

  it("serves the dev server when the production build does not answer", () => {
    write("refuse-preview", "\n")
    git("add", "-A")
    git("commit", "-q", "-m", "fix: a version whose production build will not start")
    git("tag", "-a", "--no-sign", "-m", "v0.2.1", "v0.2.1")
    const started = copyScript("start", "0.2.1")
    expect(started.out).toContain("(dev server)")
    expect(fetchText(urlOf(started.out))).toBe(`dev ${join(project, ".frozen", "v0.2.1")}`)
    copyScript("stop")
    expect(existsSync(join(project, ".frozen"))).toBe(false)
  })
})
