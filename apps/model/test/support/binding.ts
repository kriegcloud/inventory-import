// The service binding, as a test has it: an `HttpClient` whose every request is answered by the model Worker's own
// `fetch` in this process, with no socket and no deploy. A Worker reaches the model's Worker the same way over its
// binding (a request in, a response out), so a client given this one sends what the site's Worker will send. And the
// session the tests run behind: one header names a person below, and a call with none is refused.
import { NotSignedIn } from "@inventory/kernel/AccessError"
import { type Actor, CurrentActor } from "@inventory/usage-model/Actor"
import { Session } from "@inventory/usage-model/Session"
import type { HttpEffect } from "alchemy/Http"
import * as Effect from "effect/Effect"
import * as HashMap from "effect/HashMap"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Scope from "effect/Scope"

/** An editor of one organization, and an admin of another. */
export const ana: Actor = { organizationId: "org_prairie", memberId: "ana", role: "editor" }
export const hal: Actor = { organizationId: "org_harbor", memberId: "hal", role: "admin" }

const people = HashMap.make(["ana", ana], ["hal", hal])

/** The header a test call names its person in. */
const header = "x-test-person"

/** The headers of a call made as `actor`. */
export const as = (actor: Actor) => ({ headers: { [header]: actor.memberId } })

/** `Session` as the tests run it: the person the header names, or `NotSignedIn`. */
export const SessionTest = Layer.succeed(Session, (effect, { headers }) =>
  O.match(
    O.flatMap(Headers.get(headers, header), (name) => HashMap.get(people, name)),
    {
      onNone: () => Effect.fail(NotSignedIn.make({ reason: "The test names no person of this model." })),
      onSome: (actor) => Effect.provideService(effect, CurrentActor, actor)
    }
  )
)

/**
 * A client whose requests the Worker's `fetch` answers in process, in `scope`: a response's body may be read after
 * the request returns, so the scope is the test's, not the request's.
 */
export const throughBinding = ({ fetch, scope }: { readonly fetch: HttpEffect; readonly scope: Scope.Scope }) =>
  HttpClient.make((request) =>
    fetch.pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromClientRequest(request)),
      Effect.provideService(Scope.Scope, scope),
      Effect.map((response) => HttpServerResponse.toClientResponse(response, { request })),
      Effect.orDie
    )
  )
