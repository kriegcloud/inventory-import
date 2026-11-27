/**
 * What the rest of the app may know of a model call before it is taken: how many one organization may take in a UTC
 * day, and what a call is for. The usage model's `TakeCall` is sent with these, and the usage model reads them from
 * here alone.
 *
 * The only copy since move 2's hosted half: the `ModelAllowance` gateway beside it (`ModelAllowance.gateway.ts`) asks
 * with these, and the access context's copy went with its old count. The catalog's memory host still writes 40 itself.
 *
 * The one thing not to break: the three purposes are the notations of `inv:ModelCallPurposeScheme`'s concepts and the
 * words the `modelCall` table's check allows. One added here is added to neither: add it to the scheme, the table's
 * check as well.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import { aboutScheme } from "@inventory/kernel/TermsPointer"
import { $UsageContractId } from "../internal/identity.ts"

const $I = $UsageContractId.create("Allowance/ModelCall")

/** How many model calls one organization may take in one UTC day (decision 25: they come back at 00:00 UTC). */
export const dailyModelCalls = 40

/**
 * What a model call is for: the table assistant reading a request (`view`), the check that the key works (`check`),
 * or suggestions for an import's rows the rules cannot fix (`suggest`). Each is the notation of a concept of
 * `inv:ModelCallPurposeScheme` (report 18 section 5).
 *
 * @category schemas
 */
export const ModelCallPurpose = LiteralKit(["view", "check", "suggest"]).pipe(
  $I.annoteSchema("ModelCallPurpose", {
    description:
      "What a model call is for: the table assistant reading a request, the check that the key works, or suggestions for an import",
    ...aboutScheme("inv:ModelCallPurposeScheme")
  })
)

/**
 * The decoded value of `ModelCallPurpose`.
 *
 * @category models
 */
export type ModelCallPurpose = typeof ModelCallPurpose.Type
