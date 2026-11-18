// Session record, part 2: turns the hooks' log (.session/events.jsonl, see scripts/session-log.mjs) and `git log`
// into docs/session/: TIMELINE.md, SUMMARY.md and a redacted copy of the events. A checkpoint runs it before packing.
//   bun run session                              write docs/session/
//   node scripts/session-report.mjs --guard      only the private-marker check (scripts/pack.sh runs this)
// The same log and history always give the same files. Nothing here is written by hand or by a model.
// Private-marker check: when TAKEHOME_PRIVATE_MARKERS names a file (one string per line, # for comments), any of
// those strings, ignoring case, in docs/session/, the tracked tree, a commit message or a line added in history
// fails the run. Hits are reported as file, line and the kind of thing that matched (a prompt, a command, a commit
// message), never the string. The hooks and this report both write a marker as [private] (`redact` in
// scripts/session-log.mjs), so docs/session/ is clean whenever the variable was set. Unset, nothing extra happens.
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { isRelayed, parseMarkers, readClockStart, redact } from "./session-log.mjs"

export { parseMarkers }

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const PERSON = "Benjamin"
// The checkpoints table needs scripts/checkpoint-rules.mjs. A project without checkpoints has no such file: the
// record is the same, without that table.
const checkpointRules = await import("./checkpoint-rules.mjs").catch(() => undefined)

// Every field the record may hold, in the order it is written. Anything else in the raw log is dropped.
const FIELDS = (
  "t min sid p dir by agent aid ev source model text name via to desc brief bg tu ok exit interrupted cmd tool path " +
  "status tools tokens ms task summary running trigger reason error hook qs"
).split(" ")

/** A dialog answer as the hook wrote it, kept to its header, the labels chosen and his words, each redacted again. */
const answerList = (value, where) =>
  Array.isArray(value)
    ? value.flatMap((q) => {
        if (q === null || typeof q !== "object") return []
        const text = (s) => (typeof s === "string" ? redact(s, where) : undefined)
        const pick = Array.isArray(q.pick)
          ? q.pick.flatMap((p) => (typeof p === "string" ? [redact(p, where)] : []))
          : []
        return [{ h: text(q.h) ?? "", pick, words: text(q.words) }]
      })
    : undefined

/** Reads the raw log: one event per line, fields allow-listed and every string redacted again. */
export function parseLog(text, where = {}) {
  const events = []
  let skipped = 0
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue
    let raw
    try {
      raw = JSON.parse(line)
    } catch {
      skipped += 1
      continue
    }
    const time = raw !== null && typeof raw === "object" ? Date.parse(raw.t) : Number.NaN
    if (!Number.isFinite(time) || typeof raw.ev !== "string") {
      skipped += 1
      continue
    }
    const event = {}
    for (const key of FIELDS) {
      const value = raw[key]
      if (value === undefined) continue
      event[key] = key === "qs" ? answerList(value, where) : typeof value === "string" ? redact(value, where) : value
    }
    events.push({ ...event, time })
  }
  return { events, skipped }
}

// ---------------------------------------------------------------------------------------------------------------
// Reading the events

// A command counts only where a command starts (start of line, or after ; & | or a bracket), so a heredoc or a
// string that mentions "vitest" is not a check.
const at = (pattern) => new RegExp(`(?:^|[;&|(\\n]\\s*)(?:[A-Z_]+=\\S*\\s+)*(?:${pattern})`)
const PACK = at(String.raw`(?:npm|bun|pnpm)\s+run\s+pack\b|(?:bash\s+)?scripts/pack\.sh\b`)
const CHECKPOINT = at(String.raw`(?:npm|bun|pnpm)\s+run\s+checkpoint\b|node\s+scripts/checkpoint\.mjs\b`)
const BUILD = at(String.raw`(?:npm|bun|pnpm)\s+run\s+build\b|(?:npx\s+)?vite\s+build\b`)
const CHECK = at(
  String.raw`(?:npm|bun|pnpm)\s+(?:run\s+)?(?:check(?!:strict)|test|typecheck|typecheck:tsc|lint|format:check)\b|(?:npx\s+|bunx\s+)?(?:vitest|tsc|oxlint|oxfmt\s+--check|effect-tsgo|tsrs)\b`
)
const COMMIT = at(String.raw`git\s+commit\b`)
// A commit that skipped the git hooks. The write-up names each one (CLAUDE.md "Commit at each working step").
const NO_VERIFY = /\bgit\s+commit\b[\s\S]*\s--no-verify\b/
/** What a shell command was for: checkpoint, pack, build, check, commit or plain shell, in that order of precedence. */
export function commandKind(cmd) {
  // A checkpoint runs the pack's checks; recording an upload result or the mode does not.
  if (CHECKPOINT.test(cmd)) return /--(?:record-upload|uploads|status)\b/.test(cmd) ? "shell" : "checkpoint"
  if (PACK.test(cmd)) return /--quick/.test(cmd) ? "quick-pack" : "pack"
  if (BUILD.test(cmd)) return "build"
  if (CHECK.test(cmd)) return "check"
  if (COMMIT.test(cmd)) return "commit"
  return "shell"
}

const KIND_LABEL = {
  checkpoint: "checkpoint",
  pack: "pack",
  "quick-pack": "pack --quick (no checks)",
  build: "build",
  check: "check",
  commit: "git commit",
  shell: "shell"
}
const isVerified = (kind) => kind === "check" || kind === "build" || kind === "pack" || kind === "checkpoint"
// `bun run check | tail` exits with tail's status: the record then cannot say whether the check passed.
const piped = (cmd) => cmd.replace(/\|\|/g, "").includes("|") && !/pipefail/.test(cmd)
const hidden = (e) => e.ok === true && isVerified(commandKind(e.cmd ?? "")) && piped(e.cmd ?? "")

