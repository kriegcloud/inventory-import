// The requests of the API's one client as requests of this page: whose they are, and what their answers say of the
// page. The one thing not to break: what one person pressed is never sent as another.
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as HttpClient from "effect/http/HttpClient"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { serverAnswered } from "@inventory/client/ConnectionAtoms"
import { asPressed, askWhoIsSignedIn, whoIsSignedInAsked } from "@inventory/client/MemberAtoms"

/**
 * What every request of the API's client does for the page it is made on. A write goes as the member who pressed it or
 * not at all (`asPressed`). An answer says the server can be reached, to whatever could not be read. "Nobody is signed
 * in" means the page's idea of who is signed in is out of date: it is asked again, once, and the page then goes on, or
 * is left.
 */
export const ofThisPage = (client: HttpClient.HttpClient): HttpClient.HttpClient =>
  HttpClient.transform(
    client,
    Effect.fnUntraced(function* (response, request) {
      const answer = yield* request.method === "GET" ? response : asPressed(response)
      serverAnswered(answer.status)
      const registry = yield* Effect.serviceOption(AtomRegistry.AtomRegistry)
      if (answer.status === 401 && O.isSome(registry) && !registry.value.get(whoIsSignedInAsked)) {
        askWhoIsSignedIn(registry.value)
      }
      return answer
    })
  )
