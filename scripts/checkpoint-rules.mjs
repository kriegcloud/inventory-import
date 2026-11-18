// Checkpoints, part 1: the rules, as pure functions. `scripts/checkpoint.mjs` (the command), `scripts/clock.mjs` and
// `scripts/session-report.mjs` use them; `test/scripts/Checkpoint.test.ts` checks them. Nothing here reads a file.
// A checkpoint is one version of the work: a semantic version in package.json, an annotated tag, its row in
// docs/session/SUMMARY.md (and in DECISIONS.md's Timeline, where one is kept) and a zip that passed the clean-copy
// checks. What must not break: the version comes from the commits
// alone, so the same history always gives the same version, and no version claims 1.0.0.

/**
 * The planned checkpoints, four in the hour. `by` is the latest minute. A checkpoint counts for the slot whose window
 * holds its minute (after the previous slot's `by`, up to its own); the next one due is the slot after that. A
 * checkpoint made in between, when a complete increment lands, is allowed and counts for its window; nothing asks for it.
 */
export const SCHEDULE = [
  { n: 1, by: 5, what: "the scaffold as it is, 0.1.0: proves the zip and the upload while there is time to fix them" },
  { n: 2, by: 25, what: "the first version a person can use end to end" },
  { n: 3, by: 45, what: "a safe version to fall back on; building goes on to minute 50" },
  { n: 4, by: 58, what: "final: the write-up done (--final)" }
]

/** Index in SCHEDULE of the slot whose window holds `minute`; SCHEDULE.length after the last slot. */
export function slotOf(minute) {
  const i = SCHEDULE.findIndex((slot) => minute <= slot.by)
  return i === -1 ? SCHEDULE.length : i
}

/**
 * Where the schedule stands at `minute`, given the minutes at which checkpoints were made (oldest first).
 * `next` is undefined when no slot is left.
 */
export function scheduleStatus({ minute, made }) {
  const last = made.length === 0 ? undefined : made[made.length - 1]
  const next = SCHEDULE[last === undefined ? 0 : slotOf(last) + 1]
  return {
    next,
    overdue: next !== undefined && minute > next.by,
    buildingStopped: minute >= 52
  }
}

/**
 * The planned checkpoint a new one fills when a decision round is due: the agent starts the reviewer, qa and the next
 * item, then asks the person through the question dialog. The first checkpoint in the window of the one due by 25 or
 * the one due by 45. Never the first checkpoint of the hour (the scaffold, before intake) and never the final one.
 * `made` holds the minutes of the checkpoints made before this one.
 * @example decisionRound({ minute: 22, made: [3] }) // { n: 2, by: 25, ... }
 */
export function decisionRound({ minute, made }) {
  if (made.length === 0) return undefined
  const i = slotOf(minute)
  const slot = SCHEDULE[i]
  if (slot === undefined || (slot.n !== 2 && slot.n !== 3)) return undefined
  return made.some((m) => slotOf(m) === i) ? undefined : slot
}

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** `"0.3.0"` as numbers, or undefined when it is not a plain semantic version. */
export function parseVersion(text) {
  const m = SEMVER.exec(typeof text === "string" ? text : "")
  return m === null ? undefined : { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
}

/** Version strings, oldest first. */
export function sortVersions(versions) {
  const key = (v) => {
    const p = parseVersion(v.replace(/^v/, ""))
    return p === undefined ? [-1, -1, -1] : [p.major, p.minor, p.patch]
  }
  return [...versions].sort((a, b) => {
    const [x, y] = [key(a), key(b)]
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
  })
}

/**
 * What a commit subject asks for: `feat:` adds a capability, so minor; a breaking marker (`type!:`) also counts as
 * minor, never major; everything else, including a subject that is not conventional, is patch.
 * @example bumpOf("feat(review): totals per unit") // "minor"
 */
export function bumpOf(subject) {
  const m = /^(\w+)(?:\([^)]*\))?(!)?:/.exec(subject)
  if (m === null) return "patch"
  return m[1] === "feat" || m[2] === "!" ? "minor" : "patch"
}

/** True for the commits a checkpoint writes itself; they never count towards the next bump. */
export const isReleaseCommit = (subject) => /^chore\(release\): v\d+\.\d+\.\d+/.test(subject)

/** True for a subject with a breaking marker (`feat!:`, `fix(api)!:`). */
export const isBreaking = (subject) => /^\w+(?:\([^)]*\))?!:/.test(subject)

/**
 * The next version, from the subjects of the commits since the last checkpoint. The first checkpoint is always 0.1.0.
 * After that minor if any commit adds a capability, otherwise patch. A breaking change counts as minor: nothing here is
 * a published interface, so 1.0.0 would claim a stability nobody promised.
 */
