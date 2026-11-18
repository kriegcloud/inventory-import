// Checkpoints, part 3: the frozen copy. After a checkpoint, the tagged version runs as its own app beside the work in
// progress, so the qa and reviewer agents can test that version while building goes on.
//   node scripts/checkpoint-copy.mjs start 0.3.0    bun run checkpoint starts this in the background once it has tagged
//   node scripts/checkpoint-copy.mjs stop [0.3.0]   one copy, or all (bun run checkpoint -- --stop, and --final)
//   node scripts/checkpoint-copy.mjs status         the newest copy that is running, and the one before it
//   node scripts/checkpoint-copy.mjs use 0.3.0 qa [pid]   marks a copy in use for a pass (bun run checkpoint -- --use)
//   node scripts/checkpoint-copy.mjs done 0.3.0 qa        clears that mark (bun run checkpoint -- --done)
//   node scripts/checkpoint-copy.mjs in-use               every mark, live or stale
// A copy marked in use is never stopped by the next checkpoint, and --final and --stop refuse while a live mark stands
// (scripts/checkpoint-rules.mjs `inUseStatus`). Marks live in .frozen/in-use/, one small JSON file each.
// The copy is a git worktree of the tag in .frozen/v<version>. That folder is git-ignored, so no check, lint, test or
// zip sees it (the zip is cloned from branches and tags only). It gets what it needs to run, and nothing is read on the
// way: node_modules is linked from the project, never installed again; the key file is copied byte for byte with
// `cp`, never opened; the project's own migrate script gives it a fresh local database of its own (with the test
// accounts, where sign-in is installed). It serves its production build with `vite preview` on its own port, and falls
// back to the dev server when the production build does not answer (a secret that production requires may be unset).
// Two copies at most: once a new one answers, the copy before it keeps running, so a qa or reviewer pass still on it
// can finish, and any older copy is stopped. Testing never waits on a gap, and a pass is not cut short by the next
// checkpoint, only by the one after it.
// Files in .frozen/: v<version>/ the worktree, v<version>.pid the server's process id, v<version>.log the output of
// the migrate, build and server, v<version>.json once it answers, v<version>.failed if it did not start, and
// v<version>.vite.config.mjs for the dev server when it is the one running.
import { execFileSync, spawn } from "node:child_process"
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs"
import { createServer } from "node:net"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { inUseLines, inUseStatus } from "./checkpoint-rules.mjs"

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const FROZEN = join(ROOT, ".frozen")
const IN_USE = join(FROZEN, "in-use")
// The first port tried; the main dev server is on 5173, a second one usually on 5174. CHECKPOINT_COPY_PORT moves it:
// the slow test's copies use another range, so they never race a real checkpoint's copy for a free port.
const FIRST_PORT = Number(process.env.CHECKPOINT_COPY_PORT ?? "") || 5273
// node_modules entries that hold one project's caches and build state. The copy makes its own.
const NOT_LINKED = new Set([".vite", ".vite-temp", ".vitest-cache", ".tmp", ".cache", ".mf"])
// The key files the copy needs to run as the project does. Copied with cp, never opened here.
const KEY_FILES = [".dev.vars", ".env"]
const VERSION = /^\d+\.\d+\.\d+$/

const at = (version, ext = "") => join(FROZEN, `v${version}${ext}`)
const git = (...args) =>
  execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
const tryGit = (...args) => {
  try {
    return git(...args)
  } catch {
    return undefined
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const seconds = (since) => Number(((Date.now() - since) / 1000).toFixed(1))
const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return undefined
  }
}

/** Orders two versions by their numbers, so 0.3.10 comes after 0.3.9. */
const byVersion = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number))
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

/** The versions that have something in .frozen/, oldest first. */
export function copies() {
  if (!existsSync(FROZEN)) return []
  const found = readdirSync(FROZEN)
    .map((name) => name.match(/^v(\d+\.\d+\.\d+)(?:\.[a-z.]+)?$/)?.[1])
    .filter((v) => v !== undefined)
  return [...new Set(found)].sort(byVersion)
}

/** True while any process of the group the server leads is alive. */
function alive(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch {
    return false
  }
}

