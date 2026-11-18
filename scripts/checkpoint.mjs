// Checkpoints, part 2: the command. It versions the committed work, records it, and builds a checked zip named with
// the version. The rules (version, schedule, records, upload mode) are in scripts/checkpoint-rules.mjs.
//   bun run checkpoint -- "Review screen with totals"     a checkpoint, with the pack's --early checks
//   bun run checkpoint -- --final "Write-up done"          the last one: the write-up may have no TODO left
//   bun run checkpoint -- --hold "..."                     pack it, but this one is not to be uploaded
//   bun run checkpoint -- --uploads auto|manual "<Benjamin's words>"    turns agent uploads on or off
//   bun run checkpoint -- --record-upload v0.3.0 confirmed|not-confirmed|stopped "<what the page said, or why>"
//   bun run checkpoint -- --record-upload v0.3.0 by-hand "<Benjamin's words>"   he dropped it in himself
//   bun run checkpoint -- --last-look "<Benjamin's answer>"   round four, "anything to write down?": --final needs it
//   bun run checkpoint -- --brief-as-is "<Benjamin's words>"  he said to go on with brief/ not as received
//   bun run checkpoint -- --status                         checkpoints so far, the upload mode, the next one due
//   bun run checkpoint -- --stop                           stops and removes the frozen copy
//   bun run checkpoint -- --use v0.3.0 qa                  marks that frozen copy in use by qa for a pass on it
//   bun run checkpoint -- --done v0.3.0 qa                 clears the mark when the pass reports
//   bun run checkpoint -- --in-use                         every mark, live or stale
//   --override-in-use, with --final or --stop: removes the copies even while one is marked in use (Benjamin's words)
// It never commits files other than its own records, never ships uncommitted work, never uploads anything, and never
// leaves a tag on a version whose zip failed its checks: that version is undone and the zip is marked DO-NOT-UPLOAD.
// It refuses while brief/ is not as received (a committed file there edited or removed, or the commit that started
// the clock amended or rewritten), until Benjamin says to go on, and refuses --final until his last look is recorded.
// Once a version is tagged, its frozen copy (scripts/checkpoint-copy.mjs) starts in the background while the zip is
// checked: the tagged version running on its own port, for the qa and reviewer agents. The --final one removes it,
// and so refuses (as --stop does) while an agent has marked a copy in use, unless --override-in-use is given.
// A version meant for the page that is not on it is said in capitals, with its path, here and by `bun run clock`: the
// upload agent tries any zip up to 25 MB (CHECKPOINT_UPLOAD_LIMIT_MB changes that) and reports what the page said.
import { execFileSync, spawn, spawnSync } from "node:child_process"
import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  addTimelineRow,
  briefFindings,
  checkpointLine,
  decisionRound,
  hasTimeline,
  inUseLines,
  inUseRefusal,
  isReleaseCommit,
  lastLook,
  nextVersion,
  notUploadedLine,
  oneLine,
  openBriefFindings,
  parseTimeline,
  readCheckpointLog,
  recordsAgree,
  scheduleStatus,
  setLockfileVersion,
  setPackageVersion,
  sizeText,
  sortVersions,
  timelineRow,
  updateTimelineRow,
  uploadLimit,
  uploadMode,
  uploadState,
  uploadWords,
  waitingDecisions,
  writeupStyle
} from "./checkpoint-rules.mjs"
import { clearInUse, describe, inUse, markInUse, outcome, running } from "./checkpoint-copy.mjs"
import { readClockStart } from "./session-log.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const STATE = join(ROOT, ".session", "checkpoints.jsonl")
const EVENTS = join(ROOT, ".session", "events.jsonl")
// The most the upload agent tries. The page's own limit is not known; if it refuses, the agent reports its words.
const UPLOAD_LIMIT = uploadLimit(process.env)
// Files a checkpoint writes. They must have no uncommitted edits when it starts, so undoing it touches nothing else.
const RELEASE_FILES = ["package.json", "package-lock.json", "bun.lock", "DECISIONS.md"]
const SESSION_DIR = "docs/session"

const git = (...args) =>
  execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).replace(/\n$/, "")
const tryGit = (...args) => {
  try {
    return git(...args)
  } catch {
    return undefined
  }
}
const read = (path) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), "utf8") : undefined)
const write = (path, text) => writeFileSync(join(ROOT, path), text)
const say = (text) => console.log(text)
const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const COPY = join(ROOT, "scripts", "checkpoint-copy.mjs")
const copyCommand = (...args) =>
  spawnSync(process.execPath, [COPY, ...args], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
const stop = (text, code = 1) => {
  console.error(text)
  process.exit(code)
}

/** When the hour started: the commit that added the brief (`readClockStart` in scripts/session-log.mjs), or undefined. */
function clockStart() {
  try {
    return readClockStart(ROOT, 10_000)
  } catch {
    return undefined
  }
}

function commitsOldestFirst() {
  return (tryGit("log", "--reverse", "--format=%H%x1f%ct%x1f%s") ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, ct, subject] = line.split("\x1f")
      return { hash, ct: Number(ct), subject: subject ?? "" }
    })
}

