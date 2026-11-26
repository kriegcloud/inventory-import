/**
 * A Better Auth hook written as an Effect. Better Auth calls a hook and awaits what it returns, so this file is where
 * an Effect leaves as a Promise: one of the Promise law's entry points, and the only one for hooks. A host's options
 * write no Promise.
 *
 * The one thing not to break: a refusal must reject with Better Auth's own `APIError`, or Better Auth answers 500 where
 * the person should read why (a closed sign-up reads "FORBIDDEN" with its sentence).
 *
 * @packageDocumentation
 */
import { APIError } from "better-auth/api"
import type { BetterAuthOptions } from "better-auth"
import * as Effect from "effect/Effect"
import * as S from "effect/Schema"
import { $BetterAuthId } from "./internal/identity.ts"

const $I = $BetterAuthId.create("BetterAuthHooks")

/**
 * A hook refused what Better Auth was about to do (make an account for an email nobody invited). `message` is what
 * the person reads; Better Auth answers 403 with it.
 *
 * @category errors
 */
export class HookRefused extends S.TaggedError<HookRefused, { readonly brand: unique symbol }>($I`HookRefused`)(
  "HookRefused",
  {
    message: S.String.pipe(S.annotateKey({ description: "What the person reads, in the app's own words" }))
  },
  $I.annoteError<HookRefused>("HookRefused", { description: "A hook refused what Better Auth was about to do" })
) {}

/**
 * Where Better Auth hands work it does after answering (rate-limit updates, cleanup), so the platform keeps it alive:
 * a Worker passes its `waitUntil`. Named here so a host's settings need not name a Promise.
 *
 * @category models
 */
export type AuthBackgroundTasks = NonNullable<NonNullable<BetterAuthOptions["advanced"]>["backgroundTasks"]>["handler"]

/**
 * Runs a hook for Better Auth: its value is what the hook answers, and a `HookRefused` rejects as Better Auth's
 * `APIError("FORBIDDEN")` with the same sentence.
 *
 * @example
 * before: (user) => hook(mayCreate(user.email) ? Effect.void : Effect.fail(HookRefused.make({ message: closed })))
 *
 * @category runners
 */
export const hook = <A>(effect: Effect.Effect<A, HookRefused>) =>
  Effect.runPromise(
    Effect.catch(effect, (refused) => Effect.die(new APIError("FORBIDDEN", { message: refused.message })))
  )
