// Every declaration of the review's model, and every one an Api serves, says in words what it is: an Api's tool list,
// its command line and its OpenAPI document are written from those words (the brief's row "Annotations"). The walk
// starts from what each Api serves, so a view, a stream or a query added later is held the day it is served. The one
// thing not to break: a new Api of this package is added to `apis` below, or what it serves is never read.
import * as Domain from "@alchemy.run/domain"
import type { Servable } from "@alchemy.run/domain/Api"
import type * as Rejection from "@alchemy.run/domain/Rejection"
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import { Catalog, CatalogApi } from "../src/Catalog.model.ts"
import { Import } from "../src/Import/Import.aggregate.ts"

/** A declaration as this check reads it: its name and its description, if it has one. */
type Said = { readonly name: string; readonly description: O.Option<string> }

/** A declaration's name and what its annotations say of it. */
const said = (name: string, annotations: Domain.Annotations): Said => ({
  name,
  description: O.fromUndefinedOr(annotations.description)
})

/** The names of the declarations that carry no description. */
const silent = (declared: ReadonlyArray<Said>) =>
  A.map(
    A.filter(declared, (one) => !O.exists(one.description, Str.isNonEmpty)),
    (one) => one.name
  )

/**
 * A rejection made by `Domain.Rejection`, which has a tag and annotations. A command may also reject with one of
 * Effect's HTTP errors, which has neither: the library types every rejection loosely for that reason.
 */
const isDomainRejection = (
  rejection: Rejection.Any
): rejection is Rejection.Any & { readonly tag: string; readonly annotations: Domain.Annotations } =>
  P.hasProperty(rejection, "tag") && P.hasProperty(rejection, "annotations")

/** What a rejection says: one that is not a domain rejection has no words of its own, and is named silent. */
const saidByRejection = (rejection: Rejection.Any): Said =>
  isDomainRejection(rejection)
    ? said(rejection.tag, rejection.annotations)
    : { name: "a rejection that is not a Domain.Rejection", description: O.none() }

/** What one served declaration says: a command with its events and its rejections, or a view, stream or query. */
const saidBy = (served: Servable): ReadonlyArray<Said> => {
  if (served.kind === "Command") {
    return [
      said(served.tag, served.annotations),
      ...A.map(served.events, (event) => said(event.tag, event.annotations)),
      ...A.map(served.rejects, saidByRejection)
    ]
  }
  if (served.kind === "View") return [said(served.viewName, served.annotations)]
  if (served.kind === "Stream") return [said(served.streamName, served.annotations)]
  return [said(served.queryName, served.annotations)]
}

/** An Api as this check reads it. */
type Serving = {
  readonly apiName: string
  readonly annotations: Domain.Annotations
  readonly serves: ReadonlyArray<Servable>
}

/** The names of everything the Apis serve, and the Apis themselves, that carry no description. */
const silentServed = (apis: ReadonlyArray<Serving>) =>
  silent(A.flatMap(apis, (api) => [said(api.apiName, api.annotations), ...A.flatMap(api.serves, saidBy)]))

/** Every Api this package declares. */
const apis: ReadonlyArray<Serving> = [CatalogApi]

describe("says what it is", () => {
  it("every Api and everything it serves: each command, its events and rejections, each view, stream and query", () => {
    expect(CatalogApi.serves.length).toBe(11)
    expect(silentServed(apis)).toEqual([])
  })

  it("each aggregate, each decision and the model", () => {
    expect(
      silent([
        ...A.map(Catalog.aggregates, (aggregate) => said(aggregate.aggregateName, aggregate.annotations)),
        ...A.map(Catalog.decisions, (decision) => said(decision.command.tag, decision.annotations)),
        said(Catalog.modelName, Catalog.annotations)
      ])
    ).toEqual([])
  })

  it("names a served view with no description, and an Api with none", () => {
    // The catalog serves no view until move 2, so a trial one shows the walk reads a view.
    class Seen extends Domain.View("Seen", {
      from: [Import],
      key: Import,
      state: S.Struct({ staged: S.Int }),
      initial: { staged: 0 },
      evolve: { ImportStaged: (seen) => ({ staged: seen.staged + 1 }) }
    }) {}
    class Trial extends Domain.Model("Trial", { aggregates: [Import], views: [Seen] }, { description: "A trial" }) {}
    class TrialApi extends Domain.Api("TrialApi", { model: Trial }) {}
    expect(A.filter(silentServed([TrialApi]), (name) => name === "TrialApi" || name === "Seen")).toEqual([
      "TrialApi",
      "Seen"
    ])
  })
})
