// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DateTime, String as Str } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// The brief stays as received (scripts/checkpoint.mjs, the rules in scripts/checkpoint-rules.mjs): a checkpoint is
// refused once a committed file under brief/ is edited or the commit that started the clock is amended, until
// Benjamin says to go on; and the final one is refused until his last look is recorded. Slow: it runs git and the
// checkpoint command on small fixture repositories in a temporary folder. Every case here stops before a version is
// made, so nothing is packed.

let base = ""
const scripts = ["checkpoint.mjs", "checkpoint-rules.mjs", "checkpoint-copy.mjs", "session-log.mjs"]
const identity = ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "commit.gpgsign=false"]
/** A commit hash as the checkpoint names it, its first seven characters. */
const short = (hash: string) => Str.slice(0, 7)(hash)

/** A fixture project: the scripts, a package at 0.0.0, a first commit, then the brief's commit. */
const fixture = (name: string) => {
  const dir = join(base, name)
  const run = (command: string, args: ReadonlyArray<string>, env?: Readonly<Record<string, string>>) => {
    const result = spawnSync(command, args, { cwd: dir, encoding: "utf8", env: { ...process.env, ...env } })
    return { status: result.status, out: `${result.stdout}${result.stderr}` }
  }
  const write = (path: string, text: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  const dateOf = (minutesAgo: number) =>
    `@${Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 1000) - minutesAgo * 60} +0000`
  const commit = (message: string, minutesAgo: number) => {
    const date = dateOf(minutesAgo)
    run("git", ["add", "-A"])
    run("git", [...identity, "commit", "-q", "-m", message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
    return Str.trim(run("git", ["rev-parse", "HEAD"]).out)
  }
  const checkpoint = (...args: ReadonlyArray<string>) => run(process.execPath, ["scripts/checkpoint.mjs", ...args])
  mkdirSync(join(dir, "scripts"), { recursive: true })
  for (const script of scripts) copyFileSync(join("scripts", script), join(dir, "scripts", script))
  write("package.json", '{ "name": "fixture", "version": "0.0.0", "private": true }\n')
  write(".gitignore", ".session/\nsubmit/\n.frozen/\n")
  write("DECISIONS.md", "# Decisions\n")
  write("brief/README.md", "# Brief\n")
  run("git", ["init", "-q", "-b", "main"])
  commit("chore: project template", 40)
  write("brief/BRIEF.md", "# The brief\n\nImport the orders.\nSubmit your code as a .zip before the timer ends.\n")
  write("brief/orders.csv", "order,line\n")
  const brief = commit("docs: add the brief and its sample files as received", 10)
  return { dir, run, write, commit, checkpoint, brief, dateOf }
}

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "checkpoint-brief-"))
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe("the brief stays as received", () => {
  let project: ReturnType<typeof fixture>

  beforeAll(() => {
    project = fixture("edited")
  })

  it("is as received after the brief's commit, a sample saved later included", () => {
    project.write("brief/later.csv", "order,line\n")
    project.commit("docs: a sample file saved later", 8)
    const status = project.checkpoint("--status")
    expect(status.status).toBe(0)
    expect(status.out).toContain(`Brief: as received since ${short(project.brief)}.`)
  })

  it("refuses a checkpoint once a committed brief file is edited, names it, and makes no version", () => {
    project.write("brief/BRIEF.md", "# The brief\n\nImport the orders.\n")
    project.commit("docs: drop a line of the brief", 6)
    const refused = project.checkpoint("Plain import")
    expect(refused.status).toBe(1)
    expect(refused.out).toContain("STOPPED: brief/ is the brief as received")
    expect(refused.out).toContain(`brief/BRIEF.md is not as received in ${short(project.brief)}`)
    expect(refused.out).toContain("Stop and ask Benjamin")
    expect(refused.out).not.toContain("later.csv")
    expect(readFileSync(join(project.dir, "package.json"), "utf8")).toContain('"version": "0.0.0"')
    expect(Str.trim(project.run("git", ["tag"]).out)).toBe("")
  })

  it("names an uncommitted edit too, and is as received again once the file is put back", () => {
    project.write("brief/orders.csv", "order,line,qty\n")
    expect(project.checkpoint("--status").out).toContain("brief/orders.csv has an uncommitted change")
    project.run("git", ["checkout", "--", "brief/orders.csv"])
    project.run("git", ["checkout", project.brief, "--", "brief/BRIEF.md"])
    project.commit("docs: put the brief back as received", 5)
    expect(project.checkpoint("--status").out).toContain(`Brief: as received since ${short(project.brief)}.`)
  })
})

describe("the commit that started the clock stands", () => {
  let project: ReturnType<typeof fixture>

  beforeAll(() => {
    project = fixture("amended")
  })

  it("refuses once that commit is amended, even with its dates kept, and names what differs", () => {
    project.write("brief/BRIEF.md", "# The brief\n\nImport the orders.\n")
    project.run("git", ["add", "-A"])
    const date = Str.trim(project.run("git", ["log", "-1", "--format=%cI"]).out)
    project.run("git", [...identity, "commit", "-q", "--amend", "--no-edit"], { GIT_COMMITTER_DATE: date })
    const amended = Str.trim(project.run("git", ["rev-parse", "HEAD"]).out)
    expect(amended).not.toBe(project.brief)
    const refused = project.checkpoint("The scaffold")
    expect(refused.status).toBe(1)
    expect(refused.out).toContain(`has changed since the clock started at ${short(amended)}`)
    expect(refused.out).toContain(
      `the commit that started the clock was amended or rewritten: ${short(project.brief)} is no longer in the history; not as it was there: brief/BRIEF.md`
    )
    // The file is received as the commit that was amended away held it, so it can be put back from there.
    expect(refused.out).toContain(`brief/BRIEF.md is not as received in ${short(project.brief)}`)
    expect(refused.out).toContain("A commit amended or rewritten cannot be put back")
  })

  it("is left with only the rewrite once the file is put back from the commit that held it first", () => {
    project.run("git", ["checkout", project.brief, "--", "brief/BRIEF.md"])
    project.commit("docs: put the brief back as received", 3)
    const status = project.checkpoint("--status").out
    expect(status).toContain("Brief: NOT AS RECEIVED")
    expect(status).toContain("is no longer in the history")
    expect(status).not.toContain("brief/BRIEF.md is not as received")
  })

  it("goes on with Benjamin's words, and only for what was open when he said them", () => {
    const recorded = project.checkpoint("--brief-as-is", "Go on as it is, and say so in the write-up")
    expect(recorded.status).toBe(0)
    expect(recorded.out).toContain("Recorded: Benjamin said to go on with brief/ as it is")
    expect(project.checkpoint("--status").out).toContain(
      "Brief: not as received, and Benjamin said to go on (“Go on as it is, and say so in the write-up”)."
    )
    project.write("brief/orders.csv", "order,line,qty\n")
    project.commit("docs: change a sample", 2)
    const again = project.checkpoint("--status").out
    expect(again).toContain("Brief: NOT AS RECEIVED")
    expect(again).toContain("brief/orders.csv is not as received")
    expect(again).not.toContain("no longer in the history")
  })

  it("refuses --brief-as-is without his words", () => {
    expect(project.checkpoint("--brief-as-is").status).toBe(1)
  })
})

describe("the final checkpoint comes after the last look", () => {
  let project: ReturnType<typeof fixture>

  beforeAll(() => {
    project = fixture("final")
    project.run("git", [...identity, "tag", "-a", "--no-sign", "-m", "v0.1.0", "v0.1.0"])
  })

  it("refuses --final until Benjamin's last look is recorded, and makes no version", () => {
    const refused = project.checkpoint("--final", "Write-up done")
    expect(refused.status).toBe(1)
    expect(refused.out).toContain("STOPPED: no last look recorded since v0.1.0. No version was made.")
    expect(refused.out).toContain('bun run checkpoint -- --last-look "<his answer>"')
    expect(readFileSync(join(project.dir, "package.json"), "utf8")).toContain('"version": "0.0.0"')
    expect(project.checkpoint("--status").out).toContain("Last look: not asked since v0.1.0")
  })

  it("records his answer, which the status then shows", () => {
    expect(project.checkpoint("--last-look").status).toBe(1)
    const recorded = project.checkpoint("--last-look", "Nothing more: write it as it stands")
    expect(recorded.status).toBe(0)
    expect(project.checkpoint("--status").out).toContain("Last look: “Nothing more: write it as it stands”.")
  })
})
