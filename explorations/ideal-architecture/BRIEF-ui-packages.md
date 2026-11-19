---
type: Brief
title: "Brief: ui-packages"
description: The goal ui-packages, step 6 of the order of work. The vendored components, their hooks and the app's own shared screen pieces become @inventory/ui, and the review region with its saved progress becomes @inventory/review, with the four imports the components make of app code turned around, Tailwind and the design lints reaching both packages, and a draft saved before the move still restored after it.
---

# Brief: `ui-packages`

Step 6 of the order of work in [README.md](README.md). It rests on the answered decisions "packages", "file naming",
"strictness", "schema form" and "client state" in [DECISIONS.md](DECISIONS.md), on sections 1, 2, 4 and 8 of
[research/04-beep-direction.md](research/04-beep-direction.md), and on the closing note of
[goals/kernel-drivers/PLAN.md](../../goals/kernel-drivers/PLAN.md). Where this brief and a report differ, this brief
is the later word and says why ("Where the research was wrong", at the end of the Sketch). It comes before
[BRIEF-contexts.md](BRIEF-contexts.md): both context web packages import these two.

## Problem

Every screen of the app imports its building blocks from inside the app, and the building blocks import the app
back. Step 7 cannot cut a web package per context until that is undone.

1. **The components import the app.** Four files of the vendored set reach into app code: `components/ui/sonner.tsx`
   reads `useTheme` from `lib/theme.tsx`, `components/ui/data-table/data-table-state.ts` reads `navigate` and
   `useLocation` from `lib/route.ts`, `components/ui/data-table/data-table-records.tsx` reads `useContentWidth` and
   `useIsNarrow` from `lib/content-width.ts`, and `hooks/use-data-table.ts` reads `stringify` from `lib/json.ts`. A
   package cannot import the app, so these four edges must point the other way first.
2. **The review region depends on app parts.** `components/review/` (6,415 lines, item-agnostic: it imports nothing
   from `src/domain`) imports `components/app/StatusPill`, `ProposedValue`, `proposalSource` and `AgentRun`, and
   `lib/content-width`, `lib/text-width` and `lib/json`. Its saved progress (`lib/saved-progress/store.ts`) imports
   the region's `logic.ts` and `types.ts`, and the hook beside it (`lib/saved-progress/index.ts`) runs on the app's
   one runtime (`lib/runtime.ts`).
3. **The shared screen pieces sit in `components/app` beside the shell.** `PageHeader` (7 importers), `Skeletons`
   (6), `ListTable` (4), `StatusPill` (6), `Code` (5), `NotSet` (5) and `TableSearch` (2) are used by screens of both
   future contexts; `AppShell`, `AppSidebar`, `SignedIn`, `BrandMark`, `ThemeToggle` and `slots` are the app's frame.
   `RowCards.tsx` has no importer at all.
4. **Styles, lints and the CSS walk assume one folder.** `index.css` names its sources as `@source "./"` (all of
   `src/web`); the production build replaces that with the files reachable from `main.tsx`
   (`scripts/reachable-sources.mjs`), which follows only paths inside `src/web`. The design lint
   (`.oxlintrc.shadcn.json`) runs on `src/web` with `"ui": "@/components/ui"`; `oxlint`'s own config ignores
   `src/web/components/ui/**`; the type-check's stage D exception names `src/web/components/ui`; `components.json`
   points the shadcn CLI at `@/components/ui`. Each breaks or goes blind when the files move.
5. **The saved draft is a stored format nobody has written down.** `localStorage` holds `progress:v1:...` drafts as
   JSON that `SavedProgress` decodes; a draft that no longer decodes is deleted (`readAt`). A move that changed its
   encoding would silently throw away a person's unfinished review. The schema also breaks the rules: `savedAt` is a
   string (SF-2), `sheet` is `S.NullOr` (SF-4), `redo` an optional key (SF-5), the decision's `out` and `kept` are
   flags (SF-6), nothing is bounded (SF-7), and the in-memory `blank` carries `savedAt: ""`.