const seconds = (ms) => `${(ms / 1000).toFixed(1)} s`
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
// Curly quotes and double backticks keep the recorded text exactly as it was, inner quotes and backticks included.
const quote = (text) => `“${text.replace(/\s+/g, " ").trim()}”`
const code = (text) => {
  const flat = text.replace(/\s+/g, " ").trim()
  return flat.includes("`") ? `\`\` ${flat} \`\`` : `\`${flat}\``
}
const refs = (events, max = 12) => {
  const ids = events.map((e) => `e${e.n}`)
  return ids.length > max ? `${ids.slice(0, max).join(", ")} and ${ids.length - max} more` : ids.join(", ")
}
// Counts by key, most first, ties by name. A Map, so a key such as "constructor" is just a key.
const countBy = (items, key) => {
  const counts = new Map()
  for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
}
const listCounts = (pairs) => (pairs.length === 0 ? "none" : pairs.map(([k, n]) => `${k} ${n}`).join(", "))

function who(e) {
  if (e.by === "person") return PERSON
  if (e.by === "harness") return "harness"
  if (e.by === "sub") return `${e.agent === undefined || e.agent === "" ? "subagent" : e.agent} (${e.aid ?? "?"})`
  return "main agent"
}

function shellResult(e, kind) {
  if (e.bg === true) return "started in the background; its result is not recorded"
  if (e.interrupted === true) return "interrupted"
  if (hidden(e))
    return `result not known: the output was piped, so exit 0 is the pipe's last command${e.ms === undefined ? "" : `, ${seconds(e.ms)}`}`
  const verified = isVerified(kind) || kind === "quick-pack"
  const word = e.ok === true ? (verified ? "PASS" : "ok") : verified ? "FAIL" : "failed"
  const exit = e.ok !== true && e.exit !== undefined ? ` (exit ${e.exit})` : ""
  return `${word}${exit}${e.ms === undefined ? "" : `, ${seconds(e.ms)}`}`
}

// ---------------------------------------------------------------------------------------------------------------
// Building the record

/**
 * Builds TIMELINE.md, SUMMARY.md and events.jsonl from parsed events and the commits (oldest first, each
 * `{ hash, ct, subject }`, with `start: true` on the one that added the brief). Pure and deterministic.
 */
