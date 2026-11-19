/**
 * Who may make an account. Benjamin's decision "infra I8": sign-up is closed, and he adds accounts. An account is
 * made only for an email he has named in the `SIGN_UP` setting; that person signs up and, as before, is the admin of
 * the organization they create. Nobody else can, whatever they send. Development leaves sign-up open.
 *
 * @packageDocumentation
 */
import { LiteralKit } from "@beep/schema/LiteralKit"
import * as A from "effect/Array"
import { dual } from "effect/Function"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import * as Tuple from "effect/Tuple"
import { $AccessModelId } from "../internal/identity.ts"

const $I = $AccessModelId.create("Session/SignUp")

/** Anyone may make an account: development, and a copy whose owner chose it. */
export class SignUpOpen extends S.Opaque<SignUpOpen, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("open") }).pipe($I.annoteSchema("SignUpOpen", { description: "Anyone may make an account" }))
) {}

/** Only these emails may make an account. With none named, nobody can: sign-up is closed. */
export class SignUpInvited extends S.Opaque<SignUpInvited, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("invited"),
    emails: S.Array(S.String.check(S.isMaxLength(254)).annotateKey({ description: "One email, in lower case" })).pipe(
      S.annotateKey({ description: "The emails that may make an account, in lower case" })
    )
  }).pipe($I.annoteSchema("SignUpInvited", { description: "Only the named emails may make an account" }))
) {}

/**
 * Who may make an account.
 *
 * @category schemas
 */
export const SignUpRule = LiteralKit(["open", "invited"])
  .mapMembers(() => Tuple.make(SignUpOpen, SignUpInvited))
  .pipe(S.toTaggedUnion("kind"), $I.annoteSchema("SignUpRule", { description: "Who may make an account" }))

/**
 * Runtime type of {@link SignUpRule}.
 *
 * @category models
 */
export type SignUpRule = typeof SignUpRule.Type

/**
 * The rule the `SIGN_UP` setting names: `open`, `closed`, or emails separated by commas or spaces. Anything that is
 * not `open` closes sign-up to all but the emails in it, so a mistyped value never opens it.
 *
 * @example signUpRuleOf("ada@example.com, Bo@Example.com") // invited: ada@example.com, bo@example.com
 * @example signUpRuleOf("closed") // invited: nobody
 */
export const signUpRuleOf = (setting: string): SignUpRule => {
  const words = A.filter(
    A.map(Str.split(/[\s,]+/)(setting), (word) => Str.toLowerCase(Str.trim(word))),
    (word) => word !== ""
  )
  if (words.length === 1 && words[0] === "open") return SignUpOpen.make({})
  return SignUpInvited.make({ emails: A.dedupe(A.filter(words, (word) => Str.includes("@")(word))) })
}

/**
 * Whether an email may make an account under a rule. Emails are compared whatever their case.
 *
 * @example mayCreateAccount(signUpRuleOf("ada@example.com"), "Ada@Example.com") // true
 * @example mayCreateAccount(signUpRuleOf("closed"), "ada@example.com") // false
 */
export const mayCreateAccount: {
  (email: string): (rule: SignUpRule) => boolean
  (rule: SignUpRule, email: string): boolean
} = dual(
  2,
  (rule: SignUpRule, email: string): boolean =>
    rule.kind === "open" || A.contains(rule.emails, Str.toLowerCase(Str.trim(email)))
)

/**
 * What the sign-in page is told of a rule: `open` (offer sign-up), `invited` (offer it, saying it is for invited
 * emails) or `closed` (do not offer it). The emails themselves never leave the server.
 */
export const signUpOfferOf = (rule: SignUpRule): "open" | "invited" | "closed" =>
  rule.kind === "open" ? "open" : rule.emails.length === 0 ? "closed" : "invited"

/** What a refused sign-up is told. */
export const signUpClosedMessage =
  "New accounts are not open here. Ask the person who runs this app to add your email, then try again."