/** Checkpoint tags `vX.Y.Z`, oldest first, with the commit each names and when it was made. */
export function readTags(gitFn = tryGit) {
  const out = gitFn(
    "for-each-ref",
    "refs/tags/v*",
    "--format=%(refname:short)%1f%(objectname)%1f%(*objectname)%1f%(creatordate:unix)"
  )
  const tags = (out ?? "")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, object, peeled, time] = line.split("\x1f")
      return { version: name.slice(1), commit: peeled !== "" ? peeled : object, time: Number(time) }
    })
    .filter((t) => /^\d+\.\d+\.\d+$/.test(t.version))
  const order = sortVersions(tags.map((t) => t.version))
  return order.map((v) => tags.find((t) => t.version === v))
}

const readState = () => readCheckpointLog(existsSync(STATE) ? readFileSync(STATE, "utf8") : "")
/**
 * The session this command runs in, as the hooks write it (`sid`, the first eight characters of the session id).
 * Claude Code names its session in the environment of every command it runs; that comes first, because with two
 * sessions in one folder (a lead and its builder) the log's last line may be the other one's. Without it, the session
 * the hooks wrote last. Undefined without either.
 */
export function currentSid() {
  const own = process.env.CLAUDE_CODE_SESSION_ID
  if (typeof own === "string" && own !== "") return own.slice(0, 8)
  if (!existsSync(EVENTS)) return undefined
  const lines = readFileSync(EVENTS, "utf8").trimEnd().split("\n")
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const sid = JSON.parse(lines[i]).sid
      if (typeof sid === "string" && sid !== "") return sid
    } catch {
      // keep looking
    }
  }
  return undefined
}
function appendState(line) {
  const start = clockStart()
  const min = start === undefined ? undefined : Math.floor((Date.now() / 1000 - start.ct) / 60)
  mkdirSync(dirname(STATE), { recursive: true })
  appendFileSync(STATE, `${JSON.stringify({ t: new Date().toISOString(), min, ...line })}\n`)
}

// ---------------------------------------------------------------------------------------------------------------
// The brief as received

/** A tree's files under brief/, path to blob. */
function briefTree(ref) {
  const files = {}
  for (const entry of (tryGit("ls-tree", "-r", "-z", ref, "--", "brief") ?? "").split("\0")) {
    const tab = entry.indexOf("\t")
    if (tab === -1) continue
    files[entry.slice(tab + 1)] = entry.slice(0, tab).split(" ")[2]
  }
  return files
}

/** The brief files a commit added, by path (`--no-renames`: a file moved in counts as added). */
function addedBriefFiles(commit) {
  return (
    tryGit("show", "--no-renames", "--diff-filter=A", "--name-only", "-z", "--format=", commit, "--", "brief") ?? ""
  )
    .split("\0")
    .filter((path) => path.startsWith("brief/"))
}

/**
 * brief/ as git has it since the clock started at `start`: each file as first committed, what HEAD and the working
 * tree hold, and any commit made since the clock started that added brief files and is no longer in the history
 * (found in the reflog: a commit amended, rebased or reset away). A file such a commit held first is received as it
 * held it, so putting it back from there makes it as received again. Then the findings (scripts/checkpoint-rules.mjs).
 */
