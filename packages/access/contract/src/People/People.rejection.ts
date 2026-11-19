/**
 * Why a change to an organization's people is refused.
 *
 * @packageDocumentation
 */
import { Sentence } from "@inventory/kernel/Text"
import * as S from "effect/Schema"
import { $AccessContractId } from "../internal/identity.ts"

const $I = $AccessContractId.create("People/People")

const reason = Sentence.pipe(S.annotateKey({ description: "What happened and what to do, in words for the person." }))

/**
 * The member in the address is not in this organization (removed meanwhile, or never there).
 *
 * @category errors
 */
export class PersonNotFound extends S.TaggedError<PersonNotFound, { readonly brand: unique symbol }>(
  $I`PersonNotFound`
)(
  "PersonNotFound",
  { reason },
  $I.annoteError<PersonNotFound>("PersonNotFound", {
    description: "The member in the address is not in this organization",
    httpApiStatus: 404
  })
) {}

/**
 * The change would leave the organization with no admin, so nobody could manage it afterwards.
 *
 * @category errors
 */
export class LastAdmin extends S.TaggedError<LastAdmin, { readonly brand: unique symbol }>($I`LastAdmin`)(
  "LastAdmin",
  { reason },
  $I.annoteError<LastAdmin>("LastAdmin", {
    description: "The change would leave the organization with no admin, so nobody could manage it afterwards",
    httpApiStatus: 409
  })
) {}
