import { UnknownError } from "./internal/unknownError.adapter.ts"
import * as SchemaTransformation from "effect/SchemaTransformation"
import { dual } from "effect/Function"
// The one place a failure becomes words for the person: what went wrong and what to do next. The rule this file
// protects: the screen never shows a status code, a stack, a URL or a provider's own text. Those go to the console,
// once per failure, for whoever is debugging; the person reads a sentence. Every screen calls `sayError`, so a new
// kind of failure is worded here once, not in each component.
import * as A from "effect/Array"
import * as R from "effect/Record"
import * as Effect from "effect/Effect"
import * as Match from "effect/Match"
import * as O from "effect/Option"
import * as P from "effect/Predicate"
import * as S from "effect/Schema"
import * as HttpClientError from "effect/http/HttpClientError"
import * as HttpApiError from "effect/http-api/HttpApiError"
import { Forbidden, NotSignedIn } from "@inventory/kernel/AccessError"
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
  O.match(
    O.orElse(R.get(troubles, kind), () => R.get(troubles, "down")),
    {
      onNone: () => "The model is not answering right now. Try again later.",
      onSome: (sentence) => sentence
    }
  )

// The failures of other packages said here by their shape: this package holds no contract, so each is its schema's
// shape, checked whole (its tag and every field read from it), never a tag looked at alone. The API's own problem
// documents are Effect's classes, checked by class.
const ModelTrouble = S.TaggedStruct("AiUnavailable", { kind: S.String })
const DraftBusy = S.TaggedStruct("DraftBusy", {})
const FileProblem = S.TaggedStruct("FileProblem", { problem: S.String, todo: S.String })
const ReadFailed = S.TaggedStruct("ReadFailed", { message: S.String })
const FileNotKept = S.TaggedStruct("FileNotKept", {})
const isBadRequest = S.is(HttpApiError.BadRequestProblem)
const isServerProblem = S.is(HttpApiError.InternalServerErrorProblem)
const isFileProblem = S.is(FileProblem)
const isReadFailed = S.is(ReadFailed)
const isFileNotKept = S.is(FileNotKept)

const NonblankReason = S.String.check(S.isPattern(/\S/)).annotate({
  description: "A failure's sentence for the person, preserving its original whitespace when nonblank."
})
const reasonOf = (error: unknown): O.Option<string> =>
  P.hasProperty(error, "reason") ? O.liftPredicate(error.reason, S.is(NonblankReason)) : O.none()

const statusOf = (error: HttpClientError.HttpClientError): O.Option<number> =>
  "response" in error.reason ? O.some(error.reason.response.status) : O.none()

const FieldWords = S.String.pipe(
  S.decode(
    SchemaTransformation.transform({ decode: (key) => key.replace(/([a-z])([A-Z])/g, "$1 $2"), encode: (key) => key })
  ),
  S.decode(SchemaTransformation.toLowerCase())
).annotate({ description: "A request field key in readable words." })
const ProblemSentence = S.String.pipe(
  S.decode(SchemaTransformation.capitalize()),
  S.decode(
    SchemaTransformation.transform({
      decode: (label) => `${label} was not accepted. Check it and try again.`,
      encode: (sentence) => sentence
    })
  )
).annotate({
  description: "The complete refused-field sentence, preserving the label's spelling after its first character."
})
const readFieldWords = S.decodeOption(FieldWords)
const readProblemSentence = S.decodeOption(ProblemSentence)

/** A request field's last path segment, made readable. */
const fieldWords = (path: ReadonlyArray<string | number>): O.Option<string> =>
  O.flatMap(A.findLast(path, P.isString), readFieldWords)

/**
 * Every problem of a refused request, one sentence each, all at once. `fields` names the screen's fields in its own
 * words (`{ action: "Action" }`); a field it does not name is said from its key.
 */
const requestProblems: {
  (fields: Readonly<Record<string, string>>): (error: unknown) => ReadonlyArray<string>
  (error: unknown, fields: Readonly<Record<string, string>>): ReadonlyArray<string>
} = dual(2, (error: unknown, fields: Readonly<Record<string, string>>): ReadonlyArray<string> => {
  if (!P.hasProperty(error, "errors") || !Array.isArray(error.errors)) return []
  const seen: Array<string> = []
  for (const issue of error.errors) {
    if (!P.hasProperty(issue, "path") || !Array.isArray(issue.path)) continue
    const path = issue.path.filter((segment): segment is string | number => typeof segment !== "object")
    const key = A.findLast(path, P.isString)
    const label = O.orElse(O.match(key, { onNone: () => R.get(fields, ""), onSome: (key) => R.get(fields, key) }), () =>
      fieldWords(path)
    )
    const sentence = O.match(O.flatMap(label, readProblemSentence), {
      onNone: () => "A value was not accepted. Check it and try again.",
      onSome: (sentence) => sentence
    })
    if (!seen.includes(sentence)) seen.push(sentence)
  }
  return seen
})

// Weak, so a failure already logged is let go with it; Effect has no weak collection to use instead.
const logged = new WeakSet<object>()

/** The raw failure, for whoever is debugging: in the console once, never on the screen. */
const logOnce = (error: unknown) => {
  if (UnknownError.isWeakKey(error)) {
    if (logged.has(error)) return Effect.void
    logged.add(error)
  }
  return Effect.logError("[failure]", error)
}