function briefState(start) {
  const received = Object.entries(briefTree(start.hash)).map(([path, blob]) => ({ path, blob, commit: start.hash }))
  const later = (tryGit("log", "--reverse", "--format=%H", `${start.hash}..HEAD`, "--", "brief") ?? "").split("\n")
  for (const commit of later.filter(Boolean)) {
    const tree = briefTree(commit)
    for (const path of addedBriefFiles(commit))
      if (!received.some((file) => file.path === path) && tree[path] !== undefined)
        received.push({ path, blob: tree[path], commit })
  }
  const inHistory = received.map((file) => ({ ...file }))
  const head = briefTree("HEAD")
  const worktree = (tryGit("status", "--porcelain=v1", "--", "brief") ?? "").split("\n").filter(Boolean)
  // A commit amended keeps its author and author date; one made since the clock started has an author date no
  // earlier than its. So the reflog's commits from then on, outside HEAD's history, are the ones rewritten away.
  const [startTime, startAuthor] = (tryGit("log", "-1", "--format=%at%x1f%an", start.hash) ?? "").split("\x1f")
  const reachable = new Set((tryGit("rev-list", "HEAD") ?? "").split("\n").filter(Boolean))
  const gone = []
  for (const row of (tryGit("log", "-g", "--format=%H%x1f%at%x1f%an", "HEAD") ?? "").split("\n")) {
    const [commit = "", time = "", author = ""] = row.split("\x1f")
    if (commit === "" || reachable.has(commit) || gone.some((c) => c.commit === commit)) continue
    if (Number(time) < Number(startTime)) continue
    const added = addedBriefFiles(commit)
    if (added.length === 0) continue
    const isStart = time === startTime && author === startAuthor && added.some((path) => path !== "brief/README.md")
    gone.push({ commit, isStart, added, tree: briefTree(commit) })
  }
  const rewritten = []
  // The reflog lists the newest first: the oldest such commit held the file first.
  for (const { commit, isStart, added, tree } of gone.reverse()) {
    const paths = isStart ? Object.keys(tree) : added
    const historyBlob = (path) => inHistory.find((file) => file.path === path)?.blob
    rewritten.push({ commit, start: isStart, differs: paths.filter((path) => historyBlob(path) !== tree[path]) })
    for (const path of paths) {
      const file = received.find((entry) => entry.path === path)
      if (file === undefined) received.push({ path, blob: tree[path], commit })
      else if (inHistory.some((entry) => entry.path === path && entry.commit === file.commit))
        Object.assign(file, { blob: tree[path], commit })
    }
  }
  const findings = briefFindings({ received, head, worktree, rewritten })
  return { findings, ...openBriefFindings({ findings, lines: readState() }) }
}

/** The refusal while brief/ is not as received: what changed, and what to do instead of fixing it by hand. */
function briefRefusal(start, open) {
  return [
    `STOPPED: brief/ is the brief as received, and it has changed since the clock started at ${start.hash.slice(0, 7)}:`,
    ...open.map((finding) => `  ${finding.text}`),
    "No version was made. Stop and ask Benjamin, with what changed and why; do not edit brief/ or rewrite a commit to",
    "fix it. A file edited by mistake goes back as received: git checkout <the commit named> -- <file>, then commit.",
    ...(open.some((finding) => finding.key.startsWith("rewritten "))
      ? ["A commit amended or rewritten cannot be put back: only his go-ahead moves on from it."]
      : []),
    'If he says to go on as it is: bun run checkpoint -- --brief-as-is "<his words>", then run the checkpoint again.'
  ].join("\n")
}

// ---------------------------------------------------------------------------------------------------------------
// Small commands

function recordUploads(mode, said) {
  if (mode !== "auto" && mode !== "manual")
    stop('Use --uploads auto "<Benjamin\'s words>" or --uploads manual "<his words>".')
  if (said === undefined || said.trim() === "") stop("Quote what Benjamin said: only his words change the upload mode.")
  appendState({ ev: "uploads", mode, said: oneLine(said, 200), sid: currentSid() })
  const now = uploadMode({ lines: readState(), sid: currentSid() })
  say(`Uploads: ${now.mode} (${now.reason}).`)
}

/** Benjamin's answer at the last look (round four), which the --final checkpoint needs. */
function recordLastLook(said) {
  if (said === undefined || said.trim() === "")
    stop('Quote his answer: --last-look "<the option he chose, or his own words>".')
  appendState({ ev: "last-look", said: oneLine(said, 300), sid: currentSid() })
  say(
    `Last look recorded: \u201c${oneLine(said, 300)}\u201d. What he describes goes under "Known wrong or missing" in his words; then the --final checkpoint.`
  )
}

/** Benjamin said to go on with brief/ as it is now: it covers the findings open at this moment, none after. */
function recordBriefAsIs(said) {
  if (said === undefined || said.trim() === "") stop('Quote what Benjamin said: --brief-as-is "<his words>".')
  const start = clockStart()
  if (start === undefined) stop("The clock has not started: there is no brief to check yet.")
  const { open } = briefState(start)
  if (open.length === 0)
    return say("brief/ is as received, or he has already said to go on with it: nothing to record.")
  appendState({ ev: "brief-as-is", keys: open.map((finding) => finding.key), said: oneLine(said, 300) })
  say(
    [
      `Recorded: Benjamin said to go on with brief/ as it is (\u201c${oneLine(said, 300)}\u201d), for:`,
      ...open.map((finding) => `  ${finding.text}`),
      'Each checkpoint says so from now on. Write it in DECISIONS.md under "How I worked with my agent".'
    ].join("\n")
  )
}

