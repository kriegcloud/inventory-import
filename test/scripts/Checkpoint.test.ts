import { Array as Arr, Option, String as Str } from "effect"
import { describe, expect, it } from "vitest"
import {
  SCHEDULE,
  UPLOAD_LIMIT,
  addTimelineRow,
  briefFindings,
  bumpOf,
  checkpointLine,
  decisionRound,
  hasTimeline,
  IN_USE_STALE_MINUTES,
  inUseLines,
  inUseRefusal,
  inUseStatus,
  largestParts,
  lastLook,
  nextVersion,
  notUploadedLine,
  openBriefFindings,
  parseTimeline,
  readCheckpointLog,
  readmeWriteup,
  recordsAgree,
  scheduleStatus,
  setLockfileVersion,
  setPackageVersion,
  timelineRow,
  updateTimelineRow,
  uploadLimit,
  uploadMode,
  uploadState,
  uploadWords,
  seededPeople,
  waitingDecisions,
  weightLines,
  writeupProblems,
  writeupStyle
} from "../../scripts/checkpoint-rules.mjs"
import type { LogLine } from "../../scripts/checkpoint-rules.mjs"
import { buildRecord, commandKind } from "../../scripts/session-report.mjs"

// Checkpoints (scripts/checkpoint-rules.mjs): the version rule from the commits, the records that must tell one story,
// the schedule, the decisions waiting for the person, and when an agent may upload.

describe("the version rule", () => {
  it("makes the first checkpoint 0.1.0, whatever the commits say", () => {
    expect(nextVersion({ current: "0.0.0", first: true, subjects: ["fix: typo"] })).toEqual({
      version: "0.1.0",
      bump: "minor",
      notes: []
    })
  })

  it("bumps minor when a commit adds a capability and patch otherwise", () => {
    expect(
      nextVersion({ current: "0.2.0", first: false, subjects: ["fix: totals", "feat(review): filters"] }).version
    ).toBe("0.3.0")
    expect(nextVersion({ current: "0.3.0", first: false, subjects: ["fix: totals", "docs: readme"] }).version).toBe(
      "0.3.1"
    )
    expect(Arr.map(["feat: a", "feat(api): b", "fix: c", "docs: d", "test: e", "Update README"], bumpOf)).toEqual([
      "minor",
      "minor",
      "patch",
      "patch",
      "patch",
      "patch"
    ])
  })

  it("never reaches 1.0.0: a breaking marker counts as minor and says so", () => {
    const next = nextVersion({ current: "0.4.1", first: false, subjects: ["fix(api)!: rename a field"] })
    expect(next.version).toBe("0.5.0")
    expect(next.error === undefined ? next.notes : []).toEqual([
      "a commit is marked breaking; it counts as minor (no 1.0.0 here)"
    ])
  })

  it("refuses a version it cannot read", () => {
    expect(nextVersion({ current: "next", first: false, subjects: ["fix: a"] }).error).toContain("not a plain x.y.z")
  })
})

describe("the version files", () => {
  it("changes only the project's own version in package.json and the lockfile", () => {
    const pkg = '{\n  "name": "takehome",\n  "version": "0.1.0",\n  "dependencies": { "x": "1.0.0" }\n}\n'
    expect(setPackageVersion(pkg, "0.2.0")).toBe(
      '{\n  "name": "takehome",\n  "version": "0.2.0",\n  "dependencies": { "x": "1.0.0" }\n}\n'
    )
    // npm writes the lockfile with two spaces and a final newline; the dependency's own version stays.
    const lock = (version: string) =>
      `{\n  "name": "takehome",\n  "version": "${version}",\n  "packages": {\n    "": {\n      "version": "${version}"\n    },\n` +
      `    "node_modules/x": {\n      "version": "1.0.0"\n    }\n  }\n}\n`
    expect(setLockfileVersion(lock("0.1.0"), "0.2.0")).toBe(lock("0.2.0"))
  })
})

const decisions =
  "# Decisions\n\n## Timeline\n\nTODO: one row per step.\n\n| Minute | What happened |\n| --- | --- |\n| 0 | Started. Read the brief. |\n| TODO | |\n"