export function buildRecord({ events: raw, commits, skipped = 0, checkpoints = [] }) {
  // A "prompt" the harness wrote (a subagent's report relayed to the main agent, a reminder) is the harness's turn,
  // not the person's, whatever an older hook called it.
  const parsed = raw.map((e) =>
    e.ev === "prompt" && isRelayed(e.text)
      ? {
          ...e,
          by: "harness",
          ev: "notification",
          text: undefined,
          task: e.task ?? /^\s*<agent-message\s+from="([^"]{1,8})/.exec(e.text)?.[1]
        }
      : e
  )
  // Minute 0 is the commit that added the brief (`start`, marked by readClockStart in scripts/session-log.mjs), not
  // the second commit: one made before the brief arrived does not start the clock.
  const startAt = commits.findIndex((c) => c.start === true)
  const startCommit = startAt === -1 ? undefined : commits[startAt]
  const start = startCommit === undefined ? undefined : startCommit.ct * 1000
  const minute = (time) => (start === undefined ? null : Math.floor((time - start) / 60000))
  const stamp = (time) => {
    const m = minute(time)
    return m === null ? "m–" : m < 0 ? "pre" : `m${m}`
  }
  const sorted = parsed.map((e, i) => ({ e, i })).sort((a, b) => a.e.time - b.e.time || a.i - b.i)

  // A session that worked in another checkout (a git worktree under .claude/worktrees/, or a folder outside the
  // project) is not this project's work: its events are left out of every count here, and named. The hook writes
  // such events into that checkout's own record (`recordPlace` in scripts/session-log.mjs); an older log may still
  // hold some. An event without `dir` comes from a hook that did not record it, and counts as this checkout's.
  const ownCheckout = ({ e }) => e.dir === undefined || e.dir === "." || e.dir.startsWith(".frozen/")
  const otherCheckout = sorted.filter((x) => !ownCheckout(x))
  const otherDirs = [...new Set(otherCheckout.map(({ e }) => e.dir))].sort()
  const otherSessions = new Set(otherCheckout.map(({ e }) => e.sid)).size
  // Once the timer runs, sessions that ended before it are left out; a session that crosses minute 0 is kept.
  const inHour = new Set()
  if (start !== undefined) for (const { e } of sorted) if (ownCheckout({ e }) && e.time >= start) inHour.add(e.sid)
  const keep = (x) => ownCheckout(x) && (start === undefined || inHour.has(x.e.sid))
  const kept = sorted.filter(keep).map(({ e }) => e)
  const leftOut = sorted.length - kept.length - otherCheckout.length
  const leftOutSessions = new Set(sorted.filter((x) => ownCheckout(x) && !keep(x)).map(({ e }) => e.sid)).size
  const events = kept.map((e, i) => ({ ...e, n: i + 1 }))
  // The main session is the one the person typed most prompts into (the earlier one on a tie). Only its prompts are
  // counted as his; a prompt in another session (a second terminal, a probe) is shown, not counted.
  const typed = events.filter((e) => e.ev === "prompt")
  const mainSid = countBy(typed, (e) => e.sid ?? "")
    .map(([sid, n]) => ({ sid, n, first: typed.find((e) => (e.sid ?? "") === sid)?.n ?? 0 }))
    .sort((a, b) => b.n - a.n || a.first - b.first)[0]?.sid
  const isMain = (e) => mainSid === undefined || (e.sid ?? "") === mainSid

  // Delegations: the end of an Agent call names the subagent it started. Without it, the next start of a subagent of
  // the same type in the same session is taken.
  const delegations = events.filter((e) => e.ev === "delegate")
  const ends = events.filter((e) => e.ev === "delegate-end")
  const starts = events.filter((e) => e.ev === "subagent-start")
  const subagentOf = new Map()
  const linkedAids = new Set()
  for (const d of delegations) {
    const end = ends.find((x) => x.sid === d.sid && x.tu !== undefined && x.tu === d.tu)
    if (end !== undefined) d.end = end
    if (end?.aid !== undefined) {
      subagentOf.set(d, end.aid)
      linkedAids.add(`${d.sid}/${end.aid}`)
    }
  }
  for (const d of delegations) {
    if (subagentOf.has(d)) continue
    const s = starts.find(
      (x) => x.sid === d.sid && x.time >= d.time && x.agent === d.to && !linkedAids.has(`${x.sid}/${x.aid}`)
    )
    if (s !== undefined) {
      subagentOf.set(d, s.aid)
      linkedAids.add(`${s.sid}/${s.aid}`)
    }
  }
  const children = new Map()
  for (const e of events) {
    if (e.by !== "sub") continue
    const key = `${e.sid}/${e.aid}`
    if (!children.has(key)) children.set(key, [])
    children.get(key).push(e)
  }
  const nested = (e) => e.by === "sub" && linkedAids.has(`${e.sid}/${e.aid}`)
  // Claude Code's own helpers (prompt suggestions, side questions) report a subagent with no type: not delegations.
  const internal = (e) => e.by === "sub" && (e.agent === undefined || e.agent === "")

  // Turns: each prompt from the person, or each notification from the harness, opens one. Events carry the id of
  // the prompt they answer; those without one join the latest turn in their session.
  const turns = []
  const turnOf = new Map()
  const lead = { opener: undefined, items: [] }
  for (const e of events) {
    if ((e.ev === "prompt" || e.ev === "notification") && !nested(e)) {
      const turn = { opener: e, items: [] }
      turns.push(turn)
      if (e.p !== undefined) turnOf.set(`${e.sid}/${e.p}`, turn)
    }
  }
  const latestTurn = (time, sid) => {
    let found
    for (const t of turns) if (t.opener.time <= time && (sid === undefined || t.opener.sid === sid)) found = t
    return found
  }
  // A session's opening lines (it started, before any prompt) belong with its first turn.
  const nextTurn = (time, sid) => turns.find((t) => t.opener.time >= time && t.opener.sid === sid)
  for (const e of events) {
    if (e.ev === "prompt" || e.ev === "notification" || nested(e) || internal(e) || e.ev === "other") continue
    const turn =
      (e.p === undefined ? undefined : turnOf.get(`${e.sid}/${e.p}`)) ??
      latestTurn(e.time, e.sid) ??
      nextTurn(e.time, e.sid) ??
      lead
    turn.items.push({ time: e.time, event: e })
  }
  // Every commit after the template, but the one minute 0 names (the status line names it). One made before the
  // brief is shown too, stamped `pre`.
  const visible = commits.slice(1)
  const afterStart = startAt === -1 ? [] : commits.slice(startAt + 1)
  for (const c of visible.filter((commit) => commit !== startCommit)) {
    const time = c.ct * 1000
    ;(latestTurn(time) ?? lead).items.push({ time, commit: c })
  }
  for (const t of [lead, ...turns]) t.items.sort((a, b) => a.time - b.time)

  // Rendering, one self-contained line per event.
  const renderLevel = (items, depth) => {
    const pad = "  ".repeat(depth)
    const out = []
    const tally = []
    const slots = new Map()
    let lastEdit
    for (const item of items) {
      if (item.commit !== undefined) {
        out.push(
          `${pad}- ${stamp(item.time)} · commit \`${item.commit.hash.slice(0, 7)}\` ${quote(item.commit.subject)} (git log)`
        )
        lastEdit = undefined
        continue
      }
      const e = item.event
      const at = `${pad}- ${stamp(e.time)} · ${who(e)}`
      // Reads, searches and other tools are counted on one line per actor, placed where the first one happened.
      if (e.ev === "look" || (e.ev === "tool" && !/upload/i.test(e.tool ?? ""))) {
        tally.push(e)
        if (!slots.has(who(e))) {
          slots.set(who(e), out.length)
          out.push("")
        }
        continue
      }
      if (e.ev === "edit") {
        if (lastEdit !== undefined && lastEdit.event.path === e.path && who(lastEdit.event) === who(e)) {
          lastEdit.list.push(e)
          out[lastEdit.index] =
            `${lastEdit.prefix} \`${e.path}\` (${lastEdit.list.length} edits) [${refs(lastEdit.list)}]`
          continue
        }
        const prefix = `${at} · ${e.ok === false ? "failed to edit" : "edited"}`
        lastEdit = { event: e, list: [e], index: out.length, prefix }
        out.push(`${prefix} \`${e.path ?? "?"}\` [e${e.n}]`)
        continue
      }
      lastEdit = undefined
      switch (e.ev) {
        case "session-start":
          out.push(
            `${at} · session ${e.sid} started (${e.source ?? "unknown"})${e.model === undefined ? "" : `, model ${e.model}`} [e${e.n}]`
          )
          break
        case "session-end":
          out.push(`${at} · session ${e.sid} ended (${e.reason ?? "unknown"}) [e${e.n}]`)
          break
        case "skill":
          out.push(
            `${at} · ${e.name === "ship" ? "**ship**: " : ""}skill \`${e.name ?? "?"}\`${e.via === "slash" ? ` (typed as /${e.name ?? ""})` : ""} [e${e.n}]`
          )
          break
        case "shell": {
          const kind = commandKind(e.cmd ?? "")
          out.push(`${at} · ${KIND_LABEL[kind]} ${code(e.cmd ?? "")} · ${shellResult(e, kind)} [e${e.n}]`)
          break
        }
        case "delegate": {
          const aid = subagentOf.get(e)
          const target = `${e.to}${aid === undefined ? "" : ` (${aid})`}`
          const how = [
            e.bg === true ? "in the background" : "foreground",
            e.model === undefined ? undefined : `model ${e.model}`
          ]
            .filter(Boolean)
            .join(", ")
          const end = e.end
          const outcome =
            end === undefined
              ? "no result recorded"
              : end.ok === false
                ? "the call failed"
                : end.status === "async_launched"
                  ? `launched${end.model === undefined ? "" : ` on ${end.model}`}`
                  : `${end.status ?? "returned"}${end.ms === undefined ? "" : ` in ${seconds(end.ms)}`}${end.tools === undefined ? "" : `, ${plural(end.tools, "tool call")}`}${end.model === undefined ? "" : ` on ${end.model}`}`
          const ids = [e, ...(end === undefined ? [] : [end])]
          out.push(
            `${at} · delegated to **${target}** (${how}): ${quote(e.desc ?? "")}; brief: ${quote(e.brief ?? "")} → ${outcome} [${refs(ids)}]`
          )
          if (aid !== undefined) {
            const own = (children.get(`${e.sid}/${aid}`) ?? []).filter(
              (c) => c.ev !== "subagent-start" || c !== starts.find((s) => s.sid === c.sid && s.aid === c.aid)
            )
            out.push(
              ...renderLevel(
                own.map((c) => ({ time: c.time, event: c })),
                depth + 1
              )
            )
          }
          break
        }
        case "delegate-end":
          break
        case "subagent-start":
          out.push(
            `${at} · ${nested(e) ? "resumed" : "started; the delegation that started it was not recorded"} [e${e.n}]`
          )
          break
        case "subagent-stop":
          out.push(`${at} · finished [e${e.n}]`)
          break
        case "tool":
          out.push(`${at} · upload step \`${e.tool}\` · ${e.ok === false ? "failed" : "ok"} [e${e.n}]`)
          break
        case "answer": {
          const each = (e.qs ?? []).map((q) => {
            const said = [...q.pick, ...(q.words === undefined ? [] : [`in his own words ${quote(q.words)}`])]
            return `${quote(q.h)}: ${said.length === 0 ? "no answer" : said.join(", ")}`
          })
          out.push(`${at} · answered a question dialog: ${each.join("; ")} [e${e.n}]`)
          break
        }
        case "turn-end":
          out.push(
            `${at} · turn ended${e.running === undefined ? "" : `, ${plural(e.running, "background task")} still running`} [e${e.n}]`
          )
          break
        case "compact":
          out.push(`${at} · context compacted (${e.trigger ?? "unknown"}) [e${e.n}]`)
          break
        case "api-error":
          out.push(`${at} · turn stopped by an API error (${e.error ?? "unknown"}) [e${e.n}]`)
          break
        default:
          out.push(`${at} · ${e.ev} [e${e.n}]`)
      }
    }
    if (tally.length > 0) {
      for (const [actor, slot] of slots) {
        const mine = tally.filter((e) => who(e) === actor)
        const r = mine.filter((e) => e.ev === "look").length
        const other = countBy(
          mine.filter((e) => e.ev === "tool"),
          (e) => e.tool ?? "?"
        )
        const [from, to] = [stamp(mine[0].time), stamp(mine[mine.length - 1].time)]
        const span = from === to ? from : `${from}–${to}`
        const parts = [
          r > 0 ? `${plural(r, "read or search", "reads and searches")} (counted, not listed)` : undefined,
          other.length > 0 ? `other tools: ${listCounts(other)}` : undefined
        ]
        out[slot] = `${pad}- ${span} · ${actor} · ${parts.filter(Boolean).join("; ")} [${refs(mine, 6)}]`
      }
    }
    return out
  }

  // ---- facts shared by both files
  const shells = events.filter((e) => e.ev === "shell" && e.bg !== true)
  const ofKind = (k) => shells.filter((e) => commandKind(e.cmd ?? "") === k)
  const prompts = events.filter((e) => e.ev === "prompt" && isMain(e))
  const elsewhere = events.filter((e) => e.ev === "prompt" && !isMain(e))
  const notes = events.filter((e) => e.ev === "notification")
  const answers = events.filter((e) => e.ev === "answer")
  const sessions = [...new Set(events.map((e) => e.sid))]
  const first = events[0]
  const last = events[events.length - 1]
  const lastTime = Math.max(last?.time ?? 0, ...visible.map((c) => c.ct * 1000))
  const status = []
  if (start === undefined) {
    status.push(
      "The timer has not started: no commit has added the brief (a file under `brief/` other than its README) yet, so no minute is shown (m–)."
    )
  } else {
    status.push(
      `Timer: m0 is ${new Date(start).toISOString().slice(0, 16).replace("T", " ")} UTC, the commit \`${startCommit.hash.slice(0, 7)}\` ${quote(startCommit.subject)}, the first to add the brief.`
    )
  }
  if (events.length === 0) {
    status.push(
      "No events were recorded. The hooks in `.claude/settings.json` write `.session/events.jsonl`; if it is empty they did not run (an untrusted workspace, hooks turned off) or the session has not started."
    )
  } else {
    status.push(
      `Recorded: ${plural(events.length, "event")} from ${plural(sessions.length, "session")} (${sessions.join(", ")}), ${stamp(first.time)} to ${stamp(last.time)}.`
    )
  }
  if (events.length > 0 && sessions.length > 1) {
    // What each session added to the counts below: they cover this checkout's sessions only.
    const per = sessions.map((sid) => {
      const mine = events.filter((e) => e.sid === sid)
      const checks = mine.filter((e) => e.ev === "shell" && isVerified(commandKind(e.cmd ?? ""))).length
      const prompts = mine.filter((e) => e.ev === "prompt").length
      return `${sid} ${plural(mine.length, "event")}, ${plural(prompts, "prompt")}, ${plural(checks, "check")}`
    })
    status.push(`Per session: ${per.join("; ")}.`)
  }
  if (leftOut > 0) {
    status.push(
      `Left out: ${plural(leftOut, "event")} from ${plural(leftOutSessions, "session")} that ended before minute 0.`
    )
  }
  if (otherCheckout.length > 0) {
    status.push(
      `Left out: ${plural(otherCheckout.length, "event")} from ${plural(otherSessions, "session")} that worked in another checkout (${otherDirs.join(", ")}); none is counted here.`
    )
  }
  if (skipped > 0) status.push(`Skipped: ${plural(skipped, "unreadable line")} in the raw log.`)

  // docs/ is an Open Knowledge Format bundle (docs/index.md): each markdown file opens with frontmatter, and `generated`
  // names this script as the author. Its time is the last event's, so the same log still gives the same files.
  const writtenAt = lastTime > 0 ? `, at: ${new Date(lastTime).toISOString().replace(/\.\d{3}Z$/, "Z")}` : ""
  const frontmatter = (title, description) => [
    "---",
    "type: Session Record",
    `title: ${title}`,
    `description: ${description}`,
    `generated: { by: process:session-report${writtenAt} }`,
    "---",
    ""
  ]

  // ---- TIMELINE.md
  const timeline = [
    ...frontmatter("Session timeline", "The session as it happened, one section per prompt, written from hook events."),
    "# Session timeline",
    "",
    "## How to read this",
    "",
    `- Written by \`bun run session\` (\`scripts/session-report.mjs\`) from hook events and \`git log\`, not by ${PERSON} or the agent. The same log always gives the same file.`,
    `- One section per turn: a prompt ${PERSON} typed in the main session, quoted exactly; a prompt typed in another session; or a notice from the harness (background work finished, or a subagent's report relayed to the main agent), which is never counted as his. Below it, what happened until the next turn, oldest first.`,
    "- `m12` is minutes since minute 0, the commit that added the brief (the first to add a file under `brief/` other than its README); `pre` is before it, and a commit made before the brief does not start it.",
    "- Who acted: the main agent, or a subagent by type and short id, such as `verifier (a4c6e517)`. Lines indented under a delegation were done by that subagent.",
    "- `check`, `build` and `pack` are the repo's own commands, with PASS or FAIL and the time taken. `[e12]` is line 12 of `events.jsonl` in this folder; a commit hash is in `git log`.",
    `- An answer in a question dialog is ${PERSON}'s: each question's header, the options he chose and his own words. The question text and the options' descriptions are not recorded.`,
    "- Reads and searches are counted, not listed. Tool output, file contents and environment variables are never recorded; private markers, paths outside the project, this machine's network names, keys and emails were redacted when written. Sessions that worked in another checkout (a git worktree) are not counted here.",
    "",
    ...status,
    ""
  ]
  // With two sessions at once (a second terminal), each turn names its session.
  const sessionOf = (e) => (sessions.length > 1 ? `, session ${e.sid}` : "")
  const leadLines = renderLevel(lead.items, 0)
  if (leadLines.length > 0) timeline.push("## Before the first prompt", "", ...leadLines, "")
  let number = 0
  for (const turn of turns) {
    const o = turn.opener
    if (o.ev === "prompt") {
      if (isMain(o)) number += 1
      timeline.push(
        isMain(o)
          ? `## ${stamp(o.time)} · ${PERSON}, prompt ${number}${sessionOf(o)} [e${o.n}]`
          : `## ${stamp(o.time)} · a prompt in session ${o.sid}, not the main session (not counted) [e${o.n}]`,
        ""
      )
      const text = (o.text ?? "").trim()
      timeline.push(
        ...(text === "" ? ["> (empty)"] : text.split("\n").map((l) => (l.trim() === "" ? ">" : `> ${l}`))),
        ""
      )
    } else {
      const sub =
        o.task === undefined ? undefined : events.find((e) => e.by === "sub" && e.sid === o.sid && e.aid === o.task)
      const task = o.task === undefined ? "" : sub === undefined ? ` ${o.task}` : ` ${who(sub)}`
      timeline.push(
        `## ${stamp(o.time)} · harness: background task${task} ${o.status ?? "reported back"}${o.summary === undefined ? "" : `, ${quote(o.summary)}`} [e${o.n}]`,
        ""
      )
    }
    const lines = renderLevel(turn.items, 0)
    timeline.push(...(lines.length === 0 ? ["- Nothing was recorded after this until the next turn."] : lines), "")
  }
  if (turns.length === 0 && events.length > 0) timeline.push("No prompt was recorded.", "")

  // ---- SUMMARY.md
  const subagents = new Map()
  for (const e of events) {
    if (e.by !== "sub" || e.agent === undefined || e.agent === "") continue
    const key = `${e.sid}/${e.aid}`
    if (!subagents.has(key)) subagents.set(key, e)
  }
  const subList = [...subagents.values()]
  const skills = events.filter((e) => e.ev === "skill")
  const edits = events.filter((e) => e.ev === "edit" && e.ok !== false)
  const looks = events.filter((e) => e.ev === "look")
  const verified = shells.filter(
    (e) => isVerified(commandKind(e.cmd ?? "")) && (start === undefined || e.time >= start)
  )
  const row = (what, value, evidence) => `| ${what} | ${value} | ${evidence === "" ? "" : evidence} |`
  const runFail = (list) => {
    const unknown = list.filter(hidden).length
    const known = `${list.length} run, ${list.filter((e) => e.ok !== true).length} failed`
    return unknown === 0 ? known : `${known}, ${unknown} with the result hidden by a pipe`
  }
  const failedRefs = (list) => refs(list.filter((e) => e.ok !== true))
  const noVerify = shells.filter((e) => COMMIT.test(e.cmd ?? "") && NO_VERIFY.test(e.cmd ?? ""))
  const passingPack = [...ofKind("pack"), ...ofKind("checkpoint")]
    .sort((a, b) => a.n - b.n)
    .find((e) => e.ok === true && !hidden(e))
  const gapFrom = start ?? first?.time
  let longest = "nothing recorded"
  let longestRefs = ""
  if (gapFrom !== undefined) {
    const points = [gapFrom, ...verified.map((e) => e.time), Math.max(lastTime, gapFrom)]
    let best = { from: points[0], to: points[0] }
    for (let i = 1; i < points.length; i += 1) {
      if (points[i] - points[i - 1] > best.to - best.from) best = { from: points[i - 1], to: points[i] }
    }
    longest =
      verified.length === 0
        ? `no check, build or pack ran (${stamp(gapFrom)} to ${stamp(lastTime)})`
        : `${((best.to - best.from) / 60000).toFixed(1)} min, ${stamp(best.from)} to ${stamp(best.to)}`
    longestRefs = refs(verified.filter((e) => e.time === best.from || e.time === best.to))
  }
  const summary = [
    ...frontmatter("Session summary", "Counts from the session record, each with the event lines it counts."),
    "# Session summary",
    "",
    "## How to read this",
    "",
    `- Counts from \`bun run session\` (\`scripts/session-report.mjs\`) over \`events.jsonl\` in this folder and \`git log\`. Nothing here is typed by ${PERSON} or the agent.`,
    "- Each row names the event lines it counts (`e12` is line 12 of `events.jsonl`), so any number can be checked. `TIMELINE.md` shows the same events in order.",
    "- A check is `bun run check`, `test`, `typecheck`, `lint` or the tools they run (with npm too); a build is `bun run build`; a pack is `bun run pack` with its clean-copy checks.",
    "",
    ...status,
    "",
    "| Measure | Value | Evidence |",
    "| --- | --- | --- |",
    row(
      `Prompts from ${PERSON}${mainSid === undefined || sessions.length < 2 ? "" : ` (main session ${mainSid})`}`,
      String(prompts.length),
      refs(prompts)
    ),
    ...(elsewhere.length === 0
      ? []
      : [row("Prompts in other sessions (not counted as his)", String(elsewhere.length), refs(elsewhere))]),
    row(`Question dialogs ${PERSON} answered`, String(answers.length), refs(answers)),
    row(
      "Turns opened by the harness (background work or a subagent reporting back; not his)",
      String(notes.length),
      refs(notes)
    ),
    row(
      "Delegations",
      `${delegations.length} (${delegations.filter((d) => d.bg === true).length} in the background)`,
      refs(delegations)
    ),
    row("Subagents, by type", listCounts(countBy(subList, (e) => e.agent)), refs(subList)),
    row("Skills, by name", listCounts(countBy(skills, (e) => e.name ?? "?")), refs(skills)),
    row(
      "Checks",
      runFail(ofKind("check")),
      failedRefs(ofKind("check")) === "" ? refs(ofKind("check")) : `failed: ${failedRefs(ofKind("check"))}`
    ),
    row("Builds", runFail(ofKind("build")), refs(ofKind("build"))),
    row("Packs", runFail(ofKind("pack")), refs(ofKind("pack"))),
    ...(checkpointRules === undefined
      ? []
      : [row("Checkpoints (`bun run checkpoint`)", runFail(ofKind("checkpoint")), refs(ofKind("checkpoint")))]),
    row(
      "First passing pack",
      passingPack === undefined ? "none yet" : stamp(passingPack.time),
      passingPack === undefined ? "" : `e${passingPack.n}`
    ),
    row("Longest stretch without a check, build or pack", longest, longestRefs),
    row("Commits after minute 0", String(afterStart.length), "`git log`"),
    row("Commits with `--no-verify` (each one is named in the write-up)", String(noVerify.length), refs(noVerify)),
    row(
      "Files edited",
      `${plural(new Set(edits.map((e) => e.path)).size, "file")}, ${plural(edits.length, "edit")}`,
      refs(edits)
    ),
    row(
      "Reads and searches (counted, not listed)",
      listCounts(countBy(looks, (e) => (e.by === "sub" ? "subagents" : "main agent"))),
      ""
    ),
    row(
      "Context compactions",
      String(events.filter((e) => e.ev === "compact").length),
      refs(events.filter((e) => e.ev === "compact"))
    ),
    row(
      "Turns stopped by an API error",
      String(events.filter((e) => e.ev === "api-error").length),
      refs(events.filter((e) => e.ev === "api-error"))
    ),
    row(
      "Sessions",
      sessions.length === 0 ? "0" : `${sessions.length}: ${sessions.join(", ")}`,
      refs(events.filter((e) => e.ev === "session-start"))
    ),
    ""
  ]
  // Checkpoints, from the checkpoint command's own log (.session/checkpoints.jsonl): the version, when, the commit,
  // the zip and what became of its upload. The page's own words stay in that local log; here only the outcome.
  const made = checkpoints.filter((c) => c.ev === "checkpoint" && typeof c.version === "string")
  const uploadWords = checkpointRules?.uploadWords
  if (made.length > 0 && uploadWords !== undefined) {
    const outcome = (version) => {
      const last = [...checkpoints].reverse().find((c) => c.ev === "upload" && c.version === version)
      return uploadWords(last === undefined ? "unrecorded" : last.result)
    }
    const modes = checkpoints.filter((c) => c.ev === "uploads")
    summary.push(
      "## Checkpoints",
      "",
      "From `.session/checkpoints.jsonl`, written by `bun run checkpoint`. The version being made when this file was written is not in it yet.",
      "",
      "| Version | Minute | Commit | Zip | Seconds | Upload |",
      "| --- | --- | --- | --- | --- | --- |",
      ...made.map(
        (c) =>
          `| v${c.version} | ${c.min ?? "?"} | \`${c.commit ?? "?"}\` | ${c.zip ?? "?"} (${typeof c.bytes === "number" ? `${(c.bytes / 1000 / 1000).toFixed(1)} MB` : "?"}) | ${c.secs ?? "?"} | ${outcome(c.version)} |`
      ),
      "",
      ...(modes.length === 0
        ? ["Upload mode: never set, so nothing was uploaded by an agent.", ""]
        : [
            `Upload mode changes: ${modes.map((m) => `${m.mode}${typeof m.min === "number" ? ` (m${m.min})` : ""}`).join(", ")}.`,
            ""
          ])
    )
  }

  const jsonl = events.map((e) => {
    const out = {}
    for (const key of FIELDS) if (e[key] !== undefined) out[key] = e[key]
    return JSON.stringify(out)
  })
  return {
    timeline: `${timeline.join("\n").trimEnd()}\n`,
    summary: `${summary.join("\n").trimEnd()}\n`,
    events: jsonl.length === 0 ? "" : `${jsonl.join("\n")}\n`,
    counts: {
      events: events.length,
      prompts: prompts.length,
      subagents: subList.length,
      checks: ofKind("check").length
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The private-marker check

// The words for an event's kind, by its `ev` and who acted: what a hit in the session record came from.
const EVENT_WORDS = {
  prompt: "a prompt Benjamin typed",
  answer: "Benjamin's answer in a question dialog",
  shell: "a command",
  delegate: "a brief to a subagent",
  "delegate-end": "a subagent's result",
  edit: "an edited file's path",
  skill: "a skill's name",
  notification: "a message the harness relayed",
  tool: "a tool's name",
  "api-error": "an API error",
  "session-start": "a session start",
  "session-end": "a session end"
}

/** The kind of a raw or rendered event line, in words; "a session record line" when it cannot be told. */
export function eventKind(line) {
  let event
  try {
    event = JSON.parse(line)
  } catch {
    return "a session record line"
  }
  if (event === null || typeof event !== "object" || typeof event.ev !== "string") return "a session record line"
  const words = EVENT_WORDS[event.ev] ?? `a "${event.ev}" event`
  const agent = typeof event.agent === "string" && event.agent !== "" ? `the ${event.agent}` : "a"
  return event.by === "sub" ? `${words}, by ${agent} subagent` : words
}

/**
 * The kind of each line of a rendered session file: a line of TIMELINE.md or SUMMARY.md cites its events as `[e12]`
 * (line 12 of events.jsonl); a line without one belongs to the nearest cited event above it (a prompt's text under
 * its heading). `events` is docs/session/events.jsonl as text.
 */
export function renderedKinds(text, events) {
  const eventLines = events.split("\n")
  let current = "a session record line"
  return text.split("\n").map((line) => {
    const cited = /\[e(\d+)\]/.exec(line)
    if (cited !== null) current = eventKind(eventLines[Number(cited[1]) - 1] ?? "")
    return current
  })
}

/**
 * Finds markers in sources (`{ where, text, lines?, kind?, kinds? }`; `lines[i]` is the real line number of the i-th
 * line, `kinds[i]` what that line is, `kind` what the whole source is). Returns `{ where, line, kind }` per hit: never
 * the marker.
 */
export function findMarkers({ markers, sources }) {
  const hits = []
  if (markers.length === 0) return hits
  for (const source of sources) {
    const lines = source.text.split("\n")
    for (let i = 0; i < lines.length; i += 1) {
      const lower = lines[i].toLowerCase()
      if (markers.some((m) => lower.includes(m)))
        hits.push({
          where: source.where,
          line: source.lines?.[i] ?? i + 1,
          kind: source.kinds?.[i] ?? source.kind ?? "a line of a tracked file"
        })
    }
  }
  return hits
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 })
}

