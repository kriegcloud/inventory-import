// The stack test (goals/alchemy-uptake, step 4): the app's own stack, as `bun run dev:alchemy` declares it, deployed
// on Alchemy's local providers by its test harness, then used over HTTP as a person would: a test account signs in
// with its cookie, imports items_clean.csv through the same upload and confirm the screen sends, and reads its 25
// items back. The one thing not to break: the sign-in secret the stack mints is in no file the run writes. The state
// is in memory; the local runtime still writes its databases under `.alchemy/local` here, so the run's own database
// is removed when it ends (it holds the test accounts' password hashes and the run's sessions).
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Test from "@alchemy.run/test/Vitest"
import InventoryDev, { localStackState } from "@beep/infra/InventoryDev"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import { assertSome, deepStrictEqual } from "@effect/vitest/utils"
import * as State from "alchemy/State"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as PlatformError from "effect/PlatformError"
import * as Redacted from "effect/Redacted"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import clean from "../../public/samples/items_clean.csv?raw"
import { Api } from "../../src/api/v1/Api.ts"
import { stage } from "../server/support/files.ts"
import { upload } from "../server/support/upload.ts"

// A personal stage: the dev stack's guard lets only `alchemy dev` (here, the harness's `dev: true`) start one.
const stageName = "dev_stacktest"
// Where the local runtime writes, whatever `dotAlchemy` says: under the folder vitest runs in, the app's (seen in the
// trial). Named from this file, since the harness does not keep the working folder a relative path is read from.
const dotAlchemy = `${import.meta.dirname}/../../.alchemy`
const runtimeData = `${dotAlchemy}/local`

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Cloudflare.providers().pipe(
    Layer.provideMerge(Layer.mergeAll(FetchHttpClient.layer, NodeFileSystem.layer))
  ),
  // The stack's own store: its `state` is the one a deploy uses, so the test reads the same records.
  state: localStackState,
  dev: true,
  stage: stageName
})

/**
 * Every file under `dir`, or none when it is not there. Walked a folder at a time: the file system the harness
 * provides lists nothing with `recursive` (seen: a folder holding a database answered an empty list).
 */
const filesUnder = (
  dir: string
): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError, FileSystem.FileSystem> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const there = yield* fs.exists(dir)
    if (!there) return A.empty<string>()
    const info = yield* fs.stat(dir)
    if (info.type === "File") return A.of(dir)
    if (info.type !== "Directory") return A.empty<string>()
    const names = yield* fs.readDirectory(dir)
    const nested = yield* Effect.forEach(names, (name) => filesUnder(`${dir}/${name}`), { concurrency: 1 })
    return A.flatten(nested)
  })

// What was under the runtime's folder before this run: only what the run adds is removed after it.
const before = beforeAll(filesUnder(runtimeData))
const stack = beforeAll(deploy(InventoryDev), { timeout: 240_000 })

afterAll(
  Effect.gen(function* () {
    yield* destroy(InventoryDev)
    const fs = yield* FileSystem.FileSystem
    const had = yield* before
    const now = yield* filesUnder(runtimeData)
    yield* Effect.forEach(
      A.filter(now, (path) => Str.includes("/d1/")(path) && !A.contains(had, path)),
      (path) => fs.remove(path),
      { concurrency: 1, discard: true }
    )
  }),
  { timeout: 120_000 }
)

const Offer = S.Struct({
  status: S.Literal("signed-out"),
  features: S.Struct({
    testAccounts: S.Struct({ password: S.String, accounts: S.Array(S.Struct({ email: S.String })) })
  })
})
const SignInSecret = S.Struct({ attr: S.Struct({ text: S.Redacted(S.String) }) })

test(
  "a test account signs in over HTTP, imports items_clean.csv and reads 25 items back; the secret is in no file",
  Effect.gen(function* () {
    const outputs = yield* stack
    const url = String(outputs.url)
    const http = yield* HttpClient.HttpClient

    // Signed out, the page offers the test accounts and their password (a personal stage's are the repository's).
    const signedOut = yield* http.get(`${url}/api/v1/identity/session`)
    const signedOutBody = yield* signedOut.json
    const offer = yield* S.decodeUnknownEffect(Offer)(signedOutBody)
    const account = A.head(offer.features.testAccounts.accounts)
    assertSome(
      O.map(account, () => true),
      true
    )
    const email = O.match(account, { onNone: () => "", onSome: (found) => found.email })
    const signIn = yield* http.execute(
      HttpClientRequest.post(`${url}/api/auth/sign-in/email`).pipe(
        HttpClientRequest.setHeader("origin", url),
        HttpClientRequest.bodyJsonUnsafe({ email, password: offer.features.testAccounts.password })
      )
    )
    const cookie = O.flatMap(Headers.get(signIn.headers, "set-cookie"), (header) => A.head(Str.split(";")(header)))
    assertSome(
      O.map(cookie, () => true),
      true
    )
    const sent = O.match(cookie, { onNone: () => "", onSome: (value) => value })

    // The app's own client, as the page's: the cookie, and the origin a write from the page carries.
    const client = yield* HttpApiClient.make(Api, {
      baseUrl: url,
      transformClient: HttpClient.mapRequest(HttpClientRequest.setHeaders({ origin: url, cookie: sent }))
    })
    const table = yield* stage(new File([clean], "items_clean.csv"))
    const staged = yield* upload({ client, table })
    deepStrictEqual([staged.progress.rows, staged.progress.ready], [25, 25])
    const confirmed = yield* client.imports.commit({
      params: { id: staged.id },
      payload: { revision: staged.revision, madeOn: {}, set: {}, clear: [] }
    })
    assertSome(
      O.map(confirmed.result, (result) => result.created),
      25
    )
    const items = yield* client.items.list()
    deepStrictEqual(items.length, 25)

    // The secret the stack minted, read from its state, is in no file under the runtime's folder.
    // The service is the effect that opens the store.
    const opening = yield* State.State
    const state = yield* opening
    const fqns = yield* state.list({ stack: "inventory", stage: stageName })
    const secretFqn = A.findFirst(fqns, (fqn) => Str.endsWith("SignInSecret")(fqn))
    assertSome(
      O.map(secretFqn, () => true),
      true
    )
    const persisted = yield* state.get({
      stack: "inventory",
      stage: stageName,
      fqn: O.match(secretFqn, { onNone: () => "", onSome: (fqn) => fqn })
    })
    const secret = yield* S.decodeUnknownEffect(SignInSecret)(persisted)
    const text = Redacted.value(secret.attr.text)
    deepStrictEqual(text.length, 64)
    const fs = yield* FileSystem.FileSystem
    const written = yield* filesUnder(dotAlchemy)
    // The search reads the run's own database at least: a search of no file proves nothing.
    deepStrictEqual(
      A.some(written, (path) => Str.includes("/d1/")(path) && Str.endsWith(".sqlite")(path)),
      true
    )
    const holding = yield* Effect.filter(
      written,
      (path) => Effect.map(fs.readFile(path), (bytes) => Str.includes(text)(new TextDecoder("latin1").decode(bytes))),
      { concurrency: 1 }
    )
    deepStrictEqual(holding, [])
  }),
  { timeout: 180_000 }
)
