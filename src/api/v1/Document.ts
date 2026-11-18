// What the OpenAPI document says that the contract's own types cannot: corrections made to the generated document
// only (`OpenApi.Transform` on the `Api`, applied last). Nothing here changes a route, a payload or an answer; the
// one thing not to break is that every line below states what the server already does, never what it should do.
import { Equal } from "effect"

/** The name of the security scheme every signed-in endpoint lists: the session cookie Better Auth sets. */
export const sessionCookieScheme = "sessionCookie"

/**
 * The session cookie as an OpenAPI security scheme. Declared here, in the document, and not as `security` on the
 * `Identity` middleware: that would make Effect hand the middleware a decoded cookie, and both implementations (the
 * session's, and the tests' header identity, which reads no cookie) would have to change shape for a line of docs.
 */
const sessionCookie = {
  type: "apiKey",
  in: "cookie",
  name: "takehome.session_token",
  description:
    "The session cookie Better Auth sets when you sign in at `POST /api/auth/sign-in/email` (HttpOnly, " +
    "SameSite=Lax). A copy served over https names it `__Secure-takehome.session_token`. The browser sends it by " +
    "itself; nothing in a header or a payload can choose who a request acts as."
}

type Json = Record<string, any>

const methods = ["get", "put", "post", "delete", "patch", "head", "options"]

/** Every operation of the document, with its method. */
const operationsOf = (spec: Json): Array<{ readonly method: string; readonly operation: Json }> => {
  const found: Array<{ readonly method: string; readonly operation: Json }> = []
  for (const item of Object.values<Json>(spec["paths"] ?? {})) {
    for (const method of methods) {
      const operation = item[method]
      if (operation !== undefined) found.push({ method, operation })
    }
  }
  return found
}

const refPrefix = "#/components/schemas/"

/** Every `$ref` to a component schema, anywhere in the document, pointed at the component's new name. */
const renameRefs = (node: unknown, renamed: Readonly<Record<string, string>>): void => {
  if (Array.isArray(node)) {
    for (const item of node) renameRefs(item, renamed)
    return
  }
  if (typeof node !== "object" || node === null) return
  const object = node as Json
  const ref = object["$ref"]
  if (typeof ref === "string" && ref.startsWith(refPrefix)) {
    const name = ref.slice(refPrefix.length)
    if (Object.hasOwn(renamed, name)) object["$ref"] = `${refPrefix}${renamed[name]}`
  }
  for (const value of Object.values(object)) renameRefs(value, renamed)
}

/**
 * Component names a reader and a generated client can use. Effect names the wire side of a `Schema.Class` or a
 * `Schema.TaggedError` with `Encoded` appended (`MemberEncoded`), and emits a second copy (`RowDecision_1`) of a
 * named schema it meets through two routes. Here a class takes its own name when that name is free, and a numbered
 * copy that is identical to the original is folded into it. A copy that differs keeps its number.
 */
const nameComponents = (spec: Json): void => {
  const schemas: Json = spec["components"]["schemas"]
  const renamed: Record<string, string> = {}
  for (const name of Object.keys(schemas)) {
    const copy = /^(.+)_\d+$/.exec(name)
    const original = copy?.[1]
    if (original !== undefined && Object.hasOwn(schemas, original) && Equal.equals(schemas[name], schemas[original])) {
      renamed[name] = original
      continue
    }
    const plain = /^(.+)Encoded$/.exec(name)?.[1]
    if (plain !== undefined && !Object.hasOwn(schemas, plain)) renamed[name] = plain
  }
  const next: Json = {}
  for (const [name, schema] of Object.entries(schemas)) {
    const to = renamed[name] ?? name
    if (!Object.hasOwn(next, to)) next[to] = schema
  }
  spec["components"]["schemas"] = next
  renameRefs(spec, renamed)
}

/**
 * Responses the server can never send, taken off the operations that list them. `SameOrigin` and `ProblemDetails`
 * cover the whole API, so Effect documents their errors on every operation; but `SameOrigin` lets every read through
 * (`allowsRequest` in src/server/SameOrigin.ts), so a GET never answers `CrossSiteRequest`, and an operation with no
 * path parameter, no query and no body has nothing a caller sent that could fail its Schema with a 400. A 403 that
 * also covers `Forbidden` (a role too low) is shared by both errors and is left as it is.
 */
const dropImpossibleResponses = (spec: Json): void => {
  for (const { method, operation } of operationsOf(spec)) {
    const responses: Json = operation["responses"] ?? {}
    const refused = responses["403"]?.["content"]?.["application/json"]?.["schema"]?.["$ref"]
    if (method === "get" && refused === `${refPrefix}CrossSiteRequest`) delete responses["403"]
    const parameters: ReadonlyArray<unknown> = operation["parameters"] ?? []
    if (parameters.length === 0 && operation["requestBody"] === undefined) delete responses["400"]
  }
}

/**
 * The session cookie declared as a scheme, and required on every operation that can answer 401: exactly the
 * endpoints under the `Identity` middleware, whose error (`NotSignedIn`) is that 401. `identity.session` answers for
 * nobody too, has no 401, and stays open.
 */
const declareSessionCookie = (spec: Json): void => {
  spec["components"]["securitySchemes"] = {
    ...spec["components"]["securitySchemes"],
    [sessionCookieScheme]: sessionCookie
  }
  for (const { operation } of operationsOf(spec)) {
    if (operation["responses"]?.["401"] !== undefined) operation["security"] = [{ [sessionCookieScheme]: [] }]
  }
}

/**
 * The generated OpenAPI document with what only the document can say. Given to `OpenApi.Transform` on the `Api`.
 */
export const describeDocument = (spec: Json): Json => {
  nameComponents(spec)
  dropImpossibleResponses(spec)
  declareSessionCookie(spec)
  return spec
}