describe("the records", () => {
  it("adds a checkpoint row to the Timeline before its TODO placeholder", () => {
    const row = timelineRow({
      minute: 3,
      version: "0.1.0",
      contents: "Scaffold and brief",
      upload: uploadWords(undefined)
    })
    const text = addTimelineRow(decisions, row)
    expect(text).toContain(
      "| 0 | Started. Read the brief. |\n| 3 | Checkpoint v0.1.0: Scaffold and brief. Upload: pending when this zip was made |\n| TODO | |\n"
    )
  })

  it("fills in the commit and the upload result at the next checkpoint", () => {
    const row = timelineRow({
      minute: 3,
      version: "0.1.0",
      contents: "Scaffold and brief",
      upload: uploadWords(undefined)
    })
    const text = updateTimelineRow(addTimelineRow(decisions, row), "0.1.0", {
      commit: "1a2b3c4",
      upload: uploadWords("confirmed")
    })
    expect(parseTimeline(text)).toEqual([
      {
        minute: "3",
        version: "0.1.0",
        commit: "1a2b3c4",
        contents: "Scaffold and brief",
        upload: "confirmed by the page"
      }
    ])
  })

  it("keeps a note someone wrote in a row's upload, and fills only what is empty or its own", () => {
    const pending = addTimelineRow(
      decisions,
      timelineRow({ minute: 49, version: "0.5.1", contents: "Final", upload: uploadWords(undefined) })
    )
    const handWritten = Str.replace(
      "Upload: pending when this zip was made",
      "Upload: left for Benjamin to drop in by hand"
    )(pending)
    const next = updateTimelineRow(handWritten, "0.5.1", { commit: "5c2ffbe", upload: uploadWords("unrecorded") })
    expect(parseTimeline(next)[0]).toMatchObject({
      commit: "5c2ffbe",
      upload: "left for Benjamin to drop in by hand"
    })
    const own = updateTimelineRow(pending, "0.5.1", { commit: "5c2ffbe", upload: uploadWords("confirmed") })
    expect(parseTimeline(own)[0]?.upload).toBe("confirmed by the page")
    const again = updateTimelineRow(own, "0.5.1", { upload: uploadWords("by-hand") })
    expect(parseTimeline(again)[0]?.upload).toBe("dropped in by hand by Benjamin")
    const continued = Str.replace(
      "Upload: pending when this zip was made",
      "Upload: pending when this zip was made; Benjamin also kept a copy of this version on his own disk, to compare the two later"
    )(pending)
    expect(parseTimeline(updateTimelineRow(continued, "0.5.1", { upload: uploadWords("confirmed") }))[0]?.upload).toBe(
      "confirmed by the page; Benjamin also kept a copy of this version on his own disk, to compare the two later"
    )
  })

  it("adds a Timeline section when DECISIONS.md has none", () => {
    const text = addTimelineRow(
      "# Decisions\n",
      timelineRow({ minute: 3, version: "0.1.0", contents: "A", upload: "x" })
    )
    expect(parseTimeline(text)).toHaveLength(1)
  })

  it("finds where the Timeline and the tags disagree", () => {
    const rows = addTimelineRow(
      addTimelineRow(
        decisions,
        timelineRow({ minute: 3, version: "0.1.0", contents: "Scaffold and brief", upload: "x" })
      ),
      timelineRow({ minute: 19, version: "0.2.0", contents: "Review screen", upload: "x" })
    )
    expect(recordsAgree({ decisions: rows, versions: ["0.1.0", "0.2.0"] })).toEqual([])
    expect(recordsAgree({ decisions: rows, versions: ["0.1.0"] })).toEqual([
      "DECISIONS.md's Timeline has v0.2.0, which no checkpoint made"
    ])
    expect(recordsAgree({ decisions, versions: ["0.1.0"] })).toEqual(["DECISIONS.md's Timeline has no row for v0.1.0"])
  })
})

