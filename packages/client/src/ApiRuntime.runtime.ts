// The browser's seam to the API, with no contract in it. The app builds one runtime with one client for the whole
// contract (one runtime, one DevTools connection) and each web package binds these helpers to the client tag it
// declares, so a screen calls `call((api) => api.people.list())` against its own context's groups only. The rule this
// file protects: a write is retried only for a failure that may pass, never for a refusal.
import { Cause, Context, Effect, Exit, type Fiber, type ManagedRuntime, Schedule } from "effect"
import { SecureRandom } from "effect/crypto"
import { RequestId } from "@inventory/kernel/Ids"
import { isTransient } from "@inventory/client/SayError"

/** Runs one program against the API as a Promise, for TanStack Query; a typed API error rejects as itself. */
export type Call<Client> = <A, E>(use: (client: Client) => Effect.Effect<A, E>) => Promise<A>

/** Runs a longer program against the API in the background; interrupting the fiber aborts its requests. */
export type Fork<Client> = <A, E>(use: (client: Client) => Effect.Effect<A, E>) => Fiber.Fiber<A, E>

/** The three ways a screen reaches the API, bound to one client. */
export interface Api<Client> {
  readonly call: Call<Client>
  /** One write: a failure that may pass is sent again, twice at most, waiting longer each time; a refusal is not. */
  readonly callWrite: Call<Client>
  readonly fork: Fork<Client>
}

/**
 * The helpers for one client, run on `runtime`, which must provide `tag`. The app calls it once for the whole
 * contract; a web package calls it with its own tag over the same runtime.
 */
export const makeApi = <Id, Client, R>(
  runtime: ManagedRuntime.ManagedRuntime<R, never>,
  tag: Context.Key<Id, Client> & (Id extends R ? unknown : never)
): Api<Client> => {
  const run = <A, E>(use: (client: Client) => Effect.Effect<A, E>) =>
    Effect.flatMap(tag as unknown as Effect.Effect<Client, never, R>, use)
  const call: Call<Client> = (use) =>
    runtime.runPromiseExit(run(use)).then((exit) => {
      if (Exit.isSuccess(exit)) return exit.value
      throw Cause.squash(exit.cause)
    })
  return {
    call,
    callWrite: (use) =>
      call((client) =>
        use(client).pipe(
          Effect.retry({
            schedule: Schedule.exponential("400 millis").pipe(Schedule.jittered),
            times: 2,
            while: isTransient
          })
        )
      ),
    fork: (use) => runtime.runFork(run(use))
  }
}

/**
 * A key for one thing the person does: make it once per click of a write button (or per Confirm), and send the same
 * key if that request is retried. The server writes once per key, so a retry or a double submit adds nothing.
 */
export const newRequestId = (): RequestId => RequestId.make(SecureRandom.uuidV4Unsafe())
