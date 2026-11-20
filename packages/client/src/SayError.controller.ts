// The one place a failure becomes words for the person: what went wrong and what to do next. The rule this file
// protects: the screen never shows a status code, a stack, a URL or a provider's own text. Those go to the console,
// once per failure, for whoever is debugging; the person reads a sentence. Every screen calls `sayError`, so a new
// kind of failure is worded here once, not in each component.
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as HttpClientError from "effect/http/HttpClientError"
import { toast } from "sonner"

/** A failure as the person reads it: a short title, one or two sentences, and every problem when there are several. */
export type Said = {
  readonly title: string
  readonly sentence: string
  /** One sentence per problem, all at once, when a request or a file had several. */
  readonly problems: ReadonlyArray<string>
}

let troubles: Readonly<Record<string, string>> = {}

/**
 * The sentences a model failure is said in, by kind (the app passes the contract's `modelSentences` at start). An
 * unknown kind reads as the `down` sentence.
 */
export const installTroubleSentences = (sentences: Readonly<Record<string, string>>): void => {
  troubles = sentences
}

const troubleSentence = (kind: string): string =>
  (Object.hasOwn(troubles, kind) ? troubles[kind] : troubles["down"]) ??
  "The model is not answering right now. Try again later."

const reasonOf = (error: unknown): string | undefined =>
  P.hasProperty(error, "reason") && P.isString(error.reason) && error.reason.trim() !== "" ? error.reason : undefined

const tagOf = (error: unknown): string | undefined =>
  P.hasProperty(error, "_tag") && P.isString(error._tag) ? error._tag : undefined

const statusOf = (error: HttpClientError.HttpClientError): number | undefined =>
  "response" in error.reason ? error.reason.response.status : undefined

/** A request field's last path segment, made readable: `payload.unitCost` is "unit cost". */
const fieldWords = (path: ReadonlyArray<string | number>): string => {
  const last = [...path].reverse().find((segment): segment is string => typeof segment === "string")
  return last === undefined ? "a value" : last.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
}

/**
 * Every problem of a refused request, one sentence each, all at once. `fields` names the screen's fields in its own
 * words (`{ action: "Action" }`); a field it does not name is said from its key.
 */
const requestProblems = (error: unknown, fields: Readonly<Record<string, string>>): ReadonlyArray<string> => {
  if (!P.hasProperty(error, "errors") || !Array.isArray(error.errors)) return []
  const seen: Array<string> = []
  for (const issue of error.errors) {
    if (!P.hasProperty(issue, "path") || !Array.isArray(issue.path)) continue
    const path = issue.path.filter((segment): segment is string | number => typeof segment !== "object")
    const key = [...path].reverse().find((segment): segment is string => typeof segment === "string") ?? ""
    const label = Object.hasOwn(fields, key) ? (fields[key] ?? key) : fieldWords(path)
    const sentence = `${label.charAt(0).toUpperCase()}${label.slice(1)} was not accepted. Check it and try again.`
    if (!seen.includes(sentence)) seen.push(sentence)
  }
  return seen
}

// Weak, so a failure already logged is let go with it; Effect has no weak collection to use instead.
const logged = new WeakSet<object>()

/** The raw failure, for whoever is debugging: in the console once, never on the screen. */
const logOnce = (error: unknown) => {
  if (typeof error !== "object" || error === null) return Effect.runSync(Effect.logError("[failure]", error))
  if (logged.has(error)) return
  logged.add(error)
  Effect.runSync(Effect.logError("[failure]", error))
}

/**
 * Says any failure the browser can meet: a typed API error, a refused request, the network, a server error or an
 * answer that could not be read. `fields` gives the screen's own names for a form's fields. The raw failure goes to
 * the console, once.
 *
 * @example sayError(networkFailure).sentence // "The server could not be reached. Check the connection and try again."
 */
