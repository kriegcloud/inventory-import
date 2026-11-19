import * as S from "effect/Schema"
import * as HttpApi from "effect/http-api/HttpApi"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiMiddleware from "effect/http-api/HttpApiMiddleware"
import * as OpenApi from "effect/http-api/OpenApi"
import { ActivityApi, IdentityApi, PeopleApi } from "@inventory/access-contract/Access"
import { ModelCallsUsedUp } from "@inventory/access-contract/ModelAllowance"
import { AiProvider, AnsweredBy } from "@inventory/catalog-contract/Answer"
import { AssistantApi, ImportsApi, ItemsApi } from "@inventory/catalog-contract/Catalog"
import { describeDocument } from "./Document.ts"
import { Forbidden } from "@inventory/kernel/AccessError"
import { Identity } from "@inventory/kernel/Identity"
import { SameOrigin } from "@inventory/kernel/SameOrigin"
import { apiPrefix } from "./Version.ts"
import { AiUnavailable } from "@inventory/catalog-contract/AiUnavailable"

// The API contract, version 1. The server implements it (src/server) and the browser calls it through a client
// derived from this same definition (src/web/lib/api.ts), so a renamed field is a compile error on both sides.
// Sign-in routes are never versioned: Better Auth answers /api/auth/*, beside this (@inventory/access-host/SignIn).

export { apiPrefix } from "./Version.ts"

/** The OpenAPI document generated from this contract. Served in development and in production. */
export const openApiPath = `${apiPrefix}/openapi.json` as const

/** The API reference page (Scalar). Served in development only: a production build has no such route. */
export const docsPath = `${apiPrefix}/docs` as const

/** One step of the model plan: a provider, the model asked first, and the models that provider falls back to. */
export class AiRoute extends S.Class<AiRoute, { readonly brand: unique symbol }>("AiRoute")(
  {
    provider: AiProvider,
    model: S.String.annotateKey({ description: "The model asked first on this provider (a vendor/model id)." }),
    fallbackModels: S.Array(S.String).annotateKey({
      description: "Models this provider tries, in order, when the first one fails (OpenRouter's models list)."
    })
  },
  { description: "One provider in the order the server tries them." }
) {}

/** Whether a language model can be used right now, and in which order the server will try them. */
export class AiStatus extends S.Class<AiStatus, { readonly brand: unique symbol }>("AiStatus")(
  {
    available: S.Boolean.annotateKey({ description: "False with no key, or with AI_ENABLED=false." }),
    provider: S.Literals(["openrouter", "none"]).annotateKey({
      description: "The provider asked first, or none when AI is off."
    }),
    model: S.String.annotateKey({ description: "The model asked first (AI_MODEL), even when AI is off." }),
    routes: S.Array(AiRoute).annotateKey({
      description: "Every provider the server will try, in order. After the last, features use their non-AI path."
    }),
    reason: S.String.annotateKey({
      description: "One sentence for the screen: why AI is off, or what will answer when it is on."
    })
  },
  { description: "What will answer a model call, so nobody waits on a missing key." }
) {}

/** Health of the stack as the current member sees it. The activity count is their organization's only. */
export class SystemStatus extends S.Class<SystemStatus, { readonly brand: unique symbol }>("SystemStatus")(
  {
    database: S.Struct({
      ok: S.Boolean.annotateKey({ description: "True when the database answered this request" }),
      activityCount: S.Int.annotateKey({
        description: "Audit-trail rows in the actor's organization.",
        examples: [12]
      })
    }).annotateKey({ description: "Whether the database answers, and one count read from it" }),
    ai: AiStatus
  },
  { description: "Whether the database answers and what will answer a model call." }
) {}

/** One round trip to the model, timed, so a person can see the key works before relying on it. */
export class AiCheck extends S.Class<AiCheck, { readonly brand: unique symbol }>("AiCheck")(
  {
    model: S.String.annotateKey({ description: "The model that answered." }),
    reply: S.String.annotateKey({ description: "What the model said back to the test prompt" }),
    millis: S.Int.annotateKey({
      description: "How long the whole call took, retries and fallbacks included.",
      examples: [840]
    }),
    answeredBy: AnsweredBy
  },
  { description: "The model's answer to a short test prompt, and how long it took." }
) {}

/** Liveness and configuration. Both endpoints name the actor: the count is tenant data and the check spends the key. */
export class SystemApi extends HttpApiGroup.make("system")
  .add(
    HttpApiEndpoint.get("status", "/status", { success: SystemStatus })
      .annotate(OpenApi.Summary, "Database health and what will answer a model call")
      .annotate(
        OpenApi.Description,
        "Whether the database answers, how many audit-trail rows the caller's organization has, and which model, if any, will answer a model call. Any member may read it."
      ),
    HttpApiEndpoint.post("checkAi", "/ai-check", {
      success: AiCheck,
      error: [AiUnavailable, Forbidden, ModelCallsUsedUp]
    })
      .annotate(OpenApi.Summary, "Ask the model for a short reply, to see the key works")
      .annotate(
        OpenApi.Description,
        "Sends one short prompt to the model and times the answer. It spends one of the organization's daily model calls, so it counts as a write: needs the editor role. Answers 503 when no model could answer and 429 when the day's calls are used up."
      )
  )
  .middleware(Identity)
  .prefix("/system")
  .annotate(OpenApi.Title, "System")
  .annotate(OpenApi.Description, "Whether the stack works, as the current member sees it.") {}

/**
 * Everything the browser can call. A request that does not match its Schema gets a 400 problem document listing
 * every field that is wrong at once (`errors: "all"`, `HttpApiMiddleware.ProblemDetails`); a write that did not come
 * from this app's own pages is refused first (`SameOrigin`).
 */
export class Api extends HttpApi.make("inventory")
  .add(SystemApi)
  .add(IdentityApi)
  .add(ActivityApi)
  .add(ImportsApi)
  .add(ItemsApi)
  .add(PeopleApi)
  .add(AssistantApi)
  .middleware(HttpApiMiddleware.ProblemDetails)
  .middleware(SameOrigin)
  .prefix(apiPrefix)
  .annotate(HttpApi.PayloadParseOptions, { errors: "all" })
  .annotate(OpenApi.Title, "Items API")
  // The document's own version, not the path's and not package.json's (each release bumps that): the major is
  // the `v1` of the address, the minor goes up when the contract gains something, the patch when only words change.
  .annotate(OpenApi.Version, "1.0.0")
  // No `OpenApi.Servers`: OpenAPI reads a document without one as served from "/" of whichever host serves it, which
  // is the truth here. Written out as "/", it is joined to every path as "//api/v1/..." on the reference page.
  .annotate(
    OpenApi.Description,
    "The contract the browser calls.\n\n" +
      "**Signing in** is not part of this document: `POST /api/auth/sign-in/email` (Better Auth, with `email` and " +
      "`password` as JSON) sets the session cookie every endpoint here reads, except `GET /identity/session`, which " +
      "answers for nobody too.\n\n" +
      "Each endpoint acts as the signed-in member of their active organization and sees only that organization's " +
      "rows; nothing in a payload can name another member or organization.\n\n" +
      "A write must come from this app's own pages (`Sec-Fetch-Site: same-origin`, or an `Origin` that is the " +
      "app's own). A request with neither header is not from a browser page and is let through to the session check."
  )
  .annotate(OpenApi.Transform, describeDocument) {}
