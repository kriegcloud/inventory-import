import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Order from "effect/Order"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import { AnsweredBy } from "@inventory/catalog-contract/Answer"
import { ViewOutcome } from "@inventory/catalog-contract/TableView"
import { CrossSiteRequest, Forbidden, NotSignedIn } from "@inventory/kernel/AccessError"
import { signIn } from "@inventory/access-host/SignIn"
import { testAccountPassword } from "@inventory/access-host/TestAccounts"
import { D1Binding } from "@beep/d1/D1"
import { browser, settingsLayer, signInApp, TestDatabase, testSettings } from "./support/app.ts"

// Sign-in end to end: real requests through the Worker's own composition (`makeApp`, the session identity, Better
// Auth's routes beside the HttpApi) on a real D1 database in workerd, with the migrations and the local test accounts
// applied. Nothing is stubbed. Better Auth's own origin check is on here too (`disableOriginCheck: false`), where it
// would otherwise skip itself under test.

const password = testAccountPassword

// A write any editor may make and a viewer may not: the start of an upload, as the upload screen sends it.
const head = (fileName: string) => ({
  fileName,
  kind: "csv",
  sheet: null,
  headerRowNumber: 1,
  columns: [{ index: 0, letter: "A", label: "Code" }],
  notes: []
})
const begin = (fileName: string) => ({ key: `key-${fileName}`, head: head(fileName), rowCount: 1, chunkCount: 1 })