/** A server is stopped only while it still runs inside that copy: a stale pid file must never stop a stranger. */
function ours(pid, folder) {
  if (!existsSync("/proc")) return true
  try {
    return `${readlinkSync(`/proc/${pid}/cwd`)}${sep}`.startsWith(`${realpathSync(folder)}${sep}`)
  } catch {
    return false
  }
}

async function stopServer(version) {
  const pidFile = at(version, ".pid")
  const pid = existsSync(pidFile) ? Number(readFileSync(pidFile, "utf8").trim()) : NaN
  if (Number.isInteger(pid) && pid > 1 && alive(pid) && existsSync(at(version)) && ours(pid, at(version))) {
    // The server leads its own process group (it was started detached), so the group signal reaches workerd too.
    process.kill(-pid, "SIGTERM")
    for (let i = 0; i < 50 && alive(pid); i += 1) await sleep(100)
    if (alive(pid)) process.kill(-pid, "SIGKILL")
    for (let i = 0; i < 20 && alive(pid); i += 1) await sleep(100)
  }
  rmSync(pidFile, { force: true })
}

/**
 * Stops one copy's server and removes the copy, its worktree record and its files (with the output of the background
 * start that made it, unless that start is the caller). Nothing else is touched.
 */
export async function stopCopy(version, { keepStartOutput = false } = {}) {
  await stopServer(version)
  const folder = at(version)
  if (existsSync(folder)) {
    // Its node_modules holds links into the project's: rm removes the links themselves and never follows one.
    rmSync(join(folder, "node_modules"), { recursive: true, force: true })
    tryGit("worktree", "remove", "--force", "--force", folder)
    rmSync(folder, { recursive: true, force: true })
  }
  for (const ext of [".json", ".log", ".failed", ".vite.config.mjs"]) rmSync(at(version, ext), { force: true })
  if (!keepStartOutput) rmSync(join(FROZEN, `start-v${version}.out`), { force: true })
  if (existsSync(FROZEN) && readdirSync(FROZEN).length === 0) rmSync(FROZEN, { recursive: true, force: true })
  tryGit("worktree", "prune")
}

// ---------------------------------------------------------------------------------------------------------------
// In use: a pass on a copy marks it, so nothing removes the copy under it.

const markFile = (version, by) => join(IN_USE, `v${version}-${by.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`)

/** Marks v<version> in use by `by` (an agent's name), with the process that holds it when one is given. */
export function markInUse(version, by, pid) {
  if (!VERSION.test(version ?? "") || typeof by !== "string" || by.trim() === "")
    return "Use: use <version> <who> [pid], for example use 0.4.1 qa"
  mkdirSync(IN_USE, { recursive: true })
  const mark = { version, by: by.trim(), t: Date.now(), ...(Number.isInteger(pid) && pid > 1 ? { pid } : {}) }
  writeFileSync(markFile(version, mark.by), `${JSON.stringify(mark)}\n`)
  return `Frozen copy: v${version} marked in use by ${mark.by}. Clear it when the pass reports: --done v${version} ${mark.by}.`
}

/** Clears the mark `by` put on v<version>; says so when there was none. */
export function clearInUse(version, by) {
  const file = typeof by === "string" && VERSION.test(version ?? "") ? markFile(version, by.trim()) : undefined
  if (file === undefined || !existsSync(file)) return `Frozen copy: v${version} had no mark by ${by}.`
  rmSync(file, { force: true })
  return `Frozen copy: v${version} no longer in use by ${by.trim()}.`
}

/** Every mark, split into live and stale (`inUseStatus` in scripts/checkpoint-rules.mjs). */
export function inUse() {
  const marks = existsSync(IN_USE)
    ? readdirSync(IN_USE)
        .filter((name) => name.endsWith(".json"))
        .map((name) => readJson(join(IN_USE, name)))
        .filter((m) => m !== undefined && typeof m.version === "string" && typeof m.by === "string")
    : []
  const running = copies().filter((version) => liveState(version) !== undefined)
  const pidAlive = (pid) => {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }
  return inUseStatus({ marks, now: Date.now(), running, pidAlive })
}

