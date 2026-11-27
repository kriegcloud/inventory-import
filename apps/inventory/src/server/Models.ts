// THE MODELS, FROM THE SITE'S WORKER. The site reaches the app's models two ways, and only these: a member's page
// through the forwarding route (`ModelRoute.ts`), to the member Api alone, and the site's own code (the allowance's
// gateway below) to the server Api. Where they run is chosen once, in worker.ts: under `bun run dev:alchemy` and
// deployed, in the model's Worker over the service binding the stack declares (`MODEL`); under `bun run dev` (Vite,
// one Worker), in memory inside this Worker, on the model Worker's own composition (`modelsOn`) with `Domain.InMemory`
// in place of Durable Objects ("Keep Vite; dev:alchemy beside it", Benjamin, 2026-11-26). Both answer the same calls
// the same way: the harness test beside the stack test holds that (tests-13).
//
// The one thing not to break: a call carries the person, never a name. The site hands on the session cookie and the
// page's member header of the request it is answering (`carried`), and the model reads the session itself ("Forward the
// cookie", the same day); nothing here says who acts.
import * as Domain from "@alchemy.run/domain"
import type { ClientOf } from "@alchemy.run/domain/Api"
import { pageMemberHeader } from "@inventory/access-contract/Access"
import { CurrentActor } from "@inventory/kernel/Actor"
import { SessionLookup } from "@inventory/kernel/SessionLookup"
import { modelsOn } from "@inventory/model-app/Models"
import { memberPrefix, serverPrefix } from "@inventory/model-app/ModelRoutes"
import { UsageMemberApi } from "@inventory/usage-model/MemberApi"
import { UsageServerApi } from "@inventory/usage-model/ServerApi"
import { ModelAllowanceGateway, taken, usedUp, usedUpSentence } from "@inventory/usage-contract/ModelAllowance"
import type { ModelCallPurpose } from "@inventory/usage-contract/ModelCall"
import * as A from "effect/Array"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import type * as Scope from "effect/Scope"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Headers from "effect/http/Headers"
import * as HttpClient from "effect/http/HttpClient"
import * as HttpServerRequest from "effect/http/HttpServerRequest"
import * as HttpServerResponse from "effect/http/HttpServerResponse"

/** The client of the usage model's server Api (`TakeCall`), which only the site's own code holds. */
export type UsageServerClient = ClientOf<typeof UsageServerApi>

/** Where a page reaches the models on the site's own origin: `/api/model/member`, and a live read's address under it. */
export const modelRoutePrefix = "/api/model"

/** The address the binding is reached at: a Worker's binding takes any host, and the path chooses the Api. */
const bound = "http://model"

/**
 * The headers of the request being answered that a call to a model carries: the session cookie, which names the
 * member, and the page's member header, which can only refuse (`SessionLookup`). Nothing else of the browser's request
 * reaches the model's Worker on the site's own calls.
 */
export const carried = A.make("cookie", pageMemberHeader)

/** `headers` with only what a model call carries. */
const carriedOf = (headers: Headers.Headers): Headers.Headers =>
  Headers.fromInput(
    R.fromEntries(
      A.getSomes(A.map(carried, (name) => O.map(Headers.get(headers, name), (value) => [name, value] as const)))
    )
  )

/**
 * The service binding as the site's Worker holds it: a request in, a response out, as the platform's `fetch`.
 * Cloudflare's `Fetcher` is one; it is named by shape here, so code that is not the Worker's (the tests) compiles
 * without the Workers' types.
 */
export interface ModelBinding {
  readonly fetch: typeof globalThis.fetch
}

/** A request for the usage model's member Api: as it came, and the page's member header the route sets, if any. */
export interface MemberCall {
  readonly request: HttpServerRequest.HttpServerRequest
  readonly pageMember: O.Option<string>
}

/** The model's Worker did not answer over the binding: a fault of the platform, said as a 502. */
export class ModelsUnreachable extends S.TaggedError<ModelsUnreachable, { readonly brand: unique symbol }>()(
  "ModelsUnreachable",
  { cause: S.Defect() }
) {}

/**
 * The app's models as the site's Worker reaches them: the server Api's client, built for one call (in a Worker, a
 * client's connection may not outlive the request it was made in), and a member's request handed to the member Api,
 * the only one a page reaches. The two places they run are its two Layers: `overBinding` and `inMemory`.
 */
export class Models extends Context.Service<
  Models,
  {
    /** The usage model's server Api, for one call: built in the caller's scope and gone with it. */
    readonly usageServer: Effect.Effect<UsageServerClient, never, Scope.Scope>
    /**
     * A page's call (a POST) or live read (a WebSocket upgrade) to the usage model's member Api, as the request came,
     * with the member header `pageMember` when the route set one: answered by the Api itself, its refusals typed in
     * the answer. A 101 comes back with its socket, and the copy the API's security headers are set on keeps it (seen
     * under `alchemy dev` by the harness test beside the stack test).
     */
    readonly usageMember: (call: MemberCall) => Effect.Effect<HttpServerResponse.HttpServerResponse>
  }
