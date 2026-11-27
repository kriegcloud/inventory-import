/**
 * `infra export --stage <name>`: a dump of one stage's database, taken by the repository's owner at his workstation
 * into a file only he can read (`goals/alchemy-uptake`, step 3; his decision of 2026-11-26). With `--dry-run` it
 * prints its steps and starts nothing, which is the only way an agent runs it.
 *
 * Must not break: the file holds every person's email and password hash, so it is made readable by its owner alone
 * before the first row is written, it goes nowhere but his home folder, and a dump that did not finish is removed.
 *
 * It is a dump, never called a backup: the rows of the tables as they were at one moment, with no schema. D1 refuses
 * to export a database that has a full-text index (`itemSearch`) unless the tables are named, so this names every
 * table but the index's own, SQLite's and the migrations' ledger; a restore gets those three from the migrations
 * (`docs/operations.md`, "A dump of a stage's database").
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import * as A from "effect/Array"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Path from "effect/Path"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { CloudflareId } from "./InfraSetup.rules.ts"
import { Workstation } from "./Workstation.service.ts"

const $I = $RepoCliId.create("commands/Infra/DatabaseDump.rules")

/**
 * A dump that stopped: why, and what the owner does next.
 *
 * @category errors
 */
export class DumpStopped extends S.TaggedError<DumpStopped, { readonly brand: unique symbol }>($I`DumpStopped`)(
  "DumpStopped",
  { message: S.String.pipe(S.annotateKey({ description: "Why the dump stopped and what the owner does next" })) },
  $I.annoteError<DumpStopped>("DumpStopped", { description: "A dump of a stage's database that stopped" })
) {}

const stop = (message: string) => Effect.fail(DumpStopped.make({ message }))

/** The folder under his home that dumps are kept in, and nowhere else. */
export const dumpFolder = "inventory-dumps"

/** How long the export may run before this command stops it: Cloudflare's own polling has no bound. */
export const exportMinutes = 15

/** D1 loads no statement longer than this back (its limit on one SQL statement), so a longer row is not restored. */
export const longestStatement = 100_000

/** A stage's name, as the stack takes it. */
const StageName = S.String.check(S.isPattern(/^[a-z0-9][-_a-z0-9]*$/))

/** A name SQLite and wrangler take without quoting: a database's or a table's. */
const PlainName = S.String.check(S.isPattern(/^[A-Za-z_][-_A-Za-z0-9]*$/))

/**
 * What the state store's record of the database says, as far as a dump needs it. The record holds no secret.
 *
 * @category schemas
 */
export const DatabaseRecord = S.fromJsonString(
  S.Struct({
    attr: S.Struct({
      databaseName: PlainName.pipe(S.annotateKey({ description: "The database's name in the account" })),
      accountId: CloudflareId.pipe(S.annotateKey({ description: "The Cloudflare account the database is in" }))
    })
  })
).pipe($I.annoteSchema("DatabaseRecord", { description: "A stage's database as the state store records it" }))

/** One table as SQLite lists it. */
const ListedTable = S.Struct({
  name: S.String,
  sql: S.OptionFromNullOr(S.String)
})

/**
 * What `wrangler d1 execute --json` prints for the one statement that lists the tables.
 *
 * @category schemas
 */
export const TableListing = S.Struct({ results: S.Array(ListedTable) }).pipe(
  S.NonEmptyArray,
  S.fromJsonString,
  $I.annoteSchema("TableListing", { description: "The tables of a database as wrangler prints them" })
)

/** The statement that lists a database's tables with the statement each was made by. */
export const tablesQuery = "select name, sql from sqlite_master where type = 'table' order by name"

const madeVirtual = (table: typeof ListedTable.Type) =>
  O.exists(table.sql, (sql) => Str.startsWith("CREATE VIRTUAL TABLE")(sql))

/**
 * The tables a dump names: every table that holds the app's rows. Left out are a full-text index and the tables
 * SQLite keeps for it (`itemSearch`, `itemSearch_data`, …), which D1 refuses to export and the item table's
 * triggers rebuild; SQLite's and Cloudflare's own (`sqlite_…`, `_cf_…`); and the migrations' ledger, which a new
 * database already has.
 *
 * @example
 * dumpTables([
 *   { name: "item", sql: O.some('CREATE TABLE "item" (…)') },
 *   { name: "itemSearch", sql: O.some("CREATE VIRTUAL TABLE itemSearch USING fts5(…)") },
 *   { name: "itemSearch_data", sql: O.some("CREATE TABLE 'itemSearch_data'(…)") },
 *   { name: "d1_migrations", sql: O.some("CREATE TABLE d1_migrations(…)") }
 * ]) // ["item"]
 *
 * @category rules
 */