/**
 * Says any failure the browser can meet: a typed API error, a refused request, the network, a server error or an
 * answer that could not be read. `fields` gives the screen's own names for a form's fields. The raw failure goes to
 * the console, once.
 *
 * @example sayError(networkFailure).sentence // "The server could not be reached. Check the connection and try again."
 */
export const sayError: {
  (options: { readonly fields: Readonly<Record<string, string>> }): (error: unknown) => Said
  (error: unknown, options: { readonly fields: Readonly<Record<string, string>> }): Said
} = dual(2, (error: unknown, options: { readonly fields: Readonly<Record<string, string>> }): Said => {
  Effect.runFork(logOnce(error))
  const said = (title: string, sentence: string): Said => ({ title, sentence, problems: [] })
  const known = Match.value(error).pipe(
    // Its reason names what was sent; the person needs only what to do.
    Match.when(S.is(NotSignedIn), () =>
      said("We could not tell who you are", "Reload the page. If it happens again, sign in again.")
    ),
    Match.when(S.is(Forbidden), () =>
      O.match(reasonOf(error), {
        onNone: () => said("Your role does not allow this", "Ask an admin in your organization for the editor role."),
        onSome: (reason) => said("Your role does not allow this", reason)
      })
    ),
    // Said by its kind, from the sentences the app installed (the contract's `modelSentences`), never by the error's
    // own text: a provider's words never reach the screen.
    Match.when(S.is(ModelTrouble), (trouble) => said("The model did not answer", troubleSentence(trouble.kind))),
    Match.when(isBadRequest, () => {
      const problems = requestProblems(error, options.fields)
      return A.match(problems, {
        onEmpty: () =>
          said("This was not accepted", "Something in it was not accepted. Reload the page and try again."),
        onNonEmpty: (problems) => ({
          title: "This was not accepted",
          sentence:
            problems.length === 1
              ? A.headNonEmpty(problems)
              : `${problems.length} things need a look before it can be saved.`,
          problems: problems.length > 1 ? problems : []
        })
      })
    }),
    // What a save, a confirm or a match was worked out against kept changing: the import, the items it would change, or
    // both. Its reason says which, so the title says neither; nothing was written, and the reason says to try again.
    Match.when(S.is(DraftBusy), () =>
      O.match(reasonOf(error), {
        onNone: () => said("Nothing was written", "Something kept changing meanwhile. Try again in a moment."),
        onSome: (reason) => said("Nothing was written", reason)
      })
    ),
    Match.when(isServerProblem, () =>
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
    if (unreachable(error)) {
      return said(
        "The server could not be reached",
        "Check the connection and try again. Nothing was lost on this page."
      )
    }
    if (O.contains(status, 429)) return said("Too many requests at once", "Wait a few seconds and try again.")
    if (O.exists(status, (status) => status >= 500)) {
      return said(
        "Something went wrong on our side",
        "Nothing was changed. Try again; if it keeps happening, reload the page."
      )
    }
    return said("The server's answer could not be read", "Reload the page and try again.")
  }
  // A file's own problem (`FileProblem`, read by its tag) is written for the person: what is wrong, then what to do.
  if (isFileProblem(error)) return said("The file was not read", `${error.problem} ${error.todo}`)
  // The reader itself failed: its sentence says what to do.
  if (isReadFailed(error)) return said("The file was not read", error.message)
  if (isFileNotKept(error)) {
    return said(
      "This browser would not keep your progress",
      "Your work on this page is fine, but a refresh would lose it. Finish here, or allow this site to store data."
    )
  }
  // Any other typed error of this app's API: its `reason` is written for the person, by the contract's rule.
  const reason = reasonOf(error)
  return O.match(reason, {
    onSome: (reason) => said("That did not work", reason),
    onNone: () => said("Something went wrong", "Try again, and reload the page if it keeps happening.")
  })
})

/**
 * Shows a failure as a toast: its title, the sentence under it, and `lead` before the sentence when the screen has
 * more to say ("Your line was not recorded."). `action` adds one button, such as "Edit again".
 */
export const toastError: {
  (options: {
    readonly lead: O.Option<string>
    readonly action?: { readonly label: string; readonly onClick: () => void }
  }): (error: unknown) => void
  (
    error: unknown,
    options: {
      readonly lead: O.Option<string>
      readonly action?: { readonly label: string; readonly onClick: () => void }
    }
  ): void
} = dual(
  2,
  (
    error: unknown,
    options: {
      readonly lead: O.Option<string>
      readonly action?: { readonly label: string; readonly onClick: () => void }
    }
  ): void => {
    const said = sayError(error, { fields: {} })
    toast.error(said.title, {
      description: O.match(options.lead, { onNone: () => said.sentence, onSome: (lead) => `${lead} ${said.sentence}` }),
      ...R.getSomes({ action: O.fromUndefinedOr(options.action) })
    })
  }
)

/** True when the request never got an answer: the server could not be reached. */
const unreachable = (error: HttpClientError.HttpClientError): boolean =>
  error.reason instanceof HttpClientError.TransportError

/**
 * True for a failure that asking again may fix: the network, a server error, "too many requests". A typed refusal
 * (a role, a bad request, a missing record) gets the same answer every time, so it is never asked again.
 */
export const isTransient = (error: unknown): boolean => {
  // The server's own 500, as the API's problem document: the request was fine, so another try may pass.
  if (isServerProblem(error)) return true
  if (!HttpClientError.isHttpClientError(error)) return false
  if (unreachable(error)) return true
  const status = statusOf(error)
  return O.exists(status, (status) => status === 429 || status >= 500)
}
