// The trial of npm's @alchemy.run/test 2.0.0-beta.87 (goals/alchemy-uptake, step 4): the dev stack on Alchemy's
// local providers, its state in memory, and a test account signed in over HTTP with its cookie. What it showed is
// in NOTE.md.
import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Test from "@alchemy.run/test/Vitest"
import InventoryDev from "@beep/infra/InventoryDev"
import { assertSome, deepStrictEqual } from "@effect/vitest/utils"
import * as Alchemy from "alchemy"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const { test, beforeAll, afterAll, deploy, destroy } = Test.make({
  providers: Layer.merge(Cloudflare.providers(), FetchHttpClient.layer),
  state: Alchemy.inMemoryState(),
  dev: true,
  stage: "dev_trial",
  dotAlchemy: `${import.meta.dirname}/.state/alchemy`
})

const stack = beforeAll(deploy(InventoryDev), { timeout: 240_000 })
afterAll(destroy(InventoryDev), { timeout: 120_000 })

const Offer = S.Struct({
  status: S.Literal("signed-out"),
  features: S.Struct({
    testAccounts: S.Struct({ password: S.String, accounts: S.Array(S.Struct({ email: S.String })) })
  })
})
const Ready = S.Struct({ status: S.Literal("ready"), actor: S.Struct({ name: S.String }) })

test(
  "the dev stack serves the app, and a test account signs in over HTTP with its cookie",
  Effect.gen(function* () {
    const outputs = yield* stack
    const url = String(outputs.url)
    const client = yield* HttpClient.HttpClient

    const signedOut = yield* client.get(`${url}/api/v1/identity/session`)
    const signedOutBody = yield* signedOut.json
    const offer = yield* S.decodeUnknownEffect(Offer)(signedOutBody)
    const account = A.head(offer.features.testAccounts.accounts)
    assertSome(O.map(account, () => true), true)
    const email = O.match(account, { onNone: () => "", onSome: (found) => found.email })

    const signIn = yield* client.execute(
      HttpClientRequest.post(`${url}/api/auth/sign-in/email`).pipe(
        HttpClientRequest.setHeader("origin", url),
        HttpClientRequest.bodyJsonUnsafe({ email, password: offer.features.testAccounts.password })
      )
    )
    const cookie = O.flatMap(Headers.get(signIn.headers, "set-cookie"), (header) => A.head(Str.split(";")(header)))
    assertSome(O.map(cookie, () => true), true)
    const sent = O.match(cookie, { onNone: () => "", onSome: (value) => value })

    const session = yield* client.execute(
      HttpClientRequest.get(`${url}/api/v1/identity/session`).pipe(HttpClientRequest.setHeader("cookie", sent))
    )
    const sessionBody = yield* session.json
    const ready = yield* S.decodeUnknownEffect(Ready)(sessionBody)
    deepStrictEqual(ready.status, "ready")

    const status = yield* client.execute(
      HttpClientRequest.get(`${url}/api/v1/system/status`).pipe(HttpClientRequest.setHeader("cookie", sent))
    )
    deepStrictEqual(status.status, 200)
  }),
  { timeout: 120_000 }
)