## Appetite

Scope, not time. In:

- Two packages, in this order, each with the app switched over and green before the next starts: `@inventory/ui`
  (`packages/ui`) and `@inventory/review` (`packages/review`).
- The four ui → app imports turned around; the shared screen pieces into `@inventory/ui`; the frame stays in the app.
- Tailwind sources, the production CSS walk, the design lint, `oxlint` and the shadcn CLI reaching both packages.
- Saved progress into `@inventory/review`, its schemas brought to SF-1 to SF-9 with the stored JSON unchanged, proved
  by restoring a draft written by the build before the move.

Out: everything in No-gos. The goal is done when no file under `apps/inventory/src/web/components/ui`,
`components/review`, `hooks` or `lib/saved-progress` is left, and the messy sample imports through Confirm with the
three numbers agreeing, after each package.

## Sketch

Each package below: what moves, the schemas it owns (only `@inventory/review` owns data), the files and exports, the
switches the move needs, then what the app imports afterwards. Every Effect name was checked in effect 4.1.4's source
(`node_modules/effect/src`). Conventions for every schema are those of
[BRIEF-kernel-drivers.md](BRIEF-kernel-drivers.md) ("Conventions for every schema below"); a `LiteralKit` needs the
narrow vendored patch that restores it to Worker-side packages, which lands on `main` before this goal is built.

### 1. `@inventory/ui` (`packages/ui`)

The design system: the vendored components exactly as they are, their hooks, the theme, and the small own pieces
every screen uses. No contract, no API client, no product data. `"beep": { "family": "ui-system" }`.

#### What moves

| Today (`apps/inventory/src/web/`) | After (`packages/ui/src/`) | Zone |
| --- | --- | --- |
| `components/ui/**` (70 files and the `data-grid/`, `data-table/` folders) | `components/**`, names as published | vendored |
| `hooks/*.ts` (6 files, shadcn, Dice UI and tablecn) | `hooks/*.ts` | vendored |
| `lib/theme.tsx` | `Theme.provider.tsx` | own |
| `lib/route.ts`: `navigate`, `useLocation`, `linkTo` | `Route.hook.ts` | own |
| `lib/route.ts`: `importAddress` | stays in the app (`lib/route.ts`, now one line); moves to `catalog-web` in step 7 | — |
| `lib/content-width.ts` | `ContentWidth.hook.ts` | own |
| `lib/text-width.ts` | `TextWidth.measure.ts` | own |
| `lib/json.ts` | `Json.codec.ts` | own |
| `components/app/StatusPill.tsx`, `Code.tsx`, `NotSet.tsx` | `StatusPill.component.tsx`, `Code.component.tsx`, `NotSet.component.tsx` | own |
| `components/app/PageHeader.tsx` (`PageHeader`, `Views`) | `PageHeader.component.tsx` | own |
| `components/app/ProposedValue.tsx`, `proposalSource.ts`, `AgentRun.tsx` | `ProposedValue.component.tsx`, `ProposalSource.words.ts`, `AgentRun.component.tsx` | own |
| `components/app/ListTable.tsx`, `TableSearch.tsx`, `Skeletons.tsx` | `ListTable.component.tsx`, `TableSearch.component.tsx`, `Skeletons.component.tsx` | own |
| `index.css` (tokens, `@theme`, fonts) and `shadcn-utilities.css` | `theme.css`, `utilities.css` | own |
| `components/app/RowCards.tsx` | deleted: nothing imports it | — |

The app keeps `AppShell`, `AppSidebar`, `SignedIn`, `BrandMark`, `ThemeToggle`, `slots`, `SheetChooser` (an import
piece, `catalog-web` in step 7) and `TableAssistant` (`catalog-web` in step 7), and its own `index.css`, which now
holds only the Tailwind entry and the `@source` lines (below).

