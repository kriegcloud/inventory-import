---
type: Reference
title: Confidence scores (TypeSafe through Effect's DecisionModel)
description: TypeSafe's Jev answers typed questions with calibrated probabilities through Effect's DecisionModel; this app would use it to decide a row's category or a field's column directly, with a measured probability behind the medium or low word the review already shows.
tags: [alchemy-domain, extra]
---

# Confidence scores (TypeSafe through Effect's DecisionModel)

Read at the library's release `2.0.0-beta.87` and its `main@dbfd0dd`, not at the pin `734c27a` the repository
builds on. What changed between that touches what this page recommends is listed once in [the map](../00-map.md),
"From `dbfd0dd` to the pin".

TypeSafe sells one API, System One, served by its model Jev. You send `state` (the content) and named typed
questions, and get back typed answers. A **Choice** picks one option from a set and returns a probability for every
option. A **Score** places the content on ordered levels. A **Noul** gives the probability that a yes-or-no
statement holds. A **Box** finds something in an image. Jev generates no text. Effect wraps it in
`@effect/ai-typesafe`, a provider for the provider-neutral `DecisionModel` service in `effect/ai`, the same way
`@effect/ai-openrouter` provides `LanguageModel`. A score is therefore **Jev's own answer to a question you ask
it**, not a number stamped on another model's answer. TypeSafe's docs describe the reported `confidence` as one
that "collapses that shape into a single number from 0 to 1" [https://docs.typesafe.ai/confidence.md].

This is not part of `@alchemy.run/domain`. Neither Alchemy tree (`v2.0.0-beta.87`, `main@dbfd0ddb`) mentions
TypeSafe or `DecisionModel`; it is on this list because the owner asked for it.

## When to reach for it

- A question has a **closed set of answers** that a person would otherwise pick: which of the five categories an
  item belongs to, which unmatched file heading holds a field, which unit a spelling means. Jev answers it
  directly, with a probability per option, in one call for every row of the import.
- A model's **open-text answer** (a name made from a description) needs a check. Jev cannot write the name, but it
  can be asked a Noul about it ("the name says only what the description says"). That is a second call.
- Not for dates, counting or arithmetic: TypeSafe lists these as weak spots and says to do them in code
  (https://docs.typesafe.ai/model-jaggedness.md). The app's rules already do them.

## How it is declared

Two layers: Effect's provider-neutral decision API in `effect/ai`, and the TypeSafe provider package.

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as S from "effect/Schema"
import * as Decision from "effect/ai/Decision"
import * as DecisionModel from "effect/ai/DecisionModel"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as TypeSafeClient from "@effect/ai-typesafe/TypeSafeClient"
import * as TypeSafeDecisionModel from "@effect/ai-typesafe/TypeSafeDecisionModel"

// One definition: an input Schema and named decisions, all sent in ONE request.
const RowCategory = Decision.make({
  input: S.Struct({ written: S.String, name: S.String, description: S.String }),
  decisions: {
    category: Decision.classify({
      instructions: "Which category is the item in `name` and `description` filed under?",
      criteria: { "raw-materials": null, components: null, "finished-goods": null, packaging: null, supplies: null }
    }),
    fits: Decision.probability({ instructions: "One of the five categories clearly fits this item" })
  }
})

// The provider: TypeSafe's HTTP client, then Jev as the DecisionModel.
const DecisionModelLive = TypeSafeDecisionModel.layer({ model: "jev-1.14.0" }).pipe(
  Layer.provide(TypeSafeClient.layer({ apiKey: typesafeKey })), // a Redacted<string> from Settings
  Layer.provide(FetchHttpClient.layer)
)

const ask = DecisionModel.decideSettled(RowCategory, {
  input: { written: "fastners", name: "Hex Bolt M8", description: "Zinc hex bolt for the frame" }
})
// outcomes.category: Result<{ label, probabilities: { components: 0.91, ... }, confidence? }, Unanswered>
// outcomes.fits:     Result<{ probability: 0.88 }, Unanswered>
```

Checked in (all at 4.1.4: `effect/src/ai/*` and `@effect/ai-openrouter` in the app's installed copy under
`node_modules`, which match Effect's repository at the 4.1.4 tag line for line; `@effect/ai-typesafe`, which the app
does not install, in Effect's repository at the `@effect/ai-typesafe@4.1.4` tag):

- **Decisions.** `Decision.classify`, `rate`, `probability` and `locate` build the four kinds; `classify` throws
  with fewer than two labels, `rate` with fewer than two levels or with a repeated level, `Decision.make` with no
  decisions (`packages/effect/src/ai/Decision.ts`, lines 62–125, 461–476, 525–536, 681–699). These throws happen when
  the definition is built, so build definitions once at module level. A `ClassifyAnswer` is `{ label, probabilities, confidence? }`, and its
  `label` may be a label other than the most probable one; `confidence` is optional, defined by the provider, and
  in `[0, 1]` (lines 273–285). A `ProbabilityAnswer` has no confidence (lines 313–315).
- **The service.** `DecisionModel.decide` fails unless every decision is answered; `decideSettled` returns one
  `Result` per decision, with `Unanswered` reasons `Missing`, `Refused`, `NoDistribution`, `Invalid`
  (`packages/effect/src/ai/DecisionModel.ts`, lines 296–307, 703–707, 756–760; `Decision.ts`, lines 376–406).
  `DecisionModel.make` validates every answer: probabilities in `[0, 1]` summing to 1, confidence in `[0, 1]`,
  and rescales the drift a provider's rounding adds (lines 395–433, 583–600). The input is encoded with
  `Schema.toCodecJson` and sent as `state`, not as a string (lines 172–187, 601–606).
- **TypeSafe client.** `TypeSafeClient.make({ apiKey?, apiUrl?, transformClient? })` sends to
  `https://api.typesafe.ai/v1` with a bearer token and `filterStatusOk`, and has no retry and no timeout
  (`packages/ai/typesafe/src/TypeSafeClient.ts`, lines 58–62, 80–130). `TypeSafeClient.layerConfig()` reads
  `TYPESAFE_API_KEY` (lines 149–163). Its two calls are `systemOne` (`POST /systemone`) and `listModels`
  (`GET /models`) (lines 30–40, 111–128).
- **TypeSafe decision model.** `TypeSafeDecisionModel.model("jev-latest")` or `.layer({ model })`; known ids are
  `jev-latest`, `jev-preview`, `jev-1.13.0`, `jev-1.14.0` (`packages/ai/typesafe/src/TypeSafeDecisionModel.ts`,
  lines 22, 31–34, 183–186). `make` maps Classify to a `choice` question, Rate to `score`, Probability to
  `noul`, Locate to `box`, and maps the answers back, passing TypeSafe's `confidence` through; it sets
  `probabilityPrecision: 2`, `supportsImages: true` and `supportsLocate: true` (lines 60–140). Locate (Box) needs
  `jev-preview` or `jev-1.14.0` (`packages/ai/typesafe/CHANGELOG.md`, "4.1.0").
- **Errors.** Everything fails with `AiError`. A 429 becomes `RateLimitError` with `retryAfter` (from
  `retry-after-ms` first, then `Retry-After`); 404 and 422 become `InvalidRequestError`; other statuses go through
  `AiError.reasonFromHttpStatus`, with 529 and 500 tested as `InternalProviderError`
  (`packages/ai/typesafe/src/internal/errors.ts`, lines 29–36, 45–103; `test/TypeSafeClient.test.ts`, lines
  234–467).
- **Wire shapes.** `SystemOneRequest { model, state, questions, assets? }`, `ChoiceAnswer { choice,
  probabilities, confidence }`, `ScoreAnswer { score, probabilities, confidence, legend? }`, `NoulAnswer { noul }`,
  `SystemOneResponse { model, answers, usage? }` (`packages/ai/typesafe/src/TypeSafeSchema.ts`, lines 95–176).
- **Stability.** Every export of `@effect/ai-typesafe` and of `effect/ai/Decision`, `DecisionModel` is
  `@stability unstable` (`packages/ai/typesafe/src/index.ts`, lines 1–30; `DecisionModel.ts`, line 7). The 4.1.0
  release removed `DecideOptions.images`, a breaking change (`packages/ai/typesafe/CHANGELOG.md`, "4.1.0").
  `@effect/ai-typesafe` 4.1.4 is published on npm (`dist-tags.latest` is `4.1.4`, checked 2026-11-19); the app does
  not depend on it.

#### Types and helpers

| Name | What it is | Where |
| --- | --- | --- |
| `Decision.Description`, `Classify`, `Rate`, `Probability`, `Locate`, `Any` | a decision's instruction text and the four decision kinds | `Decision.ts`, lines 49–125, 270 |
| `Decision.Image`, `ImageKey`, `ImageEncoded`, `ImagePaths` | an image field in the input Schema (replaced 4.0's `DecideOptions.images`) | `Decision.ts`, lines 132–259 |
| `Decision.RateAnswer`, `LocateAnswer`, `BoundingBox`, `Answer`, `Answers` | the answer types per kind | `Decision.ts`, lines 299–369 |
| `Decision.Unanswered`, `Outcome`, `Outcomes`, `Definition`, `TypeId` | `decideSettled`'s per-decision result, the definition type | `Decision.ts`, lines 26–35, 391–428 |
| `DecisionModel.DecisionModel` (the service), `DecideOptions`, `DecideResponse`, `DecideSettledResponse`, `DecideResponseMetadata`, `DecisionUsage`, `Image` | the caller's side | `DecisionModel.ts`, lines 31–170 |
| `DecisionModel.ProviderOptions`, `ProviderImage`, `ProviderClassifyAnswer`, `ProviderRateAnswer`, `ProviderProbabilityAnswer`, `ProviderLocateAnswer`, `ProviderRefusalAnswer`, `ProviderAnswer`, `ProviderResponse` | what a provider adapter receives and returns (for a scripted test provider) | `DecisionModel.ts`, lines 100–290 |
| `TypeSafeClient.TypeSafeClient`, `Service`, `Options` | the client service and its options | `TypeSafeClient.ts`, lines 30–58 |
| `TypeSafeConfig.TypeSafeConfig`, `withClientTransform` | per-request config in context, and a way to change the HTTP client for one effect | `TypeSafeConfig.ts`, lines 21, 62 |
| `TypeSafeSchema.ChoiceQuestion`, `ScoreQuestion`, `NoulQuestion`, `BoxQuestion`, `Question`, `ImageAsset`, `BoxAnswer`, `Answer`, `ListModelsResponse` | the rest of the wire Schemas | `TypeSafeSchema.ts`, lines 18–185 |
| `mapSchemaError`, `mapHttpClientError` | internal: the `AiError` mapping | `packages/ai/typesafe/src/internal/errors.ts`, lines 38, 45 |
| `OpenRouterDecisionModel.Config`, `model`, `make`, `layer` | the OpenRouter route: per-request settings in context, and the three constructors | `packages/ai/openrouter/src/OpenRouterDecisionModel.ts`, lines 45, 60, 78, 172 |

**What a score means, in TypeSafe's terms** (https://docs.typesafe.ai/confidence.md,
https://docs.typesafe.ai/introduction/machine-learning-primer.md):

- `probabilities[option]` is Jev's calibrated probability that the option is right. Calibration is claimed over
  groups of answers (of the answers given 0.8, about four in five should be right), not for one answer.
- `confidence` is derived from the distribution's shape: for a Choice with `n` options it is
  `(p_max − 1/n) / (1 − 1/n)`, so the same top probability gives a different confidence with 2 options than with
  10. A Noul returns no confidence; its value is already a probability.
- TypeSafe itself advises thresholding a Choice on the probability of the option the code will act on, and a Noul
  on its value (starting points 0.7 and 0.3), not on `confidence`.
- Jev favours the option listed first in a Choice; ask again with the options reordered when checking
  (https://docs.typesafe.ai/model-jaggedness.md).
- A Choice always picks something; pair it with a Noul asking whether any option fits
  (https://docs.typesafe.ai/patterns/companion-noul.md). The sketch's `fits` is that Noul.

**Cost, destination, key** (https://docs.typesafe.ai/models.md, https://docs.typesafe.ai/legal.md,
https://typesafe.ai/legal/data-processing):

- Price: $0.042 per million input tokens for Jev 1.14 and 1.13; output tokens are free. Billed to the TypeSafe
  account that owns the key.
- Destination: `api.typesafe.ai`. The `state` (the row's cells) leaves the app for TypeSafe. TypeSafe says Jev is
  not trained on customer requests; its Data Processing Agreement keeps data for as long as the processing needs it, and
  zero data retention is offered to enterprise customers only.
- Key: `TYPESAFE_API_KEY` is the package's default setting name. Limits: 64k tokens per request and 32k per
  question by default; rate limits per organization, a 429 when passed.

**A second route already installed: OpenRouter's Decisions API.** `@effect/ai-openrouter` 4.1.4, which the app
already depends on, has `OpenRouterDecisionModel`: the same `DecisionModel` service, sent to OpenRouter's alpha
`POST /alpha/decisions` with the app's existing OpenRouter key (`packages/ai/openrouter/src/OpenRouterDecisionModel.ts`,
lines 1–6, 60–62, 78–162; `OpenRouterClient.ts`, lines 125–127, 197–206). It returns `metadata.openrouter.cost`
and the serving provider. OpenRouter's generated schema at 4.1.4 lists `TypeSafe` as a provider and says only
TypeSafe Jev endpoints serve box questions (`packages/ai/openrouter/src/Generated.ts` at `@effect/ai-openrouter@4.1.4`,
lines 329, 453, 1079, the same in the app's installed copy; Effect's repository after 4.1.4 has the same text at
lines 600, 725, 1529).

Confirmed in the app's install: the app's OpenRouter driver, `packages/drivers/openrouter` (package
`@beep/openrouter`), depends on `@effect/ai-openrouter` `4.1.4` exactly (its `package.json`, line 26) and today
imports only `OpenRouterClient` and `OpenRouterLanguageModel` (`src/OpenRouter.service.ts`, lines 15–16). The
installed `node_modules/@effect/ai-openrouter` is version 4.1.4, exports `OpenRouterDecisionModel` (`src/index.ts`,
line 30; `dist/OpenRouterDecisionModel.js` is present, reachable as `@effect/ai-openrouter/OpenRouterDecisionModel`
through the `"./*"` export), and its source differs from the 4.1.4 tag only in formatting (two lines: parentheses
and a semicolon). So Jev appears reachable through OpenRouter without a second key or a new package. Not verified:
the model id to send, whether the alpha API is open to the app's account, OpenRouter's price for it, and where the
data goes. This adapter does not support `locate` or images: its `DecisionModel.make` call sets only
`probabilityPrecision` (line 87), so a locate decision or an image input fails with `InvalidUserInputError` before
any request (`packages/effect/src/ai/DecisionModel.ts`, lines 611–617).

### What main changes

Nothing. Not an Alchemy concept: no file in the Alchemy repository at `v2.0.0-beta.87` or `main@dbfd0ddb`
mentions TypeSafe, `DecisionModel` or `@effect/ai-typesafe` (searched both trees).

## Rules, and the mistakes to avoid

- **It does not score OpenRouter's answer.** No code path in `@effect/ai-typesafe` takes a `LanguageModel`
  response; `DecisionModel` only answers questions about an input you give it. To "score" a model's suggestion you
  ask Jev about it, which is a second call. The prior research's sentence holds for that case. For the closed
  questions it is better not to ask the language model at all: ask Jev the question.
- **Never use `confidence` as the gate.** Gate on the probability of the label the app would apply
  (`answer.probabilities[answer.label]`) and on the companion Noul. Use `confidence` only to compare uncertainty
  across questions.
- **The label may not be the most probable one** (`Decision.ts`, line 274). Read the probability of the label, and
  apply only a label that is one of the app's own values.
- **The guard sets the word, never the provider.** The app's rule "the guard, never the model, sets the
  confidence" (`packages/catalog/model/src/Suggestion/Suggest.rules.ts`, lines 17–24, 170–175) stays: a
  probability is evidence the guard reads, beside the file's own rows.
- **No retry is built in.** Apply the app's one retry policy around `decide` (`ModelPolicy`,
  `packages/drivers/openrouter/src/OpenRouter.config.ts`) and map `AiError` to the app's `AiUnavailable` troubles.
  Do not add a second retry policy.
- **Pin the model.** `jev-latest` moves when TypeSafe ships; thresholds tuned on one version need that version's
  id (https://docs.typesafe.ai/models.md, "Aliases").
- **`decideSettled`, not `decide`,** so one unanswered row does not lose the rest of the import's answers.
- **Thresholds are placeholders** until measured on the app's own labelled files; TypeSafe's own advice is
  to start conservative and tune on your data. Decision 13 in `explorations/ideal-architecture/DECISIONS.md` says the same.
- **Read secrets through `Settings.ts`**, never `layerConfig` directly, so "no key" means "off" the way the
  OpenRouter key does.

## In this app

Today "confidence" is already a word on every proposal: `high` (a form-only fix with one reading), `medium` (a
likely reading to accept or reject) and `low` (a question, nothing preselected)
(`packages/catalog/model/src/Review/Review.rules.ts`, lines 194–204, 578–583). A stored suggestion may only be
`medium` or `low` (`packages/catalog/contract/src/Suggestion/Suggestion.read.ts`, lines 60–64;
`apps/inventory/migrations/0001_init.sql`, line 215), set by the guard from the file's rows: a category is `medium`
when at least two other rows whose name starts with the same word mostly agree (`Suggest.rules.ts`, line 261), a
column when it is filled on more than half the rows (line 288). The model is told never to rate itself
(`packages/catalog/model/src/Suggestion/Suggestions.handler.ts`, lines 50–60). The confirm copies the word into
`importChange.confidence` (`0001_init.sql`, line 392).

**Worked example.** An editor in `org_prairie` presses "Suggest fixes" on an import whose row 40 says category
`fastners` and name `Hex Bolt M8`. Today the OpenRouter model answers `components` and the guard writes `low`
because only one other row starts with "Hex". With Jev:

1. `propose` takes one call from the allowance (`allowance.take("suggest")`, `Suggestions.handler.ts`, line 144,
   taken at line 91 only when a model is on), as today.
2. It sends one `decideSettled` with a `category` Choice and a `fits` Noul per open row, and a `column` Choice per
   unmatched field whose options are the unused headings. Names still go to OpenRouter's `generateObject`, since
   Jev cannot write text.
3. The guard reads row 40's answer: `components` at 0.91, runner-up `supplies` at 0.05, `fits` 0.88. It keeps the
   suggestion `medium` (never `high`: `high` stays reserved for lossless rule fixes), and the basis says so in
   words: "`fastners` on row 40 is not one of the 5 categories; Jev put 0.91 on components (next: supplies, 0.05)."
4. If the probability were 0.55, or `fits` under 0.3, the guard would write `low` and the review would show it as a
   question with the runner-up as an alternative, nothing preselected. A suggestion's proposal is already its own
   group (`${field}:suggested:${row.id}`, `Review.rules.ts`, lines 601–617), so no click accepts many at once; a
   low score changes nothing there, and a "take all suggestions" button, if one is ever added, must leave out
   `low`.

What changes, by part:

- **Schema.** A suggestion gains an optional score: `{ probability, runnerUp, scoredBy, model }`, with
  `probability` an `S.Finite` checked to `[0, 1]` and `scoredBy` a `LiteralKit(["typesafe", "openrouter"])`;
  `importSuggestion` gains nullable `probability`, `runnerUp` and `scoredBy` columns. `AiProvider` in
  `packages/catalog/contract/src/Answer/AnsweredBy.read.ts` (line 7, today `["openrouter"]`) gains `"typesafe"`
  if Jev is called directly.
- **`Answerer`.** Its one method, `ask(question, schema)`, returns one structured object from a language model
  (`packages/catalog/model/src/Answer/Answerer.external.ts`, lines 53–63); a `DecisionModel` is a different
  shape. Add a second port beside it, a `Decider` (`Context.Service` with `status` and
  `decide(definition, input)` returning the outcomes or `AiUnavailable`), with an `off` twin and a `scripted`
  twin like `Answerer`'s. Two host adapters are possible: `DeciderTypeSafe` (`TypeSafeClient.layer` with the key
  from `Settings.ts`, then `TypeSafeDecisionModel.layer`) and `DeciderOpenRouter`
  (`OpenRouterDecisionModel.layer` provided with the same `OpenRouterClient.layer({ apiKey })` the driver builds
  inline for its language model today, `packages/drivers/openrouter/src/OpenRouter.service.ts`, lines 78–85). OpenRouter stays the language model for
  names and the table assistant.
- **Allowance.** Each provider call takes one call first. In direct mode the Jev call replaces the model call for
  categories and columns, so a press that asks Jev and OpenRouter (names) takes two. In verify mode (a Noul about
  OpenRouter's name) the check is another call. The purpose words are fixed in two places,
  `ModelCallPurpose` (`packages/access/contract/src/Allowance/ModelAllowance.gateway.ts`, line 28, `view`,
  `check`, `suggest`) and the `modelCall` table's check (`0001_init.sql`, line 414): a new word such as `score`
  goes in both. Whether a Jev call counts against the same 40 a day is the owner's decision; it is cheap
  ($0.042 per million input tokens) but it is still a model call under rule 9.
- **No key.** `Decider.off` answers `noKey` without a request; the feature ends with `answeredByRules`
  (`Answerer.external.ts`, lines 117–127), the rules suggest names only and leave categories and columns to the
  person (`Suggest.rules.ts`, lines 153–165), and the screen's `answeredBy` says the rules answered and why. No
  score is stored, and the guard's file-based word stands.
- **Settings.** For direct TypeSafe: `TYPESAFE_API_KEY` (redacted) and a pinned `TYPESAFE_MODEL`, declared in
  `apps/inventory/src/server/env.d.ts` and read in `Settings.ts`, plus a switch such as `AI_DECIDER`
  (`typesafe`, `openrouter`, `off`). Through OpenRouter: no new key; `OPENROUTER_API_KEY` already exists
  (`env.d.ts`, line 9). The infra decision "I5, model keys" holds the TypeSafe key back from every stage for now.

- **Used today:** no. The words `high`, `medium`, `low` are set by rules and the guard from the file's rows
  (`Review.rules.ts`; `Suggest.rules.ts`, `guard`); no provider probability exists anywhere in the app.
- **Where it goes:** a `Decider` port in `packages/catalog/model/src/Answer/`, its adapters in
  `packages/catalog/host/src/` (beside `Answerer.adapter.ts`), the score in
  `packages/catalog/contract/src/Suggestion/Suggestion.read.ts` and the `importSuggestion` table, the band in
  `guard` (`Suggest.rules.ts`), the words on screen in `packages/catalog/web/src/internal/WhyFlagged.tsx`.
- **What the person gets:** a category or column suggestion that says how sure it is with a number from the
  scoring model, and fewer wrong guesses shown as "likely".

## How to check it

- A unit test of `guard` with a scripted `Decider` (built on `DecisionModel.make({ decide: () =>
  Effect.succeed({ answers, usage }) })`, no vendor package) proves the bands: 0.91 with `fits` 0.88 gives
  `medium`; 0.55 gives `low` with the runner-up as an alternative; a label not in `categories` is refused; nothing
  is ever `high`.
- A test with `Decider.off` proves the no-key path: rules answer, `answeredBy` is `Rules`, no allowance call is
  taken (`Suggestions.handler.ts`, line 91 takes a call only when a model is on).
- A test of the adapter over a scripted `HttpClient` returning a canned `SystemOneResponse` proves the wire mapping,
  as `packages/ai/typesafe/test/TypeSafeDecisionModel.test.ts` does.
- A calibration run on labelled sample files (with options reordered) sets the thresholds; until then they are
  placeholders.
- No declaration check of the library (`Domain.verify` at `dbfd0dd`, the Layer's build at the pin) and no prover
  applies: this is not a domain declaration. App rule 8 ("a model proposes and
  never writes") still holds and is what the tests guard.

## What it needs

- `@effect/ai-typesafe` 4.1.4 (published, not installed) for the direct route, or nothing new for the OpenRouter
  route (`@effect/ai-openrouter` 4.1.4 is installed and has `OpenRouterDecisionModel`).
- A TypeSafe key (direct) or OpenRouter's alpha Decisions API open to the app's key (not verified).
- Any host: it is an outbound HTTP call from the Worker over `FetchHttpClient`. No Alchemy host.
- The owner's decisions: open question 13 (a second vendor for confidence scores) and infra I5 (the TypeSafe key is
  not deployed), both in `explorations/ideal-architecture/DECISIONS.md`.

## Verdict

**Use:** through `DecisionModel` behind a new `Decider` port, to decide closed questions directly (a row's
category, a field's column) with `decideSettled` and a companion Noul, the guard turning the label's probability
into the existing `medium` or `low` word and the number into the basis sentence; the rules answer with no key.

The evidence is against the item as pictured: TypeSafe cannot attach a confidence score to the OpenRouter answer the
app gets today. It gives its own answer with its own probability, or checks a model's answer in a second call. The
second vendor key is not strictly needed either: OpenRouter's Decisions API appears to route to Jev with the
existing key (to be verified with one call). What holds it back is the owner's decision 13, not code.

## Where this was read

- https://docs.typesafe.ai/llms.txt and the pages it lists on confidence, choice, noul, score, routing, the
  verify cookbook, models (price), legal, request rules, jaggedness and the AI primer; https://typesafe.ai/legal/data-processing
- `packages/ai/typesafe/{README.md,package.json,CHANGELOG.md,src/*,test/*}` at `effect@4.1.4`
- `packages/effect/src/ai/{Decision,DecisionModel}.ts` at `effect@4.1.4`
- `packages/ai/openrouter/src/{OpenRouterDecisionModel,OpenRouterClient,Generated}.ts` at `effect@4.1.4` (the
  app's installed copy of `OpenRouterDecisionModel.ts` differs only in formatting)
- The app: `packages/drivers/openrouter/src`, `packages/catalog/host/src/Answerer.adapter.ts`,
  `packages/catalog/model/src/Answer/Answerer.external.ts`, `packages/catalog/model/src/Suggestion/{Suggest.rules.ts,Suggestions.handler.ts}`,
  `packages/catalog/contract/src/Suggestion/Suggestion.read.ts`, `packages/catalog/model/src/Review/Review.rules.ts`,
  `apps/inventory/migrations/0001_init.sql`, `explorations/ideal-architecture/{README.md,DECISIONS.md,research/03-effect-modules.md}`
- Alchemy at `v2.0.0-beta.87` and `main@dbfd0ddb`: no mention (searched)
