---
type: Standard
title: An error says what to do next
description: An error says what went wrong and what to do instead, in the person's words, every problem at once, and never shows technical detail.
tags: [ui, import]
status: draft
---

An error is a step in the person's job, not the app's diary. It names what went wrong in their words and what they
can do about it.

- **What went wrong, and what to do instead**: "The file has no SKU column. Add one, or pick the sheet that has it."
  Never a code, a stack trace, an HTTP status, a field path or a provider's own message. `sayError(error)` from
  `@inventory/client/SayError` is the one place a failure becomes words; `modelSentences` are the model's five (the contract's,
  `packages/catalog/contract/src/Answer/AiUnavailable.rejection.ts`, so the server's `AiUnavailable` says the same), `answeredByLine`
  says which path answered, and `formProblems` (`@/lib/form`) and the pure `review` (`packages/catalog/model/src/Review/Review.rules.ts`) say
  every problem at once, a form's and a file's rows'. Check: cause each refusal
  the app has (a wrong file, a viewer pressing Import, the model unavailable) and read every sentence; none uses a
  word the person would not.
- **Every problem is said at once**, not one per attempt: a form names every field that is wrong, a file every row's
  problems with their columns and values; a refused request's `400` lists every wrong field. Check: in the record editor
  (Records page), an empty Name and a price with three decimals are both named after one press.
- **Problems in a person's data are data**: they come back as data the screen shows on their rows, never as a request
  error (an import's upload steps answer 200 with a `StagingOutcome`, and its review gives every row its reason).
  Request errors stay for what is not the person's data: signed out, not allowed, a record that is gone, the server
  broken. Check: an import with bad rows answers 200 and lists each row's reason. A file that cannot be read or staged
  is a `FileProblem` (`packages/catalog/contract/src/Staging/FileProblem.read.ts`: its kind, what is wrong, what to do), from the browser's reader and
  from the server alike. A server step that stages a file answers 200 with `StagingOutcome(made)`, a `Schema.Result` of
  what it made or the `FileProblem`, and its endpoint's errors keep only what is not the file. Copy the endpoints and
  their handler from the import's upload steps (`packages/catalog/model/src/Import/Imports.handler.ts`), and the screen from the Upload step
  (`packages/catalog/web/src/UploadStep.screen.tsx`: `fileProblemTitles[kind]`, then the problem, then what to do). Check: a bad
  file sent to the step answers 200 with `"_tag":"Failure"` holding the `FileProblem`, and the screen says what is
  wrong, then what to do.
- **The model's failures have plain sentences**: no key, a key refused or out of credit (not "try again": it says AI
  is not available on this copy), too many requests, too slow, an answer that could not be used (`kind` on
  `AiUnavailable`). Each says what the app did instead (the rules path), and the provider's own text
  goes to the log only.
  Check: with an invalid key, the screen shows the sentence, and the log line has the provider's text.
- **An error never leaks what is sensitive**: no key, cookie, header, path, query or other organization's data, on
  screen or in the response. Check: read the response body of each refusal above.
