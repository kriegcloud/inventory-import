// @effect-diagnostics nodeBuiltinImport:off
import { spawnSync } from "node:child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { DateTime, String as Str } from "effect"
import { afterAll, beforeAll, describe, expect, it } from "vitest"

// When the hour starts (scripts/clock.mjs, with the rule in scripts/session-log.mjs): at the first commit that adds a
// file under brief/ other than brief/README.md, never at a commit made before it. Slow: it runs git and the clock on
// a small fixture repository in a temporary folder.

let base = ""
let project = ""
const run = (command: string, args: ReadonlyArray<string>, env?: Readonly<Record<string, string>>) => {
  const result = spawnSync(command, args, { cwd: project, encoding: "utf8", env: { ...process.env, ...env } })
  return { status: result.status, out: `${result.stdout}${result.stderr}` }
}
const write = (path: string, text: string) => {
  mkdirSync(join(project, path, ".."), { recursive: true })
  writeFileSync(join(project, path), text)
}
/** A commit dated `minutesAgo` minutes before now, so the clock has a known minute to report. */
const commit = (message: string, minutesAgo: number) => {
  const date = `@${Math.floor(DateTime.toEpochMillis(DateTime.nowUnsafe()) / 1000) - minutesAgo * 60} +0000`
  run("git", ["add", "-A"])
  const identity = ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.test", "-c", "commit.gpgsign=false"]
  run("git", [...identity, "commit", "-q", "-m", message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
  return Str.trim(run("git", ["rev-parse", "--short=7", "HEAD"]).out)
}
const clock = (...args: ReadonlyArray<string>) => Str.trim(run(process.execPath, ["scripts/clock.mjs", ...args]).out)
/** The clock as the session with this id sees it: Claude Code names the session in each command's environment. */
const clockIn = (session: string) =>
  Str.trim(run(process.execPath, ["scripts/clock.mjs", "--short"], { CLAUDE_CODE_SESSION_ID: session }).out)

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), "clock-start-"))
  project = join(base, "fixture")
  mkdirSync(join(project, "scripts"), { recursive: true })
  for (const name of ["clock.mjs", "checkpoint-rules.mjs", "session-log.mjs"]) {
    copyFileSync(join("scripts", name), join(project, "scripts", name))
  }
  write("package.json", '{ "name": "fixture", "version": "0.0.0", "private": true }\n')
  write("brief/README.md", "# Brief\n")
  expect(run("git", ["init", "-q", "-b", "main"]).status).toBe(0)
  commit("chore: project template", 40)
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe("the clock starts at the brief", () => {
  it("has not started on the template alone", () => {
    expect(clock("--short")).toBe("timer not started")
  })

  it("is not started by a commit made before the brief", () => {
    write("src/web/components/review/ReviewRegion.tsx", "export {}\n")
    commit("chore: bring files across", 30)
    expect(clock("--short")).toBe("timer not started")
    expect(clock()).toContain("The timer has not started: no commit has added the brief yet.")
  })

  it("starts at the commit that adds the brief, and counts the minutes from it", () => {
    write("brief/BRIEF.md", "# The brief\n")
    write("brief/orders.csv", "order,line\n")
    const brief = commit("docs: add the brief and its sample files as received", 7)
    expect(clock("--short")).toMatch(/^min 7\/60 · understand · /)
    expect(clock()).toContain(`Minute 7 of 60, counted from ${brief} (the commit that added the brief). 53 left.`)
  })

  it("stays at the brief commit through later commits, a later brief file too", () => {
    write("brief/notes.md", "Notes\n")
    commit("docs: Benjamin's notes on the brief", 2)
    write("src/web/App.tsx", "export {}\n")
    commit("feat: the first screen", 1)
    expect(clock("--short")).toMatch(/^min 7\/60 · /)
  })
})

describe("the page's own start", () => {
  it("counts page minutes first once the page's start is given, with the commit's minute beside them", () => {
    const pageStart = DateTime.formatIso(DateTime.subtract(DateTime.nowUnsafe(), { minutes: 9 }))
    expect(clock("--page-start", pageStart)).toContain("Page start remembered: ")
    // The phase and the schedule follow the page: minute 9 is past the understand phase and the first checkpoint.
    expect(clock("--short")).toMatch(
      /^min 9\/60 \(page; 7 by commit\) · build · no checkpoint yet · CHECKPOINT OVERDUE/
    )
    const long = clock()
    expect(long).toContain("Page minute 9 of 60: the page started at ")
    expect(long).toContain("51 left on the page")
    expect(long).toMatch(
      /By the commit: minute 7 of 60, counted from [0-9a-f]{7} \(the commit that added the brief\)\./
    )
    rmSync(join(project, ".session", "page-start.json"))
    expect(clock("--short")).toMatch(/^min 7\/60 · /)
    expect(clock()).toContain("The page's own start is not recorded")
  })

  it("refuses a page start it cannot read", () => {
    const refused = run(process.execPath, ["scripts/clock.mjs", "--page-start", "soon"])
    expect(refused.status).toBe(1)
    expect(refused.out).toContain("Use --page-start 08:28:58")
  })
})

describe("whose uploads the clock shows", () => {
  it("says auto in the session that turned uploads on, and in another session that they are on there", () => {
    write(
      ".session/checkpoints.jsonl",
      '{"ev":"uploads","mode":"auto","said":"upload every checkpoint","sid":"b0i1der0"}\n'
    )
    // The hooks' log ends with the other session's line: the environment decides, not the last line.
    write(".session/events.jsonl", '{"sid":"1ead0000","ev":"shell"}\n')
    expect(clockIn("b0i1der0-1111-2222-3333-444455556666")).toMatch(/ · uploads auto$/)
    expect(clockIn("1ead0000-1111-2222-3333-444455556666")).toMatch(/ · uploads auto in another session$/)
  })
})
