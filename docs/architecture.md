---
type: Architecture Overview
title: Architecture in four diagrams
description: The stored data model, one row through the import, one import through its steps, and how the layers depend on each other, as Mermaid diagrams read from the code.
tags: [architecture, data-model, import]
generated: { by: claude-code/claude-fable-5-2, at: 2026-11-18T18:30:00Z }
---

# Architecture in four diagrams

Each diagram was drawn from the files named under it, as they stood when this page was written. Every name in a
diagram is a name in that code. Where the code and this page disagree, the code is right.

## 1. What is stored

From `migrations/0001_init.sql` and `src/domain/Item.ts`.

```mermaid
erDiagram
  organization ||--o{ member : "organizationId"
  member ||--o{ activity : "organizationId, actorId"
  member ||--o{ importDraft : "organizationId, actorId"
  importDraft ||--o{ importChunk : "organizationId, importId"
  importDraft ||--o{ importDecision : "organizationId, importId"
  importDraft ||--o{ importBatch : "organizationId, importId"
  importDraft ||--o{ importOutcome : "organizationId, importId"
  importBatch ||--o{ importChange : "organizationId, batchId"
  importBatch ||--o{ item : "organizationId, batchId"
  importDraft ||--o{ item : "organizationId, importId"
  item ||--o{ Vendor : "vendors, JSON text, up to 3"
  item ||--o| Dimensions : "dimensions, JSON text"
  organization {
    TEXT id PK
    TEXT name
  }
  member {
    TEXT id PK
    TEXT organizationId FK
    TEXT userId FK "the sign-in account"
    TEXT name
    TEXT role "admin, editor, viewer"
  }
  activity {
    TEXT organizationId PK
    TEXT id PK
    TEXT actorId FK
    TEXT action
  }
  importDraft {
    TEXT organizationId PK
    TEXT id PK
    TEXT fileName
    TEXT headJson "name, sheet, columns, notes"
    TEXT status "open, imported, takenBack"
    TEXT choicesJson "column given to a field"
  }
  importChunk {
    TEXT organizationId PK
    TEXT importId PK
    INTEGER seq PK
    TEXT rowsJson "the staged rows, 500 to a chunk"
  }
  importDecision {
    TEXT organizationId PK
    TEXT importId PK
    TEXT rowId PK
    TEXT decisionJson "a RowDecision"
    TEXT decidedById FK
  }
  importBatch {
    TEXT organizationId PK
    TEXT id PK
    TEXT importId FK
    TEXT confirmedById FK
    INTEGER created
    TEXT takeBackId
  }
  importOutcome {
    TEXT organizationId PK
    TEXT importId PK
    INTEGER rowNumber PK
    INTEGER part PK
    TEXT outcome "created, updated, already, notImported, takenBack"
  }
  importChange {
    TEXT organizationId PK
    TEXT batchId PK
    INTEGER rowNumber PK
    INTEGER part PK
    TEXT field PK
    TEXT confidence "high, medium, low"
  }
  item {
    TEXT organizationId PK
    TEXT id PK
    TEXT skuKey UK "unique with organizationId"
    TEXT sku
    TEXT name
    TEXT description
    TEXT category
    TEXT uom "EA, BX, KG, M, L"
    TEXT unitCost "decimal string"
    INTEGER quantityOnHand
    INTEGER reorderPoint
    INTEGER isActive
    INTEGER lotTracked
    TEXT tags "JSON text"
    TEXT firstReceivedOn
    TEXT discontinuedOn
    TEXT dimensions "JSON text"
    TEXT vendors "JSON text"
    TEXT importId FK
    TEXT batchId FK
    INTEGER sourceRow
    INTEGER revision "1 as created"
  }
  Vendor {
    string vendorName
    string vendorSku
    string unitCost
    int leadTimeDays
    boolean isPreferred
  }
  Dimensions {
    number length
    number width
    number height
    string unit "cm, in"
  }
```

An item has the fifteen fields of `ItemFields`, from `sku` to `vendors`; `Vendor` and `Dimensions` are not tables but
values inside the item, stored as JSON text and decoded through their Schemas. Every table of customer data has
`organizationId` first in its key and names its parent by `(organizationId, id)`, so a row of one organization cannot
point at a row of another. A file on its way in sits in `importUpload` and `importUploadChunk` (not drawn) until it is
whole, and then becomes an `importDraft` with the same id.

## 2. One row through the import

From `src/domain/ItemImport.ts` (`RowOutcome`, `Proposal.confidence`, `RowDecision`), `src/server/Imports.ts` and the
words in `packages/review/src/ReviewWords.words.ts` and `src/web/pages/import/format.tsx`.