// Starting workerd through the platform proxy took 8.8 to 10.2 s on a busy machine: past Vitest's 10 s hook default.
layer(signInApp(), { timeout: "60 seconds" })("sign-in with Better Auth", (it) => {
  it.effect("signs up a new person, who then creates an organization and is its admin", () =>
    Effect.gen(function* () {
      const ada = browser("10.0.0.1")
      const signUp = yield* ada.send("POST", "/api/auth/sign-up/email", {
        name: "Ada Park",
        email: "ada@example.test",
        password: "a long enough password"
      })
      expect(signUp.status).toBe(200)
      expect(signUp.setCookie).toContain("HttpOnly")
      expect(signUp.setCookie).toContain("SameSite=Lax")

      const before = yield* ada.send("GET", "/api/v1/identity/me")
      expect(before.status).toBe(401)
      expect(before.json.reason).toBe("You are signed in but not part of an organization yet.")
      expect((yield* ada.send("GET", "/api/v1/identity/session")).json).toMatchObject({
        status: "no-organization",
        email: "ada@example.test",
        organizations: []
      })

      const created = yield* ada.send("POST", "/api/auth/organization/create", { name: "Ada Works", slug: "ada-works" })
      expect(created.status).toBe(200)
      const me = yield* ada.send("GET", "/api/v1/identity/me")
      expect(me.json).toMatchObject({ name: "Ada Park", role: "admin", organizationName: "Ada Works" })
      // The membership Better Auth wrote reads back as a person: its `createdAt` decodes as an instant.
      const people = yield* ada.send("GET", "/api/v1/people")
      expect(people.status).toBe(200)
      expect(people.json).toMatchObject([{ name: "Ada Park", email: "ada@example.test", role: "admin" }])
      expect(Number.isNaN(Date.parse(people.json[0].joinedAt))).toBe(false)
    })
  )

  it.effect("refuses a short password and a second account for the same email", () =>
    Effect.gen(function* () {
      const someone = browser("10.0.0.2")
      const short = yield* someone.send("POST", "/api/auth/sign-up/email", {
        name: "Short",
        email: "short@example.test",
        password: "too-short"
      })
      expect(short.status).toBe(400)
      const taken = yield* someone.send("POST", "/api/auth/sign-up/email", {
        name: "Again",
        email: "priya@example-works.test",
        password: "a long enough password"
      })
      expect(taken.status).toBe(422)
    })
  )

  it.effect("answers the session once for the page: nobody, with the test accounts offered", () =>
    Effect.gen(function* () {
      const stranger = browser("10.0.0.20")
      const state = yield* stranger.send("GET", "/api/v1/identity/session")
      expect(state.status).toBe(200)
      expect(state.json).toMatchObject({ status: "signed-out", features: { pwnedPasswordCheck: false } })
      // Nobody is signed in: the answer has no email, actor or organizations to be null or empty.
      expect(A.sort(R.keys(state.json), Order.String)).toEqual(["features", "status"])
      expect(state.json.features.testAccounts.password).toBe(password)
      // Two organizations and all three roles, read from the database, in the order the page lists them.
      expect(state.json.features.testAccounts.accounts).toEqual([
        {
          email: "dana@example-works.test",
          name: "Dana Whitfield",
          memberships: [
            { organizationName: "Example Works (test)", role: "admin" },
            { organizationName: "Sample Supply Co. (test)", role: "viewer" }
          ]
        },
        {
          email: "marcus@example-works.test",
          name: "Marcus Oyelaran",
          memberships: [{ organizationName: "Example Works (test)", role: "editor" }]
        },
        {
          email: "priya@example-works.test",
          name: "Priya Raman",
          memberships: [{ organizationName: "Example Works (test)", role: "viewer" }]
        },
        {
          email: "elena@sample-supply.test",
          name: "Elena Sokolova",
          memberships: [{ organizationName: "Sample Supply Co. (test)", role: "admin" }]
        },
        {
          email: "tom@sample-supply.test",
          name: "Tom Becker",
          memberships: [{ organizationName: "Sample Supply Co. (test)", role: "editor" }]
        }
      ])
    })
  )

  it.effect("signs in a seeded person, whose session resolves to their member, organization and role", () =>
    Effect.gen(function* () {
      const priya = browser("10.0.0.3")
      const wrong = yield* priya.send("POST", "/api/auth/sign-in/email", {
        email: "priya@example-works.test",
        password: "not the password"
      })
      expect(wrong.status).toBe(401)
      expect(priya.cookie()).toBe("")

      expect((yield* priya.signIn("priya@example-works.test")).status).toBe(200)
      const me = yield* priya.send("GET", "/api/v1/identity/me")
      expect(me.json).toEqual({
        id: "mem_priya",
        name: "Priya Raman",
        role: "viewer",
        organizationId: "org_prairie",
        organizationName: "Example Works (test)"
      })
      expect((yield* priya.send("GET", "/api/v1/identity/session")).json).toMatchObject({
        status: "ready",
        email: "priya@example-works.test",
        actor: { id: "mem_priya" },
        organizations: [{ id: "org_prairie", name: "Example Works (test)" }]
      })
    })
  )

  it.effect("refuses a viewer every write and the model check, and an editor an admin action, on the server", () =>
    Effect.gen(function* () {
      const priya = browser("10.0.0.4")
      yield* priya.signIn("priya@example-works.test")
      const write = yield* priya.send("POST", "/api/v1/imports/uploads", begin("priya.csv"))
      expect(write.status).toBe(403)
      const writeRefused = yield* S.decodeUnknownEffect(Forbidden)(write.json)
      expect(writeRefused.required).toBe("editor")
      // The model check spends the key: the same rule as a write.
      const spend = yield* priya.send("POST", "/api/v1/system/ai-check")
      expect(spend.status).toBe(403)
      const spendRefused = yield* S.decodeUnknownEffect(Forbidden)(spend.json)
      expect(spendRefused.required).toBe("editor")
      const role = yield* priya.send("POST", "/api/v1/people/mem_priya/role", { role: "admin" })
      expect(role.status).toBe(403)

      // An editor may write, but may not make themselves an admin: the organization plugin refuses it.
      const marcus = browser("10.0.0.5")
      yield* marcus.signIn("marcus@example-works.test")
      expect((yield* marcus.send("POST", "/api/v1/imports/uploads", begin("marcus.csv"))).status).toBe(200)
      const promote = yield* marcus.send("POST", "/api/auth/organization/update-member-role", {
        memberId: "mem_marcus",
        role: "admin"
      })
      expect(promote.status).toBe(403)
      expect((yield* marcus.send("GET", "/api/v1/identity/me")).json.role).toBe("editor")
    })
  )

  it.effect("keeps one organization's people and data from another's", () =>
    Effect.gen(function* () {
      const dana = browser("10.0.0.6")
      yield* dana.signIn("dana@example-works.test")
      const begun = yield* dana.send("POST", "/api/v1/imports/uploads", begin("example-works-only.csv"))
      const id = begun.json.success.id
      yield* dana.send("PUT", `/api/v1/imports/uploads/${id}/chunks`, {
        seq: 0,
        rows: [{ rowNumber: 2, cells: [{ text: "X-1" }] }]
      })
      expect((yield* dana.send("POST", `/api/v1/imports/uploads/${id}/finish`)).status).toBe(200)
      expect((yield* dana.send("GET", "/api/v1/activity")).json).toContainEqual(
        expect.objectContaining({
          action: "Uploaded a file",
          detail: expect.stringContaining("example-works-only.csv")
        })
      )

      const tom = browser("10.0.0.7")
      yield* tom.signIn("tom@sample-supply.test")
      const recent = yield* tom.send("GET", "/api/v1/activity")
      expect(recent.json).not.toContainEqual(expect.objectContaining({ action: "Uploaded a file" }))
      expect((yield* tom.send("GET", "/api/v1/imports/open")).json).toMatchObject({ views: [], older: 0 })
      expect((yield* tom.send("GET", `/api/v1/imports/${id}`)).status).toBe(404)
      const people = yield* tom.send("GET", "/api/v1/identity/members")
      expect(people.json).toMatchObject([
        { organizationId: "org_northline" },
        { organizationId: "org_northline" },
        { organizationId: "org_northline" }
      ])

      // Choosing another organization is checked on the server: Tom is not a member of Example Works. (Better Auth also
      // clears his active organization; he then acts in his earliest one, still Sample Supply.)
      const switched = yield* tom.send("POST", "/api/auth/organization/set-active", { organizationId: "org_prairie" })
      expect(switched.status).toBe(403)
      expect((yield* tom.send("GET", "/api/v1/identity/me")).json.organizationId).toBe("org_northline")
      expect((yield* tom.send("GET", "/api/v1/activity")).json).not.toContainEqual(
        expect.objectContaining({ action: "Uploaded a file" })
      )

      // A header naming another member changes nothing: only the session decides who acts.
      const spoof = yield* tom.send("GET", "/api/v1/identity/me", undefined, { "x-acting-as": "mem_dana" })
      expect(spoof.json.id).toBe("mem_tom")
    })
  )

  it.effect("switches a person in two organizations, with the role they have in each", () =>
    Effect.gen(function* () {
      const dana = browser("10.0.0.8")
      yield* dana.signIn("dana@example-works.test")
      expect((yield* dana.send("GET", "/api/v1/identity/me")).json).toMatchObject({
        role: "admin",
        organizationId: "org_prairie"
      })
      expect(
        (yield* dana.send("POST", "/api/auth/organization/set-active", { organizationId: "org_northline" })).status
      ).toBe(200)
      expect((yield* dana.send("GET", "/api/v1/identity/session")).json).toMatchObject({
        status: "ready",
        actor: { role: "viewer", organizationId: "org_northline" },
        organizations: [
          { id: "org_prairie", name: "Example Works (test)" },
          { id: "org_northline", name: "Sample Supply Co. (test)" }
        ]
      })
      expect((yield* dana.send("POST", "/api/v1/imports/uploads", begin("dana-sample-supply.csv"))).status).toBe(403)
    })
  )

  it.effect("refuses what a page sends for its member once somebody else is signed in in the same browser", () =>
    Effect.gen(function* () {
      const tabs = browser("10.0.0.22")
      yield* tabs.signIn("dana@example-works.test")
      const dana = { "x-page-member": "mem_dana/org_prairie" }
      expect((yield* tabs.send("GET", "/api/v1/identity/me", undefined, dana)).json.id).toBe("mem_dana")
      // Marcus signs in in another tab: the browser's one cookie is his now.
      yield* tabs.signIn("marcus@example-works.test")
      const write = yield* tabs.send("POST", "/api/v1/imports/uploads", begin("pressed-by-dana.csv"), dana)
      const read = yield* tabs.send("GET", "/api/v1/imports/open", undefined, dana)
      expect([write.status, read.status]).toEqual([401, 401])
      const refused = yield* S.decodeUnknownEffect(NotSignedIn)(write.json)
      expect(refused.reason).toBe("This page was opened for somebody else than is signed in now. Load the page again.")
      // Nothing of hers was made as him, and his own page is served as before.
      const his = { "x-page-member": "mem_marcus/org_prairie" }
      expect((yield* tabs.send("GET", "/api/v1/activity", undefined, his)).json).not.toContainEqual(
        expect.objectContaining({ detail: expect.stringContaining("pressed-by-dana.csv") })
      )
      expect((yield* tabs.send("GET", "/api/v1/identity/me")).json.id).toBe("mem_marcus")
      // Dana's own switch of organization: her page for the organization she left is refused there too.
      const again = browser("10.0.0.23")
      yield* again.signIn("dana@example-works.test")
      yield* again.send("POST", "/api/auth/organization/set-active", { organizationId: "org_northline" })
      expect((yield* again.send("GET", "/api/v1/imports/open", undefined, dana)).status).toBe(401)
    })
  )

  it.effect("refuses a rename through Better Auth's update-user, so a name cannot change under a decision", () =>
    Effect.gen(function* () {
      const dana = browser("10.0.0.21")
      yield* dana.signIn("dana@example-works.test")
      const before = yield* dana.send("GET", "/api/v1/identity/me")
      expect((yield* dana.send("POST", "/api/auth/update-user", { name: "Someone Else" })).status).toBe(404)
      expect((yield* dana.send("GET", "/api/v1/identity/me")).json).toEqual(before.json)
    })
  )

  it.effect("signs out, and the session ends at once: the old cookie no longer works anywhere", () =>
    Effect.gen(function* () {
      const elena = browser("10.0.0.9")
      yield* elena.signIn("elena@sample-supply.test")
      const cookie = elena.cookie()
      expect((yield* elena.send("POST", "/api/auth/sign-out", {})).status).toBe(200)
      // Another tab still holds the old cookie: its next request is refused (no cookie cache keeps it alive).
      const otherTab = browser("10.0.0.9")
      const replay = yield* otherTab.send("GET", "/api/v1/identity/me", undefined, { cookie })
      expect(replay.status).toBe(401)
    })
  )

  it.effect("answers a request with no session with the typed 401, whatever header it sends", () =>
    Effect.gen(function* () {
      const stranger = browser("10.0.0.10")
      const me = yield* stranger.send("GET", "/api/v1/identity/me", undefined, { "x-acting-as": "mem_dana" })
      expect(me.status).toBe(401)
      const notSignedIn = yield* S.encodeEffect(S.toCodecJson(NotSignedIn))(
        NotSignedIn.make({ reason: "Sign in to continue." })
      )
      expect(me.json).toEqual(notSignedIn)
      expect((yield* stranger.send("GET", "/api/v1/identity/members")).status).toBe(401)
      expect((yield* stranger.send("POST", "/api/v1/imports/uploads", begin("stranger.csv"))).status).toBe(401)
    })
  )

  it.effect("answers the table assistant for any signed-in member, by the rules with no key, writing nothing", () =>
    Effect.gen(function* () {
      const priya = browser("10.0.0.14")
      yield* priya.signIn("priya@example-works.test")
      const before = (yield* priya.send("GET", "/api/v1/activity")).json.length
      const view = yield* priya.send("POST", "/api/v1/assistant/view", {
        prompt: "sort by name",
        table: "Items",
        columns: [
          { id: "name", label: "Name", type: "text", sortable: true, hideable: false, operators: [], values: [] }
        ],
        searchable: false
      })
      expect(view.status).toBe(200)
      const answer = yield* S.decodeUnknownEffect(S.toCodecJson(ViewOutcome))(view.json).pipe(
        Effect.flatMap(Effect.fromResult)
      )
      expect(AnsweredBy.guards.Rules(answer.answeredBy)).toBe(true)
      expect(answer.changes).toMatchObject([{ kind: "sort", column: "name", direction: "asc" }])
      expect((yield* priya.send("GET", "/api/v1/activity")).json.length).toBe(before)
    })
  )

  it.effect("refuses sign-in and sign-out sent from another site, and a foreign callback address", () =>
    Effect.gen(function* () {
      // Our check, before Better Auth's: a sign-in the browser says came from another site.
      const elsewhere = browser("10.0.0.15")
      const crossSite = yield* elsewhere.send(
        "POST",
        "/api/auth/sign-in/email",
        { email: "dana@example-works.test", password },
        { origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" }
      )
      expect(crossSite.status).toBe(403)
      // The answer is the typed refusal: it decodes as one, or the test stops here.
      yield* S.decodeUnknownEffect(CrossSiteRequest)(crossSite.json)
      expect(elsewhere.cookie()).toBe("")
      // Better Auth's own checks, on under test: a callback to another origin is refused...
      const callback = yield* browser("10.0.0.16").send("POST", "/api/auth/sign-in/email", {
        email: "dana@example-works.test",
        password,
        callbackURL: "https://elsewhere.example/after"
      })
      expect([callback.status, callback.json.code]).toEqual([403, "INVALID_CALLBACK_URL"])
      // ...and a request carrying the session cookie with no origin at all (a script, not our page) is refused too.
      const dana = browser("10.0.0.17")
      yield* dana.signIn("dana@example-works.test")
      const bare = yield* dana.send("POST", "/api/auth/sign-out", {}, { origin: "", "sec-fetch-site": "" })
      expect([bare.status, bare.json.code]).toEqual([403, "MISSING_OR_NULL_ORIGIN"])
      // A write to the app's own API carrying a valid cookie, from another site: refused before identity.
      const write = yield* dana.send("POST", "/api/v1/imports/uploads", begin("forged.csv"), {
        origin: "https://elsewhere.example",
        "sec-fetch-site": "cross-site"
      })
      expect(write.status).toBe(403)
      yield* S.decodeUnknownEffect(CrossSiteRequest)(write.json)
    })
  )

  it.effect("limits sign-in attempts from one address to 10 a minute", () =>
    Effect.gen(function* () {
      const guesser = browser("10.0.0.11")
      const statuses: Array<number> = []
      for (let attempt = 0; attempt < 11; attempt++) {
        const answer = yield* guesser.send("POST", "/api/auth/sign-in/email", {
          email: "dana@example-works.test",
          password: `guess number ${attempt}`
        })
        statuses.push(answer.status)
      }
      expect(A.every(A.take(statuses, 10), (status) => status === 401)).toBe(true)
      expect(statuses[10]).toBe(429)
      // Another address is not affected.
      expect((yield* browser("10.0.0.12").signIn("dana@example-works.test")).status).toBe(200)
    })
  )
})

layer(signInApp({ production: true }), { timeout: "60 seconds" })("a production build", (it) => {
  it.effect("sets Secure, __Secure- prefixed, HttpOnly cookies and offers no test accounts", () =>
    Effect.gen(function* () {
      const marcus = browser("10.1.0.1")
      const signIn = yield* marcus.signIn("marcus@example-works.test")
      expect(signIn.status).toBe(200)
      expect(signIn.setCookie).toMatch(/^__Secure-inventory\.session_token=/)
      expect(signIn.setCookie).toContain("Secure")
      expect(signIn.setCookie).toContain("HttpOnly")
      expect(signIn.setCookie).toContain("SameSite=Lax")
      const state = yield* browser("10.1.0.2").send("GET", "/api/v1/identity/session")
      expect(state.json.features).toEqual({ testAccounts: null, pwnedPasswordCheck: false, signUp: "closed" })
    })
  )
})

layer(settingsLayer({ ...testSettings, BETTER_AUTH_SECRET: "" }), { timeout: "60 seconds" })(
  "without BETTER_AUTH_SECRET",
  (it) => {
    it.effect("a production build refuses to start, and says how to set one", () =>
      Effect.gen(function* () {
        const started = yield* Effect.gen(function* () {
          return signIn({ database: yield* D1Binding, production: true })
        }).pipe(Layer.unwrap, Layer.provide(TestDatabase), Layer.build, Effect.scoped, Effect.exit)
        expect(Exit.isFailure(started)).toBe(true)
        expect(String(Exit.isFailure(started) ? started.cause : "")).toContain(
          "BETTER_AUTH_SECRET is not set. Set it with `wrangler secret put BETTER_AUTH_SECRET`"
        )
      })
    )
  }
)

layer(signInApp({ settings: { BETTER_AUTH_URL: "https://app.example.test" } }), { timeout: "60 seconds" })(
  "with BETTER_AUTH_URL set",
  (it) => {
    it.effect("trusts that origin only, and its https makes the cookies Secure", () =>
      Effect.gen(function* () {
        const there = { origin: "https://app.example.test" }
        const dana = browser("10.2.0.1")
        const signIn = yield* dana.send(
          "POST",
          "/api/auth/sign-in/email",
          { email: "dana@example-works.test", password, callbackURL: "https://app.example.test/after" },
          there
        )
        expect(signIn.status).toBe(200)
        expect(signIn.setCookie).toMatch(/^__Secure-inventory\.session_token=.*; Secure/)
        // A callback to anywhere else, and a sign-out from the address the request reached (not the configured one).
        const elsewhere = yield* browser("10.2.0.2").send(
          "POST",
          "/api/auth/sign-in/email",
          { email: "dana@example-works.test", password, callbackURL: "https://elsewhere.example/after" },
          there
        )
        expect([elsewhere.status, elsewhere.json.code]).toEqual([403, "INVALID_CALLBACK_URL"])
        const fromHere = yield* dana.send("POST", "/api/auth/sign-out", {})
        expect([fromHere.status, fromHere.json.code]).toEqual([403, "INVALID_ORIGIN"])
        expect((yield* dana.send("POST", "/api/auth/sign-out", {}, there)).status).toBe(200)
      })
    )
  }
)