export function nextVersion({ current, first, subjects }) {
  const base = parseVersion(current)
  if (base === undefined) return { error: `package.json's version "${current}" is not a plain x.y.z version` }
  const notes = []
  if (first) {
    if (current !== "0.0.0") notes.push(`package.json said ${current}; the first checkpoint is 0.1.0`)
    return { version: "0.1.0", bump: "minor", notes }
  }
  if (subjects.some(isBreaking)) notes.push("a commit is marked breaking; it counts as minor (no 1.0.0 here)")
  const bump = subjects.some((subject) => bumpOf(subject) === "minor") ? "minor" : "patch"
  const version =
    bump === "minor" ? `${base.major}.${base.minor + 1}.0` : `${base.major}.${base.minor}.${base.patch + 1}`
  return { version, bump, notes }
}

/** One line, no table pipes, no trailing full stop, at most `max` characters. */
export function oneLine(text, max = 200) {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\|/g, "/")
    .trim()
    .replace(/[.\s]+$/, "")
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const ROW =
  /^\|\s*(\d+|pre)\s*\|\s*Checkpoint (v\d+\.\d+\.\d+)(?: \(`([0-9a-f]{7,40})`\))?: (.*)\. Upload: (.*?)\s*\|\s*$/

/**
 * A Timeline row for a checkpoint. `commit` is filled in by the next checkpoint: a commit cannot name itself. The upload
 * note is cut at 120 characters unless `keep` says it is someone's own text, which is never shortened.
 */
