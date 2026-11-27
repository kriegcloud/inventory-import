// `infra plan-check`: the guard the deploy workflow runs between a stage's plan and its deploy. The lines below are
// the ones Alchemy's plain renderer printed (`formatPlanLines`, then `prettyLine`) at the commit `vendor/alchemy`
// keeps, plain and with a terminal's colours: copied from a run of that function, not written from its source.
// Not seen: a plan of a real stage. No account is reached here.
import * as NodeServices from "@effect/platform-node/NodeServices"
import { describe, expect, it, layer } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Str from "effect/String"
import * as Digest from "effect/crypto/Digest"
import {
  databaseResource,
  planCheck,
  planFinding,
  PlanFinding,
  planSentence
} from "../src/commands/Infra/PlanCheck.rules.ts"
import { Repo } from "../src/Repo.service.ts"
import { render } from "../src/Report.schema.ts"
import { inTree } from "./support/tree.ts"

const here = Repo.layer().pipe(Layer.provide(Digest.layerWebCrypto), Layer.provide(NodeServices.layer))

const printed = (...lines: ReadonlyArray<string>) =>
  A.join(
    A.map(lines, (line) => `[18:00:00.000] INFO: ${line}`),
    "\n"
  )

const unchanged = printed("Plan: no changes", "[Database] noop", "[SignInSecret] noop", "[Website] noop")
const update = printed("Plan: 1 to update", "[Database] noop", "[SignInSecret] noop", "[Website] update")
const first = printed("Plan: 3 to create", "[Database] create", "[SignInSecret] create", "[Website] create")
const replaced = printed("Plan: 1 to update, 1 to replace", "[Database] replace", "[Website] update")
const deleted = printed("Plan: 1 to delete", "[Database] delete", "[Website] noop")
const orphaned = printed("Plan: 1 to orphaned", "[Database] orphaned", "[Website] noop")
// As a terminal that takes colours gets it.
const coloured =
  "\u001b[33m[18:00:00.000]\u001b[39m \u001b[33mINFO\u001b[39m: \u001b[1mPlan:\u001b[22m \u001b[37m1 to replace\u001b[39m\n" +
  "\u001b[33m[18:00:00.000]\u001b[39m \u001b[33mINFO\u001b[39m: \u001b[33m[Database]\u001b[39m \u001b[37mreplace\u001b[39m"

describe("a printed plan", () => {
  it("keeps the rows when the database is made, changed in place or left alone", () => {
    expect(A.map([unchanged, update, first], planFinding)).toEqual([
      PlanFinding.cases.Keeps.make({ resources: 3 }),
      PlanFinding.cases.Keeps.make({ resources: 3 }),
      PlanFinding.cases.Keeps.make({ resources: 3 })
    ])
    expect(planFinding(printed("Plan: no resources"))).toEqual(PlanFinding.cases.Keeps.make({ resources: 0 }))
  })

  it("is refused when the database is replaced, deleted or dropped from the state, in colour too", () => {
    expect(A.map([replaced, deleted, orphaned, coloured], planFinding)).toEqual([
      PlanFinding.cases.LosesDatabase.make({ action: "replace" }),
      PlanFinding.cases.LosesDatabase.make({ action: "delete" }),
      PlanFinding.cases.LosesDatabase.make({ action: "orphaned" }),
      PlanFinding.cases.LosesDatabase.make({ action: "replace" })
    ])
  })

  it("another resource deleted or replaced is not the database's loss", () => {
    expect(
      planFinding(
        printed("Plan: 1 to replace, 1 to delete", "[Database] noop", "[Website] replace", "[Website/Old] delete")
      )
    ).toEqual(PlanFinding.cases.Keeps.make({ resources: 3 }))
    // A resource under another whose own name is the database's is not the app's database.
    expect(planFinding(printed("Plan: 1 to delete", "[Other/Database] delete", "[Database] noop"))).toEqual(
      PlanFinding.cases.Keeps.make({ resources: 2 })
    )
  })

  it("is refused when it is no plan: a command that failed, nothing at all, or changes with no resource named", () => {
    expect(A.map(["", "error: the state store was not found", printed("Plan: 1 to replace")], planFinding)).toEqual([
      PlanFinding.cases.Unreadable.make({ why: 'no line says "Plan:"' }),
      PlanFinding.cases.Unreadable.make({ why: 'no line says "Plan:"' }),
      PlanFinding.cases.Unreadable.make({ why: "the plan names no resource" })
    ])
  })

  it("fails the command on a loss and on an unreadable plan, and passes one that keeps the rows", () => {
    const failed = (text: string) => render(planSentence)([planFinding(text)]).failed
    expect(A.map([unchanged, update, first, replaced, deleted, orphaned, ""], failed)).toEqual([
      false,
      false,
      false,
      true,
      true,
      true,
      true
    ])
  })

  it.effect("reads the plan from the file the workflow wrote it to", () =>
    inTree(
      { "plan.txt": replaced },
      Effect.map(planCheck("plan.txt"), (findings) =>
        expect(findings).toEqual([PlanFinding.cases.LosesDatabase.make({ action: "replace" })])
      )
    )
  )
})

layer(here)("the database the guard names", (it) => {
  it.effect("is the stack's own name for it", () =>
    Effect.gen(function* () {
      const repo = yield* Repo
      const stack = yield* repo.text(repo.join(repo.root, "packages/infra/src/Inventory.stack.ts"))
      expect(Str.includes(`Cloudflare.D1.Database("${databaseResource}"`)(stack)).toBe(true)
    })
  )
})
