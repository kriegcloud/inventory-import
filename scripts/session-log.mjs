// Session record, part 1: the Claude Code hook handler wired in `.claude/settings.json`.
// It reads one hook payload from stdin and appends one short JSON line to `.session/events.jsonl` (git-ignored):
// who acted (Benjamin, the main agent, or a subagent by type and id), what was asked, what was delegated to whom,
// which skills ran, which commands ran and whether they passed, which files were edited.
// It never records tool output, file contents or environment variables, with one exception: Benjamin's answers in a
// question dialog (AskUserQuestion), kept as each question's header, the option labels he chose and the words he
// typed, never the question text or the options' descriptions. It redacts as it writes: a private marker (one of the
// strings in the file TAKEHOME_PRIVATE_MARKERS names) becomes [private], a path outside the project becomes
// [outside the project], this machine's network names become [host], key-shaped strings become [redacted], email
// addresses become [email]. So the raw log never needs an edit by hand, and nobody makes one.
// It must never get in the way of the session: it prints nothing, swallows every error and always exits 0.
// `bun run session` (scripts/session-report.mjs) turns the log into docs/session/.
import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs"
import { homedir, hostname, userInfo } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

const LIMITS = { prompt: 8000, command: 200, brief: 300, description: 120, answer: 2000 }

// The key shapes `scripts/pack.sh` refuses, plus common token shapes. A match becomes [redacted].
const KEY_SHAPES = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /sk-or-[A-Za-z0-9_-]{16,}/g,
  /sk-ant-[A-Za-z0-9_-]{16,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}/g,
  /\bvck_[A-Za-z0-9_-]{16,}/g,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
  /\bop:\/\/[^\s'"`]+/g
]
// `API_KEY=...`, `"token": "..."`, `Authorization: Bearer ...`: the name stays, the value goes.
const NAMED_SECRET =
  /\b([A-Za-z0-9_]*(?:api[_-]?key|token|secret|passw(?:or)?d|authorization)[A-Za-z0-9_]*["']?\s*[:=]\s*["']?)(?:bearer\s+)?([^\s"'`&]{8,})/gi
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

// The first folder of an absolute path on a disk (Linux, macOS, WSL). A path that starts with anything else, such as
// an API route ("/api/items") or a slash command ("/qa"), is not a file path and stays.
const DISK_PATH = String.raw`(?<![\w.~:/-])(?:~|/(?:home|Users|root|tmp|private|var|opt|mnt|media|srv|run|etc|usr|nix|Volumes|workspaces?|data|proc|sys|snap)(?![\w.-]))(?:/(?:[^\s'"\`<>|;&()]*[^\s'"\`<>|;&().,:!?])?)?`
// Names this machine has on a network: a tailnet (MagicDNS) name and a private or tailnet address.
const TAILNET_NAME = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.ts\.net\b\.?/gi
const PRIVATE_ADDRESS =
  /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01])|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7]))\.\d{1,3}\.\d{1,3}\b/g

/** What a private marker becomes in the record. */
export const PRIVATE = "[private]"

/** One marker per line, compared ignoring case; blank lines and lines starting with # are skipped. */
export function parseMarkers(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.toLowerCase())
}

let envMarkers
/** The markers in the file TAKEHOME_PRIVATE_MARKERS names (an absolute path), read once; none when it is unset. */
export function markersFromEnv(env = process.env) {
  if (env === process.env && envMarkers !== undefined) return envMarkers
  const file = env.TAKEHOME_PRIVATE_MARKERS
  const markers =
    typeof file === "string" && file !== "" && isAbsolute(file) && existsSync(file)
      ? safe(() => parseMarkers(readFileSync(file, "utf8")), [])
      : []
  if (env === process.env) envMarkers = markers
  return markers
}

/**
 * Replaces every private marker in `text` with `[private]`, ignoring case, longest first, so a marker inside a longer
 * one leaves nothing behind. The marker itself is never returned or printed.
 * @example hideMarkers("Call Acme Rocket today", ["acme rocket"]) // "Call [private] today"
 */
export function hideMarkers(text, markers) {
  if (typeof text !== "string" || text === "" || markers.length === 0) return text
  let out = text
  for (const marker of [...markers].sort((a, b) => b.length - a.length))
    if (marker !== "") out = out.replace(new RegExp(escape(marker), "gi"), PRIVATE)
  return out
}

