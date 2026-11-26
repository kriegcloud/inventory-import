---
type: Tooling Guide
title: Looking at a deployed stage
description: For one stage - how to read its plan, its drift, its logs and its state, each with the exact command; what the deploy workflow's plan step and its guard do; who may open a preview; and what none of these commands may be run by.
tags: [tooling, deploy, operations]
---

# Looking at a deployed stage

A stage is one deployed copy of the app: `pr-<number>`, `staging`, `prod` or `test_<user>`
([Releasing and deploying](releasing.md) says which event deploys which). This page is how to look at one without
changing it.

**Every command here reaches a real Cloudflare account, so it is Benjamin's to run, at his own terminal.** No agent
runs `alchemy plan`, `deploy`, `drift`, `logs` or `state`. The one exception is `bun run beep infra plan-check`, which
reads a file and reaches nothing.

All of them run from the repository's root and take the stage and the profile of the account the stage is in:
`--profile inventory-preview` for previews, test stages and staging, `--profile inventory-production` for `prod`
(the names `bun run beep infra setup` gives them).

| To see | Command | Changes anything |
| --- | --- | --- |
| What a deploy would do | `bunx alchemy plan --stage <name> --profile <profile>` | No |
| The same, with every declared property | `bunx alchemy plan --stage <name> --profile <profile> --detailed` | No |
| Whether the account still matches what was deployed | `bunx alchemy drift --stage <name> --profile <profile>` | Only on a yes to its question |
| The Worker's last 100 log lines | `bunx alchemy logs --stage <name> --profile <profile>` | No |
| The Worker's log as it happens | `bunx alchemy logs --stage <name> --profile <profile> --tail` | No |
| Which resources a stage's state holds | `bunx alchemy state list inventory/<name> --profile <profile>` | No |

Not verified: none of these was run against an account when this page was written (2026-11-26). The flags, the
exit codes and what each prints are read from the CLI's source at the commit `vendor/alchemy` holds, and the plan's
lines from a run of its own formatter.

## The plan

One line for each resource and what a deploy would do to it:

```
Plan: 1 to update
[Database] noop
[SignInSecret] noop
[Website] update
```

The words are `create`, `update`, `adopted`, `replace`, `delete`, `orphaned` and `noop`. A resource bound to another
has a line of its own under it (`[Website/DB] update`).

The three to stop at:

- **`[Database] replace` or `[Database] delete`.** The stage's rows are gone after it: a replaced database is a new,
  empty one. `[Database] orphaned` ends the same way one deploy later. Take a dump first ("A dump of a stage's
  database", below) and be sure it is meant.
- **`[SignInSecret] replace` or `delete`.** Every person is signed out, and every session cookie stops working
  (decision I3: the secret is minted once and kept in the state).
- **`[Website] replace`.** The Worker is made anew; on `workers.dev` its address stays, and a custom hostname is
  bound again.

`--detailed` adds each resource's declared properties as YAML. Read it at a terminal and never in a workflow: a
workflow's log is public.

### What the deploy workflow does with it

Each of the three deploys in `.github/workflows/deploy.yml` (a preview, staging, production) runs two steps before
its `alchemy deploy --yes`:

1. **Show the plan**: `bunx alchemy deploy --stage <name> --dry-run --yes`, printed to the log and kept in a file.
   `alchemy plan` and `deploy --dry-run` are the same code; `--yes` lets the step bring the state store up to date
   after a re-pin, as the deploy itself always has, where `plan` would stop the job and ask for
   `alchemy state bootstrap`.
2. **Stop a plan that loses the database**: `bun run beep infra plan-check <file>`. It refuses a plan in which
   `[Database]` is `replace`, `delete` or `orphaned`, and a text it cannot read as a plan (no `Plan:` line, or
   changes with no resource named), so a change in what the tool prints stops a deploy instead of passing it.

A refused plan deploys nothing. If the loss is meant, it is deployed from a workstation, after a dump.

To try the guard on a plan you saved:

```bash
bunx alchemy plan --stage staging --profile inventory-preview > plan.txt 2>&1
```

```bash
bun run beep infra plan-check plan.txt
```

The guard knows the database by the stack's name for it, `Database`
(`packages/infra/src/Inventory.stack.ts`); its test reads that file, so a rename there fails `bun run check`.

## Who may open a preview

A preview (`pr-<number>`) is behind Cloudflare Access: its address asks for an email and a one-time code before
the app's own sign-in page, and only the emails in the `preview` environment's secret `PREVIEW_ACCESS` pass. No
other stage has a gate. The emails are in no file of the repository, which is public.

To change who may open one, set the secret again with the whole list, typed at the prompt as one line separated
by commas:

```bash
gh secret set PREVIEW_ACCESS --env preview --repo kriegcloud/inventory-import
```

Each preview takes the new list at its next deploy (a push to its pull request). A list with a piece that is no
email stops the deploy with `MissingPreviewAccess`, which says so without repeating the list. In a preview's plan
the gate is the line `[Website/Access]`.

## Where a stage's telemetry goes

Cloudflare keeps its own traces and logs of the Worker for every stage (`observability`, read with `alchemy logs`
and in the dashboard). Staging and production can also send them to a collector that speaks OpenTelemetry over
HTTPS; a preview, a test stage and a personal one never do. Neither names a collector today, so nothing is sent.

A stage sends when its GitHub environment holds the collector's address, and the header the collector asks for if
it asks for one:

```bash
gh variable set TELEMETRY_COLLECTOR_URL --env staging --repo kriegcloud/inventory-import
```

```bash
gh secret set TELEMETRY_COLLECTOR_AUTHORIZATION --env staging --repo kriegcloud/inventory-import
```

The address is the collector's base, `https://` and no query (`https://otlp.example.test/otlp`): the stack adds
`/v1/traces` and `/v1/logs`. Anything else stops the deploy with `UnreadableCollector`, which repeats nothing it
was given. The header's value is the whole `authorization` line (`Basic …` or `Bearer …`), typed at the prompt.
At the next deploy the plan reads `[TelemetryTraces] create` and `[TelemetryLogs] create`; Cloudflare first sends
the collector one test request and refuses a destination that does not answer it. Taking the variable away removes
both destinations at the next deploy.

These are Cloudflare's records of each request (its time, its status, the Worker's log lines). The app's own
spans, the ones `bun run telemetry` shows locally, are not joined to them.

