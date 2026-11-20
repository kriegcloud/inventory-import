---
type: Reference
title: CLI (toCli)
description: toCli builds an Effect CLI command from an Api, one kebab-case subcommand per exposed call; inventory-import would use it for an operator's command line over its admin Api, separate from the repository's own CLI.
tags: [alchemy-domain, surface]
---

# CLI (toCli)

`toCli` from `@alchemy.run/domain/Cli` turns the calls of an [Api](./api.md) you list into an `effect/cli` command: one
kebab-case subcommand per command, query, view or stream, flags for the payload's fields, the result printed as JSON.
It is a client of the deployed Api, so the server runs the same middleware and checks as for the screens; the CLI only
sends headers (a token read from the environment) and decodes the input before anything is sent. The docs put it as
running "an Api's calls from a terminal, as a person or an agent, against the deployed Api"
[https://alchemy.run/domain/cli]. It is its own module, so an app that builds no CLI never loads `effect/cli`.

## When to reach for it

- An operator who must run a handful of calls by hand (list imports, take one back, add a person) without a screen.
- A shell script or a coding agent in a terminal that needs the same calls with exit codes.
- Not for the repository's own chores (lint rules, docs checks): those do not go through the domain.

## How it is declared

```ts
// SKETCH: not compiled
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Config from "effect/Config"
import * as Redacted from "effect/Redacted"
import * as Command from "effect/cli/Command"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as BunServices from "@effect/platform-bun/BunServices"
import * as Domain from "@alchemy.run/domain"
import { toCli } from "@alchemy.run/domain/Cli"
import { AdminApi } from "@inventory/access-model/AdminApi"

const inventory = toCli(AdminApi, {
  name: "inventory",
  expose: ["PastImports", "ImportSummary.get", "TakeBackImport", "AddPerson", "ChangeRole"],
  headers: Config.redacted("INVENTORY_SESSION").pipe(
    Effect.map((session) => ({ cookie: `inventory.session_token=${Redacted.value(session)}` }))
  )
})

Command.run(inventory, { version: "0.1.0" }).pipe(
  Effect.provide(
    Layer.mergeAll(
      Domain.protocolHttp("https://inventory.example.com/ops").pipe(Layer.provide(FetchHttpClient.layer)),
      BunServices.layer
    )
  ),
  BunRuntime.runMain
)
```

- `toCli(api, { expose?, name?, description?, headers? })`.
  - `expose`: the calls that get a subcommand, by name; defaults to `[]`. Only calls that answer once can be listed
    (`OnceCallName`): a command, a query, `get`, `peek`, `list`, `snapshot`. `watch` and `events` are streams and never
    become subcommands.
  - `name`: the root command; defaults to the Api's name in kebab-case.
  - `description`: the root help; defaults to the Api's `description` [annotation](./annotations.md).
  - `headers`: a plain headers value, or an Effect that runs once per call (so it can read a redacted `Config`).
- The returned command's requirements are the Api `client`'s services minus `Scope`: an `RpcClient.Protocol` (provide
  `Domain.protocolHttp(url)` and an `HttpClient`) and the client half of any middleware that requires one. Then the
  platform's CLI services to run it.

What it builds:

- A command or a query is one subcommand (`take-back-import`). A view or a stream is a subcommand with one subcommand
  per read (`import-summary get --key imp_7f3`); help lines say what each read prints.
- Each payload field is a kebab-case flag (`--target`, `--command-id`, `--key`, `--at-least`, `--after`, `--take`).
  A command's or a query's `input` fields are flattened into flags of their own (`--confirms`, `--email`, `--role`),
  unless one of them would collide with an outer flag (at beta.87, an input field named `target`); then the whole
  input is one `--input` JSON flag.
- A string, a number, a boolean, or a union of string literals takes a typed flag (`Flag.String`, `Flag.Finite`,
  `Flag.Boolean`, `Flag.Literals`). Anything else (a struct, an array, a date) takes its JSON; a JSON flag whose text is
  not JSON is passed as the text itself.
- Every subcommand has `--json`: the flags as one object, flat or as the wire payload with `input` nested; any flag
  given as well wins over it.
- A subcommand's help is the entry's `description` annotation, or a generated sentence ("Send the TakeBackImport
  command.", "Ask the PastImports query.", "Read the ImportSummary view."). A field's help is its Schema
  description, plus "A JSON value." and "Required." where they apply.
- Reserved flags: `json`, `help`, `version`, `wizard`, `completions`, `log-level`. A field that would take one, two
  fields with one flag, or two served things with one command name fail every run with a `DefinitionError`
  (`ReservedFlag`, `DuplicateFlag`, `DuplicateCommand`).

Results and exit codes:

- Success: the result encoded as its wire JSON, printed to stdout, pretty-printed with two spaces.
- Invalid input: decoded against the call's payload schema before anything is sent; it fails with
  `CliError.UserError` ("Invalid input for take-back-import: ..."). `--json` that is not JSON, or not an object, also
  fails with `UserError`.
- A typed failure (a declared rejection, or the error of the call's middleware): its wire JSON is printed to stderr and
  the run fails with `CallRejected { rpc, error }`. `CallRejected` sets `Runtime.errorReported` to false, so `runMain`
  prints nothing more.
- Anything else (the server could not be reached): `UserError` "<Rpc> did not reach the Api: <message>".

The exit codes, settled from Effect 4.1.4's runner. `Command.run` renders a `UserError` (anything with a
`userMessage`) to stderr through the CLI's formatter, marks it reported and fails again with it
(`effect/cli/Command.ts` lines 3317-3325 and 3738-3752). `BunRuntime.runMain` (or `NodeRuntime.runMain`) then ends the
process through `Runtime.defaultTeardown` (`effect/Runtime.ts` lines 183-197): 0 on success; 130 when the run was only
interrupted (Ctrl-C); otherwise the failure's `Runtime.errorExitCode` if it carries one, and 1 if not
(`getErrorExitCode`, lines 399-407). Neither `CallRejected`, `UserError` nor `DefinitionError` carries an exit code,
so:

| Outcome | Printed | Exit code |
| --- | --- | --- |
| success | the result's JSON on stdout | 0 |
| a rejection or a middleware error (`CallRejected`) | its wire JSON on stderr, nothing more | 1 |
| invalid input, bad `--json`, Api not reached (`UserError`) | the message on stderr, by `Command.run` | 1 |
| a reserved or duplicate name (`DefinitionError`, a defect) | the cause, logged by `runMain` | 1 |
| unknown flag or subcommand | help with the errors (`CliError.ShowHelp`, exit code 1 when it has errors) | 1 |
| `--help` | the help | 0 |
| interrupted | nothing | 130 |

The exit codes were read from source; no CLI was built or run in either trial on 2026-11-19.

Checked in: `packages/domain/src/Cli.ts` lines 38-49 (`Cliable`, `ClientServices`), 51-64 (`CallRejected`), 66-95
(`Exposable`, `Options`, `Failure`), 103-111 (`kebab`, `RESERVED`), 138-220 (field kinds, flattening the input),
224-253 (flags, `--json`), 289-316 (how a call is invoked), 318-342 (live reads left out, help text), 344-430 (one
subcommand: decode, call, print, fail), 491-548 (`toCli`), at `v2.0.0-beta.87`. In Effect 4.1.4:
`packages/effect/src/Runtime.ts` lines 183-197, 399-407 and 490-497 (`getErrorReported`, true unless set);
`packages/effect/src/cli/Command.ts` lines 3317-3325, 3703-3704 (`--help` runs its action and returns), 3706-3709
(parse errors become `ShowHelp`), 3738-3760; `packages/effect/src/cli/CliError.ts` lines 672-693 (`UserError`),
783-797 (`ShowHelp`, its exit code at line 791).

### What main changes

- Commands have no `target`, so there is no `--target`: the key is an input field and gets its own flag
  (`--import-id`). The flag that makes an input fall back to `--input` JSON is now a field named like a payload field,
  such as `commandId` (`Cli.ts` lines 165-170, 206-209 on main). The call goes through `sendPayload`
  (`Cli.ts` line 299; `packages/domain/src/internal.ts` lines 255-271), which also passes a `consistency` field.
- `consistency` is a payload field, a union of the literals `"strong"` and `"eventual"`, so every command subcommand
  gets `--consistency strong|eventual` (`Command.ts` lines 51 and 319 on main; `Flag.Literals` from `kindOf`, `Cli.ts`
  lines 143-157). An input field named `consistency` now also sends the whole input to `--input`.
- Every command can now fail with `ConsistencyTimeout` (`Command.ts` line 328 on main), printed to stderr as a
  `CallRejected` with exit code 1, though the command was committed.
- The printed receipt gains `commits` (see [Api](./api.md)).
- `CallRejected` is at `Cli.ts` lines 52-65 on main (the class at line 58).
- Commit not known for target-less commands; `consistency` is commit `bc0024faf` (#3469).

## Rules, and the mistakes to avoid

- Expose only what an operator should run by hand. The server still checks the caller, but a subcommand that exists is
  an invitation.
- Never pass a token as a flag (it lands in shell history); read it with `Config.redacted` in `headers`.
- Do not name an input field `json`, `help`, `version`, `wizard`, `completions` or `log-level`: every run of the CLI
  then dies, not only that subcommand.
- Provide the protocol: `toCli` uses the Api's plain `client`, not `clientHttp`, so a missing `RpcClient.Protocol` is a
  type error at `Command.run`, not a runtime surprise.
- `--json` and flags merge: a flag wins over the same field in `--json`.
- The docs say "A view, a stream or an aggregate is a subcommand" (`cli.mdx` line 95, both refs). An Api never serves
  an aggregate (`Servable`, `Api.ts` line 52), so `expose` cannot name one; read an aggregate through a view.
- Exit code 1 means any failure: a rejection, bad input, an unreachable server and a definition problem all exit 1.
  A script tells them apart by stderr (a rejection's JSON has a `_tag`), not by the code.

## In this app

The repository already has a CLI: `@beep/repo-cli` (`packages/tooling/tool/cli`, entry `src/bin.ts`, root command
`beep` in `src/Root.command.ts` with the groups `docs`, `laws`, `quality`, `vendor`), built on `effect/cli` and run on
Bun. It checks the repository's own rules; it never reaches a deployed app, and it should stay that way.

An operator's CLI over the domain is a different program with different users: it is a client of a deployed
organization's data. It would live in its own app, for example `apps/inventory-ops` (name not decided), importing an
`AdminApi` from the access and catalog model packages, with a bin named `inventory`. What it would do, at beta.87:

```text
$ inventory past-imports --take 20
{ "entries": [ { "importId": "imp_7f3", "file": "items_messy.csv", "created": 141 } ], "cursor": null }

$ inventory take-back-import --target imp_7f3 --confirms '["cnf_19"]'
{ "reply": { "removed": 139, "restored": 0, "kept": 2 }, "stream": "Import/imp_7f3", "version": 11 }

$ inventory add-person --email sam@northline.example --role editor
{ "_tag": "Forbidden", "reason": "You are a viewer in Northline. This needs the admin role: ask an admin there." }
# exit code 1: the session belongs to a viewer
```

- **Used today:** no. People are managed on the People page (`packages/access/web`), backed by
  `packages/access/model/src/People/People.handler.ts`; there is no command line for an organization's data.
- **Where it goes:** a new app beside `apps/inventory` (for example `apps/inventory-ops/src/bin.ts`), never inside
  `packages/tooling/tool/cli`. The Worker would serve the `AdminApi` on its own path for it.
- **What the person gets:** an admin can list, take back and add people from a terminal, with the same refusals the
  screens give.

How the CLI signs in is open: the app's sessions are Better Auth cookies, so the sketch sends the session cookie as a
header. The app sets `cookiePrefix: "inventory"` and `useSecureCookies` from its options
(`packages/access/host/src/internal/authOptions.ts` lines 118-121), so by Better Auth's naming the cookie is
`inventory.session_token`, with a `__Secure-` prefix when secure cookies are on (Better Auth's naming was not checked
in its source here). Whether a bearer-token plugin or a service token suits operators better is a decision for the
owner (see [Better Auth](./better-auth.md)).

## How to check it

- A fast test: build `toCli(AdminApi, { expose: [...] })` and run it with `--help` in a test runtime; assert the
  subcommand names and that a field named `json` makes the run die with `DefinitionError`.
- A slow test against a local Worker with the [in-memory host](./host-in-memory.md) or local D1: run
  `take-back-import` as a viewer and assert `CallRejected` with `Forbidden` on stderr; as an editor, assert the receipt
  on stdout.
- Run `inventory take-back-import` twice with one `--command-id`: the second prints the first receipt.

## What it needs

- `effect/cli` (Effect 4.1.4) and a platform runtime (`@effect/platform-bun`, already a dependency of the repository
  CLI).
- A deployed Api reachable over HTTP, and its middleware's server half able to read the header the CLI sends.
- beta.87 for `--target`; main for target-less commands.

## Verdict

**Use:** build an operators' CLI with `toCli` over an `AdminApi`, in its own app, with a short `expose` list and the
session read from a redacted `Config`.

## Where this was read

- https://alchemy.run/domain/cli (the live site documents beta.87)
- `website/src/content/docs/domain/cli.mdx` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/Cli.ts` at `v2.0.0-beta.87`; on `main@dbfd0ddb`: same path, changed
- `packages/domain/src/ReadRpcs.ts` at `v2.0.0-beta.87` (lines 224-335); on `main@dbfd0ddb`: same path, changed
- `packages/domain/skills/alchemy-domain/references/hosting.md` at `v2.0.0-beta.87`, "CLI"; on `main@dbfd0ddb`: same
  path, changed
