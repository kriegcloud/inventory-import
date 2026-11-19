import { expect, layer } from "@effect/vitest"
import { Array as Arr, Effect, String as Str } from "effect"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Ai } from "../../src/server/Ai.ts"
import { inMemoryApp, send, TestFetch } from "./support/app.ts"

// The API reference page a development build serves at /api/v1/docs: Scalar, from the bundled script (no CDN), under
// a content security policy that allows exactly the page's two inline scripts by hash and nothing from elsewhere.
// That it renders without a policy violation was checked in a real browser (headless Chromium) on `bun run dev`.

const dana = Member.make({
  id: MemberId.make("mem_dana"),
  name: "Dana Whitfield",
  role: "admin",
  organizationId: OrganizationId.make("org_prairie"),
  organizationName: "Example Works (test)"
})

const sha256 = (text: string) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).pipe(
    Effect.map((digest) =>
      btoa(
        Arr.join(
          Arr.map(Arr.fromIterable(new Uint8Array(digest)), (byte) => String.fromCharCode(byte)),
          ""
        )
      )
    )
  )

layer(TestFetch.layer(inMemoryApp({ member: dana, ai: Ai.layerFor({ routes: [], model: "test/model" }), docs: true })))(
  "the API reference page",
  (it) => {
    it.effect("is served with a policy that allows its own two scripts by hash and nothing else", () =>
      Effect.gen(function* () {
        const page = yield* send({ path: "/api/v1/docs" })
        expect(page.status).toBe(200)
        expect(page.headers.get("content-type")).toContain("text/html")
        const scripts = Arr.map(
          Arr.fromIterable(Str.matchAll(/<script>([\s\S]*?)<\/script>/g)(page.text)),
          (match) => match[1] ?? ""
        )
        expect(scripts.length).toBe(2)
        const hashes = yield* Effect.forEach(scripts, sha256, { concurrency: 1 })
        const policy = page.headers.get("content-security-policy") ?? ""
        expect(policy).toContain(
          `script-src ${Arr.join(
            Arr.map(hashes, (hash) => `'sha256-${hash}'`),
            " "
          )};`
        )
        expect(policy).not.toContain("unsafe-eval")
        expect(policy).toContain("connect-src 'self'")
        // No source other than this origin: in the browser the page made no request elsewhere (checked headless).
        expect(policy).not.toMatch(/https?:/)
        // The rest of the API keeps its own policy.
        const status = yield* send({ path: "/api/v1/system/status" })
        expect(status.headers.get("content-security-policy")).toBe("default-src 'none'; frame-ancestors 'none'")
      })
    )
  }
)