export const dumpTables = (listed: ReadonlyArray<typeof ListedTable.Type>): ReadonlyArray<string> => {
  const virtual = A.map(A.filter(listed, madeVirtual), (table) => table.name)
  const kept = (name: string) =>
    !A.contains(virtual, name) &&
    !A.some(virtual, (index) => Str.startsWith(`${index}_`)(name)) &&
    !Str.startsWith("sqlite_")(name) &&
    !Str.startsWith("_cf_")(name) &&
    name !== "d1_migrations"
  return A.filter(
    A.map(listed, (table) => table.name),
    kept
  )
}

const insertInto = /^INSERT INTO "([^"]+)"/

/**
 * The tables with a row too long for D1 to load back, each with how many: a restore leaves those rows out.
 *
 * @category rules
 */
export const tooLongToRestore = (dump: string): ReadonlyArray<{ readonly table: string; readonly rows: number }> =>
  pipe(
    Str.split("\n")(dump),
    A.filter((line) => Str.length(line) > longestStatement),
    A.map((line) =>
      pipe(
        Str.match(insertInto)(line),
        O.flatMap((found) => O.fromUndefinedOr(found[1])),
        O.match({ onNone: () => "a statement that is no insert", onSome: (table) => table })
      )
    ),
    A.groupBy((table) => table),
    (byTable) => A.map(R.toEntries(byTable), ([table, lines]) => ({ table, rows: A.length(lines) }))
  )

/**
 * What a dump is asked for.
 *
 * @category models
 */
export interface DumpOptions {
  readonly stage: string
  readonly dryRun: boolean
  readonly previewProfile: string
  readonly productionProfile: string
  /** His home folder: dumps go under it and nowhere else. */
  readonly home: string
}

/** Production's own account has its own profile; every other stage is in the previews' account. */
const profileFor = (options: DumpOptions) =>
  options.stage === "prod" ? options.productionProfile : options.previewProfile

const stateRead = (options: DumpOptions) => [
  "alchemy",
  "state",
  "read",
  `inventory/${options.stage}/Database`,
  "--profile",
  profileFor(options)
]

const wrangler = (account: string, args: ReadonlyArray<string>) => [
  `CLOUDFLARE_ACCOUNT_ID=${account}`,
  "bunx",
  "wrangler",
  "d1",
  ...args
]

/**
 * What `--dry-run` prints: the steps of a dump in order, word for word where the words are known before a run.
 *
 * @category rendering
 */
export const dumpDryRun = (options: DumpOptions): ReadonlyArray<string> => [
  "Dry run: nothing is started and nothing is written. A run would do these steps, in this order:",
  `1. Ask you whether to take it: the file will hold every person's email and password hash and every item of ${options.stage}.`,
  `2. Read the database's name and account from the state store (the record holds no secret): bunx ${A.join(stateRead(options), " ")}`,
  `3. List its tables: env CLOUDFLARE_ACCOUNT_ID=<account> bunx wrangler d1 execute <database> --remote --json --command "${tablesQuery}"`,
  "   wrangler uses its own login (bunx wrangler whoami): this command starts no login and reads no token.",
  `4. Make ~/${dumpFolder} readable by you alone, and in it an empty file ${options.stage}-<time>.sql readable by you alone.`,
  `5. Export the rows, with your terminal, stopped after ${exportMinutes} minutes: env CLOUDFLARE_ACCOUNT_ID=<account> bunx wrangler d1 export <database> --remote --no-schema --table <each table but the search index's, SQLite's and the migrations' ledger> --output ~/${dumpFolder}/${options.stage}-<time>.sql`,
  "6. Say where the file is, which rows are too long for D1 to load back, and that it is yours to delete. Nothing is uploaded.",
  'How to load it into a new stage: docs/operations.md, "A dump of a stage\'s database".'
]

const failed = (what: string, said: string) =>
  stop(`${what} did not answer as expected. Nothing was written. It said: ${Str.trim(said)}`)

/**
 * Takes the dump, or prints its steps.
 *
 * @category rules
 */
