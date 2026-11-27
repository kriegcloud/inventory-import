/**
 * Which Api of the model's Worker answers a request: one prefix for what a member's page may send, one for what the
 * site's Worker sends, and nothing for any other path. An Api's own `fetch` does not read the path
 * (`@alchemy.run/domain/src/Api.ts`, `serve`: an upgrade is a live read, anything else one RPC call), so the Worker
 * chooses the Api by prefix. The site's Worker forwards a page's call to the member prefix only (host-04); the server
 * prefix is reached by the site's own code over the service binding. The one thing not to break: a path under the
 * member prefix never reaches an Api that serves a command a browser may not send.
 *
 * @packageDocumentation
 */
import * as Effect from "effect/Effect"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"
import * as O from "effect/Option"
import * as Str from "effect/String"
import type { ApiServer } from "@alchemy.run/domain/Api"

/**
 * Where a member's page reaches the model: the paths the site's Worker forwards to. A live read's address adds the
 * member's id as its last segment (decided by the rule on 2026-11-27, for Benjamin to overrule:
 * `explorations/alchemy-domain/DECISIONS.md`), so a path under it is the member's too.
 */
export const memberPrefix = "/member"

/** Where the site's Worker reaches what only a server may send (`TakeCall`), over the service binding. */
export const serverPrefix = "/server"

/** True when `path` is `prefix` itself or a path under it: `/member` and `/member/m-1`, never `/members`. */
const under =
  (prefix: string) =>
  (path: string): boolean =>
    path === prefix || Str.startsWith(`${prefix}/`)(path)

/**
 * The Worker's `fetch`: the member's Api under `memberPrefix`, the server's under `serverPrefix`, and a 404 with no
 * body for any other path, so nothing about the model is said to a request that names neither.
 */
export const routeByPrefix = Effect.fnUntraced(function* (apis: {
  readonly member: ApiServer
  readonly server: ApiServer
}) {
  const request = yield* HttpServerRequest.HttpServerRequest
  const url = HttpServerRequest.toURL(request)
  if (O.exists(url, (at) => under(memberPrefix)(at.pathname))) return yield* apis.member.fetch
  if (O.exists(url, (at) => under(serverPrefix)(at.pathname))) return yield* apis.server.fetch
  return HttpServerResponse.empty({ status: 404 })
})
