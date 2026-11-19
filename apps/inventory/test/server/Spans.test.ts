import { expect, layer } from "@effect/vitest"
import { Array as Arr, Effect, Formatter, Layer, Tracer } from "effect"
import { HttpApiTest } from "effect/http-api"
import { Api } from "../../src/api/v1/Api.ts"
import { MemberId, OrganizationId } from "@inventory/kernel/Ids"
import { Member } from "@inventory/kernel/Member"
import { Ai } from "../../src/server/Ai.ts"
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
  inMemoryHandlers({ member: tom, ai: Ai.layerFor({ routes: [], model: "test/model" }) }).pipe(
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
      const services = Arr.filter(ended, (span) => /^(Activities|TableAssistant|Ai)\./.test(span.name))
      expect(Arr.map(services, (span) => span.name)).toEqual([
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
