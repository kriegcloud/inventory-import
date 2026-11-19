import { expect, it, layer } from "@effect/vitest"
import { Array as Arr, Effect, Option, Record as Rec, String as Str } from "effect"
import * as S from "effect/Schema"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Ai } from "../../src/server/Ai.ts"
import { safeRedirectPath } from "../../src/server/security.ts"
import { inMemoryApp, send, TestFetch } from "./support/app.ts"

// What the Worker sends back over HTTP, through the same `fetch` it exports: headers, the cross-origin policy, the
// cross-site write check, request validation and the OpenAPI document. Storage is in memory; nothing here needs SQL.

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "admin",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const App = TestFetch.layer(inMemoryApp({ member: dana, ai: Ai.layerFor({ routes: [], model: "test/model" }) }))

// The parts of the OpenAPI document the document's own corrections (src/api/v1/Document.ts) change.
const Operation = S.Struct({
  responses: S.Record(S.String, S.Unknown),
  security: S.Array(S.Record(S.String, S.Array(S.String)))
})
const OpenApiDocument = S.Struct({
  paths: S.Record(S.String, S.Record(S.String, Operation)),
  components: S.Struct({
    schemas: S.Record(S.String, S.Unknown),
    securitySchemes: S.Record(S.String, S.Unknown)
  })
})

const ProblemDocument = S.Struct({
  errors: S.Array(S.Struct({ path: S.Array(S.Union([S.String, S.Int])), message: S.String }))
})

// A request to the table assistant: a POST any member may send, so it stands for every write in these tests.
const view = (prompt: string) => ({
  prompt,
  table: "Items",
  columns: [{ id: "name", label: "Name", type: "text", sortable: true, hideable: false, operators: [], values: [] }],
  searchable: false
})

layer(App)("the API over HTTP", (it) => {
  it.effect("grants no other origin access, and every answer carries the security headers", () =>
    Effect.gen(function* () {
      // Another site, and another app on this machine (a localhost origin), get no CORS grant.
      for (const origin of ["https://elsewhere.example", "http://localhost:5999"]) {
        const read = yield* send({ path: "/api/v1/system/status", headers: { origin } })
        expect(read.status).toBe(200)
        expect(read.headers.get("access-control-allow-origin")).toBeNull()
        const preflight = yield* send({
          path: "/api/v1/assistant/view",
          method: "OPTIONS",
          headers: { origin, "access-control-request-method": "POST" }
        })
        expect(preflight.headers.get("access-control-allow-origin")).toBeNull()
      }
      const missing = yield* send({ path: "/api/v1/no-such-thing" })
      for (const answer of [yield* send({ path: "/api/v1/system/status" }), missing]) {
        expect(Rec.fromEntries(answer.headers)).toMatchObject({
          "cache-control": "no-store",
          "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
          "cross-origin-embedder-policy": "require-corp",
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-resource-policy": "same-origin",
          "referrer-policy": "no-referrer",
          "strict-transport-security": "max-age=63072000; includeSubDomains",
          "x-content-type-options": "nosniff",
          "x-frame-options": "DENY"
        })
      }
      expect(missing.status).toBe(404)
    })
  )

  it.effect("refuses a write another site asked for before it acts as anyone, and takes the app's own", () =>
    Effect.gen(function* () {
      const write = (headers: Record<string, string>) =>
        send({ path: "/api/v1/assistant/view", body: view("sort by name"), headers })
      const crossSite = yield* write({ "sec-fetch-site": "cross-site", origin: "https://elsewhere.example" })
      expect(crossSite.status).toBe(403)
      expect(crossSite.json).toMatchObject({ _tag: "CrossSiteRequest" })
      const sibling = yield* write({ "sec-fetch-site": "same-site" })
      expect(sibling.status).toBe(403)
      const oldBrowser = yield* write({ origin: "https://elsewhere.example" })
      expect(oldBrowser.status).toBe(403)
      expect((yield* write({ "sec-fetch-site": "same-origin" })).status).toBe(200)
      expect((yield* write({ origin: "http://localhost:5320" })).status).toBe(200)
      // Reading is never refused: no other origin can see the answer anyway.
      const read = yield* send({ path: "/api/v1/activity", headers: { "sec-fetch-site": "cross-site" } })
      expect(read.status).toBe(200)
    })
  )

  it.effect("lists every problem in a request at once, with the message written for a missing field", () =>
    Effect.gen(function* () {
      const twoWrong = yield* send({
        path: "/api/v1/assistant/view",
        body: { ...view("  "), table: Str.repeat(41)("x") }
      })
      expect(twoWrong.status).toBe(400)
      const problem = yield* S.decodeUnknownEffect(ProblemDocument)(twoWrong.json)
      expect(Arr.map(problem.errors, (issue) => issue.path)).toEqual([
        ["payload", "prompt"],
        ["payload", "table"]
      ])
      const missing = yield* send({ path: "/api/v1/assistant/view", body: { ...view("x"), prompt: undefined } })
      const absent = yield* S.decodeUnknownEffect(ProblemDocument)(missing.json)
      expect(Arr.map(absent.errors, (issue) => issue.message)).toEqual(["Type what you want to see in the table."])
    })
  )

  it.effect("serves the OpenAPI document with the descriptions written on the schemas, and no reference page", () =>
    Effect.gen(function* () {
      const document = yield* send({ path: "/api/v1/openapi.json" })
      expect(document.status).toBe(200)
      expect(document.json).toMatchObject({ info: { title: "Items API", version: "1.0.0" } })
      // A schema description, a field description and a key description each reach the document.
      expect(document.text).toContain("An item as stored for one organization")
      expect(document.text).toContain("Data rows the pieces will carry in all")
      expect(document.text).toContain("The file column's position, from 0, that fills the field; null for none")
      expect(document.text).toContain("True when trying again later may work")
      // The session cookie is the one scheme, required wherever a 401 can come back, and the session answer is open.
      const spec = yield* S.decodeUnknownEffect(OpenApiDocument)(document.json)
      expect(Rec.keys(spec.components.securitySchemes)).toEqual(["sessionCookie"])
      const operations = Arr.flatMap(Rec.values(spec.paths), (item) => Rec.toEntries(item))
      for (const [, operation] of operations) {
        expect(operation.security).toEqual(Rec.has(operation.responses, "401") ? [{ sessionCookie: [] }] : [])
      }
      expect(Rec.get(spec.paths, "/api/v1/identity/session")).toEqual(
        Option.some({ get: expect.objectContaining({ security: [] }) })
      )
      // A read is never refused as cross-site, so no GET lists that 403; and no component keeps Effect's suffix.
      for (const [method, operation] of operations) {
        if (method === "get") expect(Rec.has(operation.responses, "403")).toBe(false)
      }
      expect(Arr.filter(Rec.keys(spec.components.schemas), Str.endsWith("Encoded"))).toEqual([])
      expect((yield* send({ path: "/api/v1/docs" })).status).toBe(404)
    })
  )
})

it("sends a person back only to a path on this site", () => {
  expect(safeRedirectPath("/imports/42?tab=review#row-3")).toEqual(Option.some("/imports/42?tab=review#row-3"))
  expect(safeRedirectPath("https://elsewhere.example/")).toEqual(Option.none())
  expect(safeRedirectPath("//elsewhere.example/")).toEqual(Option.none())
  expect(safeRedirectPath("/\\elsewhere.example/")).toEqual(Option.none())
  expect(safeRedirectPath("javascript:alert(1)")).toEqual(Option.none())
  expect(safeRedirectPath("imports")).toEqual(Option.none())
})