describe("the schedule", () => {
  it("plans four checkpoints: by minute 5, 25, 45 and 58", () => {
    expect(Arr.map(SCHEDULE, (slot) => slot.by)).toEqual([5, 25, 45, 58])
  })

  it("asks for the first checkpoint by minute 5, then the slot after the last one made", () => {
    expect(scheduleStatus({ minute: 2, made: [] }).next?.by).toBe(5)
    expect(scheduleStatus({ minute: 6, made: [] }).overdue).toBe(true)
    expect(scheduleStatus({ minute: 10, made: [3] }).next?.by).toBe(25)
    expect(scheduleStatus({ minute: 26, made: [3] }).overdue).toBe(true)
    expect(scheduleStatus({ minute: 30, made: [3, 19] })).toMatchObject({ overdue: false, next: { n: 3, by: 45 } })
    expect(scheduleStatus({ minute: 59, made: [3, 22, 44, 57] }).next).toBeUndefined()
  })

  it("lets an extra checkpoint count for its window without asking for more", () => {
    expect(scheduleStatus({ minute: 33, made: [3, 19, 30] })).toMatchObject({ overdue: false, next: { n: 4, by: 58 } })
  })

  it("calls a decision round at the first checkpoint in the windows due by 25 and by 45, and nowhere else", () => {
    expect(decisionRound({ minute: 3, made: [] })).toBeUndefined()
    expect(decisionRound({ minute: 7, made: [] })).toBeUndefined()
    expect(decisionRound({ minute: 17, made: [3] })?.by).toBe(25)
    expect(decisionRound({ minute: 22, made: [3, 17] })).toBeUndefined()
    expect(decisionRound({ minute: 44, made: [3, 17] })?.by).toBe(45)
    expect(decisionRound({ minute: 49, made: [3, 17, 44] })).toBeUndefined()
  })
})

describe("the decisions waiting for the person", () => {
  const table = (...rows: ReadonlyArray<string>) =>
    `# Decisions\n\n| Decision | Options (recommended first) | Who decided | Minute | On what evidence |\n| --- | --- | --- | --- | --- |\n${Arr.join(rows, "\n")}\n`

  it("counts the rows whose Who decided cell says not decided, or the older waiting", () => {
    expect(
      waitingDecisions(
        table(
          "| Round half up; agent's default, built | Round half up (Recommended); Ask per row | not decided | 12 | the brief is silent |",
          "| Managers approve in bulk | In bulk (Recommended); One by one | Benjamin chose; agent recommended the same | 20 | |",
          "| Hide zero rows | Hide (Recommended); Show | agent's default, waiting | 31 | |"
        )
      )
    ).toBe(2)
  })

  it("does not count an answered decision, the agent's own choice, or the words elsewhere", () => {
    const text =
      table(
        "| Round half up | Round half up (Recommended); Ask | Benjamin chose against the recommendation | 12 | |",
        "| Keys in capitals | | agent, not asked | 14 | |",
        '| A blank unit means each | | Benjamin, in his own words: "each, unless the SKU says m" | 31 | |'
      ) +
      "\nThe person is waiting for the import.\n\n| Kind of row | Outcome |\n| --- | --- |\n| A row with two units | not decided |\n"
    expect(waitingDecisions(text)).toBe(0)
    expect(waitingDecisions(undefined)).toBe(0)
  })
})

const log = (...lines: ReadonlyArray<LogLine>): ReadonlyArray<LogLine> => lines
const auto = { ev: "uploads", mode: "auto", said: "upload every checkpoint", sid: "s1" }
const made = (version: string) => ({ ev: "checkpoint", version })
const upload = (version: string, result: string) => ({ ev: "upload", version, result })