## Drift

`alchemy drift` reads each resource back from the account and compares it with what the state says was deployed:
someone changed a setting in the dashboard, or deleted something by hand. All three of this stack's resources can be
read back (the database, the minted secret, the Worker), so none is skipped.

| It ends with | Meaning |
| --- | --- |
| 0 | Nothing differs |
| 2 | Something differs and was left as it is |
| 3 | Nothing differs, but a resource could not be checked: an earlier deploy stopped half way. A deploy recovers it |
| 1 | The check itself failed |

At a terminal it asks "Repair" or "Cancel" when something differs, with Cancel chosen. `--repair` or `--yes` repairs
without asking: that is a change to the account, and it is never passed without having read the drift first.
`alchemy deploy --detect-drift` runs the same check before a deploy; the workflow does not pass it.

## Logs

`alchemy logs` prints what the Worker logged, newest last, each line with its time and the resource it came from.
`--since 1h` (or `30m`, `2d`, or a date) goes further back, `--limit 500` takes more lines, `--resource Website`
keeps to one resource, and `--tail` follows the log until it is stopped.

These are the Worker's own lines (`Effect.log` in the app). A person's email is in none of them by the app's own
rule, but a log is still read at a terminal, not pasted into an issue.

## State

The state is Alchemy's record of what it made for a stage, kept in the account's state store, encrypted
(`Cloudflare.state()`, decision I2). Its paths read `inventory/<stage>/<resource>`.

```bash
bunx alchemy state list inventory/staging --profile inventory-preview
```

lists the resources of one stage; `bunx alchemy state list inventory --profile inventory-preview` lists the stages.

`bunx alchemy state read inventory/<stage>/<resource> --profile <profile>` prints one resource's record as JSON.
**`SignInSecret`'s record and `TestAccountPassword`'s hold the secret itself.** Read `Database` or `Website` when
that is what is needed, never the whole stage (`--recursive`), and never where the output is kept.

`state delete`, `state nuke`, `state migrate` and everything under `state unsafe` change the record without
changing the account, or the reverse. They are recovery tools, not ways of looking: none is part of this page.

## A dump of a stage's database

Not built yet: step 3 of [the Alchemy uptake goal](../goals/alchemy-uptake/PLAN.md), which waits for Benjamin's
answer on where a dump is kept, for how long, and who may take one. Until then a plan that would lose the database
is deployed by nobody.