export function timelineRow({ minute, version, commit, contents, upload, keep }) {
  return `| ${minute} | Checkpoint v${version.replace(/^v/, "")}${commit === undefined ? "" : ` (\`${commit}\`)`}: ${oneLine(contents)}. Upload: ${oneLine(upload, keep === true ? 2000 : 120)} |`
}

/** The checkpoint rows of DECISIONS.md's Timeline. */
export function parseTimeline(text) {
  const rows = []
  for (const line of (text ?? "").split("\n")) {
    const m = ROW.exec(line)
    if (m !== null) rows.push({ minute: m[1], version: m[2].slice(1), commit: m[3], contents: m[4], upload: m[5] })
  }
  return rows
}

/** Adds a row to the Timeline table: before a trailing `| TODO | |` placeholder, else after its last row. */
export function addTimelineRow(text, row) {
  const lines = (text ?? "").replace(/\n*$/, "").split("\n")
  const h = lines.findIndex((line) => /^##\s+Timeline\s*$/.test(line))
  if (h === -1) return `${lines.join("\n")}\n\n## Timeline\n\n| Minute | What happened |\n| --- | --- |\n${row}\n`
  let end = h + 1
  while (end < lines.length && !/^#{1,2}\s/.test(lines[end])) end += 1
  const table = []
  for (let i = h + 1; i < end; i += 1) if (lines[i].startsWith("|")) table.push(i)
  if (table.length === 0) {
    lines.splice(end, 0, "| Minute | What happened |", "| --- | --- |", row, "")
  } else {
    const last = table[table.length - 1]
    const at = /^\|\s*TODO\s*\|/.test(lines[last]) && table.length > 2 ? last : last + 1
    lines.splice(at, 0, row)
  }
  return `${lines.join("\n")}\n`
}

/**
 * True when a row's upload note is empty or is one this command wrote itself. Any other text there was written by a
 * person or the agent ("left for you to drop in by hand") and is never replaced.
 */
export function isOwnUploadNote(note) {
  const flat = oneLine(note ?? "", 120)
  return flat === "" || OWN_UPLOAD_NOTES.some((words) => oneLine(words, 120) === flat)
}

/**
 * The upload note after a result: the command's own words are replaced, and so is its own phrase at the start of a
 * note someone continued ("pending when this zip was made; I kept a copy"), keeping what they added. Any other note
 * stays exactly as written.
 */
export function fillUploadNote(note, upload) {
  if (upload === undefined) return { note, kept: true }
  if (isOwnUploadNote(note)) return { note: upload, kept: false }
  const flat = oneLine(note ?? "", 2000)
  const own = OWN_UPLOAD_NOTES.map((words) => oneLine(words, 120))
    .sort((a, b) => b.length - a.length)
    .find((words) => flat.startsWith(words) && /^[;,.:]?\s/.test(flat.slice(words.length)))
  return own === undefined ? { note, kept: true } : { note: `${upload}${flat.slice(own.length)}`, kept: true }
}

/**
 * Fills the row for `version` with its commit and upload result, only where the row is empty or holds the command's
 * own words: a note someone added stays as it was (`fillUploadNote`). The text is unchanged if there is no row.
 */
export function updateTimelineRow(text, version, { commit, upload }) {
  return (text ?? "")
    .split("\n")
    .map((line) => {
      const m = ROW.exec(line)
      if (m === null || m[2] !== `v${version}`) return line
      const filled = fillUploadNote(m[5], upload)
      return timelineRow({
        minute: m[1],
        version,
        commit: m[3] ?? commit,
        contents: m[4],
        upload: filled.note,
        keep: filled.kept
      })
    })
    .join("\n")
}

/**
 * True when DECISIONS.md has a Timeline section. The template has none: the write-up is about the app, and each
 * checkpoint is in docs/session/SUMMARY.md instead. A project that keeps one gets its rows filled as before.
 */
export const hasTimeline = (text) => /^##\s+Timeline\s*$/m.test(text ?? "")

/**
 * The write-up's budgets, in words: README.md's own part (from the top to its first `###` heading or "What is in the
 * repository", the starter's reference sections after it not counted) and DECISIONS.md whole. A reader wants the app
 * in a page or two; past these, the checkpoint warns.
 */
export const WRITEUP_BUDGET = { readme: 900, decisions: 1500 }

/** README.md's own part: from the top to its first `###` heading or "## What is in the repository". */
export function readmeWriteup(text) {
  const lines = (text ?? "").split("\n")
  const end = lines.findIndex((line) => /^###\s/.test(line) || /^##\s+What is in the repository/.test(line))
  return (end === -1 ? lines : lines.slice(0, end)).join("\n")
}

const words = (text) => (text.match(/[A-Za-z0-9][\w'’.-]*/g) ?? []).length

// Words that tell how the hour was run, not what the app does: roles, rounds, relays, the record, minute stamps.
const PROCESS_WORDS = [
  /\bthe lead\b(?! times?\b)/i,
  /\blead session\b/i,
  /\bbuilders?\b/i,
  /\buploader\b/i,
  /\brelay(?:ed|s|ing)?\b/i,
  /\b(?:decision )?rounds? (?:one|two|three|four|[1-4])\b/i,
  /\bsub-?agents?\b/i,
  /\bsession record\b/i,
  /\bprivate[- ]marker/i,
  /\bat minute \d+|\bminute \d+\b/i,
  // A branch or worktree of side work: not in the zip, so the reader cannot follow it.
  /\bbranch(?:es)? `[^`]+`/i,
  /\bclaude\/[a-z0-9][\w.-]*/i,
  /\bworktrees?\b/i
]

/**
 * Warnings, never failures, for a write-up that has grown past its budget or speaks about how the hour was run
 * (`PROCESS_WORDS`) instead of the app. `files` holds README.md and DECISIONS.md by name; only README.md's own part
 * is read (`readmeWriteup`). Each line names the file and line and the word, at most eight lines of words.
 * @example writeupStyle({ files: { "DECISIONS.md": "The builder relayed it." } }) // two WARN lines
 */
export function writeupStyle({ files, budget = WRITEUP_BUDGET }) {
  const out = []
  const hits = []
  for (const [name, raw] of Object.entries(files)) {
    if (typeof raw !== "string") continue
    const text = name === "README.md" ? readmeWriteup(raw) : raw
    const limit = name === "README.md" ? budget.readme : budget.decisions
    const count = words(text)
    if (count > limit)
      out.push(
        `${name}${name === "README.md" ? " (its own part, before the reference sections)" : ""} is ${count} words, over the ${limit} a reader gives it: cut it to the app, its rules and what was cut.`
      )
    text.split("\n").forEach((line, index) => {
      for (const pattern of PROCESS_WORDS) {
        const found = pattern.exec(line)
        if (found !== null) hits.push(`${name}:${index + 1} says "${found[0]}"`)
      }
    })
  }
  if (hits.length > 0)
    out.push(
      `The write-up speaks about how the hour was run (roles, rounds, relays, the record, minute stamps, branches not in the zip); say that in chat, and write about the app: ${hits.slice(0, 8).join("; ")}${hits.length > 8 ? `; and ${hits.length - 8} more` : ""}.`
    )
  return out
}

/**
 * The Timeline and the tags must tell one story: every version has a Timeline row, and no row holds a version that
 * was never made. Returns the problems.
 */
export function recordsAgree({ decisions, versions }) {
  const problems = []
  const rows = parseTimeline(decisions)
  const made = new Set(versions.map((v) => v.replace(/^v/, "")))
  for (const v of made) {
    if (!rows.some((r) => r.version === v)) problems.push(`DECISIONS.md's Timeline has no row for v${v}`)
  }
  for (const r of rows)
    if (!made.has(r.version)) problems.push(`DECISIONS.md's Timeline has v${r.version}, which no checkpoint made`)
  return problems
}

/**
 * The product decisions waiting for the person: rows of a DECISIONS.md table with a "Who decided" column whose cell
 * starts "not decided" (asked, or about to be, and not answered yet) or says "waiting" (the older wording). The clock
 * shows the count.
 * @example waitingDecisions("| Decision | Who decided |\n| --- | --- |\n| Round half up | not decided |") // 1
 */
export function waitingDecisions(text) {
  let column = -1
  let count = 0
  for (const line of (text ?? "").split("\n")) {
    if (!line.trim().startsWith("|")) {
      column = -1
      continue
    }
    const cells = line
      .trim()
      .replace(/^\||\|$/g, "")
      .split("|")
      .map((cell) => cell.trim())
    const header = cells.findIndex((cell) => /^who decided$/i.test(cell))
    if (header !== -1) {
      column = header
      continue
    }
    if (column === -1 || cells.every((cell) => /^:?-+:?$/.test(cell))) continue
    const cell = cells[column] ?? ""
    if (/^(?:not decided|undecided)\b/i.test(cell) || /\bwaiting\b/i.test(cell)) count += 1
  }
  return count
}

/** package-lock.json with the project's own version (two places) set; npm writes it with two spaces and a newline. */
export function setLockfileVersion(text, version) {
  const lock = JSON.parse(text)
  lock.version = version
  if (lock.packages !== undefined && lock.packages[""] !== undefined) lock.packages[""].version = version
  return `${JSON.stringify(lock, null, 2)}\n`
}

/** package.json with its top-level version changed, every other byte kept. */
export function setPackageVersion(text, version) {
  return text.replace(/^(\s*"version"\s*:\s*")[^"]*(")/m, `$1${version}$2`)
}

/** Lines of `.session/checkpoints.jsonl`, unreadable ones skipped. */
export function readCheckpointLog(text) {
  const lines = []
  for (const raw of (text ?? "").split("\n")) {
    if (raw.trim() === "") continue
    try {
      const line = JSON.parse(raw)
      if (line !== null && typeof line === "object" && typeof line.ev === "string") lines.push(line)
    } catch {
      // A torn last line (the command was killed mid-write) is skipped, not fatal.
    }
  }
  return lines
}

/**
 * The upload mode, from the local log. "not asked" until Benjamin says in this session that checkpoints are
 * uploaded; "auto" after that; "manual" when he says so, when the first upload after "auto" is not confirmed (one
 * strike), or when two in a row are not confirmed after a confirmed one. Only his word turns it back to "auto".
 * "auto" belongs to the session that recorded it: any other session reads "not asked", with `elsewhere` set (a new
 * session, or a lead while the builder it started uploads).
 */
export function uploadMode({ lines, sid }) {
  let mode = "not asked"
  let reason = "not turned on in this session"
  let autoSid
  let first = true
  let strikes = []
  let lastConfirmed
  const results = new Map()
  for (const line of lines) {
    if (line.ev === "uploads" && line.mode === "auto") {
      mode = "auto"
      autoSid = line.sid
      first = true
      strikes = []
      reason = "turned on in this session"
    } else if (line.ev === "uploads" && line.mode === "manual") {
      mode = "manual"
      reason = "turned off in this session"
    } else if (line.ev === "upload" && typeof line.version === "string") {
      results.set(line.version, line.result)
      if (line.result === "confirmed") {
        lastConfirmed = line.version
        first = false
        strikes = []
      } else if ((line.result === "not-confirmed" || line.result === "stopped") && mode === "auto") {
        if (first) {
          mode = "manual"
          reason = `the first upload of the session (v${line.version}) was not confirmed: one strike`
        } else {
          strikes.push(line.version)
          if (strikes.length >= 2) {
            mode = "manual"
            reason = `two uploads in a row were not confirmed (${strikes.map((v) => `v${v}`).join(", ")})`
          }
        }
      }
    }
  }
  let elsewhere = false
  if (mode === "auto" && autoSid !== undefined && sid !== undefined && autoSid !== sid) {
    mode = "not asked"
    reason = "turned on in another session, not in this one"
    elsewhere = true
  }
  const made = lines.filter((l) => l.ev === "checkpoint").map((l) => l.version)
  const after = lastConfirmed === undefined ? made : made.slice(made.lastIndexOf(lastConfirmed) + 1)
  return {
    mode,
    reason,
    firstPending: mode === "auto" && first,
    lastConfirmed,
    elsewhere,
    unconfirmed: after.filter((v) => !UPLOADED.has(results.get(v)))
  }
}

/**
 * What changed under brief/ since it was received. The brief stays as it came: a file may be added there (a sample
 * saved later), never changed or removed once committed, and the commit that started the clock is never amended or
 * rewritten. `received` holds each brief file as first committed, in the clock-start commit or after it
 * (`{ path, blob, commit }`); `head` the blob of each brief file at HEAD, by path; `worktree` the
 * `git status --porcelain` lines under brief/; `rewritten` the commits HEAD once pointed at, made since the clock
 * started, that are no longer in its history and added a brief file (`{ commit, start, differs }`: `start` when it
 * was the commit that started the clock, `differs` the brief files whose content is not what the history holds).
 * Returns one finding per change: `key` is what Benjamin's go-ahead covers, `text` the sentence that names it.
 * @example briefFindings({ received: [{ path: "brief/BRIEF.md", blob: "a1", commit: "c0ffee1" }], head: { "brief/BRIEF.md": "b2" }, worktree: [], rewritten: [] })
 * // [{ key: "changed brief/BRIEF.md b2", text: "brief/BRIEF.md is not as received in c0ffee1" }]
 */
export function briefFindings({ received, head, worktree, rewritten }) {
  const found = []
  const at = (commit) => commit.slice(0, 7)
  for (const file of received) {
    const now = Object.hasOwn(head, file.path) ? head[file.path] : undefined
    if (now === undefined)
      found.push({ key: `removed ${file.path}`, text: `${file.path} was removed (received in ${at(file.commit)})` })
    else if (now !== file.blob)
      found.push({ key: `changed ${file.path} ${now}`, text: `${file.path} is not as received in ${at(file.commit)}` })
  }
  for (const line of worktree) {
    if (line.trim() === "" || line.startsWith("??")) continue
    const path = line.slice(3).replace(/^.* -> /, "")
    found.push({ key: `uncommitted ${path}`, text: `${path} has an uncommitted change` })
  }
  for (const commit of rewritten) {
    const differs = commit.differs.length === 0 ? "" : `; not as it was there: ${commit.differs.join(", ")}`
    if (commit.start)
      found.push({
        key: `rewritten ${commit.commit}`,
        text: `the commit that started the clock was amended or rewritten: ${at(commit.commit)} is no longer in the history${differs}`
      })
    else if (commit.differs.length > 0)
      found.push({
        key: `rewritten ${commit.commit}`,
        text: `${at(commit.commit)}, which added brief files, was amended or rewritten${differs}`
      })
  }
  return found
}

/**
 * The brief findings Benjamin has not said to go on with (`--brief-as-is "<his words>"`, which covers the findings
 * open when it was recorded), the ones he has, and his words.
 */
export function openBriefFindings({ findings, lines }) {
  const given = lines.filter((line) => line.ev === "brief-as-is" && Array.isArray(line.keys))
  const covered = new Set(given.flatMap((line) => line.keys))
  return {
    open: findings.filter((finding) => !covered.has(finding.key)),
    asIs: findings.filter((finding) => covered.has(finding.key)),
    said: given.map((line) => line.said).filter((said) => typeof said === "string" && said !== "")
  }
}

/**
 * The last look, round four: Benjamin's answer to "anything to write down?", recorded with `--last-look` after the
 * last checkpoint. The final checkpoint is refused without one, so the round always comes after the last version
 * with code, however late. Undefined when none was recorded since the last checkpoint.
 * @example lastLook({ lines: [{ ev: "checkpoint", version: "0.3.0" }, { ev: "last-look", said: "Nothing more" }] })
 * // { ev: "last-look", said: "Nothing more" }
 */
export function lastLook({ lines }) {
  let last = -1
  lines.forEach((line, index) => {
    if (line.ev === "checkpoint") last = index
  })
  return lines
    .slice(last + 1)
    .reverse()
    .find((line) => line.ev === "last-look" && typeof line.said === "string" && line.said !== "")
}

/** A mark older than this is stale: a qa pass takes about seven minutes, a reviewer's about five. */
export const IN_USE_STALE_MINUTES = 30

/**
 * Which "in use" marks on frozen copies still hold. An agent marks a copy before a pass on it (`bun run checkpoint --
 * --use v0.4.1 qa`) and clears the mark when it reports (`--done`); `--final` and `--stop` refuse while a live mark
 * stands, because they remove every copy and would cut that pass short. A mark is stale, and only reported, when it is
 * older than IN_USE_STALE_MINUTES, when its copy no longer runs, or when the process it names has ended.
 * `marks` are `{ version, by, t, pid? }` (`t` in milliseconds); `running` the versions whose copy answers.
 * @example inUseStatus({ marks: [{ version: "0.4.1", by: "qa", t: 0 }], now: 60_000, running: ["0.4.1"] }).live.length // 1
 */
export function inUseStatus({ marks, now, running, pidAlive = () => true }) {
  const live = []
  const stale = []
  for (const mark of marks) {
    const minutes = Math.floor((now - mark.t) / 60000)
    const why =
      minutes > IN_USE_STALE_MINUTES
        ? `marked ${minutes} min ago, over ${IN_USE_STALE_MINUTES}`
        : !running.includes(mark.version)
          ? "its copy is not running"
          : typeof mark.pid === "number" && !pidAlive(mark.pid)
            ? `process ${mark.pid} has ended`
            : undefined
    if (why === undefined) live.push({ ...mark, minutes })
    else stale.push({ ...mark, minutes, why })
  }
  return { live, stale }
}

/** One line per mark, for the refusal, `--status` and `--in-use`. */
export function inUseLines({ live, stale }) {
  return [
    ...live.map((m) => `  v${m.version} in use by ${m.by}, marked ${m.minutes} min ago`),
    ...stale.map(
      (m) => `  v${m.version} marked by ${m.by}: STALE (${m.why}); ignored. Clear it: --done v${m.version} ${m.by}`
    )
  ]
}

/** The refusal of a step that removes every frozen copy (`--final`, `--stop`) while a live mark stands. */
export function inUseRefusal({ live, stale, step }) {
  return [
    `STOPPED: ${step} removes every frozen copy, and ${live.length === 1 ? "one is" : `${live.length} are`} in use:`,
    ...inUseLines({ live, stale }),
    "No version was made and nothing was stopped. Wait for that pass to report (it clears its mark with --done), or,",
    `if Benjamin says in his own words to cut it short, run ${step} again with --override-in-use.`
  ].join("\n")
}

/** The words for an upload result in the Timeline row. The page's own sentence stays in the local log and the chat. */
export function uploadWords(result) {
  switch (result) {
    case "confirmed":
      return "confirmed by the page"
    case "by-hand":
      return "dropped in by hand by Benjamin"
    case "not-confirmed":
      return "not confirmed"
    case "stopped":
      return "stopped before sending; handed to Benjamin"
    case "too-big":
      return "not uploaded: over the upload agent's size limit; handed to Benjamin"
    case "held":
      return "held back by Benjamin"
    case "manual":
      return "manual: handed to Benjamin to drop in"
    case "not-asked":
      return "not asked for in this session"
    case "unrecorded":
      return "no result was recorded"
    default:
      return "pending when this zip was made"
  }
}

/** Every note `uploadWords` can write: the only text in a row's upload note the command may replace. */
export const OWN_UPLOAD_NOTES = [
  "confirmed",
  "by-hand",
  "not-confirmed",
  "stopped",
  "too-big",
  "held",
  "manual",
  "not-asked",
  "unrecorded",
  undefined
].map(uploadWords)

/** Results that put a version on the page: the page confirmed it, or Benjamin dropped it in himself. */
const UPLOADED = new Set(["confirmed", "by-hand"])

/** The most the upload agent tries, in bytes. The page's own limit is not known: it says so if it refuses. */
export const UPLOAD_LIMIT = 25 * 1000 * 1000

/** The upload limit, from `CHECKPOINT_UPLOAD_LIMIT_MB` (a number of megabytes) when it is set, else 25 MB. */
export function uploadLimit(env) {
  const raw = env?.CHECKPOINT_UPLOAD_LIMIT_MB
  const mb = typeof raw === "string" && raw.trim() !== "" ? Number(raw) : Number.NaN
  return Number.isFinite(mb) && mb > 0 ? Math.round(mb * 1000 * 1000) : UPLOAD_LIMIT
}

/** Bytes as megabytes with one decimal (1 MB = 1,000,000 bytes, the unit the limits use), or kilobytes below 1 MB. */
export function sizeText(bytes) {
  return bytes >= 1000 * 1000 ? `${(bytes / 1000 / 1000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} kB`
}

/**
 * Where one version's upload stands, from the local log. "uploaded" once the page confirmed it or Benjamin dropped it
 * in; "pending" while it waits for the uploader's result; "held" or "not asked" when nobody meant to upload it; else
 * "not uploaded". `loud` means the person must be told in capitals, with the path: a version meant for the page that
 * is not on it, or a final version that is not uploaded for any reason. A final version that is not uploaded is never
 * done.
 */
export function uploadState({ lines, version }) {
  const v = String(version).replace(/^v/, "")
  let result
  let final = false
  let zip
  let why
  for (const line of lines) {
    if (line.version !== v) continue
    if (line.ev === "checkpoint") {
      // A result recorded before this checkpoint belongs to an earlier, undone attempt at the same version.
      result = undefined
      why = undefined
      final = line.final === true
      zip = typeof line.zip === "string" ? line.zip : undefined
    } else if (line.ev === "upload") {
      result = line.result
      why =
        line.result === "too-big" && typeof line.bytes === "number" && typeof line.limit === "number"
          ? `${sizeText(line.bytes)}, over the ${sizeText(line.limit)} the upload agent tries`
          : undefined
    }
  }
  const state =
    result === undefined
      ? "pending"
      : UPLOADED.has(result)
        ? "uploaded"
        : result === "held"
          ? "held"
          : result === "not-asked"
            ? "not asked"
            : "not uploaded"
  const loud = state === "not uploaded" || (final && (state === "held" || state === "not asked"))
  return { version: v, result, state, final, zip, loud, why: why ?? notUploadedWhy(result) }
}

/** Why a version is not on the page, in plain words. */
function notUploadedWhy(result) {
  switch (result) {
    case "not-confirmed":
      return "the page did not confirm it"
    case "stopped":
      return "the upload agent stopped before sending it"
    case "too-big":
      return "it is over the size the upload agent tries"
    case "manual":
      return "uploads are by hand in this session"
    case "held":
      return "held back by Benjamin"
    case "not-asked":
      return "uploads were not asked for in this session"
    default:
      return undefined
  }
}

/**
 * The capitals line for a version that is not on the page, with the path to drop in. Printed by the checkpoint, by the
 * upload record and by the clock; a final version adds that the work is not done.
 */
export function notUploadedLine({ version, final, why, zip }) {
  const reason = why === undefined ? "" : `: ${why}`
  return final
    ? `FINAL VERSION v${version} is NOT UPLOADED${reason}. The work is not done until it is on the page. Drop it in by hand: ${zip}`
    : `v${version} is NOT UPLOADED${reason}. Drop it in by hand: ${zip}`
}

/** The one line a checkpoint ends with. */
export function checkpointLine({ version, minute, commit, zip, bytes, seconds, upload }) {
  return `CHECKPOINT v${version} · minute ${minute} · commit ${commit} · ${zip} · ${sizeText(bytes)} · ${seconds} s · upload: ${upload}`
}

/** True for a raster image: a screenshot, a photo, an icon. */
export const isImage = (path) => /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(path)

/** The part of the project a path is counted under in the zip's weight: its first three folders, or a top-level file. */
export function partOf(path) {
  const parts = path.split("/")
  if (parts[0] === ".git") return ".git (index, hooks, refs)"
  if (parts.length === 1) return path
  return parts.slice(0, Math.min(parts.length - 1, 3)).join("/")
}

/**
 * The largest parts of a zip. `files` are its entries with their compressed size (the git pack left out); `history`
 * is every object in that pack with the path it was committed at (none for commits and folders) and its size there.
 * A committed file counts twice, as a file and in history, and a file replaced since still counts in history.
 */
export function largestParts({ files, history, top = 3 }) {
  const parts = new Map()
  const part = (name) => {
    if (!parts.has(name)) parts.set(name, { name, files: 0, history: 0, paths: new Set(), images: new Set() })
    return parts.get(name)
  }
  for (const f of files) {
    const p = part(partOf(f.path))
    p.files += f.bytes
    if (!f.path.startsWith(".git/")) p.paths.add(f.path)
    if (isImage(f.path)) p.images.add(f.path)
  }
  for (const h of history) {
    const p = part(h.path === undefined || h.path === "" ? "git commits and folder lists" : partOf(h.path))
    p.history += h.bytes
    if (h.path !== undefined && h.path !== "") p.paths.add(h.path)
    if (h.path !== undefined && isImage(h.path)) p.images.add(h.path)
  }
  return [...parts.values()]
    .map((p) => ({
      name: p.name,
      bytes: p.files + p.history,
      files: p.files,
      history: p.history,
      count: p.paths.size,
      images: p.images.size
    }))
    .sort((a, b) => b.bytes - a.bytes || (a.name < b.name ? -1 : 1))
    .slice(0, top)
}

/** The zip size gets a warning above this: a big zip is slow to upload, and it is almost always screenshots. */
export const ZIP_WARN = 5 * 1000 * 1000

/** The size line, and above 5 MB a plain warning naming the three largest parts. */
export function weightLines({ bytes, parts, warn = ZIP_WARN }) {
  const lines = [`Size:    ${sizeText(bytes)}`]
  if (bytes <= warn) return lines
  lines.push(`WARN  the zip is ${sizeText(bytes)}, over ${sizeText(warn)}. The three largest things in it:`)
  for (const p of parts) {
    const what = `${p.count} file${p.count === 1 ? "" : "s"}${p.images > 0 ? `, ${p.images} of them images` : ""}`
    lines.push(
      `      ${p.name}: ${sizeText(p.bytes)} (${what}; ${sizeText(p.files)} as files, ${sizeText(p.history)} in git history)`
    )
  }
  // The hint is for screenshots, not for the app's own icons or a vendored skill's pictures.
  const assets = /^(public|src\/web\/assets|\.agents|test\/fixtures)(\/|$)/
  if (parts.some((p) => p.images > 0 && !assets.test(p.name)))
    lines.push(
      "      Screenshots belong in .scratch/shots/ (git-ignored); at most six small WebP images are committed (bun run shot)."
    )
  return lines
}

/** The cells of one markdown table row, or undefined for a line that is not a row or is the dashes under a header. */
function tableCells(line) {
  if (!line.trim().startsWith("|")) return undefined
  const cells = line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim())
  return cells.every((cell) => /^:?-+:?$/.test(cell)) ? undefined : cells
}

/**
 * The people the migrations seed: the distinct names in every `INSERT INTO member` statement (by id where a statement
 * has no name column). One person in two organisations is still one person.
 * @example seededPeople(["INSERT INTO member (id, name) VALUES ('mem_a', 'Ann'), ('mem_b', 'Bo');"]) // 2
 */
export function seededPeople(sqlTexts) {
  const people = new Set()
  for (const sql of sqlTexts) {
    const statements = sql.matchAll(/insert\s+(?:or\s+\w+\s+)?into\s+["`]?member["`]?\s*\(([^)]*)\)\s*values\s*/gi)
    for (const statement of statements) {
      const columns = statement[1].split(",").map((c) => c.trim().replace(/["`]/g, "").toLowerCase())
      const key = columns.includes("name") ? columns.indexOf("name") : Math.max(columns.indexOf("id"), 0)
      // The value tuples, read up to the statement's end: quotes and nested brackets are kept whole.
      let depth = 0
      let quoted = false
      let value = ""
      let row = []
      for (let i = statement.index + statement[0].length; i < sql.length; i += 1) {
        const ch = sql[i]
        if (quoted) {
          if (ch === "'" && sql[i + 1] === "'") {
            value += "'"
            i += 1
          } else if (ch === "'") quoted = false
          else value += ch
          continue
        }
        if (ch === "'") quoted = true
        else if (ch === "(") {
          depth += 1
          if (depth > 1) value += ch
        } else if (ch === ")") {
          depth -= 1
          if (depth === 0) {
            row.push(value.trim())
            if (row[key] !== undefined && row[key] !== "") people.add(row[key])
            row = []
            value = ""
          } else value += ch
        } else if (ch === "," && depth === 1) {
          row.push(value.trim())
          value = ""
        } else if (ch === ";" && depth === 0) break
        else if (depth > 0) value += ch
      }
    }
  }
  return people.size
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve"
]
const numberOf = (word) => {
  const at = NUMBER_WORDS.indexOf(word.toLowerCase())
  return at === -1 ? Number(word.replace(/,/g, "")) : at
}

/**
 * What the final write-up must not still say, checked before the last zip. `files` holds README.md and DECISIONS.md
 * by name; `tests` is how many tests the clean copy's `check:full` passed (undefined when it did not run); `people`
 * how many people the migrations seed. A table cell still "waiting" fails: the hour is over, so nothing waits, and a
 * decision is either written down or "not decided". A cell "not decided", and a count of tests or people that differs
 * from the check or the seed, are warnings, each naming its file and line: the sentence may mean something else.
 */
export function writeupProblems({ files, tests, people }) {
  const fail = []
  const warn = []
  for (const [name, text] of Object.entries(files)) {
    if (typeof text !== "string") continue
    text.split("\n").forEach((line, index) => {
      const where = `${name}:${index + 1}`
      for (const cell of tableCells(line) ?? []) {
        if (/^(?:agent['’]s default,\s*)?waiting\b/i.test(cell))
          fail.push(`${where} still says "${cell}": the hour is over. Write what Benjamin decided, or "not decided".`)
        else if (/^(?:not decided|undecided)\b/i.test(cell))
          warn.push(`${where} says "${cell}". If Benjamin decided it, write his decision there.`)
      }
      if (tests !== undefined) {
        const said = [
          ...line.matchAll(/\b(\d[\d,]*)\s+(?:fast\s+|slow\s+|unit\s+|passing\s+)?tests?\b/gi),
          ...line.matchAll(/\bTests\s+(\d+)\s+passed\b/g)
        ]
        for (const m of said)
          if (numberOf(m[1]) !== tests)
            warn.push(
              `${where} says "${m[0]}"; check:full in the clean copy passed ${tests}. Correct it if it means every test.`
            )
      }
      if (people !== undefined && people > 0) {
        const words = `\\d+|${NUMBER_WORDS.join("|")}`
        for (const m of line.matchAll(new RegExp(`\\b(${words})\\s+(?:seeded\\s+)?(?:people|persons)\\b`, "gi")))
          if (numberOf(m[1]) !== people)
            warn.push(`${where} says "${m[0]}"; the migrations seed ${people}. Correct it if it means everyone seeded.`)
      }
    })
  }
  return { fail, warn }
}
