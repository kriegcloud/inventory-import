// Prints where we are in the hour. The hour starts at the commit that adds the brief: the first commit that adds a
// file under brief/ other than brief/README.md (`readClockStart` in scripts/session-log.mjs). A commit before it, such
// as files brought in before the brief arrived, does not start it. Run `bun run clock`; `--short` is for a status line.
// It also says which checkpoint is next and when it is due (the schedule is in scripts/checkpoint-rules.mjs),
// whether checkpoints are uploaded automatically, by hand, or not at all in this session, and how many product
// decisions are waiting for Benjamin (rows marked "not decided" in DECISIONS.md). When the last version is meant for
// the page and is not on it, it says so in capitals with the zip's path, in both forms.
// The upload page's own timer starts when Benjamin presses Start, usually a minute or so before the brief's commit,
// and it is the one that ends the hour. `bun run clock -- --page-start 08:28:58` (the time the page showed, or an ISO
// time) remembers it in .session/page-start.json; from then on the clock counts page minutes first, with the minute by
// the brief's commit beside it. The checkpoint's own records keep the commit's minutes.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  notUploadedLine,
  readCheckpointLog,
  scheduleStatus,
  sortVersions,
  uploadMode,
  uploadState,
  waitingDecisions
} from "./checkpoint-rules.mjs"
import { readClockStart } from "./session-log.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const git = (...args) =>
  execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
const short = process.argv.includes("--short")
const PAGE_FILE = join(ROOT, ".session", "page-start.json")
// A page start older than this belongs to another hour in this folder, and is not used.
const PAGE_START_MAX_AGE = 6 * 60 * 60 * 1000

let started
try {
  started = readClockStart(ROOT, 10_000)
} catch {
  started = undefined
}

/** "08:28:58" or "08:28" (today, local time; yesterday when that is still ahead) or an ISO time, as milliseconds. */
function parsePageStart(text, now = Date.now()) {
  const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text.trim())
  if (clock !== null) {
    const day = new Date(now)
    day.setHours(Number(clock[1]), Number(clock[2]), Number(clock[3] ?? 0), 0)
    const t = day.getTime()
    return t > now + 60_000 ? t - 24 * 60 * 60 * 1000 : t
  }
  const t = Date.parse(text)
  return Number.isFinite(t) ? t : undefined
}

const given = process.argv.indexOf("--page-start")
if (given !== -1) {
  const said = process.argv[given + 1] ?? ""
  const t = parsePageStart(said)
  if (t === undefined) {
    console.error("Use --page-start 08:28:58 (the time the page showed when Benjamin pressed Start) or an ISO time.")
    process.exit(1)
  }
  mkdirSync(dirname(PAGE_FILE), { recursive: true })
  writeFileSync(PAGE_FILE, `${JSON.stringify({ t: new Date(t).toISOString(), said })}\n`)
  const gap = started === undefined ? "" : ` It is ${Math.round(started.ct - t / 1000)} s before the brief's commit.`
  console.log(`Page start remembered: ${new Date(t).toTimeString().slice(0, 8)}.${gap}`)
}

/** The page's start in milliseconds, from .session/page-start.json, or undefined. */
function readPageStart() {
  try {
    const t = Date.parse(JSON.parse(readFileSync(PAGE_FILE, "utf8")).t)
    return Number.isFinite(t) && Date.now() - t < PAGE_START_MAX_AGE ? t : undefined
  } catch {
    return undefined
  }
}
const page = readPageStart()
const hhmmss = (ms) => new Date(ms).toTimeString().slice(0, 8)
// The minutes everything below counts in: the page's when it is known, else the brief's commit's.
const start = page !== undefined ? page / 1000 : started?.ct

// Checkpoints are the v<version> tags; the minute is when each tag was made.
function checkpoints() {
  try {
    const rows = git("for-each-ref", "refs/tags/v*", "--format=%(refname:short) %(creatordate:unix)")
      .split("\n")
      .filter((line) => /^v\d+\.\d+\.\d+ \d+$/.test(line))
      .map((line) => line.split(" "))
    const order = sortVersions(rows.map(([v]) => v))
    return order.map((v) => {
      const [, time] = rows.find(([x]) => x === v)
      return { version: v, minute: Math.floor((Number(time) - start) / 60) }
    })
  } catch {
    return []
  }
}

// The upload mode lives in the git-ignored local log; "auto" belongs to the session that recorded it. This session is
// the one Claude Code names in the environment (the hooks write its first eight characters as `sid`); without that,
// the one the hooks wrote last.
function uploads(lines) {
  const own = process.env.CLAUDE_CODE_SESSION_ID
  if (typeof own === "string" && own !== "") return uploadMode({ lines, sid: own.slice(0, 8) })
  const read = (name) => {
    const file = join(ROOT, ".session", name)
    return existsSync(file) ? readFileSync(file, "utf8") : ""
  }
  let sid
  for (const line of read("events.jsonl").trimEnd().split("\n").reverse()) {
    try {
      sid = JSON.parse(line).sid
    } catch {
      sid = undefined
    }
    if (typeof sid === "string" && sid !== "") break
  }
  return uploadMode({ lines, sid: typeof sid === "string" ? sid : undefined })
}

