// `infra export`: a dump of a stage's database on the owner's workstation. Every tool is a stand-in that answers
// from what the test gives it and writes down what was asked, run and handed the terminal; the "export" writes the
// file a real one would. No `alchemy` and no `wrangler` is started and no account is reached, so these show what
// the command starts, with which words, and what it does to its file, never that the tools do what their help says.
// The table list and the long rows are the ones a local database of this app gave (`goals/alchemy-uptake/PLAN.md`).
import * as NodeServices from "@effect/platform-node/NodeServices"
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils"
import { describe, expect, it, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Deferred from "effect/Deferred"
import * as Effect from "effect/Effect"
import * as Fiber from "effect/Fiber"
import * as FileSystem from "effect/FileSystem"
import { dual } from "effect/Function"
import * as MutableRef from "effect/MutableRef"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as Path from "effect/Path"
import * as Str from "effect/String"
import * as TestClock from "effect/testing/TestClock"
import {
  databaseDump,
  dumpDryRun,
  dumpTables,
  exportMinutes,
  longestStatement,
  tablesQuery,
  tooLongToRestore
} from "../src/commands/Infra/DatabaseDump.rules.ts"
import { type Answer, Workstation } from "../src/commands/Infra/Workstation.service.ts"
import { json } from "./support/tree.ts"

const account = "0123456789abcdef0123456789abcdef"
const record = json({
  status: "created",
  attr: { databaseName: "inventory-staging-database-1a2b", accountId: account }
})

const made = (name: string, sql: string) => ({ name, sql })
const listedAsWrangler = json([
  {
    results: [
      made("d1_migrations", 'CREATE TABLE "d1_migrations"(id INTEGER)'),
      made("item", 'CREATE TABLE "item" (id TEXT)'),
      made("itemSearch", "CREATE VIRTUAL TABLE itemSearch USING fts5(name)"),
      made("itemSearch_config", "CREATE TABLE 'itemSearch_config'(k PRIMARY KEY, v)"),
      made("itemSearch_data", "CREATE TABLE 'itemSearch_data'(id INTEGER PRIMARY KEY, block BLOB)"),
      made("sqlite_sequence", "CREATE TABLE sqlite_sequence(name,seq)"),
      made("user", 'CREATE TABLE "user" ("id" text)')
    ],
    success: true
  }
])

const longRow = `INSERT INTO "importChunk" ("id","rows") VALUES('c1','${Str.repeat(longestStatement)("x")}');`
const dumpText = A.join(
  [
    "PRAGMA defer_foreign_keys=TRUE;",
    `INSERT INTO "user" ("id") VALUES('usr_dana');`,
    `INSERT INTO "item" ("id") VALUES('itm_1');`,
    longRow,
    ""
  ],
  "\n"
)

interface World {
  readonly log: ReadonlyArray<string>
  readonly yes: boolean
  readonly state: Answer
  readonly tables: Answer
  /** What the export does: its exit code, or never ending. */
  readonly ends: O.Option<number>
  /** Run when the export has been handed the terminal and has written its file. */
  readonly onExport: Effect.Effect<void>
}

const world = (over: Partial<World> = {}) =>
  MutableRef.make<World>({
    log: [],
    yes: true,
    state: { stdout: record, stderr: "", code: 0 },
    tables: { stdout: listedAsWrangler, stderr: "", code: 0 },
    ends: O.some(0),
    onExport: Effect.void,
    ...over
  })

const said = (w: MutableRef.MutableRef<World>, entry: string) =>
  MutableRef.update(w, (now) => ({ ...now, log: [...now.log, entry] }))

const line = (command: string, args: ReadonlyArray<string>) => A.join([command, ...args], " ")

/** The workstation as a dump uses it; the handed export writes `dumpText` to the path after `--output`. */
const standIn = (w: MutableRef.MutableRef<World>, fs: FileSystem.FileSystem) =>
  Workstation.of({
    say: Effect.fnUntraced(function* (text: string) {
      return yield* Effect.sync(() => said(w, `say: ${text}`))
    }),
    ask: dual(2, (self: string, args: ReadonlyArray<string>) =>
      Effect.sync(() => {
        said(w, `ask: ${line(self, args)}`)
        return self === "bunx" ? w.current.state : w.current.tables
      })
    ),
    quiet: dual(2, (_self: string, _args: ReadonlyArray<string>) => Effect.die("a dump runs no tool quietly")),
    hand: dual(
      (args) => P.isString(args[0]),
      (self: string, args: ReadonlyArray<string>) =>
        Effect.gen(function* () {
          said(w, `hand: ${line(self, args)}`)
          const file = A.last(args)
          assertSome(file, A.lastNonEmpty(["", ...args]))
          yield* fs.writeFileString(file.value, dumpText).pipe(Effect.orDie)
          yield* w.current.onExport
          return yield* O.match(w.current.ends, { onNone: () => Effect.never, onSome: Effect.succeed })
        })
    ),
    confirm: Effect.fnUntraced(function* (question: string) {
      said(w, `confirm: ${question}`)
      return yield* Effect.succeed(w.current.yes)
    }),
    choose: dual(2, (_self: string, _choices: ReadonlyArray<unknown>) => Effect.die("a dump asks for no choice"))
  })

const options = {
  stage: "staging",
  dryRun: false,
  previewProfile: "inventory-preview",
  productionProfile: "inventory-production"
}

/** Runs a dump in a home folder of its own; what stopped it, and the files left in the dumps' folder. */
const run = Effect.fn("run")(function* (w: MutableRef.MutableRef<World>, over: Partial<typeof options>) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "dump-home-" })
  const stopped = yield* databaseDump({ ...options, ...over, home }).pipe(
    Effect.provideService(Workstation, standIn(w, fs)),
    Effect.match({ onFailure: (error) => O.some(error.message), onSuccess: () => O.none<string>() })
  )
  const folder = path.join(home, "inventory-dumps")
  const there = yield* fs.exists(folder)
  const files = there ? yield* fs.readDirectory(folder) : []
  return { stopped, home, folder, files, there }
}, Effect.scoped)