/** The absolute path of a version's zip in submit/. */
const zipPath = (version, name) =>
  join(ROOT, "submit", name ?? `${basename(ROOT)}-v${String(version).replace(/^v/, "")}.zip`)

function recordUpload(version, result, said) {
  const v = (version ?? "").replace(/^v/, "")
  if (!/^\d+\.\d+\.\d+$/.test(v))
    stop('Use --record-upload v0.3.0 confirmed|not-confirmed|stopped|by-hand "<what the page said, or his words>".')
  if (!["confirmed", "not-confirmed", "stopped", "by-hand"].includes(result ?? ""))
    stop("The result is confirmed, not-confirmed, stopped or by-hand.")
  appendState({ ev: "upload", version: v, result, said: oneLine(said ?? "", 300) })
  const lines = readState()
  const now = uploadMode({ lines, sid: currentSid() })
  const behind =
    now.unconfirmed.length === 0 ? "" : ` Not confirmed since: ${now.unconfirmed.map((x) => `v${x}`).join(", ")}.`
  say(
    `Recorded v${v}: ${uploadWords(result)}. Uploads are now ${now.mode} (${now.reason}).` +
      (now.lastConfirmed === undefined
        ? " The page has confirmed no version yet."
        : ` The page last confirmed v${now.lastConfirmed}.`) +
      behind
  )
  const state = uploadState({ lines, version: v })
  if (state.loud) say(notUploadedLine({ ...state, zip: zipPath(v, state.zip) }))
  else if (state.final && state.state === "uploaded") say(`Final version v${v} is on the page. The work is handed in.`)
}

function status() {
  const start = clockStart()?.ct
  const minuteAt = (t) => (start === undefined ? "pre" : Math.floor((t - start) / 60))
  const tags = readTags()
  say(
    tags.length === 0
      ? "No checkpoint yet."
      : `Checkpoints: ${tags.map((t) => `v${t.version} at minute ${minuteAt(t.time)} (${t.commit.slice(0, 7)})`).join(", ")}.`
  )
  if (start !== undefined) {
    const s = scheduleStatus({ minute: minuteAt(Date.now() / 1000), made: tags.map((t) => minuteAt(t.time)) })
    say(
      s.next === undefined
        ? "No checkpoint left in the schedule."
        : `Next: #${s.next.n}, ${s.next.what}, by minute ${s.next.by}${s.overdue ? " (OVERDUE)" : ""}.`
    )
  }
  const lines = readState()
  const m = uploadMode({ lines, sid: currentSid() })
  say(
    `Uploads: ${m.mode} (${m.reason}).${m.lastConfirmed === undefined ? "" : ` The page last confirmed v${m.lastConfirmed}.`}`
  )
  const latest = tags.length === 0 ? undefined : uploadState({ lines, version: tags[tags.length - 1].version })
  if (latest?.loud === true) say(notUploadedLine({ ...latest, zip: zipPath(latest.version, latest.zip) }))
  const started = clockStart()
  if (started !== undefined) {
    const brief = briefState(started)
    say(
      brief.open.length > 0
        ? `Brief: NOT AS RECEIVED since ${started.hash.slice(0, 7)}; the checkpoint refuses until Benjamin decides:\n${brief.open.map((f) => `  ${f.text}`).join("\n")}`
        : brief.asIs.length > 0
          ? `Brief: not as received, and Benjamin said to go on (\u201c${brief.said.join("\u201d, \u201c")}\u201d).`
          : `Brief: as received since ${started.hash.slice(0, 7)}.`
    )
  }
  if (tags.length > 0) {
    const look = lastLook({ lines })
    say(
      look === undefined
        ? `Last look: not asked since v${tags[tags.length - 1].version}; the --final checkpoint needs it (--last-look).`
        : `Last look: \u201c${look.said}\u201d.`
    )
  }
  say(describe(running()))
}

/**
 * A step that removes every frozen copy (`--final`, `--stop`) stops here while a copy is marked in use, so a pass on
 * it is never cut short by surprise. A stale mark is named and ignored. `override` is Benjamin's word to go on anyway.
 */
function guardInUse(step, override) {
  const marks = inUse()
  if (marks.live.length > 0 && !override) stop(inUseRefusal({ ...marks, step }))
  for (const line of inUseLines(marks)) say(line)
  if (marks.live.length > 0)
    say(`--override-in-use: removing the frozen copies although ${marks.live.length} is marked in use.`)
}

function stopCopies() {
  const stopped = copyCommand("stop")
  say((stopped.stdout ?? "").trim() || "Frozen copy: could not be stopped; run node scripts/checkpoint-copy.mjs stop.")
  return stopped.status ?? 1
}