describe("when an agent may upload", () => {
  it("does not upload until Benjamin turns uploads on in this session, and never quotes him", () => {
    expect(uploadMode({ lines: log(auto), sid: "s1" })).toMatchObject({
      mode: "auto",
      reason: "turned on in this session"
    })
    expect(uploadMode({ lines: log(made("0.1.0")), sid: "s1" }).mode).toBe("not asked")
    expect(uploadMode({ lines: log(auto), sid: "s2" })).toMatchObject({
      mode: "not asked",
      reason: "turned on in another session, not in this one",
      elsewhere: true
    })
    expect(uploadMode({ lines: log(auto), sid: "s1" }).elsewhere).toBe(false)
  })

  it("switches to manual for the rest of the session when the first upload is not confirmed", () => {
    const now = uploadMode({
      lines: log(auto, made("0.1.0"), upload("0.1.0", "not-confirmed"), made("0.2.0")),
      sid: "s1"
    })
    expect(now).toMatchObject({
      mode: "manual",
      reason: "the first upload of the session (v0.1.0) was not confirmed: one strike"
    })
    expect(now.unconfirmed).toEqual(["0.1.0", "0.2.0"])
  })

  it("after a confirmed first upload, tries again once and switches on the second miss in a row", () => {
    const one = log(auto, made("0.1.0"), upload("0.1.0", "confirmed"), made("0.2.0"), upload("0.2.0", "stopped"))
    expect(uploadMode({ lines: one, sid: "s1" })).toMatchObject({
      mode: "auto",
      firstPending: false,
      lastConfirmed: "0.1.0"
    })
    const two = log(...one, made("0.3.0"), upload("0.3.0", "not-confirmed"))
    expect(uploadMode({ lines: two, sid: "s1" })).toMatchObject({
      mode: "manual",
      reason: "two uploads in a row were not confirmed (v0.2.0, v0.3.0)"
    })
  })

  it("does not count a held-back checkpoint as a miss, and only Benjamin's word turns automatic back on", () => {
    const held = log(auto, made("0.1.0"), upload("0.1.0", "held"))
    expect(uploadMode({ lines: held, sid: "s1" })).toMatchObject({ mode: "auto", firstPending: true })
    const back = log(auto, upload("0.1.0", "not-confirmed"), {
      ev: "uploads",
      mode: "auto",
      said: "try again",
      sid: "s1"
    })
    expect(uploadMode({ lines: back, sid: "s1" })).toMatchObject({ mode: "auto", firstPending: true })
  })

  it("tries any zip up to 25 MB, or the size CHECKPOINT_UPLOAD_LIMIT_MB names", () => {
    expect(UPLOAD_LIMIT).toBe(25_000_000)
    expect(uploadLimit({})).toBe(25_000_000)
    expect(uploadLimit({ CHECKPOINT_UPLOAD_LIMIT_MB: "0.5" })).toBe(500_000)
    expect(uploadLimit({ CHECKPOINT_UPLOAD_LIMIT_MB: "lots" })).toBe(25_000_000)
  })

  it("skips a torn line in the local log", () => {
    expect(readCheckpointLog('{"ev":"checkpoint","version":"0.1.0"}\n{"ev":"up')).toEqual([made("0.1.0")])
  })
})

describe("the session record keeps the same facts", () => {
  it("counts a checkpoint as a checked step, and recording an upload as plain shell", () => {
    expect(commandKind('npm run checkpoint -- "Review screen"')).toBe("checkpoint")
    expect(commandKind("npm run checkpoint -- --final Write-up done")).toBe("checkpoint")
    expect(commandKind("npm run checkpoint -- --record-upload v0.2.0 confirmed Uploaded")).toBe("shell")
    expect(commandKind('npm run checkpoint -- --uploads auto "upload every checkpoint"')).toBe("shell")
  })

  it("lists each checkpoint with its upload outcome, never the page's own words", () => {
    const commits = [
      { hash: "1111111aaaa", ct: 1794571200, subject: "chore: project template" },
      { hash: "2222222bbbb", ct: 1794578400, subject: "chore: add the brief", start: true }
    ]
    const { summary } = buildRecord({
      events: [],
      commits,
      checkpoints: log(
        auto,
        {
          ev: "checkpoint",
          min: 3,
          version: "0.1.0",
          commit: "3333333",
          zip: "takehome-v0.1.0.zip",
          bytes: 4100692,
          secs: 12
        },
        { ev: "upload", version: "0.1.0", result: "confirmed", said: "Received upload 1: takehome-v0.1.0.zip" },
        {
          ev: "checkpoint",
          min: 19,
          version: "0.2.0",
          commit: "4444444",
          zip: "takehome-v0.2.0.zip",
          bytes: 4201700,
          secs: 14
        }
      )
    })
    expect(summary).toContain(
      "| v0.1.0 | 3 | `3333333` | takehome-v0.1.0.zip (4.1 MB) | 12 | confirmed by the page |\n" +
        "| v0.2.0 | 19 | `4444444` | takehome-v0.2.0.zip (4.2 MB) | 14 | no result was recorded |"
    )
    expect(summary).not.toContain("Received upload 1")
  })
})

