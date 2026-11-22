// The requests of the API's one client as requests of this page: whose they are, and what their answers say of the
// page. The one thing not to break: what one person pressed is never sent as another, and what is read for one person
// is never taken for another's. One browser has one session cookie for all its tabs, so every request names the member
// its page is for (`pageMemberHeader`), and the server refuses it when the cookie is somebody else's by then.
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpClientRequest from "effect/http/HttpClientRequest"
import type * as HttpClientResponse from "effect/http/HttpClientResponse"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import * as Headers from "effect/http/Headers"
import { pageMemberHeader } from "@inventory/access-contract/Access"
import { serverAnswered } from "@inventory/client/ConnectionAtoms"
import {
  asPressed,
  askWhoIsSignedIn,
  memberKey,
  notSentElsewhere,
  onceSignedInKnown,
  whoIsSignedInAsked
} from "@inventory/client/MemberAtoms"

/** The request named for the member this page is for, when it has one. */
const named = (request: HttpClientRequest.HttpClientRequest) =>
  Effect.map(Effect.serviceOption(AtomRegistry.AtomRegistry), (registry) => {
    const key = O.getOrElse(
      O.map(registry, (one) => one.get(memberKey)),
      () => ""
    )
    return key === "" ? request : HttpClientRequest.setHeader(request, pageMemberHeader, key)
  })

/**
 * What every request of the API's client does for the page it is made on. It names the member the page is for, and a
 * write goes as the member who pressed it or not at all (`asPressed`). An answer says the server can be reached, to
 * whatever could not be read. "Nobody is signed in" means the page's idea of who is signed in is out of date: it is
 * asked again, once, and the request waits for the answer. The same member: it is sent once more. Somebody else or
 * nobody: the page is left and the request never ends. The person's own switch of organization: a read for the
 * organization they left is never taken there, and is read again when they are back in it; a write fails, said as
 * not sent.
 */
export const ofThisPage = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
  client.pipe(
    HttpClient.mapRequestEffect(named),
    HttpClient.transform((response, request) => {
      const send = Effect.tap(request.method === "GET" ? response : asPressed(response), (answer) =>
        Effect.sync(() => serverAnswered(answer.status))
      )
      return Effect.flatMap(send, (answer) =>
        Effect.flatMap(
          Effect.serviceOption(AtomRegistry.AtomRegistry),
          O.match({
            onNone: () => Effect.succeed(answer),
            onSome: (registry) => answeredFor({ registry, answer, request, send })
          })
        )
      )
    })
  )

/** Done once the page is the given member's again: a read held for them waits here, and no longer than that. */
const onceBackAs = (registry: AtomRegistry.AtomRegistry, key: string): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    if (registry.get(memberKey) === key) return resume(Effect.void)
    const stop = registry.subscribe(memberKey, (now) => {
      if (now !== key) return
      stop()
      resume(Effect.void)
    })
    return Effect.sync(stop)
  })

/** An answer as this page takes it: one refused for want of a member waits until who is signed in is known. */
const answeredFor = <E>(input: {
  readonly registry: AtomRegistry.AtomRegistry
  readonly answer: HttpClientResponse.HttpClientResponse
  readonly request: HttpClientRequest.HttpClientRequest
  readonly send: Effect.Effect<HttpClientResponse.HttpClientResponse, E>
}): Effect.Effect<HttpClientResponse.HttpClientResponse, E> => {
  const { registry, answer, request } = input
  if (answer.status !== 401) return Effect.succeed(answer)
  if (!registry.get(whoIsSignedInAsked)) askWhoIsSignedIn(registry)
  const sentFor = O.getOrElse(Headers.get(request.headers, pageMemberHeader), () => "")
  // Sent for nobody (the sign-in page): its answer is the page's to say.
  if (sentFor === "") return Effect.succeed(answer)
  // After what is running now: an ask made while the registry is between two states is taken up first.
  return Effect.yieldNow.pipe(
    Effect.andThen(onceSignedInKnown(registry)),
    Effect.andThen(() => {
      // Still that member (the cookie changed back meanwhile): nothing was done, and it is sent once more.
      if (registry.get(memberKey) === sentFor) return input.send
      // The person switched organization: a read for the one they left is not taken here, and is sent again once the
      // page is that member's again (never, if it is left); a write was refused before it did anything, and is said
      // as not sent.
      return request.method === "GET"
        ? Effect.andThen(onceBackAs(registry, sentFor), input.send)
        : Effect.die(notSentElsewhere())
    })
  )
}