export const databaseDump = Effect.fn("Infra.databaseDump")(function* (options: DumpOptions) {
  const workstation = yield* Workstation
  if (!S.is(StageName)(options.stage)) {
    return yield* stop(
      `"${options.stage}" is no stage's name: lower-case letters, digits, - and _. Nothing was started.`
    )
  }
  if (options.dryRun) {
    return yield* Effect.forEach(dumpDryRun(options), workstation.say, { concurrency: 1, discard: true })
  }
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const agreed = yield* workstation.confirm(
    `Take a dump of ${options.stage}? The file will hold every person's email and password hash and every item, on this machine, readable by you alone.`
  )
  if (!agreed) {
    return yield* stop("No dump was taken: the question was answered no, or there was no terminal to ask at.")
  }

  const record = yield* workstation.ask("bunx", stateRead(options))
  if (record.code !== 0) {
    return yield* failed("The state store", record.stderr)
  }
  const database = yield* S.decodeEffect(DatabaseRecord)(record.stdout).pipe(
    Effect.catchTag("SchemaError", () =>
      stop(
        `The state store's record of inventory/${options.stage}/Database names no database and account this command can read. Nothing was written.`
      )
    )
  )
  const { accountId, databaseName } = database.attr

  const listing = yield* workstation.ask(
    "env",
    wrangler(accountId, ["execute", databaseName, "--remote", "--json", "--command", tablesQuery])
  )
  if (listing.code !== 0) {
    return yield* failed("wrangler (is it logged in to this account? bunx wrangler whoami)", listing.stderr)
  }
  const listed = yield* S.decodeEffect(TableListing)(listing.stdout).pipe(
    Effect.catchTag("SchemaError", () => stop("wrangler's list of the tables could not be read. Nothing was written."))
  )
  const tables = dumpTables(A.headNonEmpty(listed).results)
  if (!A.isReadonlyArrayNonEmpty(tables) || !A.every(tables, S.is(PlainName))) {
    return yield* stop("The database lists no table this command can name to wrangler. Nothing was written.")
  }

  const now = yield* DateTime.now
  const time = pipe(DateTime.formatIso(now), Str.replace(/[:.]/g, ""), Str.slice(0, 17))
  const folder = path.join(options.home, dumpFolder)
  const file = path.join(folder, `${options.stage}-${time}Z.sql`)
  yield* fs.makeDirectory(folder, { recursive: true }).pipe(
    Effect.andThen(fs.chmod(folder, 0o700)),
    Effect.andThen(fs.writeFileString(file, "", { flag: "wx", mode: 0o600 })),
    Effect.andThen(fs.chmod(file, 0o600)),
    Effect.catchTag("PlatformError", (error) =>
      stop(`${file} could not be made: ${error.message}. Nothing was exported.`)
    )
  )

  const exported = yield* workstation
    .hand(
      "env",
      wrangler(accountId, [
        "export",
        databaseName,
        "--remote",
        "--no-schema",
        ...A.flatMap(tables, (table) => ["--table", table]),
        "--output",
        file
      ])
    )
    .pipe(Effect.timeoutOption(`${exportMinutes} minutes`))
  const finished = O.exists(exported, (code) => code === 0)
  if (!finished) {
    yield* fs.remove(file, { force: true }).pipe(Effect.ignore)
    return yield* stop(
      O.match(exported, {
        onNone: () => `The export was stopped after ${exportMinutes} minutes and its file removed. No dump was taken.`,
        onSome: (code) => `wrangler ended with ${code} and the unfinished file was removed. No dump was taken.`
      })
    )
  }
  yield* fs.chmod(file, 0o600).pipe(Effect.ignore)
  const dump = yield* fs
    .readFileString(file)
    .pipe(
      Effect.catchTag("PlatformError", (error) =>
        stop(`The dump was written to ${file} but could not be read back: ${error.message}`)
      )
    )
  const rows = A.length(A.filter(Str.split("\n")(dump), Str.startsWith("INSERT INTO ")))
  return yield* Effect.forEach(
    [
      `A dump of ${options.stage} is in ${file}: ${rows} rows of ${A.length(tables)} tables, readable by you alone. Nothing was uploaded.`,
      ...A.map(
        tooLongToRestore(dump),
        ({ table, rows: long }) =>
          `${long} rows of ${table} are longer than D1 loads back (${longestStatement} bytes a statement): a restore leaves them out.`
      ),
      "It holds no schema, no search index and no migrations' ledger: a new stage has those from its own deploy.",
      `It holds every person's email and password hash. Delete it when it has served: rm ${file}`
    ],
    workstation.say,
    { concurrency: 1, discard: true }
  )
})