describe("whether the last version is on the page", () => {
  const zip = "/work/stockload/submit/stockload-v0.5.1.zip"
  const cp = (version: string, final?: boolean): LogLine =>
    final === true
      ? { ev: "checkpoint", version, zip: `stockload-v${version}.zip`, final: true }
      : { ev: "checkpoint", version, zip: `stockload-v${version}.zip` }

  it("is pending while the uploader works, and uploaded once the page confirms or Benjamin drops it in", () => {
    expect(uploadState({ lines: log(auto, cp("0.2.0")), version: "0.2.0" })).toMatchObject({
      state: "pending",
      loud: false
    })
    expect(
      uploadState({ lines: log(auto, cp("0.2.0"), upload("0.2.0", "confirmed")), version: "v0.2.0" })
    ).toMatchObject({ state: "uploaded", loud: false })
    const byHand = log(auto, cp("0.2.0"), upload("0.2.0", "not-confirmed"), upload("0.2.0", "by-hand"))
    expect(uploadState({ lines: byHand, version: "0.2.0" })).toMatchObject({ state: "uploaded", loud: false })
    expect(uploadMode({ lines: byHand, sid: "s1" }).unconfirmed).toEqual([])
    const remade = log(auto, upload("0.3.0", "by-hand"), cp("0.3.0"))
    expect(uploadState({ lines: remade, version: "0.3.0" }).state).toBe("pending")
  })

  it("says in capitals, with the path, that a version the page refused or never got is NOT UPLOADED", () => {
    const refused = uploadState({ lines: log(auto, cp("0.5.1"), upload("0.5.1", "not-confirmed")), version: "0.5.1" })
    expect(refused).toMatchObject({ state: "not uploaded", loud: true })
    expect(notUploadedLine({ ...refused, zip })).toBe(
      "v0.5.1 is NOT UPLOADED: the page did not confirm it. Drop it in by hand: /work/stockload/submit/stockload-v0.5.1.zip"
    )
    const big = uploadState({
      lines: log(auto, cp("0.5.1"), {
        ev: "upload",
        version: "0.5.1",
        result: "too-big",
        bytes: 26_300_000,
        limit: UPLOAD_LIMIT
      }),
      version: "0.5.1"
    })
    expect(notUploadedLine({ ...big, zip })).toBe(
      "v0.5.1 is NOT UPLOADED: 26.3 MB, over the 25.0 MB the upload agent tries. Drop it in by hand: /work/stockload/submit/stockload-v0.5.1.zip"
    )
    expect(uploadState({ lines: log(cp("0.5.1"), upload("0.5.1", "manual")), version: "0.5.1" }).loud).toBe(true)
    expect(uploadState({ lines: log(cp("0.5.1"), upload("0.5.1", "stopped")), version: "0.5.1" }).loud).toBe(true)
  })

  it("stays quiet about a version nobody meant to upload, but never reports a final one as done until it is on the page", () => {
    expect(uploadState({ lines: log(cp("0.3.0"), upload("0.3.0", "not-asked")), version: "0.3.0" })).toMatchObject({
      state: "not asked",
      loud: false
    })
    expect(uploadState({ lines: log(cp("0.3.0"), upload("0.3.0", "held")), version: "0.3.0" }).loud).toBe(false)
    const final = uploadState({ lines: log(cp("0.5.2", true), upload("0.5.2", "not-asked")), version: "0.5.2" })
    expect(notUploadedLine({ ...final, zip: "/work/stockload/submit/stockload-v0.5.2.zip" })).toBe(
      "FINAL VERSION v0.5.2 is NOT UPLOADED: uploads were not asked for in this session. The work is not done until it is on the page. Drop it in by hand: /work/stockload/submit/stockload-v0.5.2.zip"
    )
  })

  it("writes the result in the Timeline in plain words, and the checkpoint line says NOT UPLOADED with the path", () => {
    expect(uploadWords("too-big")).toBe("not uploaded: over the upload agent's size limit; handed to Benjamin")
    expect(
      checkpointLine({
        version: "0.5.1",
        minute: 49,
        commit: "5c2ffbe",
        zip,
        bytes: 10_357_537,
        seconds: 31,
        upload: `NOT UPLOADED, over the 25.0 MB the upload agent tries: drop this file in: ${zip}`
      })
    ).toBe(
      `CHECKPOINT v0.5.1 · minute 49 · commit 5c2ffbe · ${zip} · 10.4 MB · 31 s · upload: NOT UPLOADED, over the 25.0 MB the upload agent tries: drop this file in: ${zip}`
    )
  })
})

