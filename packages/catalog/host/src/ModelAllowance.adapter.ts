// The catalog's allowance port, met by the access context's gateway. The catalog's model never imports the access
// contract; this is the one place the two unions meet.
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import {
  AllowanceAnswer,
  ModelAllowance,
  taken,
  usedUp,
  type CatalogModelPurpose
} from "@inventory/catalog-model/ModelAllowance"
import { ModelAllowanceGateway, usedUpWords } from "@inventory/access-contract/ModelAllowance"

/**
 * `ModelAllowance` through the access context's gateway. A used-up allowance is handed on in the short words an
 * answer begins with (`usedUpWords`), which the catalog's handlers finish ("..., so the rules answered.").
 */
export const ModelAllowanceViaAccess = Layer.effect(
  ModelAllowance,
  Effect.gen(function* () {
    const gateway = yield* ModelAllowanceGateway

    const take = Effect.fnUntraced(function* (purpose: CatalogModelPurpose) {
      const call = yield* gateway.take(purpose)
      return AllowanceAnswer.guards.taken(call) ? taken : usedUp(usedUpWords)
    })

    return ModelAllowance.of({
      take
    })
  })
)
