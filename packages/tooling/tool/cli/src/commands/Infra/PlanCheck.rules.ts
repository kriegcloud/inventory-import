/**
 * `infra plan-check <file>`: reads what `alchemy deploy --dry-run` printed for a stage and refuses a plan that would
 * leave the app on a database with none of its rows. The deploy workflow runs it between the plan and the deploy
 * (`goals/alchemy-uptake`, step 1).
 *
 * Must not break: a plan it cannot read is refused, never passed. A deploy that goes ahead because the printed plan
 * changed its shape is the failure this file exists to stop.
 *
 * The lines are Alchemy's plain renderer's (`Cli/LoggingCli.ts`, `formatPlanLines`): a summary that starts `Plan:`,
 * then one `[<resource>] <action>` for each resource, each behind a time and a level. The test holds them as that
 * function printed them at the commit `vendor/alchemy` keeps.
 *
 * @packageDocumentation
 */
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { err, type Line, out } from "../../Report.schema.ts"
import { Repo } from "../../Repo.service.ts"

const $I = $RepoCliId.create("commands/Infra/PlanCheck.rules")

/**
 * The stack's name for the app's one database (`Cloudflare.D1.Database("Database", ...)` in
 * `packages/infra/src/Inventory.stack.ts`). The test reads that file, so a rename there fails here.
 *
 * @category rules
 */
export const databaseResource = "Database"

/**
 * What a plan does to one resource, in Alchemy's words.
 *
 * @category schemas
 */
export const PlanAction = LiteralKit(["create", "update", "adopted", "replace", "delete", "orphaned", "noop"]).pipe(
  $I.annoteSchema("PlanAction", { description: "What a plan does to one resource, in Alchemy's words" })
)

/**
 * The three that end with the Worker on a database that holds nothing: `delete` removes it, `replace` makes a new
 * empty one in its place, and `orphaned` drops it from the state, so the next deploy makes a new empty one.
 */
const losesRows = S.is(PlanAction.pick(["replace", "delete", "orphaned"]))

/**
 * What reading a printed plan found.
 *
 * @category schemas
 */
export const PlanFinding = S.TaggedUnion({
  Keeps: {
    resources: S.Int.pipe(S.annotateKey({ description: "How many resources the plan names" }))
  },
  LosesDatabase: {
    action: PlanAction.pipe(S.annotateKey({ description: "What the plan does to the database" }))
  },
  Unreadable: {
    why: S.String.pipe(S.annotateKey({ description: "What the text lacks that a printed plan has" }))
  }
}).pipe($I.annoteSchema("PlanFinding", { description: "Whether a printed plan keeps the database's rows" }))

/**
 * The decoded value of `PlanFinding`.
 *
 * @category models
 */
export type PlanFinding = typeof PlanFinding.Type

/** A terminal's colour codes, which a log may carry. */
// oxlint-disable-next-line no-control-regex
const colourCodes = /\u001b\[[0-9;]*m/g

/** One resource's line: `[<resource>] <action>`, after the time and level a log line starts with. */
const resourceLine = /\[([^\]\s]+)\] (create|update|adopted|replace|delete|orphaned|noop)\b/

const decodeAction = S.decodeUnknownOption(PlanAction)

/** The resource and the action a line names, when it is a resource's line. */
const named = (line: string) =>
  pipe(
    Str.match(resourceLine)(line),
    O.flatMap((found) => O.all({ resource: O.fromUndefinedOr(found[1]), action: decodeAction(found[2]) }))
  )

/**
 * Reads a printed plan. No `Plan:` line is not a plan (the command failed, or its output changed); a plan that says
 * it changes something and names no resource is not one this can judge.
 *
 * @example
 * planFinding("[18:00:00.000] INFO: Plan: 1 to replace\n[18:00:00.000] INFO: [Database] replace")
 * // LosesDatabase { action: "replace" }
 *
 * @category rules
 */
export const planFinding = (printed: string): PlanFinding => {
  const lines = Str.split("\n")(Str.replace(colourCodes, "")(printed))
  const summary = A.findFirst(lines, Str.includes("Plan: "))
  if (O.isNone(summary)) {
    return PlanFinding.cases.Unreadable.make({ why: 'no line says "Plan:"' })
  }
  const resources = A.getSomes(A.map(lines, named))
  const empty = Str.includes("Plan: no resources")(summary.value)
  if (A.isReadonlyArrayEmpty(resources) && !empty) {
    return PlanFinding.cases.Unreadable.make({ why: "the plan names no resource" })
  }
  return pipe(
    A.findFirst(resources, (one) => one.resource === databaseResource && losesRows(one.action)),
    O.match({
      onNone: () => PlanFinding.cases.Keeps.make({ resources: A.length(resources) }),
      onSome: ({ action }) => PlanFinding.cases.LosesDatabase.make({ action })
    })
  )
}

/**
 * What each finding prints.
 *
 * @category rendering
 */
export const planSentence: (finding: PlanFinding) => Line = PlanFinding.match({
  Keeps: ({ resources }) =>
    out(`infra plan-check OK  the plan names ${resources} resources and keeps the database's rows`),
  LosesDatabase: ({ action }) =>
    err(
      `infra plan-check REFUSED  the plan would ${action} the database, and the app would then hold none of its rows. Nothing was deployed. If this is meant, take a dump first (docs/operations.md, "A dump of a stage's database") and deploy from a workstation.`
    ),
  Unreadable: ({ why }) =>
    err(
      `infra plan-check REFUSED  this is not a plan as \`alchemy deploy --dry-run\` prints one: ${why}. Nothing was deployed.`
    )
})

/**
 * Reads the file a workflow step wrote the plan to.
 *
 * @category rules
 */
export const planCheck = Effect.fn("Infra.planCheck")(function* (file: string) {
  const repo = yield* Repo
  const printed = yield* repo.text(repo.resolve(file))
  return A.of(planFinding(printed))
})