const started = (w: MutableRef.MutableRef<World>) =>
  A.filter(w.current.log, (entry) => Str.startsWith("ask: ")(entry) || Str.startsWith("hand: ")(entry))

describe("the tables a dump names", () => {
  it("are the app's own: not the search index or its tables, SQLite's, Cloudflare's or the migrations' ledger", () => {
    expect(
      dumpTables([
        { name: "_cf_KV", sql: O.some("CREATE TABLE _cf_KV (key TEXT)") },
        { name: "d1_migrations", sql: O.some("CREATE TABLE d1_migrations(id INTEGER)") },
        { name: "item", sql: O.some('CREATE TABLE "item" (id TEXT)') },
        { name: "itemSearch", sql: O.some("CREATE VIRTUAL TABLE itemSearch USING fts5(name)") },
        { name: "itemSearch_data", sql: O.some("CREATE TABLE 'itemSearch_data'(id INTEGER)") },
        { name: "itemSearchLog", sql: O.some("CREATE TABLE itemSearchLog (id TEXT)") },
        { name: "sqlite_sequence", sql: O.none() },
        { name: "user", sql: O.some('CREATE TABLE "user" ("id" text)') }
      ])
    ).toEqual(["item", "itemSearchLog", "user"])
  })

  it("a row longer than D1 loads back is counted by its table, and a row at the limit is not", () => {
    const [open, close] = [`INSERT INTO "item" ("id") VALUES('`, "');"]
    const atLimit = `${open}${Str.repeat(longestStatement - Str.length(open) - Str.length(close))("x")}${close}`
    expect(Str.length(atLimit)).toBe(longestStatement)
    expect(
      tooLongToRestore(A.join([atLimit, longRow, longRow, `INSERT INTO "user" ("id") VALUES('u');`], "\n"))
    ).toEqual([{ table: "importChunk", rows: 2 }])
  })
})