describe("what the zip weighs", () => {
  const files = [
    { path: "docs/qa/01-review.png", bytes: 150_000 },
    { path: "docs/qa/02-done.png", bytes: 140_000 },
    { path: ".agents/skills/design-taste-frontend/library/sites.json", bytes: 280_000 },
    { path: "src/web/App.tsx", bytes: 2_000 },
    { path: ".git/index", bytes: 30_000 }
  ]
  const history = [
    { path: "docs/qa/01-review.png", bytes: 150_000 },
    { path: "docs/qa/02-done.png", bytes: 140_000 },
    { path: "docs/qa/old-review.png", bytes: 160_000 },
    { path: ".agents/skills/design-taste-frontend/library/sites.json", bytes: 281_000 },
    { path: "", bytes: 40_000 }
  ]

  it("names the three largest parts, each counted as files and in git history, replaced files included", () => {
    expect(largestParts({ files, history })).toEqual([
      { name: "docs/qa", bytes: 740_000, files: 290_000, history: 450_000, count: 3, images: 3 },
      {
        name: ".agents/skills/design-taste-frontend",
        bytes: 561_000,
        files: 280_000,
        history: 281_000,
        count: 1,
        images: 0
      },
      { name: "git commits and folder lists", bytes: 40_000, files: 0, history: 40_000, count: 0, images: 0 }
    ])
  })

  it("prints the size every time and warns in plain words over 5 MB", () => {
    expect(weightLines({ bytes: 2_700_000, parts: [] })).toEqual(["Size:    2.7 MB"])
    const lines = weightLines({ bytes: 10_357_537, parts: largestParts({ files, history }) })
    expect(lines[1]).toBe("WARN  the zip is 10.4 MB, over 5.0 MB. The three largest things in it:")
    expect(lines[2]).toBe("      docs/qa: 740 kB (3 files, 3 of them images; 290 kB as files, 450 kB in git history)")
    expect(Option.getOrElse(Arr.last(lines), () => "")).toContain("Screenshots belong in .scratch/shots/")
    const vendored = largestParts({
      files: [{ path: ".agents/skills/shadcn/assets/shadcn.png", bytes: 6_000_000 }],
      history: []
    })
    expect(Arr.join(weightLines({ bytes: 6_000_000, parts: vendored }), "\n")).not.toContain("Screenshots belong")
  })
})

describe("the final write-up against the app", () => {
  const decisions = Arr.join(
    [
      "| Decision | Who decided | Minute |",
      "| --- | --- | --- |",
      "| Round half up | agent's default, waiting | 12 |",
      "| A blank unit means each | Benjamin chose; agent recommended the same | 4 |",
      "",
      "| Kind of row | Outcome |",
      "| --- | --- |",
      "| A row with two units | not decided |",
      "",
      "75 tests pass. The last check printed Tests  75 passed (75). Six people are seeded."
    ],
    "\n"
  )

  it("fails a cell still waiting, naming the file and line, and only warns on one not decided", () => {
    const { fail, warn } = writeupProblems({ files: { "DECISIONS.md": decisions }, tests: 75, people: 6 })
    expect(fail).toEqual([
      `DECISIONS.md:3 still says "agent's default, waiting": the hour is over. Write what Benjamin decided, or "not decided".`
    ])
    expect(warn).toEqual(['DECISIONS.md:8 says "not decided". If Benjamin decided it, write his decision there.'])
  })

  it("warns where a count of tests or people differs from the check or the seed", () => {
    const readme = "- An identity seam: two seeded organizations, five people with roles.\n- 70 tests, all fast."
    const { fail, warn } = writeupProblems({
      files: { "README.md": readme, "DECISIONS.md": decisions },
      tests: 75,
      people: 6
    })
    expect(fail).toHaveLength(1)
    expect(warn).toEqual([
      'README.md:1 says "five people"; the migrations seed 6. Correct it if it means everyone seeded.',
      'README.md:2 says "70 tests"; check:full in the clean copy passed 75. Correct it if it means every test.',
      'DECISIONS.md:8 says "not decided". If Benjamin decided it, write his decision there.'
    ])
  })

  it("says nothing about tests when the check did not run, and nothing at all for a write-up that agrees", () => {
    expect(writeupProblems({ files: { "DECISIONS.md": "70 tests." }, tests: undefined, people: 6 })).toEqual({
      fail: [],
      warn: []
    })
    expect(
      writeupProblems({
        files: { "README.md": "Five people, 75 tests.", "DECISIONS.md": undefined },
        tests: 75,
        people: 5
      })
    ).toEqual({ fail: [], warn: [] })
  })

  it("counts the people the migrations seed by name: one person in two organisations is one", () => {
    const seed = Arr.join(
      [
        "INSERT INTO member (id, organizationId, name, role) VALUES",
        "  ('mem_dana', 'org_a', 'Dana Whitfield', 'admin'),",
        "  ('mem_o', 'org_a', 'Pat O''Neil', 'editor');",
        'INSERT OR IGNORE INTO "member" (id, organizationId, name, role, createdAt) VALUES',
        "  ('mem_dana_b', 'org_b', 'Dana Whitfield', 'viewer', strftime('%Y-%m-%d', 'now')),",
        "  ('mem_jo', 'org_b', 'Jo, the clerk', 'viewer', NULL);",
        "INSERT INTO item (id, name) VALUES ('i1', 'Bolt');"
      ],
      "\n"
    )
    expect(seededPeople([seed])).toBe(3)
    expect(seededPeople(["UPDATE member SET name = 'Jen' WHERE id = 'mem_dana';"])).toBe(0)
  })
})

