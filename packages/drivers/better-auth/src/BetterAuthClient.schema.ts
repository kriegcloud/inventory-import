/**
 * What the browser sends Better Auth and what Better Auth answers, for the five things a person does there: sign in,
 * make an account, sign out, make an organization, and choose the organization to work in.
 *
 * @packageDocumentation
 */
import * as S from "effect/Schema"
import { $BetterAuthId } from "./internal/identity.ts"

const $I = $BetterAuthId.create("BetterAuthClient")

/**
 * Text a person typed into a form, sent as it is: Better Auth checks and bounds it on the server, and its refusal is a
 * sentence for the person, which a check here could not be.
 */
const Typed = S.String

/**
 * An email and its password, as typed.
 *
 * @category schemas
 */
export class Credentials extends S.Opaque<Credentials, { readonly brand: unique symbol }>()(
  S.Struct({
    email: Typed.pipe(S.annotateKey({ description: "The email the account signs in with" })),
    password: Typed.pipe(S.annotateKey({ description: "The password as typed, never logged" }))
  }).pipe($I.annoteSchema("Credentials", { description: "An email and its password, as typed on the sign-in form" }))
) {}

/**
 * A new account: the person's name, and the email and password it will sign in with.
 *
 * @category schemas
 */
export class NewAccount extends S.Opaque<NewAccount, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Typed.pipe(S.annotateKey({ description: "The person's name, shown beside what they do" })),
    email: Typed.pipe(S.annotateKey({ description: "The email the account will sign in with" })),
    password: Typed.pipe(S.annotateKey({ description: "The password as typed, never logged" }))
  }).pipe($I.annoteSchema("NewAccount", { description: "A new account, as typed on the sign-up form" }))
) {}

/**
 * A new organization: its name, and the slug the organization plugin requires.
 *
 * @category schemas
 */
export class NewOrganization extends S.Opaque<NewOrganization, { readonly brand: unique symbol }>()(
  S.Struct({
    name: Typed.pipe(S.annotateKey({ description: "The organization's name, as typed" })),
    slug: Typed.pipe(S.annotateKey({ description: "Its unique slug: lowercase words joined by hyphens" }))
  }).pipe($I.annoteSchema("NewOrganization", { description: "A new organization the signed-in person will run" }))
) {}

/**
 * The part of the client's answer this driver reads: no error, or the error's HTTP status and Better Auth's sentence.
 * Whatever else is in it (the session, the user, the organization) is ignored: who is signed in is asked of the app.
 *
 * @category schemas
 */
export const ClientAnswer = S.Struct({
  error: S.OptionFromNullOr(
    S.Struct({
      status: S.Int.pipe(S.annotateKey({ description: "The HTTP status of the refusal (429: too many attempts)" })),
      message: S.String.pipe(
        S.annotateKey({ description: "Better Auth's sentence for the person, when it has one" }),
        S.OptionFromOptional
      )
    })
  ).pipe(S.annotateKey({ description: "None when Better Auth did what was asked" }))
}).pipe($I.annoteSchema("ClientAnswer", { description: "Whether Better Auth did what the browser asked" }))

/**
 * Better Auth did not do what the browser asked. `status` is the refusal's HTTP status, none when no answer came (the
 * network, or an answer that could not be read); `sentence` is Better Auth's own, already written for the
 * person ("Invalid email or password"), when it gave one. A screen words it; this driver holds no words.
 *
 * @category errors
 */
export class BetterAuthRefused extends S.TaggedError<BetterAuthRefused, { readonly brand: unique symbol }>(
  $I`BetterAuthRefused`
)(
  "BetterAuthRefused",
  {
    status: S.Option(S.Int).pipe(S.annotateKey({ description: "The refusal's HTTP status. None: no answer came" })),
    sentence: S.Option(S.String).pipe(S.annotateKey({ description: "Better Auth's sentence for the person, if any" }))
  },
  $I.annoteError<BetterAuthRefused>("BetterAuthRefused", {
    description: "Better Auth did not do what the browser asked"
  })
) {}