function guardSources(root) {
  const sources = []
  const paths = new Set(git(root, ["ls-files", "-z"]).split("\0").filter(Boolean))
  const session = join(root, "docs", "session")
  if (existsSync(session)) for (const name of readdirSync(session)) paths.add(`docs/session/${name}`)
  const eventsFile = join(session, "events.jsonl")
  const events = existsSync(eventsFile) ? readFileSync(eventsFile, "utf8") : ""
  for (const path of [...paths].sort()) {
    const file = join(root, path)
    let buffer
    try {
      buffer = readFileSync(file)
    } catch {
      continue
    }
    if (buffer.subarray(0, 8000).includes(0)) continue
    const text = buffer.toString("utf8")
    // In the session record, each line says which kind of event it came from.
    const kinds =
      path === "docs/session/events.jsonl"
        ? text.split("\n").map(eventKind)
        : path.startsWith("docs/session/") && path.endsWith(".md")
          ? renderedKinds(text, events)
          : undefined
    sources.push({ where: path, text, ...(kinds === undefined ? {} : { kinds }) })
  }
  for (const entry of git(root, ["log", "--all", "--format=%h%x00%B%x1e"]).split("\x1e")) {
    const [hash, body] = entry.replace(/^\n/, "").split("\0")
    if (hash !== undefined && body !== undefined)
      sources.push({ where: `commit ${hash} message`, text: body, kind: "a commit message" })
  }
  // Every line ever added, so a marker removed later is still found: it would be in the zip's .git.
  let commit = ""
  let path = ""
  let line = 0
  let added = { text: [], lines: [] }
  const flush = () => {
    if (added.text.length > 0)
      sources.push({
        where: `history ${commit} ${path}`,
        text: added.text.join("\n"),
        lines: added.lines,
        kind: `a line committed in ${commit}`
      })
    added = { text: [], lines: [] }
  }
  for (const row of git(root, ["log", "--all", "-p", "--no-color", "--no-ext-diff", "--format=%x00%h"]).split("\n")) {
    if (row.startsWith("\0")) {
      flush()
      commit = row.slice(1)
    } else if (row.startsWith("+++ ")) {
      flush()
      path = row.slice(4).replace(/^b\//, "")
    } else if (row.startsWith("@@")) {
      line = Number(/\+(\d+)/.exec(row)?.[1] ?? 0)
    } else if (row.startsWith("+")) {
      added.text.push(row.slice(1))
      added.lines.push(line)
      line += 1
    } else if (row.startsWith(" ")) {
      line += 1
    }
  }
  flush()
  return sources
}

/**
 * What to do about the hits, after their places. A hit under brief/ is the brief as received: it is never edited and
 * the commit that started the clock is never rewritten to remove it, so that one goes to Benjamin. Any other hit is
 * removed where it is.
 * @example markerAdvice([{ where: "history 11c2da6 brief/BRIEF.md", line: 53 }]) // one line: stop and ask Benjamin
 */
export function markerAdvice(hits) {
  const inBrief = (hit) => hit.where.replace(/^history \S+ /, "").startsWith("brief/")
  const advice = []
  if (hits.some(inBrief))
    advice.push(
      "A hit under brief/ is in the brief as received: never edit brief/ or rewrite the commit that started the clock to remove it. Stop and ask Benjamin."
    )
  const inSession = (hit) => hit.where.startsWith("docs/session/")
  if (hits.some(inSession))
    advice.push(
      "A hit in docs/session/: run bun run session again with TAKEHOME_PRIVATE_MARKERS set; it writes each marker as [private]. Never edit .session/ or docs/session/ by hand."
    )
  if (hits.some((hit) => !inBrief(hit) && !inSession(hit)))
    advice.push(
      "Any other hit: remove the text there in a new commit. One in a commit message or in history stays in .git: stop and ask Benjamin."
    )
  return advice
}

/** Runs the private-marker check for the repo at `root`. Returns the exit code; prints no marker text. */
export function guard(root, file) {
  if (file === undefined || file === "") return 0
  if (!isAbsolute(file)) {
    console.error("Private-marker check: TAKEHOME_PRIVATE_MARKERS must be an absolute path.")
    return 1
  }
  if (!existsSync(file)) {
    console.error("Private-marker check: the file TAKEHOME_PRIVATE_MARKERS names does not exist.")
    return 1
  }
  const markers = parseMarkers(readFileSync(file, "utf8"))
  // TAKEHOME_MARKER_EXEMPT_PATHS: colon-separated path prefixes that are not scanned. For vendored third-party data
  // (a skill's library of names and words), where a hit says nothing about this project.
  const exempt = (process.env.TAKEHOME_MARKER_EXEMPT_PATHS ?? "").split(":").filter((prefix) => prefix !== "")
  const scanned = guardSources(root).filter((source) => {
    const path = source.where.replace(/^history \S+ /, "")
    return !exempt.some((prefix) => path.startsWith(prefix))
  })
  const hits = findMarkers({ markers, sources: scanned })
  if (hits.length === 0) {
    console.log(`Private-marker check: no hits (${markers.length} markers).`)
    return 0
  }
  console.error(`Private-marker check: ${hits.length} hit(s). Each is a place and what it is, never the text:`)
  for (const hit of hits) console.error(`  ${hit.where}:${hit.line} (${hit.kind})`)
  for (const line of markerAdvice(hits)) console.error(line)
  return 1
}

// ---------------------------------------------------------------------------------------------------------------
// Command line

function readCommits(root) {
  try {
    const started = readClockStart(root, 10_000)
    return git(root, ["log", "--reverse", "--format=%H%x1f%ct%x1f%s"])
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [hash, ct, subject] = line.split("\x1f")
        const commit = { hash, ct: Number(ct), subject: redact(subject ?? "") }
        return hash === started?.hash ? { ...commit, start: true } : commit
      })
  } catch {
    return []
  }
}

function main() {
  const markerFile = process.env.TAKEHOME_PRIVATE_MARKERS
  if (process.argv.includes("--guard")) process.exit(guard(ROOT, markerFile))
  const log = join(ROOT, ".session", "events.jsonl")
  const { events, skipped } = parseLog(existsSync(log) ? readFileSync(log, "utf8") : "")
  const state = join(ROOT, ".session", "checkpoints.jsonl")
  const checkpoints =
    checkpointRules === undefined || !existsSync(state)
      ? []
      : checkpointRules.readCheckpointLog(redact(readFileSync(state, "utf8")))
  const record = buildRecord({ events, commits: readCommits(ROOT), skipped, checkpoints })
  const out = join(ROOT, "docs", "session")
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, "TIMELINE.md"), record.timeline)
  writeFileSync(join(out, "SUMMARY.md"), record.summary)
  writeFileSync(join(out, "events.jsonl"), record.events)
  const c = record.counts
  console.log(
    `docs/session/: ${c.events} events, ${c.prompts} prompts, ${c.subagents} subagents, ${c.checks} checks. Commit the folder with the work.`
  )
  process.exit(guard(ROOT, markerFile))
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
