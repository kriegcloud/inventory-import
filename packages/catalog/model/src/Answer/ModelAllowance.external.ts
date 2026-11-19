// The day's allowance of model calls, as the catalog needs it: one call taken before a model is asked. The allowance
// is the access context's to keep; the host translates (`ModelAllowanceViaAccess`), so nothing here knows how many
// calls a day there are or where they are counted.
import { LiteralKit } from "@beep/schema/LiteralKit"
import { CurrentActor } from "@inventory/kernel/Actor"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Tuple from "effect/Tuple"
import * as S from "effect/Schema"

/** What the catalog takes a model call for: reading a table request, or suggesting for an import. */
export const CatalogModelPurpose = LiteralKit(["view", "suggest"]).annotate({
  identifier: "CatalogModelPurpose",
  description: "What a model call of the catalog is for: a table view, or suggestions for an import"
})
/** The decoded value of `CatalogModelPurpose`. */
export type CatalogModelPurpose = typeof CatalogModelPurpose.Type

/** The two answers to taking a call. */
export const AllowanceAnswerKind = LiteralKit(["taken", "usedUp"]).annotate({
  identifier: "CatalogAllowanceAnswerKind",
  description: "A call was taken, or the day's calls are used"
})

class Taken extends S.Opaque<Taken, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("taken") }).annotate({
    identifier: "CatalogAllowanceTaken",
    description: "One call was taken from the day's allowance"
  })
) {}

class UsedUp extends S.Opaque<UsedUp, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("usedUp"),
    reason: S.String.pipe(
      S.annotateKey({ description: "That the day's calls are used, in the words an answer begins with" })
    )
  }).annotate({ identifier: "CatalogAllowanceUsedUp", description: "The day's calls are used: the rules answer" })
) {}

/** Whether a call was taken: the catalog's own union of the access context's two cases. */
export const AllowanceAnswer = AllowanceAnswerKind.mapMembers(() => Tuple.make(Taken, UsedUp)).pipe(
  S.toTaggedUnion("kind"),
  S.annotate({ identifier: "CatalogAllowanceAnswer", description: "Whether a model call was taken" })
)
/** The decoded value of `AllowanceAnswer`. */
export type AllowanceAnswer = typeof AllowanceAnswer.Type

/** A call was taken. */
export const taken: AllowanceAnswer = Taken.make({})
/** The day's calls are used; `reason` says so. */
export const usedUp = (reason: string): AllowanceAnswer => UsedUp.make({ reason })

/** The words a twin says when its calls are used. */
export const memoryUsedUpWords = "The day's AI calls are used"

/**
 * One call from the actor's organization's allowance, taken before a model is asked, so a call that fails still
 * counts. When the day's calls are used the feature's rules answer and say so.
 */
export class ModelAllowance extends Context.Service<
  ModelAllowance,
  {
    readonly take: (purpose: CatalogModelPurpose) => Effect.Effect<AllowanceAnswer, never, CurrentActor>
  }
>()("@inventory/catalog-model/Answer/ModelAllowance.external/ModelAllowance") {
  /** A twin holding `left` calls for everyone: each take uses one, and after the last every take is `usedUp`. */
  static readonly memory = (left: number): Layer.Layer<ModelAllowance> =>
    Layer.effect(
      ModelAllowance,
      Effect.gen(function* () {
        const calls = yield* Ref.make(left)
        return ModelAllowance.of({
          take: Effect.fnUntraced(function* () {
            yield* CurrentActor
            const had = yield* Ref.getAndUpdate(calls, (n) => Math.max(0, n - 1))
            return had > 0 ? taken : usedUp(memoryUsedUpWords)
          })
        })
      })
    )
}
