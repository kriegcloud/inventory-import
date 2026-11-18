// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Array as Arr, pipe, String as Str } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// scripts/pack.sh reads each value in .dev.vars to prove it is nowhere in the zip. Run with `bash -x`, a script prints
// every command with its values filled in, so the pack turns tracing off around that check. This proves it on a small
// fixture project with a fixture key file holding a made-up value; it never touches the project's own .dev.vars.
// Slow: each case runs git, bash and zip.

const fakeValue = "fixture-value-0123456789-not-a-real-key"
let base = ""
let project = ""
const run = (command: string, args: ReadonlyArray<string>) => {
  const result = spawnSync(command, args, { cwd: project, encoding: "utf8" })
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
// Traced, with the marker variable unset so the pack needs nothing but this fixture.
const traced = (script: string) => run("env", ["-u", "TAKEHOME_PRIVATE_MARKERS", "bash", "-x", script, "--quick"])
const write = (path: string, text: string) => writeFileSync(join(project, path), text)
const release = (version: string, message: string) => {
  write("package.json", `{ "name": "fixture", "version": "${version}", "private": true }\n`)
  git("add", "-A")
  git("commit", "-q", "-m", message)
  git("tag", "-a", "--no-sign", "-m", `v${version}`, `v${version}`)
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "pack-trace-"))
  project = join(base, "fixture")
  mkdirSync(join(project, "scripts"), { recursive: true })
  copyFileSync("scripts/pack.sh", join(project, "scripts/pack.sh"))
  write(".gitignore", ".dev.vars\nsubmit/\n")
  write("README.md", "# Fixture\n")
  write("DECISIONS.md", "# Decisions\n")
  write(".dev.vars", `# a fixture key file\nFIXTURE_KEY="${fakeValue}"\n`)
  expect(run("git", ["init", "-q", "-b", "main"]).status).toBe(0)
  release("0.1.0", "chore: fixture")
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe("the pack under bash -x", () => {
  it("prints no value from the key file, though it traces everything else", () => {
    const packed = traced("scripts/pack.sh")
    expect(packed.status).toBe(0)
    expect(packed.out).toContain("Zip:")
    expect(packed.out).not.toContain(fakeValue)
  })

  it("would print it without the guard lines: the test can see a leak", () => {
    const unguarded = pipe(
      Str.split(readFileSync(join(project, "scripts/pack.sh"), "utf8"), "\n"),
      Arr.filter((line) => !Str.endsWith("# no-trace")(line)),
      Arr.join("\n")
    )
    writeFileSync(join(base, "pack-unguarded.sh"), unguarded)
    expect(traced(join(base, "pack-unguarded.sh")).out).toContain(fakeValue)
  })

  it("still finds the value once it is committed, and names the key, never the value", () => {
    write("notes.txt", `pasted by mistake: ${fakeValue}\n`)
    release("0.2.0", "docs: notes")
    const packed = traced("scripts/pack.sh")
    expect(packed.status).toBe(1)
    expect(packed.out).toContain("the value of FIXTURE_KEY from .dev.vars is in the tree")
    expect(packed.out).toContain("the value of FIXTURE_KEY from .dev.vars is in git history")
    expect(packed.out).not.toContain(fakeValue)
  })
})
