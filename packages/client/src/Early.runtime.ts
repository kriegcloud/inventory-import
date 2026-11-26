import * as A from "effect/Array"
import * as O from "effect/Option"
import { request } from "@inventory/client/Http"
// Requests started before the code that will read them needs them. The first screen's data can be asked for the
// moment someone is known to be signed in, by its address, and the API client takes the answer when it asks for that
// address itself (`takeEarly`, in api.ts). Nothing here reads an answer: the client decodes it through the contract,
// as it does every other. A plain list: a page starts three or four of these.

let started: ReadonlyArray<{ readonly path: string; readonly response: Promise<Response> }> = []

/** Starts a GET of `path` (an address on this origin) now, unless one is already on its way. */
export const early = (path: string): void => {
  if (started.some((entry) => entry.path === path)) return
  started = [...started, { path, response: request(path, { credentials: "same-origin" }) }]
}

/** The answer of an early GET of `path`, once; none when none was started, and the client asks itself. */
export const takeEarly = (path: string): O.Option<Promise<Response>> =>
  O.map(
    A.findFirst(started, (entry) => entry.path === path),
    (found) => {
      started = started.filter((entry) => entry !== found)
      return found.response
    }
  )

/** Drops every answer not taken yet: the session says nobody is signed in, so they were asked for the wrong person. */
export const forgetEarly = (): void => {
  started = []
}