Turning the four edges around is the first commit, inside the app, before any file leaves it: `lib/route.ts` splits
(`importAddress` stays), and `theme`, `route`, `content-width`, `json` and `text-width` move into the folder that
becomes the package, so `components/ui` imports a sibling and nothing in `components/ui` or `hooks` imports `@/lib`.

#### Files and exports

Vendored files keep their published names so a registry update can be compared file by file (deviation 1). Own files
take a role suffix from the ui-system vocabulary this brief adds (deviation 2): `.component.tsx`, `.provider.tsx`,
`.hook.ts`, `.words.ts`, `.codec.ts`, `.measure.ts`.

| Subpath | File | Exports |
| --- | --- | --- |
| `./components/<name>` | `src/components/<name>.tsx`, one entry per file, `data-grid/<name>` and `data-table/<name>` included | as published |
| `./hooks/<name>` | `src/hooks/<name>.ts` | as published |
| `./Theme` | `src/Theme.provider.tsx` | `ThemeProvider`, `useTheme`, `Theme` |
| `./Route` | `src/Route.hook.ts` | `navigate`, `useLocation`, `linkTo` |
| `./ContentWidth` | `src/ContentWidth.hook.ts` | `useContentWidth`, `useContentBelow`, `useIsNarrow`, `setContentInset`, `contentWidth`, `sidebarOpen`, `sidebarFolded`, `sidebarWasOpen`, `narrowBelow` |
| `./TextWidth` | `src/TextWidth.measure.ts` | as today |
| `./Json` | `src/Json.codec.ts` | `stringify`, `parse` |
| `./StatusPill`, `./Code`, `./NotSet`, `./PageHeader`, `./ProposedValue`, `./ProposalSource`, `./AgentRun`, `./ListTable`, `./TableSearch`, `./Skeletons` | the files above | as today |
| `./theme.css`, `./utilities.css` | `src/theme.css`, `src/utilities.css` | stylesheets |

No `index.ts` barrel: importing one component must not pull the others into a chunk, and the vendored files are
imported by path today. Exact exports, no wildcard (decision (b)); `scripts/check-exports.mjs` in the package's
`check` fails when a file under `src/components` or `src/hooks` has no entry or an entry names no file, so a component
the shadcn CLI adds cannot be forgotten.

`package.json`: `"sideEffects": ["*.css"]`; dependencies are the UI libraries the vendored files import today
(`radix-ui`, `@base-ui/react`, `cmdk`, `vaul`, `sonner`, `lucide-react`, `cn`, `class-variance-authority`,
`@tanstack/react-table`, `@tanstack/react-virtual`, `@dnd-kit/*`, `react-day-picker`, `recharts`, `embla-carousel-react`,
`input-otp`, `react-resizable-panels`, `react-hook-form`, `@hookform/resolvers`, `@floating-ui/react-dom`,
`date-fns`, the two `@fontsource-variable` faces, `tw-animate-css`) and `effect`, moved out of the app's
`package.json` where nothing else in the app imports them; React as a peer.

#### Switches the move needs