layer(NodeServices.layer)("a dump of a stage's database", (it) => {
  it.effect("a dry run says each step and starts nothing, asks nothing and makes no folder", () =>
    Effect.gen(function* () {
      const w = world()
      const result = yield* run(w, { dryRun: true })
      assertNone(result.stopped)
      expect(w.current.log).toEqual(
        A.map(dumpDryRun({ ...options, dryRun: true, home: result.home }), (text) => `say: ${text}`)
      )
      expect(result.there).toBe(false)
      const text = A.join(w.current.log, "\n")
      assertTrue(Str.includes("bunx alchemy state read inventory/staging/Database --profile inventory-preview")(text))
      assertTrue(Str.includes(`stopped after ${exportMinutes} minutes`)(text))
      assertTrue(Str.includes("Nothing is uploaded")(text))
    })
  )

  it.effect("production's database is read with production's profile", () =>
    Effect.gen(function* () {
      const w = world()
      yield* run(w, { stage: "prod" })
      expect(A.head(started(w))).toEqual(
        O.some("ask: bunx alchemy state read inventory/prod/Database --profile inventory-production")
      )
    })
  )

  it.effect("asks first, then names the app's tables to wrangler and leaves a file only its owner reads", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem
      const path = yield* Path.Path
      const w = world()
      const result = yield* Effect.gen(function* () {
        const home = yield* fs.makeTempDirectoryScoped({ prefix: "dump-home-" })
        yield* databaseDump({ ...options, home }).pipe(Effect.provideService(Workstation, standIn(w, fs)))
        const folder = path.join(home, "inventory-dumps")
        const file = path.join(folder, "staging-1970-01-01T000000Z.sql")
        return {
          file,
          files: yield* fs.readDirectory(folder),
          folderMode: (yield* fs.stat(folder)).mode & 0o777,
          fileMode: (yield* fs.stat(file)).mode & 0o777,
          text: yield* fs.readFileString(file)
        }
      }).pipe(Effect.scoped)

      expect(A.head(w.current.log)).toEqual(
        O.some(
          "confirm: Take a dump of staging? The file will hold every person's email and password hash and every item, on this machine, readable by you alone."
        )
      )
      expect(started(w)).toEqual([
        "ask: bunx alchemy state read inventory/staging/Database --profile inventory-preview",
        `ask: env CLOUDFLARE_ACCOUNT_ID=${account} bunx wrangler d1 execute inventory-staging-database-1a2b --remote --json --command ${tablesQuery}`,
        `hand: env CLOUDFLARE_ACCOUNT_ID=${account} bunx wrangler d1 export inventory-staging-database-1a2b --remote --no-schema --table item --table user --output ${result.file}`
      ])
      expect(result.files).toEqual(["staging-1970-01-01T000000Z.sql"])
      expect(result.folderMode).toBe(0o700)
      expect(result.fileMode).toBe(0o600)
      expect(result.text).toBe(dumpText)
      expect(A.filter(w.current.log, Str.startsWith("say: "))).toEqual([
        `say: A dump of staging is in ${result.file}: 3 rows of 2 tables, readable by you alone. Nothing was uploaded.`,
        `say: 1 rows of importChunk are longer than D1 loads back (${longestStatement} bytes a statement): a restore leaves them out.`,
        "say: It holds no schema, no search index and no migrations' ledger: a new stage has those from its own deploy.",
        `say: It holds every person's email and password hash. Delete it when it has served: rm ${result.file}`
      ])
    })
  )

  it.effect("a no, which is also what no terminal answers, starts no tool and makes no folder", () =>
    Effect.gen(function* () {
      const w = world({ yes: false })
      const result = yield* run(w, {})
      assertSome(result.stopped, "No dump was taken: the question was answered no, or there was no terminal to ask at.")
      expect(started(w)).toEqual([])
      expect(result.there).toBe(false)
    })
  )

  it.effect("a name that is no stage's stops before the question", () =>
    Effect.gen(function* () {
      const w = world()
      const result = yield* run(w, { stage: "staging; rm -rf ~" })
      assertTrue(O.exists(result.stopped, Str.includes("is no stage's name")))
      expect(w.current.log).toEqual([])
    })
  )

  it.effect("a state record that names no database, or one that cannot be read, stops before wrangler", () =>
    Effect.gen(function* () {
      const failed = world({ state: { stdout: "", stderr: "the profile was not found\n", code: 1 } })
      const first = yield* run(failed, {})
      assertSome(
        first.stopped,
        "The state store did not answer as expected. Nothing was written. It said: the profile was not found"
      )
      const odd = world({
        state: { stdout: json({ attr: { databaseName: "x; drop", accountId: account } }), stderr: "", code: 0 }
      })
      const second = yield* run(odd, {})
      assertTrue(O.exists(second.stopped, Str.includes("names no database and account this command can read")))
      expect(A.length(started(failed))).toBe(1)
      expect(A.length(started(odd))).toBe(1)
      expect(second.there).toBe(false)
    })
  )

  it.effect("a table list that cannot be read, or holds a name wrangler cannot be given, writes nothing", () =>
    Effect.gen(function* () {
      const refused = world({ tables: { stdout: "", stderr: "Not logged in.\n", code: 1 } })
      const first = yield* run(refused, {})
      assertTrue(O.exists(first.stopped, Str.includes("bunx wrangler whoami")))
      const odd = world({
        tables: { stdout: json([{ results: [{ name: "item --remote", sql: "CREATE TABLE x" }] }]), stderr: "", code: 0 }
      })
      const second = yield* run(odd, {})
      assertSome(second.stopped, "The database lists no table this command can name to wrangler. Nothing was written.")
      expect(first.there).toBe(false)
      expect(second.there).toBe(false)
    })
  )

  it.effect("an export that fails leaves no file behind", () =>
    Effect.gen(function* () {
      const w = world({ ends: O.some(1) })
      const result = yield* run(w, {})
      assertSome(result.stopped, "wrangler ended with 1 and the unfinished file was removed. No dump was taken.")
      expect(result.files).toEqual([])
    })
  )

  it.effect("an export that never ends is stopped after its minutes and leaves no file behind", () =>
    Effect.gen(function* () {
      const exporting = yield* Deferred.make<void>()
      const w = world({ ends: O.none(), onExport: Deferred.succeed(exporting, undefined) })
      const fiber = yield* Effect.forkChild(run(w, {}))
      yield* Deferred.await(exporting)
      yield* Effect.yieldNow
      yield* TestClock.adjust(`${exportMinutes} minutes`)
      const result = yield* Fiber.join(fiber)
      assertSome(
        result.stopped,
        `The export was stopped after ${exportMinutes} minutes and its file removed. No dump was taken.`
      )
      expect(result.files).toEqual([])
    })
  )
})