/** Stops and removes every frozen copy, then the .frozen folder itself. */
export async function stopAll() {
  for (const version of copies()) await stopCopy(version)
  rmSync(FROZEN, { recursive: true, force: true })
  tryGit("worktree", "prune")
}

/** True when nothing listens on the port, on 127.0.0.1 or on ::1: "localhost" can be either, server by server. */
async function freePort(port) {
  const freeOn = (host) =>
    new Promise((resolve) => {
      const server = createServer()
      // A machine without that address family cannot have the port taken on it.
      server.once("error", (error) => resolve(error.code === "EADDRNOTAVAIL" || error.code === "EAFNOSUPPORT"))
      server.listen({ port, host, exclusive: true }, () => server.close(() => resolve(true)))
    })
  return (await freeOn("127.0.0.1")) && (await freeOn("::1"))
}

/** Runs node with these arguments in the copy, output appended to its log. Resolves to the exit code. */
function run(cwd, args, log) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      stdio: ["ignore", log, log],
      env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" }
    })
    child.on("error", () => resolve(1))
    child.on("exit", (code) => resolve(code ?? 1))
  })
}

/** The first HTTP status the URL answers with, or undefined if it does not answer in time. */
async function answers(url, limitMs) {
  const until = Date.now() + limitMs
  while (Date.now() < until) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
      return response.status
    } catch {
      await sleep(200)
    }
  }
  return undefined
}

/**
 * The dev server only serves files inside the copy's folder, and the copy's node_modules points into the project's,
 * so it would refuse the packages' own files (fonts, for one). A config beside the copy (never in it: the copy stays
 * exactly the tag) adds the project's node_modules to what it may serve. Without a config file, none is needed.
 */
function devConfig(version) {
  const config = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"].find((name) =>
    existsSync(join(at(version), name))
  )
  if (config === undefined) return []
  const path = at(version, ".vite.config.mjs")
  const allow = JSON.stringify([at(version), realpathSync(join(ROOT, "node_modules"))])
  writeFileSync(
    path,
    [
      "// Written by scripts/checkpoint-copy.mjs for this frozen copy's dev server only.",
      'import { mergeConfig } from "vite"',
      `import config from ${JSON.stringify(`./v${version}/${config}`)}`,
      `const extra = { server: { fs: { allow: ${allow} } } }`,
      'export default async (env) => mergeConfig(typeof config === "function" ? await config(env) : await config, extra)',
      ""
    ].join("\n")
  )
  return ["--config", path]
}

function startServer(version, port, mode, log) {
  const folder = at(version)
  const vite = join(folder, "node_modules", "vite", "bin", "vite.js")
  const args = mode === "preview" ? [vite, "preview"] : [vite, ...devConfig(version)]
  // Detached: the server leads its own process group and outlives this script.
  const child = spawn(process.execPath, [...args, "--port", String(port), "--strictPort"], {
    cwd: folder,
    detached: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" }
  })
  child.unref()
  writeFileSync(at(version, ".pid"), `${child.pid}\n`)
  return child.pid
}

/** Says why the copy did not start, here and in v<version>.failed for the checkpoint that started it. */
function fail(version, why, tail = []) {
  const line = `Frozen copy: v${version} not started: ${why}. The checkpoint itself is fine.`
  const text = [...tail.map((l) => `      ${l}`), line].join("\n")
  mkdirSync(FROZEN, { recursive: true })
  writeFileSync(at(version, ".failed"), `${text}\n`)
  console.log(text)
  return 1
}

/** What a background start left: the running copy, or the lines saying why it did not start. Undefined while it runs. */
export function outcome(version) {
  const state = readJson(at(version, ".json"))
  if (state !== undefined) return { state }
  return existsSync(at(version, ".failed"))
    ? { failed: readFileSync(at(version, ".failed"), "utf8").trimEnd() }
    : undefined
}

/**
 * Makes the frozen copy of v<version> and starts it. Once it answers, any other copy is stopped and removed. Prints one
 * line: where it is, or why it did not start.
 */