/**
 * Redacts one string for the record: a private marker becomes `[private]`, a path inside the project becomes
 * relative, any other path on a disk becomes `[outside the project]`, this machine's host names `[host]`, the user
 * name `[user]`, key-shaped strings `[redacted]`, email addresses `[email]`. `where` defaults to this machine and to
 * the markers TAKEHOME_PRIVATE_MARKERS names.
 */
export function redact(text, where = {}) {
  if (typeof text !== "string" || text === "") return text
  const root = where.root ?? ROOT
  const home = where.home ?? safe(() => homedir(), "")
  const user = where.user ?? safe(() => userInfo().username, "")
  const hosts = (where.hosts ?? safe(() => hostNames(hostname()), [])).filter(
    (name) => name.length >= 4 && name.toLowerCase() !== "localhost"
  )
  // Network names before the markers: a marker that is part of a tailnet name ("ts.net") would otherwise cut the
  // name in two and leave its machine label in the record. Then the markers, before any other replacement could
  // split one; a marker that itself holds a network name is also looked for as it reads once that name is hidden.
  const network = (value) => value.replace(TAILNET_NAME, "[host]").replace(PRIVATE_ADDRESS, "[address]")
  const markers = where.markers ?? markersFromEnv()
  let out = hideMarkers(network(text), [...markers, ...markers.map(network)])
  for (const shape of KEY_SHAPES) out = out.replace(shape, "[redacted]")
  out = out.replace(NAMED_SECRET, "$1[redacted]").replace(BEARER, "Bearer [redacted]")
  out = out.replace(EMAIL, "[email]")
  out = out.replace(TAILNET_NAME, "[host]").replace(PRIVATE_ADDRESS, "[address]")
  for (const name of hosts) out = out.replace(new RegExp(`\\b${escape(name)}\\b`, "gi"), "[host]")
  // A path inside the project becomes relative; the project itself is ".". Temporary folders are named after the
  // path with "/" turned into "-", so that spelling is replaced too.
  if (root.length > 1) {
    out = out.replace(pathPattern(root), (_, slash) => (slash === "/" ? "" : "."))
    out = out.replace(pathPattern(root.replace(/\//g, "-")), "-project$1")
  }
  if (home.length > 1) out = out.replace(pathPattern(home), "~$1")
  // Whatever path is left points outside the project: where it is says nothing the record needs.
  out = out.replace(new RegExp(DISK_PATH, "g"), (path) => (path === "~" ? path : "[outside the project]"))
  if (home.length > 1) out = out.replace(pathPattern(home.replace(/\//g, "-")), "-~$1")
  if (user.length >= 4) out = out.replace(new RegExp(`\\b${escape(user)}\\b`, "g"), "[user]")
  return out
}

/** The host name and its first label ("box.example.lan" gives both "box.example.lan" and "box"). */
export const hostNames = (name) => (name.includes(".") ? [name, name.split(".")[0]] : [name])

// The path itself, followed by "/" or by anything that cannot continue a file name (a full stop ending a sentence
// does not continue it; ".bak" does).
const pathPattern = (path) => new RegExp(`${escape(path)}(/|(?![\\w-]|\\.[\\w-]))`, "g")

const cap = (text, max) => (text.length > max ? `${text.slice(0, max)}… [+${text.length - max} chars]` : text)
const clean = (value, max, where) => (typeof value === "string" ? cap(redact(value, where), max) : undefined)
const short = (id) => (typeof id === "string" && id !== "" ? id.slice(0, 8) : undefined)
// Tool call ids share a long prefix ("toolu_01"), so their tail tells them apart.
const callId = (id) => (typeof id === "string" && id !== "" ? id.slice(-10) : undefined)
const ms = (value) => (typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined)

function safe(f, fallback) {
  try {
    return f()
  } catch {
    return fallback
  }
}

// Drops undefined fields so each line stays short.
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

const READS = new Set(["Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch", "NotebookRead"])
const EDITS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"])
const DELEGATION = new Set(["Agent", "Task"])
// Text the harness injects as a "prompt": background work finishing, a subagent's report relayed to the main agent,
// a reminder. It is not Benjamin's, and it is never counted as his prompt.
const HARNESS_PROMPT =
  /^\s*<(task-notification|system-reminder|agent-message|teammate-message|cross-session-message|local-command-[a-z]+|command-[a-z]+|bash-[a-z]+)\b/

/** True for a "prompt" the harness wrote, not the person. */
export const isRelayed = (text) => typeof text === "string" && HARNESS_PROMPT.test(text)

/**
 * The agent or session a relayed message comes from: `<agent-message from="a2fe...">` gives its id, and so does
 * `<cross-session-message from="local_...">`, a message from another session (a lead and its builder write to each
 * other this way), which is never the person's prompt.
 */
const relayedFrom = (text) => /^\s*<(?:agent|cross-session)-message\s+from="([^"]+)"/.exec(text)?.[1]

function actor(p) {
  if (typeof p.agent_id === "string" && p.agent_id !== "") {
    return { by: "sub", agent: typeof p.agent_type === "string" ? p.agent_type : "", aid: short(p.agent_id) }
  }
  return { by: "main" }
}

/**
 * Benjamin's answers in a question dialog: for each question he answered, its header, the option labels he chose and
 * the words he typed under "Other". The question text and the options' descriptions are never kept. `undefined` when
 * the dialog holds no answer (dismissed, or a payload of another shape).
 */
export function dialogAnswers(input, response, where) {
  const questions = Array.isArray(response.questions)
    ? response.questions
    : Array.isArray(input.questions)
      ? input.questions
      : []
  const answers =
    response.answers !== null && typeof response.answers === "object"
      ? response.answers
      : input.answers !== null && typeof input.answers === "object"
        ? input.answers
        : undefined
  if (answers === undefined) return undefined
  const out = []
  for (const q of questions) {
    if (q === null || typeof q !== "object" || typeof q.question !== "string") continue
    if (!Object.prototype.hasOwnProperty.call(answers, q.question)) continue
    const raw = answers[q.question]
    const labels = Array.isArray(q.options)
      ? q.options.flatMap((o) => (o !== null && typeof o === "object" && typeof o.label === "string" ? [o.label] : []))
      : []
    const given = (Array.isArray(raw) ? raw : [raw]).filter((value) => typeof value === "string" && value !== "")
    const pick = []
    const words = []
    for (const value of given) {
      const parts = value.split(", ")
      if (labels.includes(value)) pick.push(value)
      else if (parts.length > 1 && parts.every((part) => labels.includes(part))) pick.push(...parts)
      else words.push(value)
    }
    out.push(
      compact({
        h: clean(typeof q.header === "string" ? q.header : "", 40, where),
        pick: pick.length === 0 ? undefined : pick.map((label) => clean(label, LIMITS.description, where)),
        words: words.length === 0 ? undefined : clean(words.join(" / "), LIMITS.answer, where)
      })
    )
  }
  return out.length === 0 ? undefined : out
}

function tag(text, name) {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(text)
  return m === null ? undefined : m[1].trim()
}

/**
 * Turns one hook payload into the line the record keeps, or `null` for nothing. Pure: `context` carries the time,
 * the minute of the hour and where to redact.
 */
export function summarize(p, context = {}) {
  if (p === null || typeof p !== "object") return null
  const where = context.where ?? {}
  const base = {
    t: new Date(context.now ?? Date.now()).toISOString(),
    min: context.minute ?? null,
    sid: short(p.session_id),
    p: short(p.prompt_id),
    // The checkout the session works in, relative to this project: "." here, ".claude/worktrees/x" for a worktree.
    dir: typeof context.dir === "string" && context.dir !== "" ? context.dir : undefined
  }
  const input = p.tool_input && typeof p.tool_input === "object" ? p.tool_input : {}
  const response = p.tool_response && typeof p.tool_response === "object" ? p.tool_response : {}
  const tool = typeof p.tool_name === "string" ? p.tool_name : ""
  const event = p.hook_event_name
  const line = (fields) => compact({ ...base, ...actor(p), ...fields })

  switch (event) {
    case "SessionStart":
      return line({ ev: "session-start", source: p.source, model: p.model })
    case "UserPromptSubmit": {
      const text = typeof p.prompt === "string" ? p.prompt : ""
      if (isRelayed(text)) {
        return line({
          by: "harness",
          ev: "notification",
          task: short(tag(text, "task-id") ?? relayedFrom(text)),
          status: clean(tag(text, "status"), 40, where),
          summary: clean(tag(text, "summary"), LIMITS.description, where)
        })
      }
      return line({ by: "person", ev: "prompt", text: clean(text, LIMITS.prompt, where) })
    }
    case "UserPromptExpansion":
      return line({ by: "person", ev: "skill", name: clean(p.command_name, 80, where), via: "slash" })
    case "PreToolUse":
      if (DELEGATION.has(tool)) {
        return line({
          ev: "delegate",
          to: typeof input.subagent_type === "string" ? input.subagent_type : "general-purpose",
          desc: clean(input.description, LIMITS.description, where),
          brief: clean(input.prompt, LIMITS.brief, where),
          bg: input.run_in_background === true ? true : undefined,
          model: clean(input.model, 40, where),
          tu: callId(p.tool_use_id)
        })
      }
      if (tool === "Skill") return line({ ev: "skill", name: clean(input.skill, 80, where), via: "tool" })
      return null
    case "PostToolUse":
    case "PostToolUseFailure": {
      const ok = event === "PostToolUse"
      if (tool === "Bash") {
        const error = typeof p.error === "string" ? p.error : ""
        const code = /^Exit code (\d+)/.exec(error)
        return line({
          ev: "shell",
          cmd: clean(input.command, LIMITS.command, where),
          ok,
          exit: ok ? 0 : code === null ? undefined : Number(code[1]),
          interrupted: p.is_interrupt === true || response.interrupted === true ? true : undefined,
          bg: input.run_in_background === true ? true : undefined,
          ms: ms(p.duration_ms)
        })
      }
      if (EDITS.has(tool)) {
        return line({ ev: "edit", tool, path: clean(input.file_path ?? input.notebook_path, 200, where), ok })
      }
      if (DELEGATION.has(tool)) {
        return line({
          ev: "delegate-end",
          tu: callId(p.tool_use_id),
          ok,
          aid: short(response.agentId),
          status: clean(response.status, 40, where),
          model: clean(response.resolvedModel, 60, where),
          ms: ms(response.totalDurationMs),
          tools: ms(response.totalToolUseCount),
          tokens: ms(response.totalTokens)
        })
      }
      if (tool === "Skill") return null
      if (tool === "AskUserQuestion") {
        const qs = ok ? dialogAnswers(input, response, where) : undefined
        return qs === undefined ? line({ ev: "tool", tool, ok }) : line({ by: "person", ev: "answer", qs })
      }
      if (READS.has(tool)) return line({ ev: "look", tool })
      return line({ ev: "tool", tool: clean(tool, 80, where), ok })
    }
    case "SubagentStart":
      return line({ ev: "subagent-start" })
    case "SubagentStop":
      return line({ ev: "subagent-stop" })
    case "Stop": {
      const running = Array.isArray(p.background_tasks)
        ? p.background_tasks.filter((task) => task && task.status === "running").length
        : 0
      return line({ ev: "turn-end", running: running > 0 ? running : undefined })
    }
    case "StopFailure":
      return line({ ev: "api-error", error: clean(p.error, 60, where) })
    case "PreCompact":
      return line({ ev: "compact", trigger: clean(p.trigger, 20, where) })
    case "SessionEnd":
      return line({ ev: "session-end", reason: clean(p.reason, 40, where) })
    default:
      return typeof event === "string" ? line({ ev: "other", hook: clean(event, 40, where) }) : null
  }
}

// ---------------------------------------------------------------------------------------------------------------
// When the hour starts. The one rule: scripts/clock.mjs, scripts/checkpoint.mjs (and through the clock the pack's zip
// name) and scripts/session-report.mjs all read it from here.

/** A file the brief brings: anything under brief/ except that folder's own README, which the template already has. */
export const isBriefFile = (path) => path.startsWith("brief/") && path !== "brief/README.md"

/**
 * The commit the hour starts at: the first one, oldest first, that adds a brief file. A commit before it (the
 * template, files brought in before the brief arrived) does not start the clock.
 */
export const clockStartOf = (commits) => commits.find((commit) => commit.added.some(isBriefFile))

/**
 * The same, read from git: `{ hash, ct, subject }` (`ct` in seconds), or undefined while no commit has added the
 * brief. A file moved into brief/ counts as added (`--no-renames`).
 */
export function readClockStart(root = ROOT, timeout = 2000) {
  const out = execFileSync(
    "git",
    [
      "-c",
      "core.quotePath=false",
      "-C",
      root,
      "log",
      "--reverse",
      "--no-renames",
      "--diff-filter=A",
      "--name-only",
      "--format=%x1e%H%x1f%ct%x1f%s",
      "--",
      "brief"
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout }
  )
  const commits = out
    .split("\x1e")
    .filter((block) => block.trim() !== "")
    .map((block) => {
      const [head = "", ...paths] = block.split("\n")
      const [hash = "", ct = "", subject = ""] = head.split("\x1f")
      // A name git still quotes (a tab or a quote mark in it) starts with `"`.
      const added = paths.filter((path) => path !== "").map((path) => (path.startsWith('"') ? path.slice(1) : path))
      return { hash, ct: Number(ct), subject, added }
    })
  const start = clockStartOf(commits)
  return start === undefined ? undefined : { hash: start.hash, ct: start.ct, subject: start.subject }
}

// Minutes since the commit that added the brief in `root`, or null before it.
function minuteOfHour(now, root = ROOT) {
  const start = readClockStart(root, 2000)
  return start === undefined ? null : Math.floor((now / 1000 - start.ct) / 60)
}

/**
 * Where an event belongs, from the folder its session works in (`cwd` in the hook payload) and the checkout this
 * script is in. The hooks run this project's script even for a session working in a git worktree of it (a side
 * session under .claude/worktrees/), so the session's own checkout decides: this project (any folder inside it, and
 * a frozen copy under .frozen/, which the qa and reviewer agents of this session use) writes here; another checkout
 * writes into its own .session/, never this one; a folder in no checkout writes nothing. `toplevel` is that
 * checkout's root as git names it, or undefined. Returns `{ root, dir }` (`dir` relative to this project, "." here)
 * or undefined. Pure.
 * @example recordPlace({ project: "/w/app", toplevel: "/w/app/.claude/worktrees/docs" }) // { root: "/w/app/.claude/worktrees/docs", dir: ".claude/worktrees/docs" }
 */
export function recordPlace({ project, toplevel }) {
  if (toplevel === undefined || toplevel === "") return undefined
  const inside = (path, folder) => path === folder || path.startsWith(`${folder}/`)
  if (toplevel === project || inside(toplevel, `${project}/.frozen`)) return { root: project, dir: "." }
  return {
    root: toplevel,
    dir: inside(toplevel, project) ? toplevel.slice(project.length + 1) : "[outside the project]"
  }
}

/** The git checkout that holds `cwd`, as a real path, or undefined. */
function checkoutOf(cwd) {
  if (typeof cwd !== "string" || cwd === "") return safe(() => realpathSync(ROOT), ROOT)
  return safe(
    () =>
      realpathSync(
        execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
          timeout: 800
        }).trim()
      ),
    undefined
  )
}

function main() {
  // Whatever happens, the session carries on: no output, exit 0, and never more than a second and a half.
  process.on("uncaughtException", () => process.exit(0))
  setTimeout(() => process.exit(0), 1500)
  let raw = ""
  process.stdin.setEncoding("utf8")
  process.stdin.on("data", (chunk) => (raw += chunk))
  process.stdin.on("end", () => {
    try {
      const now = Date.now()
      const payload = JSON.parse(raw)
      const project = safe(() => realpathSync(ROOT), ROOT)
      const place = recordPlace({ project, toplevel: checkoutOf(payload?.cwd) })
      if (place === undefined) return process.exit(0)
      const entry = summarize(payload, {
        now,
        minute: safe(() => minuteOfHour(now, place.root), null),
        dir: place.dir
      })
      if (entry !== null) {
        mkdirSync(join(place.root, ".session"), { recursive: true })
        appendFileSync(join(place.root, ".session", "events.jsonl"), `${JSON.stringify(entry)}\n`)
      }
    } catch {
      // A record with a missing line is better than a session that stops.
    }
    process.exit(0)
  })
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