>()("@inventory/app/server/Models") {
  /**
   * Over the service binding to the model's Worker (`MODEL`, declared in `packages/infra/src/Inventory.stack.ts`):
   * every call is a request on the binding, the server Api's at the server prefix and a page's at the member prefix,
   * whatever path it came on, its body and headers as they came.
   */
  static readonly overBinding = (binding: ModelBinding) => {
    const fetch: typeof globalThis.fetch = (input, init) => binding.fetch(new Request(input, init))
    return Layer.effect(
      Models,
      Effect.gen(function* () {
        const http = yield* HttpClient.HttpClient
        return Models.of({
          usageServer: UsageServerApi.clientHttp(`${bound}${serverPrefix}`).pipe(
            Effect.provideService(HttpClient.HttpClient, http)
          ),
          usageMember: Effect.fnUntraced(function* ({ request, pageMember }) {
            const source = yield* HttpServerRequest.toWeb(request).pipe(Effect.orDie)
            // The path past the route's prefix is the model Worker's own: `/member`, or `/member/<id>` for a live read.
            const path = O.match(HttpServerRequest.toURL(request), {
              onNone: () => memberPrefix,
              onSome: (at) => `${Str.slice(modelRoutePrefix.length)(at.pathname)}${at.search}`
            })
            const forwarded = new Request(`${bound}${path}`, source)
            if (O.isSome(pageMember)) forwarded.headers.set(pageMemberHeader, pageMember.value)
            return yield* Effect.tryPromise({
              try: () => binding.fetch(forwarded),
              catch: (cause) => ModelsUnreachable.make({ cause })
            }).pipe(
              Effect.map((response) => HttpServerResponse.raw(response, { status: response.status })),
              // Said as the gateway's 502, with no word about the model.
              Effect.catchTag("ModelsUnreachable", (unreachable) =>
                Effect.as(
                  Effect.logError("The model's Worker did not answer over the binding", unreachable.cause),
                  HttpServerResponse.empty({ status: 502 })
                )
              )
            )
          })
        })
      })
    ).pipe(Layer.provide(FetchHttpClient.layer), Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch)))
  }

  /**
   * In this Worker's memory, on a memory host `platform`: the model Worker's own composition (`modelsOn`), behind the
   * model Worker's own session (`UsageSession`) over the one session lookup this Worker already holds, so a call is
   * judged here as it is there. Built once for the Worker's life, so the day's count lasts until the dev server
   * restarts. A live read does not work here: the memory host answers an upgrade with the runtime's own WebSocket
   * pair, which a request Effect's web adapter does not give it; no screen reads one at move 2.
   */
  static readonly inMemoryOn = <A, E, R>(platform: Layer.Layer<A, E, R>) =>
    Layer.effect(
      Models,
      Effect.gen(function* () {
        const lookup = yield* SessionLookup
        const hosted = yield* Layer.build(modelsOn({ platform, sessions: Layer.succeed(SessionLookup, lookup) }))
        const member = yield* Effect.provideContext(UsageMemberApi, hosted)
        return Models.of({
          usageServer: Effect.provideContext(UsageServerApi.clientInProcess, hosted),
          usageMember: Effect.fnUntraced(function* ({ request, pageMember }) {
            const named = O.match(pageMember, {
              onNone: () => request,
              onSome: (key) => request.modify({ headers: Headers.set(request.headers, pageMemberHeader, key) })
            })
            return yield* member.fetch.pipe(
              Effect.provideService(HttpServerRequest.HttpServerRequest, named),
              Effect.scoped,
              Effect.orElseSucceed(() => HttpServerResponse.empty({ status: 400 }))
            )
          })
        })
      })
    )

  /** In this Worker's memory on `Domain.InMemory`, which stamps commands with the wall clock: `bun run dev`. */
  static readonly inMemory = Models.inMemoryOn(Domain.InMemory)
}

/**
 * The gateway every model call is taken through, at the hosted half of move 2: a `TakeCall` for the actor's
 * organization, sent to the usage model's server Api as the person whose request this is (the cookie and the page's
 * member header it came with). Accepted is `taken`; `DayUsedUp` is `usedUp` with the sentence a person reads
 * (`usedUpSentence`, "... They come back at midnight UTC."). Any other refusal cannot be reached from the three askers
 * (each runs for a signed-in member of the organization it names, and a viewer asks only to view) and is a defect, as
 * is a model Worker that cannot be reached or answers with a fault: none of the askers answers by its rules then, and
 * the request it answers ends as a 500, as it did when the count on D1 failed (whether they should is Benjamin's,
 * with the words they would say). Sent with the default consistency, so a take never waits on a view.
 */
export const ModelAllowanceOverUsage = Layer.effect(
  ModelAllowanceGateway,
  Effect.gen(function* () {
    const models = yield* Models
    const take = Effect.fn("ModelAllowance.take")(function* (purpose: ModelCallPurpose) {
      const actor = yield* CurrentActor
      const request = yield* Effect.serviceOption(HttpServerRequest.HttpServerRequest)
      const headers = O.match(request, { onNone: () => Headers.empty, onSome: (one) => carriedOf(one.headers) })
      const server = yield* models.usageServer
      return yield* server.TakeCall({ organizationId: actor.organizationId, purpose }, { headers }).pipe(
        Effect.as(taken),
        Effect.catchTag("DayUsedUp", () => Effect.succeed(usedUp(usedUpSentence))),
        Effect.orDie
      )
    }, Effect.scoped)
    return ModelAllowanceGateway.of({ take })
  })
)
