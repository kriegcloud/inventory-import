import { expect, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Formatter from "effect/Formatter"
import * as Layer from "effect/Layer"
import * as Tracer from "effect/Tracer"
import * as HttpApiTest from "effect/http-api/HttpApiTest"
import { Api } from "../../src/api/v1/Api.ts"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { ModelId } from "@beep/openrouter/OpenRouterModel"
import { OpenRouterTest } from "@beep/openrouter/OpenRouterTest"
import { inMemoryHandlers } from "./support/app.ts"

// Every service call is a span named Service.method, and inside a request each carries the organization's and the
// actor's ids (never a name), so a trace says whose request it was without personal data in the telemetry.

const tom = Member.make({
  id: MemberId.make("mem_tom"),
  name: "Tom Becker",
  role: "editor",
  organizationId: OrganizationId.make("org_northline"),
  organizationName: "Sample Supply Co. (test)"
})

const ended: Array<Tracer.NativeSpan> = []
const Recording = Layer.succeed(
  Tracer.Tracer,
  Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options)
      ended.push(span)
      return span
    }
  })
)

layer(
  inMemoryHandlers({ member: tom, ai: OpenRouterTest.off("noKey", ModelId.make("test/model")) }).pipe(
    Layer.provideMerge(Recording)
  )
)("service spans", (it) => {
  it.effect("are named for the service and method, and carry the tenant and actor ids, not the name", () =>
    Effect.gen(function* () {
      const client = yield* HttpApiTest.groups(Api, ["activity", "assistant", "system"])
      yield* client.activity.recent()
      yield* client.assistant.view({
        payload: {
          prompt: "sort by name",
          table: "Items",
          columns: [
            { id: "name", label: "Name", type: "text", sortable: true, hideable: false, operators: [], values: [] }
          ],
          searchable: false
        }
      })
      yield* client.system.status()
      // `Members.findById` is the identity lookup itself: it runs before there is an actor to name.
      const services = A.filter(ended, (span) => /^(Activities|TableAssistant|Ai)\./.test(span.name))
      expect(A.map(services, (span) => span.name)).toEqual([
        "Activities.recent",
        "TableAssistant.view",
        "Activities.count"
      ])
      for (const span of services) {
        expect(span.attributes.get("organization.id")).toBe("org_northline")
        expect(span.attributes.get("actor.id")).toBe("mem_tom")
        expect(Formatter.format([...span.attributes.values()])).not.toContain("Tom Becker")
      }
    })
  )
})