const logLines = () => {
  const file = join(ROOT, ".session", "checkpoints.jsonl")
  return readCheckpointLog(existsSync(file) ? readFileSync(file, "utf8") : "")
}

if (start === undefined) {
  console.log(
    short
      ? "timer not started"
      : "The timer has not started: no commit has added the brief yet. It starts at the first commit that adds a file under brief/ other than brief/README.md."
  )
} else {
  const minute = Math.floor((Date.now() / 1000 - start) / 60)
  const byCommit = started === undefined ? undefined : Math.floor((Date.now() / 1000 - started.ct) / 60)
  const left = 60 - minute
  const phase =
    minute < 8
      ? "understand"
      : minute < 45
        ? "build"
        : minute < 52
          ? "check"
          : minute < 57
            ? "write up"
            : minute < 60
              ? "pack"
              : "over"
  const made = checkpoints()
  const last = made[made.length - 1]
  const { next, overdue } = scheduleStatus({ minute, made: made.map((c) => c.minute) })
  const lines = logLines()
  const mode = uploads(lines)
  // The last version's upload: in capitals, with its path, when it is meant for the page and is not on it.
  const upload = last === undefined ? undefined : uploadState({ lines, version: last.version })
  const zip = (state) => join(ROOT, "submit", state.zip ?? `${basename(ROOT)}-v${state.version}.zip`)
  const uploadShort =
    upload === undefined
      ? ""
      : upload.loud
        ? ` · ${upload.final ? "FINAL " : ""}v${upload.version} NOT UPLOADED: ${zip(upload)}`
        : upload.state === "pending" && mode.mode === "auto"
          ? ` · v${upload.version} upload pending`
          : ""
  const due =
    next === undefined
      ? "no checkpoint due"
      : overdue
        ? `CHECKPOINT OVERDUE (due ${next.by})`
        : `next checkpoint by ${next.by}`
  const modeWord =
    mode.mode === "auto"
      ? "auto"
      : mode.mode === "manual"
        ? "manual"
        : mode.elsewhere
          ? "auto in another session"
          : "not asked"
  const decisions = join(ROOT, "DECISIONS.md")
  const waiting = waitingDecisions(existsSync(decisions) ? readFileSync(decisions, "utf8") : "")
  const which =
    page === undefined ? "" : ` (page; ${byCommit === undefined ? "brief not committed" : `${byCommit} by commit`})`
  if (short) {
    console.log(
      `min ${minute}/60${which} · ${phase} · ${last === undefined ? "no checkpoint yet" : last.version} · ${due} · decisions waiting ${waiting} · uploads ${modeWord}${uploadShort}`
    )
  } else {
    if (page !== undefined)
      console.log(
        `Page minute ${minute} of 60: the page started at ${hhmmss(page)}, and it is ${hhmmss(Date.now())} now. ${left > 0 ? `${left} left on the page` : "The hour is over on the page"}.`
      )
    if (started !== undefined)
      console.log(
        `${page === undefined ? "Minute" : "By the commit: minute"} ${byCommit} of 60, counted from ${started.hash.slice(0, 7)} (the commit that added the brief).${page === undefined ? ` ${left > 0 ? `${left} left` : "The hour is over"}. The page's own start is not recorded: bun run clock -- --page-start <the time the page showed at Start> counts page minutes from then on.` : ""}`
      )
    else console.log("The brief is not committed yet: no minute by the commit.")
    console.log(
      `${made.length === 0 ? "No checkpoint yet." : `Checkpoints: ${made.map((c) => `${c.version} at minute ${c.minute}`).join(", ")}.`} ${
        next === undefined
          ? "None left in the schedule."
          : `${overdue ? "OVERDUE: " : "Next: "}#${next.n}, ${next.what}, by minute ${next.by}.${overdue ? " Checkpoint the last working commit before anything else." : ""}`
      }`
    )
    const confirmed = mode.lastConfirmed === undefined ? "" : ` The page last confirmed v${mode.lastConfirmed}.`
    const behind =
      mode.unconfirmed.length === 0 ? "" : ` Not confirmed: ${mode.unconfirmed.map((v) => `v${v}`).join(", ")}.`
    console.log(`Uploads: ${mode.mode} (${mode.reason}).${confirmed}${behind}`)
    if (upload?.loud === true) console.log(notUploadedLine({ ...upload, zip: zip(upload) }))
    console.log(
      waiting === 0
        ? "Decisions waiting for Benjamin: none."
        : `Decisions waiting for Benjamin: ${waiting} (rows marked "not decided" in DECISIONS.md). Ask them in the next round through AskUserQuestion, at most four at a time, most consequential first.`
    )
    if (minute >= 52 && minute < 60)
      console.log("Building has stopped: the write-up, fixes, and the final checkpoint by minute 58.")
  }
}
