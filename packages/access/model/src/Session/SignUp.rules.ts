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
import * as SchemaTransformation from "effect/SchemaTransformation"
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

const SignUpWords = S.Trim.pipe(
  S.decode(SchemaTransformation.toLowerCase()),
  S.decodeTo(
    S.Array(S.String),
    SchemaTransformation.transform({
      decode: (setting): ReadonlyArray<string> => A.filter(Str.split(/[\s,]+/)(setting), (word) => word !== ""),
      encode: (words: ReadonlyArray<string>) => A.join(words, ",")
    })
  ),
  $I.annoteSchema("SignUpWords", { description: "The sign-up setting's lower-case words" })
)

/** The normalized email key used to decide account admission. */
export const SignUpEmail = S.Trim.pipe(
  S.decode(SchemaTransformation.toLowerCase()),
  S.check(S.isTrimmed(), S.isLowercased()),
  S.brand("SignUpEmail"),
  $I.annoteSchema("SignUpEmail", { description: "An email compared for sign-up, with edges dropped and case folded" })
)

/** The normalized email key accepted by the admission rule. */
export type SignUpEmail = typeof SignUpEmail.Type

/** Decodes the SIGN_UP setting into its complete admission rule. */
export const SignUpSetting = SignUpWords.pipe(
  S.decodeTo(
    SignUpRule,
    SchemaTransformation.transform({
      decode: (
        words
      ): { readonly kind: "open" } | { readonly kind: "invited"; readonly emails: ReadonlyArray<string> } =>
        words.length === 1 && words[0] === "open"
          ? { kind: "open" }
          : { kind: "invited", emails: A.dedupe(A.filter(words, (word) => Str.includes("@")(word))) },
      encode: (
        rule: { readonly kind: "open" } | { readonly kind: "invited"; readonly emails: ReadonlyArray<string> }
      ): ReadonlyArray<string> => (rule.kind === "open" ? ["open"] : rule.emails)
    })
  ),
  $I.annoteSchema("SignUpSetting", { description: "The SIGN_UP setting decoded into an account admission rule" })
)

/**
 * Whether a schema-normalized email key may make an account under a rule.
 *
 * @example mayCreateAccount(SignUpOpen.make({}), SignUpEmail.make("ada@example.com")) // true
 */
export const mayCreateAccount: {
  (email: SignUpEmail): (rule: SignUpRule) => boolean
  (rule: SignUpRule, email: SignUpEmail): boolean
} = dual(2, (rule: SignUpRule, email: SignUpEmail): boolean => rule.kind === "open" || A.contains(rule.emails, email))

/**
 * What the sign-in page is told of a rule: `open` (offer sign-up), `invited` (offer it, saying it is for invited
 * emails) or `closed` (do not offer it). The emails themselves never leave the server.
 */
export const signUpOfferOf = (rule: SignUpRule): "open" | "invited" | "closed" =>
  rule.kind === "open" ? "open" : rule.emails.length === 0 ? "closed" : "invited"

/** What a refused sign-up is told. */
export const signUpClosedMessage =
  "New accounts are not open here. Ask the person who runs this app to add your email, then try again."