export async function start(version) {
  const t0 = Date.now()
  const tag = `v${version}`
  if (!VERSION.test(version)) return fail(version, "that is not a version")
  if (tryGit("rev-parse", "-q", "--verify", `refs/tags/${tag}^{commit}`) === undefined)
    return fail(version, `no tag ${tag}`)
  if (!existsSync(join(ROOT, "node_modules", "vite"))) return fail(version, "node_modules is not installed")
  // The copy must never show up in git status, a check or a lint.
  if (tryGit("check-ignore", "-q", ".frozen/") === undefined) return fail(version, "add .frozen/ to .gitignore first")
  await stopCopy(version, { keepStartOutput: true })
  mkdirSync(FROZEN, { recursive: true })

  const folder = at(version)
  const rel = relative(ROOT, folder)
  if (tryGit("worktree", "add", "--quiet", "--detach", folder, tag) === undefined) {
    await stopCopy(version, { keepStartOutput: true })
    return fail(version, `git worktree add ${rel} failed`)
  }
  mkdirSync(join(folder, "node_modules"))
  for (const name of readdirSync(join(ROOT, "node_modules"))) {
    if (NOT_LINKED.has(name)) continue
    symlinkSync(join(ROOT, "node_modules", name), join(folder, "node_modules", name), "junction")
  }
  for (const name of KEY_FILES) {
    if (existsSync(join(ROOT, name))) execFileSync("cp", ["-p", "--", join(ROOT, name), join(folder, name)])
  }

  const times = { copy: seconds(t0) }
  const log = openSync(at(version, ".log"), "a")
  // On a failure: the end of the log (the migrate, build and server output), then this copy is removed.
  const giveUp = async (why) => {
    closeSync(log)
    const tail = readFileSync(at(version, ".log"), "utf8").trimEnd().split("\n").slice(-12)
    await stopCopy(version, { keepStartOutput: true })
    return fail(version, why, tail)
  }
  const timed = (name, promise) => {
    const began = Date.now()
    return promise.then((code) => {
      times[name] = seconds(began)
      return code
    })
  }
  // The database and the build do not depend on each other: both at once.
  const [migrated, built] = await Promise.all([
    timed("migrate", run(folder, [join("scripts", "migrate-local.mjs")], log)),
    timed("build", run(folder, [join("node_modules", "vite", "bin", "vite.js"), "build"], log))
  ])
  if (migrated !== 0) return giveUp("its database did not migrate")

  const serving = Date.now()
  let port = FIRST_PORT
  while (!(await freePort(port)) && port < FIRST_PORT + 20) port += 1
  let url = `http://localhost:${port}`
  let mode = built === 0 ? "preview" : "dev"
  let pid = startServer(version, port, mode, log)
  let status = await answers(`${url}/api/v1/system/status`, 20_000)
  if (mode === "preview" && (status === undefined || status >= 500)) {
    // The production build does not answer: serve the same commit with the dev server instead, on the next free port.
    // The production server's workerd can hold its port for seconds after it stops, and on that port a dev server
    // that cannot listen dies after the old one was found answering.
    await stopServer(version)
    port += 1
    while (!(await freePort(port)) && port < FIRST_PORT + 20) port += 1
    url = `http://localhost:${port}`
    mode = "dev"
    pid = startServer(version, port, mode, log)
    status = await answers(`${url}/api/v1/system/status`, 60_000)
  }
  if (status === undefined || status >= 500) return giveUp(`its server did not answer on ${url}`)
  closeSync(log)
  times.server = seconds(serving)

  // The newest other copy that still answers keeps running for a pass on it, and so does any copy marked in use;
  // every other copy is stopped.
  const others = copies().filter((other) => other !== version)
  const kept = others.filter((other) => liveState(other) !== undefined).at(-1)
  const held = inUse().live.map((mark) => mark.version)
  for (const other of others) if (other !== kept && !held.includes(other)) await stopCopy(other)
  const alsoHeld = [...new Set(held)].filter((other) => other !== kept && other !== version)
  const what = mode === "preview" ? "production build" : "dev server"
  const state = {
    version,
    folder: rel,
    url,
    port,
    pid,
    mode,
    seconds: seconds(t0),
    times,
    ...(kept === undefined ? {} : { kept })
  }
  writeFileSync(at(version, ".json"), `${JSON.stringify(state)}\n`)
  const before = kept === undefined ? undefined : liveState(kept)
  const hint = signInHint(folder, mode)
  console.log(
    `Frozen copy: v${version} at ${url} (${what}), folder ${rel}, ready in ${state.seconds} s.${before === undefined ? "" : ` v${kept} still runs at ${before.url} for a pass on it; the next checkpoint stops it.`}${alsoHeld.length === 0 ? "" : ` Kept, marked in use: ${alsoHeld.map((v) => `v${v}`).join(", ")}.`}${hint === "" ? "" : ` ${hint}`}`
  )
  return 0
}