/**
 * Starts the frozen copy of a version in the background (its own process group, so it outlives nothing it should
 * not and can be stopped as one). It works while the zip is checked; `copyResult` collects it afterwards.
 */
function startCopy(version) {
  const frozen = join(ROOT, ".frozen")
  mkdirSync(frozen, { recursive: true })
  for (const ext of [".json", ".failed"]) rmSync(join(frozen, `v${version}${ext}`), { force: true })
  const out = openSync(join(frozen, `start-v${version}.out`), "w")
  const child = spawn(process.execPath, [COPY, "start", version], {
    cwd: ROOT,
    detached: true,
    stdio: ["ignore", out, out]
  })
  child.unref()
  closeSync(out)
  return child.pid
}

/** Waits (at most 90 s) for the background start to finish, and says where the copy is or why it did not start. */
function copyResult(version, starter) {
  for (let i = 0; i < 450 && outcome(version) === undefined; i += 1) pause(200)
  const startOutput = join(ROOT, ".frozen", `start-v${version}.out`)
  const result = outcome(version)
  if (result === undefined) {
    const said = existsSync(startOutput) ? readFileSync(startOutput, "utf8").trim() : ""
    stopStarter(starter)
    copyCommand("stop", version)
    return `${said === "" ? "" : `${said}\n`}Frozen copy: v${version} not started: it was still starting after 90 s. The checkpoint itself is fine.`
  }
  rmSync(startOutput, { force: true })
  if (result.failed !== undefined) return result.failed
  return `${describe(result.state)} Ready ${result.state.seconds} s after the tag. Start the reviewer on it now, and qa (its own browser) after your own look; each marks the copy in use (--use v${version} <name>) and clears it (--done) when it reports.`
}