describe("the brief as received", () => {
  const received = [
    { path: "brief/README.md", blob: "r0", commit: "c1a0c1a0c1a0" },
    { path: "brief/BRIEF.md", blob: "b1", commit: "c1a0c1a0c1a0" },
    { path: "brief/orders.csv", blob: "o1", commit: "5a3f15a3f1" }
  ]
  const asReceived = { "brief/README.md": "r0", "brief/BRIEF.md": "b1", "brief/orders.csv": "o1" }

  it("finds nothing while every file is as first committed, and lets a new sample in", () => {
    expect(briefFindings({ received, head: asReceived, worktree: ["?? brief/later.csv"], rewritten: [] })).toEqual([])
  })

  it("names a file edited or removed after it was committed, and an uncommitted edit", () => {
    const found = briefFindings({
      received,
      head: { "brief/README.md": "r0", "brief/BRIEF.md": "b2" },
      worktree: [" M brief/README.md"],
      rewritten: []
    })
    expect(Arr.map(found, (f) => f.text)).toEqual([
      "brief/BRIEF.md is not as received in c1a0c1a",
      "brief/orders.csv was removed (received in 5a3f15a)",
      "brief/README.md has an uncommitted change"
    ])
  })

  it("names the clock-start commit amended away, even with the same content, and a later one only when it differs", () => {
    const found = briefFindings({
      received,
      head: asReceived,
      worktree: [],
      rewritten: [
        { commit: "0rig1na1000", start: true, differs: ["brief/BRIEF.md"] },
        { commit: "5amec0ntent", start: true, differs: [] },
        { commit: "1atersamp1e", start: false, differs: [] },
        { commit: "0therfi1e00", start: false, differs: ["brief/orders.csv"] }
      ]
    })
    expect(Arr.map(found, (f) => f.text)).toEqual([
      "the commit that started the clock was amended or rewritten: 0rig1na is no longer in the history; not as it was there: brief/BRIEF.md",
      "the commit that started the clock was amended or rewritten: 5amec0n is no longer in the history",
      "0therfi, which added brief files, was amended or rewritten; not as it was there: brief/orders.csv"
    ])
  })

  it("goes on only with Benjamin's words, and only for the findings open when he gave them", () => {
    const edited = briefFindings({
      received,
      head: { ...asReceived, "brief/BRIEF.md": "b2" },
      worktree: [],
      rewritten: []
    })
    const lines = [{ ev: "brief-as-is", keys: Arr.map(edited, (f) => f.key), said: "Go on, and say so" }]
    expect(openBriefFindings({ findings: edited, lines })).toMatchObject({ open: [], said: ["Go on, and say so"] })
    const again = briefFindings({
      received,
      head: { ...asReceived, "brief/BRIEF.md": "b3" },
      worktree: [],
      rewritten: []
    })
    expect(openBriefFindings({ findings: again, lines }).open).toHaveLength(1)
    expect(openBriefFindings({ findings: edited, lines: [] }).open).toHaveLength(1)
  })
})