/**
 * How to sign in on a copy, from the copy's own scripts/dev-accounts.sql (the local test accounts, which its migrate
 * gives its database; their password is in that file's header and in README.md, a test value, never a secret). A
 * production build shows only its sign-in page and offers no test accounts, so whoever looks needs the first account's
 * email and password in hand. Empty when the copy has no test accounts.
 */
export function signInHint(folder, mode) {
  const sql = join(folder, "scripts", "dev-accounts.sql")
  if (!existsSync(sql)) return ""
  const text = readFileSync(sql, "utf8")
  const password = /password is '([^']*)'/.exec(text)?.[1]
  const email = /INTO "user" \([^)]*\) VALUES \('[^']*', '[^']*', '([^']+)'/.exec(text)?.[1]
  if (password === undefined || email === undefined) return ""
  return mode === "preview"
    ? `It opens on the sign-in page (a production build offers no test accounts): sign in as ${email}, password ${password} (a local test account, scripts/dev-accounts.sql).`
    : `It opens signed in as ${email}; the other test accounts are in the menu under the name (password ${password}).`
}

/** One copy's state while its server runs, or undefined. */
function liveState(version) {
  const state = readJson(at(version, ".json"))
  const pidFile = at(version, ".pid")
  return state !== undefined && existsSync(pidFile) && alive(Number(readFileSync(pidFile, "utf8").trim()))
    ? state
    : undefined
}

/** The newest running copy, or undefined. */
export function running() {
  for (const version of copies().reverse()) {
    const state = liveState(version)
    if (state !== undefined) return state
  }
  return undefined
}

/** Where the copy runs, and the copy before it while that one still runs for a pass on it. */
export function describe(state) {
  if (state === undefined) return "Frozen copy: none running."
  const line = `Frozen copy: v${state.version} at ${state.url} (${state.mode === "preview" ? "production build" : "dev server"}), folder ${state.folder}.`
  const before = state.kept === undefined ? undefined : liveState(state.kept)
  const hint = signInHint(at(state.version), state.mode)
  const marks = inUse()
  const used =
    marks.live.length === 0 && marks.stale.length === 0
      ? ""
      : ` In use: ${[...marks.live.map((m) => `v${m.version} by ${m.by}`), ...marks.stale.map((m) => `v${m.version} by ${m.by} (STALE: ${m.why})`)].join(", ")}.`
  return `${line}${before === undefined ? "" : ` v${before.version} still runs at ${before.url} for a pass on it; the next checkpoint stops it.`}${used}${hint === "" ? "" : ` ${hint}`}`
}

if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const [command, version] = process.argv.slice(2)
  if (command === "start" && version !== undefined) process.exitCode = await start(version)
  else if (command === "stop" && version !== undefined) {
    await stopCopy(version)
    console.log(`Frozen copy: v${version} stopped and removed.`)
  } else if (command === "stop") {
    await stopAll()
    console.log("Frozen copy: every copy stopped and removed.")
  } else if (command === "status") console.log(describe(running()))
  else if (command === "use") console.log(markInUse(version, process.argv[4], Number(process.argv[5])))
  else if (command === "done") console.log(clearInUse(version, process.argv[4]))
  else if (command === "in-use") {
    const marks = inUse()
    const lines = inUseLines(marks)
    console.log(lines.length === 0 ? "Frozen copy: none marked in use." : `Frozen copy marks:\n${lines.join("\n")}`)
  } else {
    console.log(
      "Use: node scripts/checkpoint-copy.mjs start <version> | stop [<version>] | status | use <version> <who> [pid] | done <version> <who> | in-use"
    )
    process.exitCode = 2
  }
}