| What | Today | After |
| --- | --- | --- |
| Imports in the app | `@/components/ui/button`, `@/hooks/use-mobile`, `@/components/app/StatusPill`, `@/lib/route` | `@inventory/ui/components/button`, `@inventory/ui/hooks/use-mobile`, `@inventory/ui/StatusPill`, `@inventory/ui/Route`; no re-export shims, every import rewritten in the commit that moves the file |
| Imports inside the package | `@/components/ui/x`, `@/hooks/x`, `@/lib/x` | the package's own subpaths (`@inventory/ui/components/x`), which bun's workspace link resolves for the package itself, as shadcn's monorepo layout does |
| shadcn CLI | `apps/inventory/components.json`, aliases `@/components/ui` | `packages/ui/components.json`, aliases `@inventory/ui/components`, `@inventory/ui/hooks`, `@inventory/ui/lib`; the app's `components.json` names the package as its `ui` alias; `docs/kit.md` "Finding and adding a component" says to add with `--cwd packages/ui` |
| Tailwind, development | `@source "./"` | the app's `index.css`: `@source "./"`, `@source "../../../../packages/ui/src"`, `@source "../../../../packages/review/src"`, then `@import "@inventory/ui/theme.css"` |
| Tailwind, production | `reachableSources` walks files under `src/web` from `main.tsx` | the walk also follows `@inventory/ui/...` and `@inventory/review/...` specifiers through each package's `exports` into its `src`, so the stylesheet still holds only classes of files the app can load |
| Design lint | `.oxlintrc.shadcn.json` in the app, `src/web`, `"ui": "@/components/ui"` | one config at the repository root, `"ui": "@inventory/ui/components"`; `lint:shadcn` runs in the app, in `packages/ui` on its own files outside `components/` and `hooks/`, and in `packages/review` |
| `oxlint` ignore | `src/web/components/ui/**` | `packages/ui/src/components/**`, `packages/ui/src/hooks/**` |
| Effect diagnostics | stage D override on `src/web/components/ui` in the app's tsconfig | `packages/ui/tsconfig.json` carries stage D (every rule off) on `src/components/**` and `src/hooks/**`, and stage C on its own files (decision (d)) |
| Vite | `@` alias to `src/web` | unchanged for the app's own files; `optimizeDeps.include` gains nothing (the package is TypeScript source, as `@beep/csv` is) |

### 2. `@inventory/review` (`packages/review`)

The review region: any rows, any columns, a reason per row, proposals to accept, values to type, rows to keep or leave
out, undo and redo, and the saved progress that brings all of it back after a refresh. It knows nothing about items.
`"beep": { "family": "ui-system" }`; dependencies `@inventory/ui`, `effect`, React (peer).

#### Schemas (`SavedProgress.schema.ts`, `ReviewDecision.schema.ts`)

What `localStorage` holds is a stored format (research 04, M9): its encoded side stays byte for byte what the build
before the move writes, and only the decoded side changes. Each schema below lists its encoded side as today.