export const sayError = (
  error: unknown,
  options: { readonly fields?: Readonly<Record<string, string>> } = {}
): Said => {
  logOnce(error)
  const tag = tagOf(error)
  const said = (title: string, sentence: string, problems: ReadonlyArray<string> = []): Said => ({
    title,
    sentence,
    problems
  })
  const known = Match.value(tag).pipe(
    // Its reason names what was sent; the person needs only what to do.
    Match.when("NotSignedIn", () =>
      said("We could not tell who you are", "Reload the page. If it happens again, sign in again.")
    ),
    Match.when("Forbidden", () =>
      said("Your role does not allow this", reasonOf(error) ?? "Ask an admin in your organization for the editor role.")
    ),
    // Said by its kind, from the sentences the app installed (the contract's `modelSentences`), never by the error's
    // own text: a provider's words never reach the screen.
    Match.when("AiUnavailable", () => {
      const kind = P.hasProperty(error, "kind") && P.isString(error.kind) ? error.kind : "down"
      return said("The model did not answer", troubleSentence(kind))
    }),
    Match.when("BadRequestProblem", () => {
      const problems = requestProblems(error, options.fields ?? {})
      return said(
        "This was not accepted",
        problems.length === 0
          ? "Something in it was not accepted. Reload the page and try again."
          : problems.length === 1
            ? (problems[0] ?? "")
            : `${problems.length} things need a look before it can be saved.`,
        problems.length > 1 ? problems : []
      )
    }),
    Match.when("InternalServerErrorProblem", () =>
      said(
        "Something went wrong on our side",
        "Nothing was changed. Try again; if it keeps happening, reload the page."
      )
    ),
    Match.option
  )
  if (O.isSome(known)) return known.value
  if (HttpClientError.isHttpClientError(error)) {
    const status = statusOf(error)
    if (error.reason._tag === "TransportError") {
      return said(
        "The server could not be reached",
        "Check the connection and try again. Nothing was lost on this page."
      )
    }
    if (status === 429) return said("Too many requests at once", "Wait a few seconds and try again.")
    if (status !== undefined && status >= 500) {
      return said(
        "Something went wrong on our side",
        "Nothing was changed. Try again; if it keeps happening, reload the page."
      )
    }
    return said("The server's answer could not be read", "Reload the page and try again.")
  }
  // A file's own problem (`FileProblem`, read by its tag) is written for the person: what is wrong, then what to do.
  if (tag === "FileProblem" && P.hasProperty(error, "problem") && P.hasProperty(error, "todo")) {
    if (P.isString(error.problem) && P.isString(error.todo))
      return said("The file was not read", `${error.problem} ${error.todo}`)
  }
  // The reader itself failed: its sentence says what to do.
  if (tag === "ReadFailed" && P.hasProperty(error, "message") && P.isString(error.message)) {
    return said("The file was not read", error.message)
  }
  if (tag === "FileNotKept") {
    return said(
      "This browser would not keep your progress",
      "Your work on this page is fine, but a refresh would lose it. Finish here, or allow this site to store data."
    )
  }
  // Any other typed error of this app's API: its `reason` is written for the person, by the contract's rule.
  const reason = reasonOf(error)
  if (reason !== undefined) return said("That did not work", reason)
  return said("Something went wrong", "Try again, and reload the page if it keeps happening.")
}

/**
 * Shows a failure as a toast: its title, the sentence under it, and `lead` before the sentence when the screen has
 * more to say ("Your line was not recorded."). `action` adds one button, such as "Edit again".
 */
export const toastError = (
  error: unknown,
  options: { readonly lead?: string; readonly action?: { readonly label: string; readonly onClick: () => void } } = {}
): void => {
  const said = sayError(error)
  toast.error(said.title, {
    description: options.lead === undefined ? said.sentence : `${options.lead} ${said.sentence}`,
    ...(options.action === undefined ? {} : { action: options.action })
  })
}

/**
 * True for a failure that asking again may fix: the network, a server error, "too many requests". A typed refusal
 * (a role, a bad request, a missing record) gets the same answer every time, so it is never asked again.
 */
export const isTransient = (error: unknown): boolean => {
  // The server's own 500, as the API's problem document: the request was fine, so another try may pass.
  if (tagOf(error) === "InternalServerErrorProblem") return true
  if (!HttpClientError.isHttpClientError(error)) return false
  if (error.reason._tag === "TransportError") return true
  const status = statusOf(error)
  return status !== undefined && (status === 429 || status >= 500)
}