/** Stops a background start that is still running (its own process group: the migrate and the build with it). */
function stopStarter(pid) {
  try {
    process.kill(-pid, "SIGTERM")
  } catch {
    // already finished
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The checkpoint

function checkpoint({ contents: given, final, hold, override }) {
  // 0. The final checkpoint removes every frozen copy: not while a pass on one is marked in use.
  if (final) guardInUse("bun run checkpoint -- --final", override)
  const t0 = Date.now()
  const phases = []
  const timed = (name, f) => {
    const s = Date.now()
    const result = f()
    phases.push(`${name} ${((Date.now() - s) / 1000).toFixed(1)} s`)
    return result
  }

  // 1. The clock. The timer starts at the commit that adds the brief, not at any commit made before it.
  const start = clockStart()
  if (start === undefined)
    stop(
      "No checkpoint before the brief: commit it first (the first commit that adds a file under brief/, other than brief/README.md, starts the clock)."
    )
  const minute = Math.floor((Date.now() / 1000 - start.ct) / 60)
  const minuteOf = (t) => Math.floor((t - start.ct) / 60)
  const commits = commitsOldestFirst()
  const head = git("rev-parse", "HEAD")
  const tags = readTags()

  // 1b. The brief as received: nothing under brief/ changed, and the commit that started the clock stands.
  const brief = briefState(start)
  if (brief.open.length > 0) stop(briefRefusal(start, brief.open))
  // 1c. The final version comes after the last look: round four is never skipped.
  if (final && lastLook({ lines: readState() }) === undefined) {
    const since = tags.length === 0 ? "" : ` since v${tags[tags.length - 1].version}`
    stop(
      [
        `STOPPED: no last look recorded${since}. No version was made.`,
        'Ask Benjamin round four (CLAUDE.md "The four decision rounds"; with a lead, the lead asks): "Is there anything',
        'you saw on the final version that should be written down?" Write what he describes under "Known wrong or',
        'missing", record his answer with bun run checkpoint -- --last-look "<his answer>", then run --final again.'
      ].join("\n")
    )
  }
  const pkg = JSON.parse(read("package.json"))
  const current = pkg.version
  const folder = basename(ROOT)
  const zipOf = (v) => join(ROOT, "submit", `${folder}-v${v}.zip`)

  // 2. Nothing new since the last checkpoint: say where its zip is, make no new version.
  const lastTag = tags.length === 0 ? undefined : tags[tags.length - 1]
  if (lastTag !== undefined && lastTag.commit === head) {
    const zip = zipOf(lastTag.version)
    say(
      `Nothing new since v${lastTag.version}: no new version. ${existsSync(zip) ? `Its zip: ${zip}` : `Its zip is not in submit/ any more; bun run pack rebuilds it.`}`
    )
    return 0
  }

  // 3. Preflight: the files a checkpoint writes must be committed, so undoing it never touches someone's edit.
  const dirty = (git("status", "--porcelain=v1", "--untracked-files=all") ?? "").split("\n").filter(Boolean)
  const pathOf = (line) => line.slice(3).replace(/^.* -> /, "")
  const releaseHit = (path) => RELEASE_FILES.some((f) => path === f || path.startsWith(`${f}/`))
  const blocking = dirty.filter((line) => releaseHit(pathOf(line)))
  if (blocking.length > 0) {
    stop(`Commit (or revert) these first; the checkpoint writes them:\n${blocking.map((l) => `  ${l}`).join("\n")}`)
  }
  const elsewhere = dirty.filter((line) => !releaseHit(pathOf(line)) && !pathOf(line).startsWith(`${SESSION_DIR}/`))
  if (elsewhere.length > 0) {
    say(
      `NOT in this version (uncommitted; the zip holds commits only):\n${elsewhere
        .slice(0, 10)
        .map((l) => `  ${l}`)
        .join("\n")}`
    )
  }

  // 4. The version: the commits since the last checkpoint decide the bump.
  const since =
    (lastTag === undefined
      ? tryGit("log", "--format=%h%x1f%s", `${commits[0].hash}..HEAD`)
      : tryGit("log", "--format=%h%x1f%s", `${lastTag.commit}..HEAD`)) ?? ""
  const newCommits = since
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, subject] = line.split("\x1f")
      return { hash, subject: subject ?? "" }
    })
    .filter((c) => !isReleaseCommit(c.subject))
    .reverse()
  const first = tags.length === 0
  const next = nextVersion({ current, first, subjects: newCommits.map((c) => c.subject) })
  if (next.error !== undefined) stop(`${next.error}. Set it to the last checkpoint's version (or 0.0.0) and commit.`)
  if (tags.some((t) => t.version === next.version))
    stop(
      `The tag v${next.version} already exists, and package.json says ${current}. Put package.json back to the last checkpoint's version.`
    )
  const contents = oneLine(
    given !== undefined && given.trim() !== ""
      ? given
      : newCommits
          .filter((c) => /^(feat|fix)/.test(c.subject))
          .map((c) => c.subject)
          .join("; ") || "Work since the last checkpoint"
  )
  for (const note of next.notes) say(`Note: ${note}.`)
  // The final version should hold only the write-up: code changed after the last checkpoint was never in a frozen copy,
  // so neither qa nor the reviewer has seen it.
  const untested =
    final && lastTag !== undefined
      ? (tryGit("diff", "--name-only", lastTag.commit, "HEAD") ?? "")
          .split("\n")
          .filter(
            (path) =>
              path !== "" &&
              !RELEASE_FILES.includes(path) &&
              path !== "README.md" &&
              !path.startsWith("docs/") &&
              !path.startsWith(".agents/")
          )
      : []

  // 5. Write the version: package.json and the lockfile's own version.
  const restoreRelease = () => {
    for (const path of RELEASE_FILES) {
      if (tryGit("cat-file", "-e", `HEAD:${path}`) !== undefined) tryGit("checkout", "HEAD", "--", path)
    }
  }
  timed("version", () => {
    write("package.json", setPackageVersion(read("package.json"), next.version))
    const lock = read("package-lock.json")
    if (lock !== undefined) write("package-lock.json", setLockfileVersion(lock, next.version))
  })

  // 6. Records: when DECISIONS.md keeps a Timeline, the previous row gets its commit and upload result and this one
  //    is added (the template has none: each checkpoint is in docs/session/SUMMARY.md); then the session record.
  const lines = readState()
  const lastResult = (v) => [...lines].reverse().find((l) => l.ev === "upload" && l.version === v)?.result
  let decisions = read("DECISIONS.md") ?? "# Decisions\n"
  const timeline = hasTimeline(decisions)
  if (timeline && lastTag !== undefined) {
    const known = parseTimeline(decisions).find((r) => r.version === lastTag.version)
    if (known !== undefined) {
      const result = lastResult(lastTag.version) ?? "unrecorded"
      decisions = updateTimelineRow(decisions, lastTag.version, {
        commit: lastTag.commit.slice(0, 7),
        upload: uploadWords(result)
      })
    }
  }
  if (timeline) {
    decisions = addTimelineRow(
      decisions,
      timelineRow({ minute, version: next.version, contents, upload: uploadWords(undefined) })
    )
    write("DECISIONS.md", decisions)
  }
  // A Timeline kept from the first checkpoint must hold every version; one that never had a row is not checked.
  const problems =
    timeline && parseTimeline(decisions).length > 0
      ? recordsAgree({ decisions, versions: [...tags.map((t) => t.version), next.version] })
      : []
  const session = timed("session record", () =>
    spawnSync(process.execPath, [join(ROOT, "scripts", "session-report.mjs")], { cwd: ROOT, encoding: "utf8" })
  )
  if (session.status !== 0 || problems.length > 0) {
    restoreRelease()
    tryGit("checkout", "HEAD", "--", SESSION_DIR)
    if (session.status !== 0) say(`${session.stdout}${session.stderr}`.trim())
    for (const p of problems) say(`Records disagree: ${p}`)
    stop("No version was made. Fix the above and run the checkpoint again.")
  }

  // 7. Commit only the release files and the session record, then tag.
  const changed = (git("status", "--porcelain=v1", "--untracked-files=all", "--", ...RELEASE_FILES, SESSION_DIR) ?? "")
    .split("\n")
    .filter(Boolean)
    .map(pathOf)
  timed("commit and tag", () => {
    git("add", "-A", "--", ...changed)
    git(
      "commit",
      "-q",
      "--only",
      "-m",
      `chore(release): v${next.version}`,
      "-m",
      contents,
      "-m",
      `Minute ${minute}. Written by scripts/checkpoint.mjs.`,
      "--",
      ...changed
    )
    git("tag", "-a", "--no-sign", "-m", `v${next.version} · minute ${minute} · ${contents}`, `v${next.version}`)
  })
  const release = git("rev-parse", "HEAD")

  // 8. The frozen copy of this version starts now, in the background, and is ready by the time the zip is checked.
  //    The final checkpoint makes none: after it, nothing is tested any more.
  const starter = final ? undefined : startCopy(next.version)

  // 9. The zip, from a clean clone, with every check the pack makes.
  const packed = timed("pack", () =>
    spawnSync("bash", [join(ROOT, "scripts", "pack.sh"), ...(final ? [] : ["--early"]), "--allow-uncommitted"], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, PACK_TIMES: "1" }
    })
  )
  process.stdout.write(packed.stdout ?? "")
  process.stderr.write(packed.stderr ?? "")
  const zip = zipOf(next.version)
  if (packed.status !== 0 || !existsSync(zip)) {
    // Undo: the frozen copy of this version, the tag and the release commit (its files only; nothing else in the tree
    // is touched). The copy of the last good version, if one is running, stays.
    if (starter !== undefined) {
      stopStarter(starter)
      copyCommand("stop", next.version)
    }
    tryGit("tag", "-d", `v${next.version}`)
    if (git("rev-parse", "HEAD") === release) {
      const touched = (tryGit("diff", "--name-only", head, release) ?? "").split("\n").filter(Boolean)
      git("reset", "-q", "--soft", head)
      for (const path of touched) {
        if (tryGit("cat-file", "-e", `${head}:${path}`) !== undefined) git("checkout", head, "--", path)
        else {
          tryGit("rm", "-q", "--cached", "--", path)
          if (existsSync(join(ROOT, path))) rmSync(join(ROOT, path))
        }
      }
      say(`Undone: the tag v${next.version} and the release commit; the tree is back at ${head.slice(0, 7)}.`)
    } else {
      say(
        `The tag v${next.version} is deleted. HEAD moved during the pack, so the release commit ${release.slice(0, 7)} was left as it is.`
      )
    }
    stop(
      `FAIL  v${next.version} did not pass its checks. Do not upload anything from this run. Fix the failure above, commit, and run the checkpoint again.`
    )
  }

  // 10. The frozen copy: where it runs, or, after the final checkpoint, every copy stopped and removed.
  const copyLine = timed("frozen copy", () =>
    starter === undefined ? (copyCommand("stop").stdout ?? "").trim() : copyResult(next.version, starter)
  )

  // 11. Record it and print the line, with what happens to the upload.
  const bytes = statSync(zip).size
  const seconds = Math.round((Date.now() - t0) / 1000)
  appendState({
    ev: "checkpoint",
    min: minute,
    version: next.version,
    commit: release.slice(0, 7),
    zip: basename(zip),
    bytes,
    secs: seconds,
    ...(final ? { final: true } : {})
  })
  const mode = uploadMode({ lines: readState(), sid: currentSid() })
  let upload
  if (hold) {
    appendState({ ev: "upload", version: next.version, result: "held" })
    upload = "held back by Benjamin (packed only)"
  } else if (mode.mode === "manual") {
    appendState({ ev: "upload", version: next.version, result: "manual" })
    upload = `NOT UPLOADED, uploads are by hand (${mode.reason}): drop this file in: ${zip}`
  } else if (mode.mode === "not asked") {
    appendState({ ev: "upload", version: next.version, result: "not-asked" })
    upload = "not asked for in this session (packed only)"
  } else if (bytes > UPLOAD_LIMIT) {
    appendState({ ev: "upload", version: next.version, result: "too-big", bytes, limit: UPLOAD_LIMIT })
    upload = `NOT UPLOADED, over the ${sizeText(UPLOAD_LIMIT)} the upload agent tries: drop this file in: ${zip}`
  } else {
    upload = `automatic${mode.firstPending ? ", the first of this session (one strike, about 60 s)" : ""}: hand ${zip} to the uploader agent`
  }
  const behind = mode.unconfirmed.filter((v) => v !== next.version)
  say(copyLine)
  say(`Times:   ${phases.join(" · ")}`)
  const waiting = waitingDecisions(read("DECISIONS.md"))
  say(
    waiting === 0
      ? "Decisions waiting: none."
      : `Decisions waiting: ${waiting} in DECISIONS.md ("not decided"). Ask them in the next round through AskUserQuestion, at most four at a time, most consequential first (CLAUDE.md "Decisions by dialog"); with a lead, they go to the lead.`
  )
  if (behind.length > 0 && mode.mode !== "not asked")
    say(
      `Not confirmed by the page: ${behind.map((v) => `v${v}`).join(", ")}${mode.lastConfirmed === undefined ? "" : `; it last confirmed v${mode.lastConfirmed}`}.`
    )
  for (const line of writeupStyle({ files: { "README.md": read("README.md"), "DECISIONS.md": read("DECISIONS.md") } }))
    say(`WARN  ${line}`)
  if (final && untested.length > 0)
    say(
      `NOT LOOKED AT by qa or the reviewer: ${untested.length} file${untested.length === 1 ? "" : "s"} of code changed after v${lastTag.version}, the last version with a frozen copy (${untested.slice(0, 4).join(", ")}${untested.length > 4 ? ", …" : ""}). Say so under "Not verified".`
    )
  const round = final ? undefined : decisionRound({ minute, made: tags.map((t) => minuteOf(t.time)) })
  if (round !== undefined)
    say(
      `DECISION ROUND: this is the planned checkpoint due by minute ${round.by}. Start the reviewer on the frozen copy and keep the next plan item moving, hand over the upload if the line below says so, take your one look, start qa, then ask Benjamin through AskUserQuestion; started by a lead, send the lead the round instead (CLAUDE.md "The four decision rounds", /ship step 8).`
    )
  if (brief.asIs.length > 0)
    say(
      `Brief: not as received (${brief.asIs.map((f) => f.text).join("; ")}); Benjamin said to go on: \u201c${brief.said.join("\u201d, \u201c")}\u201d. Say so in the write-up.`
    )
  const state = uploadState({ lines: readState(), version: next.version })
  if (state.loud) say(notUploadedLine({ ...state, zip }))
  say(checkpointLine({ version: next.version, minute, commit: release.slice(0, 7), zip, bytes, seconds, upload }))
  return 0
}

