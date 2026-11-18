// The one place a failure becomes words for the person: what went wrong and what to do next. The rule this file
// protects: the screen never shows a status code, a stack, a URL or a provider's own text. Those go to the console,
// once per failure, for whoever is debugging; the person reads a sentence. Every screen calls `sayError`, so a new
// kind of failure is worded here once, not in each component.
import { Predicate } from "effect"
import { HttpClientError } from "effect/http"
import { toast } from "sonner"
import type { AnsweredBy } from "../../api/v1/Api.ts"
import { type ModelTrouble, modelSentences } from "../../api/v1/ModelTrouble.ts"

/** A failure as the person reads it: a short title, one or two sentences, and every problem when there are several. */
export type Said = {
  readonly title: string
  readonly sentence: string
  /** One sentence per problem, all at once, when a request or a file had several. */
  readonly problems: ReadonlyArray<string>
}

/**
 * Why a model did not answer, in five words the screen knows (`ModelTrouble`), and the five sentences
 * (`modelSentences`). Both are the contract's (`src/api/v1/ModelTrouble.ts`), so the server words its `AiUnavailable`
 * with the same sentences; the provider's own words stay in the server's log.
 */
export { type ModelTrouble, modelSentences }

const providerName = (provider: string): string =>
  provider === "openrouter" ? "OpenRouter" : provider === "gateway" ? "the Vercel AI Gateway" : provider

/**
 * The line under a result that says who produced it: "Answered by anthropic/claude-haiku-5.5 through OpenRouter",
 * "Answered by a fallback model, …", or "Answered by the rules: no AI key is set up."
 *
 * @example answeredByLine({ _tag: "Rules", reason: "No AI key is set up." }) // "Answered by the rules: No AI key is set up."
 */
export const answeredByLine = (answeredBy: AnsweredBy): string =>
  answeredBy._tag === "Rules"
    ? `Answered by the rules: ${answeredBy.reason}`
    : `Answered by ${answeredBy.fallback ? "a fallback model, " : ""}${answeredBy.model} through ${providerName(answeredBy.provider)}`

const reasonOf = (error: unknown): string | undefined =>
  Predicate.hasProperty(error, "reason") && Predicate.isString(error.reason) && error.reason.trim() !== ""
    ? error.reason
    : undefined

const tagOf = (error: unknown): string | undefined =>
  Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag) ? error._tag : undefined

const statusOf = (error: HttpClientError.HttpClientError): number | undefined =>
  "response" in error.reason ? error.reason.response.status : undefined

// The kinds are the keys of `modelSentences`, so a kind added to the contract and given a sentence is known here too.
const isTrouble = (value: unknown): value is ModelTrouble =>
  Predicate.isString(value) && Object.hasOwn(modelSentences, value)

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
  if (!Predicate.hasProperty(error, "errors") || !Array.isArray(error.errors)) return []
  const seen: Array<string> = []
  for (const issue of error.errors) {
    if (!Predicate.hasProperty(issue, "path") || !Array.isArray(issue.path)) continue
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
  if (typeof error !== "object" || error === null) return console.error("[failure]", error)
  if (logged.has(error)) return
  logged.add(error)
  console.error("[failure]", error)
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
  switch (tag) {
    case "NotSignedIn":
      // Its reason names what was sent; the person needs only what to do.
      return said("We could not tell who you are", "Reload the page. If it happens again, sign in again.")
    case "Forbidden":
      return said(
        "Your role does not allow this",
        reasonOf(error) ?? "Ask an admin in your organization for the editor role."
      )
    case "AiUnavailable": {
      const kind = Predicate.hasProperty(error, "kind") ? error.kind : undefined
      return said(
        "The model did not answer",
        isTrouble(kind) ? modelSentences[kind] : (reasonOf(error) ?? modelSentences.down)
      )
    }
    case "BadRequestProblem": {
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
    }
    case "InternalServerErrorProblem":
      return said(
        "Something went wrong on our side",
        "Nothing was changed. Try again; if it keeps happening, reload the page."
      )
  }
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
  if (tag === "FileProblem" && Predicate.hasProperty(error, "problem") && Predicate.hasProperty(error, "todo")) {
    if (Predicate.isString(error.problem) && Predicate.isString(error.todo))
      return said("The file was not read", `${error.problem} ${error.todo}`)
  }
  // The reader itself failed: its sentence says what to do.
  if (tag === "ReadFailed" && Predicate.hasProperty(error, "message") && Predicate.isString(error.message)) {
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
