// What the OpenAPI document says that the contract's own types cannot: corrections made to the generated document
// only (`OpenApi.Transform` on the `Api`, applied last). Nothing here changes a route, a payload or an answer; the
// one thing not to break is that every line below states what the server already does, never what it should do.
import * as A from "effect/Array"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import { identity } from "effect/Function"
import * as R from "effect/Record"
import * as S from "effect/Schema"
import * as Str from "effect/String"

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
  name: "inventory.session_token",
  description:
    "The session cookie Better Auth sets when you sign in at `POST /api/auth/sign-in/email` (HttpOnly, " +
    "SameSite=Lax). A copy served over https names it `__Secure-inventory.session_token`. The browser sends it by " +
    "itself; nothing in a header or a payload can choose who a request acts as."
}

type Json = Record<string, any>

const methods = ["get", "put", "post", "delete", "patch", "head", "options"]

/** Every operation of the document, with its method. */
const operationsOf = (spec: Json): Array<{ readonly method: string; readonly operation: Json }> => {
  const found: Array<{ readonly method: string; readonly operation: Json }> = []
  const paths = O.map(O.fromNullishOr(spec["paths"]), (paths) => R.values<string, Json>(paths))
  for (const item of O.match(paths, { onNone: A.empty, onSome: identity })) {
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
  if (A.isArray(node)) {
    for (const item of node) renameRefs(item, renamed)
    return
  }
  if (!P.isObject(node)) return
  const ref = node["$ref"]
  if (typeof ref === "string" && Str.startsWith(refPrefix)(ref)) {
    const name = Str.slice(refPrefix.length)(ref)
    if (R.has(renamed, name)) node["$ref"] = `${refPrefix}${renamed[name]}`
  }
  for (const value of R.values(node)) renameRefs(value, renamed)
}

/**
 * Component names a reader and a generated client can use. Effect names the wire side of a `Schema.Class` or a
 * `Schema.TaggedError` with `Encoded` appended (`MemberEncoded`), names a schema with an identity identifier by its
 * whole path (`_beep_inventory_kernel_AccessError_Forbidden`, from `@inventory/kernel`), and emits a second copy
 * (`RowDecision_1`) of a named schema it meets through two routes. Here a schema takes its own name (the last part of
 * the path) when that name is free, and a numbered copy that is identical to the original is folded into it. A copy
 * that differs keeps its number.
 */
/** A part of the document as JSON writes it, told apart by its structure, not by Effect's opaque `Schema.Json`. */
const DocumentPart = S.suspend((): S.Codec<S.Json> =>
  S.Union([S.Null, S.Boolean, S.Finite, S.String, S.Array(DocumentPart), S.Record(S.String, DocumentPart)])
)

/**
 * True when two parts of the document say the same thing: the same keys and values, whatever order the keys are in.
 * Derived from the structure, so it compares afresh on every pass: `Equal.equals` would remember a pair of objects
 * that a later pass has changed in place.
 */
const sameShape = S.toEquivalence(DocumentPart)

/** A regular expression's first capture, present only when the complete name matches. */
const nameGroup = (pattern: RegExp, name: string) =>
  O.flatMap(O.fromNullOr(pattern.exec(name)), (match) => A.get(match, 1))

/** One pass of naming: true when a component was renamed or folded, so another pass may find more. */
const nameOnce = (spec: Json): boolean => {
  const schemas: Json = spec["components"]["schemas"]
  const renamed: Record<string, string> = {}
  for (const name of R.keys(schemas)) {
    const original = O.filter(
      nameGroup(/^(.+)_\d+$/, name),
      (original) => R.has(schemas, original) && sameShape(schemas[name], schemas[original])
    )
    if (O.isSome(original)) {
      renamed[name] = original.value
      continue
    }
    const unsuffixed = O.match(nameGroup(/^(.+)Encoded$/, name), { onNone: () => name, onSome: identity })
    const plain = O.match(nameGroup(/^_beep_(?:[A-Za-z0-9]+_)+([A-Za-z0-9]+)$/, unsuffixed), {
      onNone: () => unsuffixed,
      onSome: identity
    })
    // Its own name when that is free, or when what holds it is the very same shape.
    if (plain !== name && (!R.has(schemas, plain) || sameShape(schemas[name], schemas[plain]))) {
      renamed[name] = plain
    }
  }
  const next: Json = {}
  for (const [name, schema] of R.toEntries(schemas)) {
    const to = O.match(O.fromNullishOr(renamed[name]), { onNone: () => name, onSome: identity })
    if (!R.has(next, to)) next[to] = schema
  }
  spec["components"]["schemas"] = next
  renameRefs(spec, renamed)
  return !R.isEmptyRecord(renamed)
}

// A copy that points at another copy is identical to its original only once that one has been folded, so the
// naming is repeated until a pass changes nothing (a few passes: one per level of nesting).
const nameComponents = (spec: Json): void => {
  let passes = 0
  while (passes < 12 && nameOnce(spec)) passes += 1
}

/**
 * Responses the server can never send, taken off the operations that list them. `SameOrigin` and `ProblemDetails`
 * cover the whole API, so Effect documents their errors on every operation; but `SameOrigin` lets every read through
 * (`RequestSource.allows` in @inventory/kernel/SameOrigin), so a GET never answers `CrossSiteRequest`, and an operation with no
 * path parameter, no query and no body has nothing a caller sent that could fail its Schema with a 400. A 403 that
 * also covers `Forbidden` (a role too low) is shared by both errors and is left as it is.
 */
const dropImpossibleResponses = (spec: Json): void => {
  for (const { method, operation } of operationsOf(spec)) {
    O.map(O.fromNullishOr(operation["responses"]), (responses: Json) => {
      const refused = responses["403"]?.["content"]?.["application/json"]?.["schema"]?.["$ref"]
      if (method === "get" && refused === `${refPrefix}CrossSiteRequest`) delete responses["403"]
      const noParameters = O.match(O.fromNullishOr(operation["parameters"]), {
        onNone: () => true,
        onSome: (parameters: ReadonlyArray<unknown>) => parameters.length === 0
      })
      if (noParameters && operation["requestBody"] === undefined) delete responses["400"]
    })
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