describe("the last look", () => {
  it("counts only an answer recorded after the last checkpoint", () => {
    const look = { ev: "last-look", said: "Nothing more: write it as it stands" }
    expect(lastLook({ lines: [made("0.3.0"), look] })).toEqual(look)
    expect(lastLook({ lines: [look, made("0.3.0")] })).toBeUndefined()
    expect(lastLook({ lines: [made("0.3.0")] })).toBeUndefined()
    expect(lastLook({ lines: [made("0.3.0"), { ev: "last-look", said: "" }] })).toBeUndefined()
    expect(lastLook({ lines: [look] })).toEqual(look)
  })
})

describe("a frozen copy in use", () => {
  const minute = 60_000
  const qa = { version: "0.4.1", by: "qa", t: 0 }

  it("holds while its copy runs and the mark is fresh, and refuses the step that would remove it", () => {
    const marks = inUseStatus({ marks: [qa], now: 3 * minute, running: ["0.4.1"] })
    expect(marks.live).toEqual([{ ...qa, minutes: 3 }])
    const refusal = inUseRefusal({ ...marks, step: "bun run checkpoint -- --final" })
    expect(refusal).toContain("STOPPED: bun run checkpoint -- --final removes every frozen copy, and one is in use:")
    expect(refusal).toContain("v0.4.1 in use by qa, marked 3 min ago")
    expect(refusal).toContain("--override-in-use")
  })

  it("is stale, named and ignored, when old, when its copy is gone or when its process has ended", () => {
    const old = inUseStatus({ marks: [qa], now: (IN_USE_STALE_MINUTES + 1) * minute, running: ["0.4.1"] })
    expect(old.live).toEqual([])
    expect(Arr.map(old.stale, (m) => m.why)).toEqual([`marked ${IN_USE_STALE_MINUTES + 1} min ago, over 30`])
    const gone = inUseStatus({ marks: [qa], now: minute, running: ["0.5.0"] })
    expect(Arr.map(gone.stale, (m) => m.why)).toEqual(["its copy is not running"])
    const ended = inUseStatus({
      marks: [{ ...qa, pid: 4242 }],
      now: minute,
      running: ["0.4.1"],
      pidAlive: () => false
    })
    expect(Arr.map(ended.stale, (m) => m.why)).toEqual(["process 4242 has ended"])
    expect(inUseLines(ended)).toEqual([
      "  v0.4.1 marked by qa: STALE (process 4242 has ended); ignored. Clear it: --done v0.4.1 qa"
    ])
  })
})

describe("the write-up's length and words", () => {
  it("warns, never fails, past the budget and on words about how the hour was run", () => {
    const decisions = Arr.join(
      [
        "# Decisions",
        "The builder relayed round three's answers at minute 41.",
        "Lead time is read from the vendor sheet; the lead time column is kept."
      ],
      "\n"
    )
    const warned = writeupStyle({ files: { "DECISIONS.md": decisions }, budget: { readme: 700, decisions: 10 } })
    expect(warned).toHaveLength(2)
    expect(Arr.getUnsafe(warned, 0)).toMatch(/^DECISIONS\.md is \d+ words, over the 10 a reader gives it/)
    const words = Arr.getUnsafe(warned, 1)
    expect(words).toContain('DECISIONS.md:2 says "builder"')
    expect(words).toContain('DECISIONS.md:2 says "relayed"')
    expect(words).toContain('DECISIONS.md:2 says "round three"')
    expect(words).toContain('DECISIONS.md:2 says "at minute 41"')
    expect(words).not.toContain("DECISIONS.md:3")
    const branches = writeupStyle({
      files: { "DECISIONS.md": "The docs review is on branch `claude/docs-review-de2b02`, in a worktree." }
    })
    expect(Arr.getUnsafe(branches, 0)).toContain('says "branch `claude/docs-review-de2b02`"')
    expect(Arr.getUnsafe(branches, 0)).toContain('says "worktree"')
  })

  it("reads only README's own part, not the starter's reference sections after it", () => {
    const readme =
      "# App\n\nWhat it does.\n\n## Run it\n\nbun run dev\n\n## What is in the repository\n\n- /lead, the builder"
    expect(readmeWriteup(readme)).not.toContain("builder")
    expect(writeupStyle({ files: { "README.md": readme } })).toEqual([])
  })

  it("keeps a Timeline only where DECISIONS.md has one", () => {
    expect(hasTimeline("# Decisions\n\n## Timeline\n\n| Minute | What happened |")).toBe(true)
    expect(hasTimeline("# Decisions\n\n## Where it stands\n")).toBe(false)
  })
})
