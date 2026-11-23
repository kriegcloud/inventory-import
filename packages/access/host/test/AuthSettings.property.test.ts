// The sign-in settings as the host reads them from its environment. A stage's password for its test accounts is
// never the one written in the repository, so that one opens nothing on a deployed stage; a blank one is none; and the
// public address is read only as an http(s) origin, all of it.
import { describe, expect, it } from "@effect/vitest"
import { authSettings } from "@inventory/access-host/Config"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"
import { passwordToVerify } from "@inventory/access-model/StagePassword"
import * as Arbitrary from "effect/Arbitrary"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as Str from "effect/String"

const runs = { arbitrary: { runs: 200 } }

/** A password a stage may be given: the repository's own, or any other text. */
const Given = S.Union([S.Literal(testAccountPassword), S.String])

/** The settings read from `values`, or why they cannot be. */
const read = (values: Readonly<Record<string, string>>, production: boolean) =>
  authSettings({ production }).parse(ConfigProvider.fromUnknown(values)).pipe(Effect.result)

/**
 * An address put together from its parts, each one a way an address can be more than an origin: a scheme that is not
 * the web's, a user and password, a path, a query, a fragment. The oracle below reads the parts, not the URL parser.
 */
const AddressParts = S.Struct({
  scheme: S.Literals(["http", "https", "file", "ftp", "ws"]),
  credentials: S.Literals(["", "user@", ":pass@", "user:pass@"]),
  host: S.Literals(["example.com", "localhost:5173", "inventory.example.workers.dev"]),
  path: S.Literals(["", "/", "/app", "/a/b"]),
  query: S.Literals(["", "?next=1"]),
  fragment: S.Literals(["", "#top"])
})
type AddressParts = typeof AddressParts.Type

/** The address as written. */
const written = (parts: AddressParts): string =>
  `${parts.scheme}://${parts.credentials}${parts.host}${parts.path}${parts.query}${parts.fragment}`

/** An origin on the web and nothing more: http or https, no user, and no path, query or fragment past the root. */
const onlyAnOrigin = (parts: AddressParts): boolean =>
  (parts.scheme === "http" || parts.scheme === "https") &&
  parts.credentials === "" &&
  (parts.path === "" || parts.path === "/") &&
  parts.query === "" &&
  parts.fragment === ""

/** What follows `data:` in a data address: a media type, then a comma and the data. */
const DataBody = S.String.check(S.isPattern(/^[a-z/;=]*,[A-Za-z0-9%.]*$/))

describe("the sign-in settings as read", () => {
  it.effect.prop(
    "a stage's password is read only when the repository's password opens nothing with it, and blank is none",
    [Arbitrary.schema(Given), Arbitrary.schema(S.Boolean)],
    ([given, production]) =>
      Effect.gen(function* () {
        const settings = yield* read({ TEST_ACCOUNT_PASSWORD: given }, production)
        expect(Result.isFailure(settings)).toBe(given === testAccountPassword)
        if (Result.isSuccess(settings)) {
          const stage = O.map(settings.success.testAccountPassword, Redacted.value)
          expect(O.isNone(stage)).toBe(Str.trim(given) === "")
          if (O.isSome(stage)) {
            const opened = passwordToVerify({ stage, repository: testAccountPassword, typed: testAccountPassword })
            expect(O.isNone(opened)).toBe(true)
          }
        }
      }),
    runs
  )

  it.effect.prop(
    "an address with another scheme, a user, a path, a query or a fragment is refused; an origin is read",
    [Arbitrary.schema(AddressParts), Arbitrary.schema(S.Boolean)],
    ([parts, production]) =>
      Effect.gen(function* () {
        const settings = yield* read({ BETTER_AUTH_URL: written(parts) }, production)
        expect(Result.isSuccess(settings)).toBe(onlyAnOrigin(parts))
      }),
    runs
  )

  it.effect.prop(
    "a data: address, whose origin is null, is refused",
    [Arbitrary.schema(DataBody), Arbitrary.schema(S.Boolean)],
    ([body, production]) =>
      Effect.gen(function* () {
        const settings = yield* read({ BETTER_AUTH_URL: `data:${body}` }, production)
        expect(Result.isFailure(settings)).toBe(true)
      }),
    runs
  )

  it.effect.prop(
    "a public address is read only when it is an http(s) origin and nothing more",
    [Arbitrary.schema(S.URL), Arbitrary.schema(S.Boolean)],
    ([url, production]) =>
      Effect.gen(function* () {
        const settings = yield* read({ BETTER_AUTH_URL: url.href }, production)
        const origin = /^https?:\/\/[^/?#@]+$/.test(url.origin) && url.href === `${url.origin}/`
        expect(Result.isSuccess(settings)).toBe(origin)
      }),
    runs
  )
})