| Schema | Decoded | Encoded (unchanged) | Behaviour beside it |
| --- | --- | --- | --- |
| `RowKey`, `ColumnKey` | `S.String` 1 to 64, branded | text | |
| `RowPlace` | by `kind`: `open {}`, `kept {}` (kept over its rivals), `leftOut { wasKept: S.Boolean }` | flags `out?: true`, `kept?: true` | `RowPlace.fromFlags`, `RowPlace.toFlags` (the transformation), `RowPlace.putBack`: `leftOut { wasKept: true }` becomes `kept`, otherwise `open` (today's `putBack`, which keeps `kept` when it removes `out`) |
| `ReviewDecision` | `{ place: RowPlace (default open), accepted: S.Array(ColumnKey) (default []), reverted: S.Array(ColumnKey) (default []), edits: S.Record(ColumnKey, CellText) (default {}) }` | `{ out?, kept?, accepted?, reverted?, edits? }`, keys left out when empty | `ReviewDecision.isEmpty`, `decidedByPerson` (today's), beside the data |
| `CellText` | `S.String` 0 to 32,767 | text | |
| `UndoStep` | `{ label: S.String 1 to 200, before: S.Array(S.Tuple([RowKey, S.Option(ReviewDecision)])), focus: Option<RowKey> }` | `before` pairs with `null`, `focus` `null` (`S.OptionFromNullOr`) | |
| `StoredReview` | `{ decisions: S.Record(RowKey, ReviewDecision), undo: S.Array(UndoStep) (at most 200), redo: S.Array(UndoStep) (default [], at most 200) }` | `redo` an optional key (a draft from before redo existed decodes with none, as today) | |
| `StoredFile` | `{ name: S.String 1 to 255, size: S.ByteSizeFromNumber, lastModified: S.DateTimeUtcFromMillis, sheet: Option<S.String 1 to 200> }` | numbers, `sheet` `null` | |
| `ProgressStep` | `S.String` 1 to 32 of `[a-z-]` | text | |
| `SavedProgress` | `{ version: S.Literal(1), step: ProgressStep, file: Option<StoredFile>, review: Option<StoredReview>, decided: S.Int ≥ 0, needed: S.Int ≥ 0, savedAt: S.DateTimeUtcFromString }` | `file` and `review` `null`; `savedAt` ISO text | `readAt`, `writeAt`, `progressKey` as today; the in-memory `blank` goes, the hook holds `Option<SavedProgress>` (None before the first save, so nothing ever holds `savedAt: ""`) |

The decoded `ReviewDecision` replaces the region's hand-written `RowDecision` type (`types.ts`), so `logic.ts` reads
`place` instead of `out === true` and `kept === true`: decision (a). Whether the region's other TypeScript types
(props, rows, columns, words) become schemas is left out: they never cross a boundary.

`ProgressScope` (`organizationId`, `memberId`, `screen`) keeps plain strings, so the package does not depend on the
kernel; the screen passes the ids it has.

#### Files and exports

Modules are folders where the region has several parts of one kind; files outside `internal/` carry a role.

| Subpath | File | Exports |
| --- | --- | --- |
| `./ReviewRegion` | `src/ReviewRegion.component.tsx` | `ReviewRegion` |
| `./ReviewTypes` | `src/ReviewRegion.types.ts` (today's `types.ts`, `RowDecision` removed) | the region's prop, row, column and words types |
| `./ReviewWords` | `src/ReviewWords.words.ts` | `defaultReviewWords` |
| `./ReviewDecision` | `src/ReviewDecision.schema.ts` | `RowKey`, `ColumnKey`, `CellText`, `RowPlace`, `ReviewDecision`, `UndoStep` |
| `./ReviewDraft` | `src/ReviewDraft.rules.ts` (today's `fromDraft`, `toDraft` and the reducer `logic.ts` exports) | `fromDraft`, `toDraft`, `reduce`, `viewsOf`, and what the tests and `reviewAdapter.ts` call today |
| `./SavedProgress` | `src/SavedProgress.schema.ts`, `src/SavedProgress.hook.ts` | schemas above, `progressKey`, `readAt`, `writeAt`, `readProgress`, `writeProgress`, `clearProgress`, `storedReview`, `restoredDecisions`, `ProgressScope`, `ProgressStorage`; `useSavedProgress`, `saveFile`, `loadFile`, `dropFile`, `FileNotKept` |
| (none) | `src/internal/ReviewGrid.tsx`, `ReviewQueue.tsx`, `WorkList.tsx`, `PhoneDrawer.tsx`, `parts.tsx`, `sizing.ts` | |

`useSavedProgress(scope, runtime)` takes the runtime it runs on (`ManagedRuntime.ManagedRuntime<never, never>`), so the
package has no runtime of its own and Effect DevTools keeps one connection; the import screens pass the app's
`browserRuntime`. `src/web/lib/table-assistant/conversation.ts`, which stores the assistant's history with the same
key scheme, imports `progressKey` and `ProgressScope` from `@inventory/review/SavedProgress`.

#### Tests

`test/web/review.test.ts`, `reviewLayout.test.ts` and `savedProgress.test.ts` move into the package (they import
the region and the gallery fixtures; `pages/gallery/fabrication.ts` and `jobs.ts` move with them as
`test/fixtures/`). `reviewHonesty.test.ts` and `reviewParity.test.ts` import `src/domain/ItemImport.ts` and the
import screen's adapter, so they stay in the app until `catalog-web` exists (step 7). The app's `ReviewGallery` page
imports the fixtures from the package's test folder by relative path in development only, or keeps its own copy:
decision (e).

## Proof

The definition of done, per package, written before the code.

| Package | Proof |
| --- | --- |
| `@inventory/ui` | `check-exports.mjs`: every component and hook has exactly one entry; `lint:shadcn` clean in the app and the package; the production build's CSS contains a class used only in a vendored component that a screen loads (`data-sticky` end edge of `table.tsx`) and no class of a component no screen loads (`tour.tsx`); `bun run build:report` before and after: the first chunk does not grow by more than the module-boundary overhead, and its makeup by package is written in PLAN. |
| `@inventory/review` | `ReviewDecision.property.test.ts`, `SavedProgress.property.test.ts`: every exported schema "generates only valid values" and round-trips; a draft JSON captured from the build before the move (committed as a fixture) decodes, encodes back to the same bytes, and gives the region the same decisions; `{ out: true, kept: true }` decodes to `leftOut { wasKept: true }` and putting it back gives `kept`; the moved region tests pass unchanged in count. |
| the app, after each package | `bun run check:full` through turbo and the production build pass; the stage C ceiling of the app plus the packages' ceilings is at most 678, and each only falls; the dev server on port 5200 (`--strictPort`); `items_messy.csv` imported in a real browser through Confirm: 200 rows in the file, the result screen, the Items table and the stored rows agree on 155. After `@inventory/review`: on the build before the move, two decisions made and one undone; the new build started on the same browser profile; the review shows the same decision and the same undo history, redo works; a hard refresh mid-review loses nothing; Confirm clears the draft. The same at phone width (375 px): the drawer and the queue. |

### How this brief obeys the schema rules

| Rule | Where it shows |
| --- | --- |
| SF-1 keys annotated as keys | every field of the saved-progress schemas takes `S.annotateKey` first; whole schemas `$I.annoteSchema` |
| SF-2 Effect's own values | `savedAt` is `DateTime.Utc`, `lastModified` a `DateTime.Utc` from millis, `size` a `ByteSize` |
| SF-3 normalised in the schema | nothing to normalise: the stored text is what the region wrote |
| SF-4 absence is `Option` | `StoredFile.sheet`, `SavedProgress.file`/`review`, `UndoStep.before` entries and `focus`; the hook's progress before the first save |
| SF-5 defaults on the schema | `ReviewDecision` (`place` open, three empty collections), `StoredReview.redo`; none on an id or a time |
| SF-6 tagged unions | `RowPlace` replaces the `out`/`kept` flags, with `.match` at every branch of the reducer |
| SF-7 generates only valid values | keys, labels, steps and counts bounded; each schema file has its property test |
| SF-8 behaviour beside its data | `RowPlace.putBack`, `ReviewDecision.isEmpty`, `readAt`/`writeAt` beside `SavedProgress` |
| SF-9 schema forms | `ReviewDecision`, `UndoStep`, `StoredReview`, `StoredFile`, `SavedProgress` are branded `S.Opaque` over `S.Struct` |

### Deviations from the exemplars, and why

1. **Vendored file names carry no role.** They are shadcn, Dice UI and tablecn files as published plus local edits;
   renaming 115 files would make every registry comparison a rename hunt. A recorded exception, like their stage D.
2. **A ui-system role vocabulary.** Research 04 §2 lists none for ui-system. This brief adds `.component.tsx`,
   `.provider.tsx`, `.hook.ts`, `.types.ts`, `.words.ts`, `.measure.ts`, and uses `.schema.ts`, `.rules.ts` and
   `.codec.ts` as the other families do.
3. **No root barrel in `@inventory/ui`.** A pure re-export of 115 components and hooks would invite one import that drags every
   component into a chunk; the anatomy's barrel rule (item 4) is for foundation packages.
4. **The encoded side of a stored schema is today's flags.** SF-6 governs the decoded side; the encoded side of
   stored bytes is frozen by M9.

### Where the research was wrong

1. **The fourth ui → app import.** Research 04 §4 names `hooks/use-data-table` as the fourth; the hooks move with the
   components, and the fourth edge is `hooks/use-data-table.ts` → `lib/json.ts`.
2. **"Item-agnostic" is true of the region, not of its tests.** `reviewHonesty.test.ts` and `reviewParity.test.ts`
   import the item rules and the import screen's adapter; research 04 put `reviewParity` in `catalog-model`, which
   cannot hold a test that imports a React region and a web adapter. It belongs to `catalog-web`.
3. **Shims.** Research 04 §8 says moves keep re-export shims at old paths; the kernel goal rewrote every import in the
   moving commit instead, and so does this one.
4. **Not wrong, but missing:** the shared table pieces (`ListTable`, `TableSearch`, `Skeletons`) are used by both
   contexts' screens and belong in `@inventory/ui`, not in the app or a context.

## Decisions for Benjamin

**(a) Does the review region's own decision become the tagged union in this goal?**

| Option | For the person | For an API client | For stored data |
| --- | --- | --- | --- |
| **Yes, `RowPlace` in this goal (recommended)** | Nothing changes: putting a row back still returns it to "kept" when it was kept. | Nothing: the region is browser-only. | `localStorage` drafts keep their bytes; the decoded side changes. |
| In step 7, with the server's `RowDecision` | Nothing changes. | Nothing. | Same; `SavedProgress` carries a recorded SF-6 deviation until then. |

Reason: the package is new code and the schema rules bind it from its first commit; the adapter between the region
and the server changes again in step 7 either way.

**(b) Exports of the vendored components.**

| Option | What it changes |
| --- | --- |
| **Exact: one entry per component and hook, checked by a script (recommended)** | About 115 entries; adding a component with the CLI also needs an entry, and the check says so. |
| One wildcard `./components/*` for the vendored folder only | Matches shadcn's monorepo guide; breaks the "exact exports everywhere" ruling for one package. |

**(c) Where do the shared screen pieces go?** (`PageHeader`, `Skeletons`, `ListTable`, `TableSearch`, `StatusPill`,
`Code`, `NotSet`, `ProposedValue`, `proposalSource`, `AgentRun`)

| Option | What it changes |
| --- | --- |
| **`@inventory/ui` (recommended)** | Both contexts and the review import them from one place; the design system owns their look. `RowCards.tsx`, imported by nothing, is deleted. |
| `@inventory/review` for the four the region uses, the app for the rest | The context web packages would need the app (they cannot import it) or copies. |

**(d) Strictness of the own code that moves.**

| Option | What it changes |
| --- | --- |
| **Stage C override per package, ceilings split (recommended)** | `@inventory/review` takes 234 of today's 678 findings (the region's 225 and saved progress's 9), `@inventory/ui` the 57 of its own pieces, the app keeps 373; the six vendored hooks join stage D and take their 14 out of the count by exemption, not by a fix. A root check keeps the sum at most 678 and each ceiling falling. |
| Fix the moved own code to the full profile now | 291 mechanical fixes (`Arr`, `Str`, `Record` modules, pipeable signatures) in this goal, on the region's 1,159-line reducer among them. |

**(e) The review gallery's fixtures.**

| Option | What it changes |
| --- | --- |
| **Fixtures in the package's `test/fixtures`, the app's development-only gallery page imports them by relative path (recommended)** | One copy; the gallery stays a development page; nothing of it reaches a production bundle (checked by `build:report`). |
| A `./Fixtures` subpath of `@inventory/review` | Test data becomes public surface. |

**(f) The theme tokens.**

| Option | What it changes |
| --- | --- |
| **`@inventory/ui/theme.css`, imported by the app's `index.css` (recommended)** | The design system owns its colours, type and radius; the app's stylesheet is only the Tailwind entry and its sources. |
| Stay in the app's `index.css` | The ui package cannot be read alone: its classes name tokens defined elsewhere. |

## Rabbit holes

- **`@shadcn/lint` and a package specifier.** Its `ui` setting is a path prefix; whether it accepts
  `@inventory/ui/components` and still tells a vendored import from a raw element is unverified. Tried first; the
  fallback is the app keeping a `@/components/ui` path alias to the package for the lint only.
- **Tailwind's `@import` of a package stylesheet** and `@source` outside the app's folder under Vite 8 and Tailwind 4
  are unverified; the production CSS check in the proof catches a miss.
- **The shadcn CLI in a workspace.** `bunx shadcn@latest add` with `--cwd packages/ui` and its aliases is checked by
  adding nothing (a dry run with `--dry-run` where the CLI has it) and comparing the import lines it would write.
- **`reachableSources` through package exports** must resolve exact subpaths, not guess `index.tsx`; an unresolved
  specifier stops the build, as a missing local file does today.
- **Hot reload across packages.** Vite serves workspace TypeScript as source (`@beep/csv` proves it for `.ts`); `.tsx`
  with React Fast Refresh from outside the app's root is checked by editing a component in the package with the dev
  server running.
- **The first page's weight.** The sign-in page imports `card`, `field`, `input`, `item`, `spinner`; a package
  boundary must not change chunking. `build:report` before and after.

## No-gos

- No context packages, no `@inventory/client`: step 7 ([BRIEF-contexts.md](BRIEF-contexts.md)).
- No change to what any screen shows or how it behaves; no restyle; no component added or updated from a registry.
- No change to the stored bytes of a saved draft, and no new `localStorage` version.
- No schema work on the region's TypeScript props, rows, columns or words.
- No edit to the vendored kit (`packages/foundation`), and no change to `CLAUDE.md` or `docs/` beyond the paths the
  move makes false (`CLAUDE.md` "UI" and "What is there", `docs/kit.md`, `docs/patterns.md` section 8,
  `docs/standards/saved-progress.md`, `.claude/agents/frontend.md`).

## Map

| Part | Goal | Cites |
| --- | --- | --- |
| The four ui → app imports turned around | `ui-packages`, slice 1 | `apps/inventory/src/web/components/ui/sonner.tsx`, `data-table/data-table-state.ts`, `data-table/data-table-records.tsx`, `hooks/use-data-table.ts`; `lib/theme.tsx`, `route.ts`, `content-width.ts`, `json.ts` |
| `@inventory/ui` with the shared pieces, Tailwind, lints, CLI | `ui-packages`, slice 2 | `apps/inventory/src/web/components/ui`, `hooks`, `components/app`, `index.css`, `shadcn-utilities.css`, `components.json`, `.oxlintrc.shadcn.json`, `scripts/reachable-sources.mjs`, `vite.config.ts` (`usedSourcesOnly`) |
| `@inventory/review` with saved progress | `ui-packages`, slice 3 | `apps/inventory/src/web/components/review`, `lib/saved-progress`, `test/web/review*.test.ts`, `savedProgress.test.ts`, `pages/gallery` |
| `reviewHonesty`, `reviewParity` into `catalog-web` | later, in `contexts` | `apps/inventory/test/web/reviewHonesty.test.ts`, `reviewParity.test.ts` |

### Order of moves

Each is one commit, with `bun run check:full` and the build green, and the app working.

1. The four edges turned around inside the app (`lib/route.ts` split; `theme`, `route`, `content-width`, `json`,
   `text-width` beside `components/ui`). Proof: check and build; the app in the browser unchanged.
2. `@inventory/ui`: vendored components and hooks, the five modules, the shared pieces, `theme.css`; every import
   rewritten; Tailwind sources, the CSS walk, lint and `oxlint` configs, `components.json`, tsconfig stages; the
   ceilings split; `RowCards.tsx` deleted. Proof: the package and app rows above, then the messy sample.
3. `@inventory/review`: the region, `ReviewDecision` and `SavedProgress` schemas with the stored encoding kept, the
   hook taking its runtime, the moved tests and the draft fixture. Proof: the package and app rows above, the old
   draft restored, then the messy sample.
4. Documents the moves made false; PLAN's closing note.

The first vertical slice is move 1: the smallest change that makes a package possible, and one a browser can check
in a minute.