```mermaid
stateDiagram-v2
  state "A row of the file" as Row
  state "Needs a decision" as Decision
  state "Cannot import" as Cannot
  state "Left out" as Out
  state "Already there" as Already
  state "Imported" as Created
  state "Updated" as Updated
  state "Not imported" as NotImported
  state "Taken back" as TakenBack
  [*] --> Row
  Row --> Ready: every value reads as written
  Row --> Ready: high confidence, a form-only fix applied by a rule
  Row --> Decision: medium, a proposal to accept or reject
  Row --> Decision: low, a question with alternatives
  Row --> Decision: stored item differs, keep or replace
  Row --> Cannot: a blocker, only a typed value settles it
  Row --> Already: the SKU is stored with the same values
  Decision --> Ready: accepted, chosen, or replace
  Decision --> Already: keep the stored item
  Cannot --> Ready: a value typed or chosen
  Ready --> Out: the person leaves the row out
  Decision --> Out: the person leaves the row out
  Cannot --> Out: the person leaves the row out
  Ready --> Created: confirm, a new item
  Ready --> Updated: confirm, replaces the stored item
  Already --> Already: confirm writes nothing
  Decision --> NotImported: confirm, with the reason
  Cannot --> NotImported: confirm, with the reason
  Out --> NotImported: confirm, with the reason
  Created --> TakenBack: take-back, item still at revision 1
```

The review puts every row in exactly one of `ready`, `decision`, `cannot`, `out` and `already`, and the counts add up
to the rows of the file. A proposal's confidence says how it arrives: high is a change of form with one reading, in
force and listed as Auto-fixed unless undone; medium waits for an accept; low is a question with nothing preselected.
After the confirm each row has one stored outcome (`created`, `updated`, `already`, `notImported`), and a take-back
turns `created` into `takenBack` only where nobody has changed the item since.

## 3. One import through its steps

From `src/server/Imports.ts` (`importDraft.status`, `commit`, `takeBack`, `reopen`, `remove`) and
`src/web/pages/ImportPage.tsx` (the steps Upload, Match, Review, Result).

```mermaid
stateDiagram-v2
  state "Upload, the file sent in pieces" as Uploading
  state "open" as Open {
    [*] --> Match: a required field found no column
    [*] --> Review
    Match --> Review: every required field has a column
    Review --> Match: change a column
  }
  state "imported, the Result step" as Imported
  state "takenBack, the Result step" as TakenBack
  [*] --> Uploading: beginUpload
  Uploading --> Uploading: putChunk
  Uploading --> Open: finishUpload
  Uploading --> [*]: discardUpload
  Open --> Imported: commit, the confirm
  Imported --> TakenBack: takeBack, no confirm left in force
  Imported --> Open: reopen
  TakenBack --> Open: reopen
  Open --> [*]: remove, no item in force
```

An import is `open` while its rows are being matched and reviewed; the confirm writes the items, the outcomes and the
changed values in one batch and flips it to `imported`, and the page then shows the Result step whatever step the
address asks for. A take-back removes the items still at revision 1 and marks it `takenBack` once no confirm is in
force. Reopening puts it back in Review, where rows an earlier confirm created count as already there.

## 4. How the parts depend on each other

From the imports in `src/`, `src/server/ModelCalls.ts`, `src/server/TableAssistant.ts` and the two callers of `review`
(`src/web/pages/import/ReviewStep.tsx`, `src/server/ImportHandlers.ts`).

```mermaid
flowchart LR
  web["src/web<br/>React screens, in the browser"]
  subgraph Worker["Cloudflare Worker"]
    server["src/server<br/>services and handlers"]
    assistant["TableAssistant"]
    calls["ModelCalls<br/>40 calls a day per organization"]
    ai["Ai<br/>the one model service"]
  end
  api["src/api/v1<br/>the HTTP contract"]
  domain["src/domain<br/>Schemas and pure functions<br/>review"]
  d1[("D1 (SQLite)")]
  web -->|imports| api
  server -->|imports| api
  api -->|imports| domain
  web -. "calls /api/v1" .-> server
  web -->|"ReviewStep runs review"| domain
  server -->|"ImportHandlers runs review"| domain
  server --> d1
  assistant --> calls
  calls -->|"take, before each call"| d1
  assistant --> ai
```

Dependencies point one way: the browser and the Worker both import the contract, the contract imports the domain, and
the browser never imports the server. The review screen and the confirm run the same pure `review` on the same staged
rows and decisions, so the server refuses what the preview refused. Every model call first takes one from the
organization's daily allowance in `modelCall`; when it is used up, or there is no key, the feature's rules answer.