// ---------------------------------------------------------------------------------------------------------------
// Command line

function main(argv) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")))
  const words = argv.filter((a) => !a.startsWith("--"))
  if (flags.has("--status")) return status()
  if (flags.has("--uploads")) return recordUploads(words[0], words.slice(1).join(" "))
  if (flags.has("--record-upload")) return recordUpload(words[0], words[1], words.slice(2).join(" "))
  if (flags.has("--last-look")) return recordLastLook(words.join(" "))
  if (flags.has("--brief-as-is")) return recordBriefAsIs(words.join(" "))
  if (flags.has("--use")) return say(markInUse((words[0] ?? "").replace(/^v/, ""), words.slice(1).join(" ")))
  if (flags.has("--done")) return say(clearInUse((words[0] ?? "").replace(/^v/, ""), words.slice(1).join(" ")))
  if (flags.has("--in-use")) {
    const lines = inUseLines(inUse())
    return say(lines.length === 0 ? "Frozen copy: none marked in use." : `Frozen copy marks:\n${lines.join("\n")}`)
  }
  if (flags.has("--stop")) {
    guardInUse("bun run checkpoint -- --stop", flags.has("--override-in-use"))
    process.exit(stopCopies())
  }
  const known = new Set(["--final", "--hold", "--override-in-use"])
  const unknown = [...flags].filter((f) => !known.has(f))
  if (unknown.length > 0) stop(`Unknown option ${unknown.join(", ")}. See the top of scripts/checkpoint.mjs.`)
  process.exit(
    checkpoint({
      contents: words.join(" "),
      final: flags.has("--final"),
      hold: flags.has("--hold"),
      override: flags.has("--override-in-use")
    })
  )
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2))
