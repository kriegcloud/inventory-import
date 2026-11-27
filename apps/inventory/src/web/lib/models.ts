// The app's models as the screens reach them (web-02): each model's member Api over a WebSocket on the app's own
// origin (`/api/model/member`, the site Worker's forwarding route), beside the HTTP client that stays for everything
// else. The usage model's is the first; no screen reads it at move 2 (Benjamin, 2026-11-26: "No screen yet").
//
// The one thing not to break: what a page sends is its own member's (web-03). Every call names the member the page is
// for in the page's member header, as `ofThisPage` names every HTTP request, and a call refused `NotSignedIn` does what
// a 401 does there (the kit's model atoms, `@inventory/client/Model`): who is signed in is asked once, the same member
// sends it once more, a read for the organization the person left waits until they are back, and a command is said
// as not sent. A live read carries no header: its
// address names the member instead (`makeModelAtoms`'s `liveClient`), and the site's Worker checks that.
import * as Domain from "@alchemy.run/domain"
import { pageMemberHeader } from "@inventory/access-contract/Access"
import { serverAnswered } from "@inventory/client/ConnectionAtoms"
import { modelHttpClient } from "@inventory/client/Http"
import { asPressed, memberKey } from "@inventory/client/MemberAtoms"
import { makeModelAtoms } from "@inventory/client/Model"
import type { Member } from "@inventory/kernel/Member"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { Session } from "@inventory/usage-model/Session"
import * as Effect from "effect/Effect"
import * as HashSet from "effect/HashSet"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import type * as RpcClient from "effect/rpc/RpcClient"
import * as RpcMiddleware from "effect/rpc/RpcMiddleware"
import * as Socket from "effect/socket/Socket"

/** A path under the forwarding route, as an address on the app's own origin (the library's socket needs one whole). */
const onOwnOrigin = (path: string): string => `${globalThis.location.origin}/api/model${path}`

/**
 * The keys of the usage model's member Api's commands (each call's `key`): none at move 2 (`UsageMemberApi`'s commands
 * are none: a page sends no `TakeCall`), so every call it sends is a read. A command added to it is named here, and
 * goes as pressed.
 */
const commandKeys = HashSet.empty<string>()

/**
 * The client half of the usage model's `Session` middleware: the page's member header on every call, and a command
 * sent as the member who pressed it or not at all (`asPressed`). It sees the sending of a call only, never its answer
 * (node_modules/effect/src/rpc/RpcClient.ts, `onEffectRequest`: `next` is the send to the protocol), so a refusal for
 * want of a member is taken where the answer is read, by the kit's model atoms (`readAsPageMember`,
 * `sentAsPageMember` in `@inventory/client/MemberAtoms`), as `ofThisPage` takes a 401.
 */
export const UsageSessionClient = RpcMiddleware.layerClient(Session, ({ next, request, rpc }) =>
  Effect.flatMap(
    Effect.serviceOption(AtomRegistry.AtomRegistry),
    O.match({
      onNone: () => next(request),
      onSome: (registry) => {
        const sentFor = registry.get(memberKey)
        const named =
          sentFor === "" ? request : { ...request, headers: Headers.set(request.headers, pageMemberHeader, sentFor) }
        return HashSet.has(commandKeys, rpc.key) ? asPressed(next(named)) : next(named)
      }
    })
  )
)

/** The HTTP client a model's protocol sends its calls with: the kit's, and every answer tells the page it is back. */
const ModelHttp = Layer.effect(
  HttpClient.HttpClient,
  Effect.map(Effect.service(HttpClient.HttpClient), (client) =>
    HttpClient.tap(client, (response) => Effect.sync(() => serverAnswered(response.status)))
  )
).pipe(Layer.provide(modelHttpClient))

/**
 * The usage model's member client over `protocol`, with what every one the page holds is given: the HTTP client and
 * the session's half (`UsageSessionClient`). The page's are over the WebSocket protocol (`usageAt`); its test gives it
 * the protocol in process, so what it holds is the client the page builds.
 */
export const usageClientOver = <E, R>(protocol: Layer.Layer<RpcClient.Protocol, E, R>) =>
  UsageMemberApi.layerClient.pipe(
    Layer.provide(protocol),
    Layer.provide(Layer.mergeAll(ModelHttp, Socket.layerWebSocketConstructorGlobal, UsageSessionClient))
  )

/** The usage model's member client at `address`, over its WebSocket protocol. */
const usageAt = (address: string) => usageClientOver(Domain.protocolWebSocket(address))

/** The usage model's member client for the page's calls, which the app's runtime holds (`appRuntime`, api.ts). */
export const UsageClientLive = usageAt(onOwnOrigin("/member"))

/** A member's live reads: their own address, its last segment the member's id ("Member id in the socket's address"). */
const liveAddressOf = (member: O.Option<Member>): string =>
  member.pipe(O.match({ onNone: () => onOwnOrigin("/member"), onSome: (one) => onOwnOrigin(`/member/${one.id}`) }))

/**
 * The usage model's atoms (`@inventory/client/Model`), for a screen of the usage model: its commands and its
 * watched views, each live read on a client of its member's own.
 */
export const usageAtoms = makeModelAtoms(UsageMemberApi.Client, {
  liveClient: (member) => member.pipe(liveAddressOf, usageAt)
})
