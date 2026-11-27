---
type: Research
title: Alchemy, what the repository does not use yet
description: A sweep of Alchemy at commit e1c3e6d (docs and source) against what inventory-import does by hand, outside the domain library - eight things worth taking, what declaring the Worker as an Effect would remove, and what is not worth it now.
---

# Alchemy: what the repository does not use yet

Written 2026-11-26 by a Codex lane (`gpt-6.1-sol`, medium) from a brief, then spot-checked by the orchestrating agent:
the source files and options named for items 1, 2, 4, 5, 6 and 8 exist at this commit
(`packages/alchemy-test`, `Cli/commands/{drift,logs,state}.ts`, `Workers/Worker.ts` `limits`, `placement` and
`access`, `Workers/RateLimit.ts`, `D1/ExportDatabase.ts`). Nothing was installed, run or deployed, so every item is
a capability read from source, not a verified integration. The goal built from it is
[alchemy-uptake](../../../goals/alchemy-uptake/SPEC.md).


Compared inventory-import `4840cdaa` with Alchemy `e1c3e6d6ef435a22681d27caf8c3377fb7957cc0`. Both repositories were read only; no runtime, deployment or integration tests were run. Recommendations are source-confirmed capabilities, not verified integrations.

Citation prefixes resolve inside the Alchemy reference checkout: **D** = `website/src/content/docs`, **P** = `packages`. App paths are relative to inventory-import. **V** means available in packages already listed in `vendor/alchemy/sources.json`; adding an import/dependency may still be necessary. **Add** means expanding the vendor package set at this commit. Everything remains beta. Prior domain research and section 9 exclusions stand.

## Top eight worth doing, in order

1. **Add a stack-level integration suite. Medium; Add `@alchemy.run/test` (`packages/alchemy-test`).** The harness deploys a real stack locally or remotely, supplies HTTP clients and tears it down (`D/testing/testing-a-stack.mdx`; `P/alchemy-test/src/{Core,Vitest,Http}.ts`). Add coverage of the built SPA, Worker bindings, cookies and migrations beside `apps/inventory/test/server/support/app.ts`. Today's `*.slow.test.ts` run real D1 through `packages/drivers/d1/src/D1.test-layer.ts`, but compose the application in the test process. Keep their tenancy, atomicity and 50,000-row assertions. Explicitly provide `Cloudflare.state()`; the harness defaults to prohibited plaintext local state. Live runs need isolated test stages and credentials. This closes a deployment-wiring gap without replacing focused tests.

2. **Use operational CLI inspection. Small; V, `alchemy` and Cloudflare.** `plan --detailed`, `drift`, `logs --tail`, and `state list/read` expose declaration changes, observed drift, execution logs and deployment records (`D/cli/{plan,drift,logs,state,inspecting-state}.mdx`; `P/alchemy/src/Cli/commands/{deploy,drift,logs,state}.ts`; `P/cloudflare/src/Workers/WorkerProvider.ts`). Add plan/preflight steps to `.github/workflows/deploy.yml` and a troubleshooting procedure; deployment currently goes straight to `deploy --yes`. `provider check-env` checks credential presence, not the token-permission checks in the setup tooling. Drift skips providers without reads; interactive drift can offer repair. Keep release guards, reviewer approval and account separation.

3. **Consolidate local development under `alchemy dev`. Medium; V.** Local providers run D1 migrations/imports and serve Vite with bindings (`D/environments/{local-development,worktrees}.mdx`, `D/cloudflare/local-development.mdx`; `P/cloudflare/src/D1/Database.ts`, `P/cloudflare/src/Workers/Sources/Vite.ts`). This can replace `apps/inventory/scripts/migrate-local.mjs`, its `.dev.vars` secret creation and the local binding duplication in `apps/inventory/wrangler.jsonc`, using the stack's existing seeds and Random secret. Blockers: local-state/secret policy, workstation secret-provider evaluation, worktree-specific stages, and preserving zero-key startup. `vite.config.ts` must guard its Cloudflare plugin against Alchemy's injected instance. HTTPS certificate trust in `scripts/dev-https.mjs` remains necessary; the CLI does not establish machine trust.

4. **Declare CPU limits and evaluate smart placement. Small; V.** Worker props configure execution limits and placement (`D/cloudflare/compute/workers.mdx`; `P/cloudflare/src/Workers/{Worker,WorkerProvider}.ts`). Add them to `packages/infra/src/Inventory.stack.ts`, and mirror local configuration where meaningful. Confirm runs review and a large atomic batch in `packages/catalog/host/src/ImportStore.adapter.ts`; paid-plan I9 alone does not specify its budget. Measure hosted CPU and latency first: local `WriteLimits.slow.test.ts` proves SQL bounds, not Cloudflare CPU survival. Placement may help repeated D1 round trips while increasing latency for other routes; neither option accelerates CPU-heavy review.

5. **Add a coarse abuse limiter. Medium; V.** `RateLimit` is native binding metadata with approximate, location-local counters and only 10/60-second periods (`D/cloudflare/compute/rate-limiting.mdx`; `P/cloudflare/src/Workers/{RateLimit,RateLimitBinding}.ts`). Bind through `Website.Vite.env`, then check before expensive auth/model requests in `apps/inventory/src/server/worker.ts`. A full Effect Worker is unnecessary for the native env form. Keep Better Auth's database limiter in `packages/access/host/src/internal/authOptions.ts` and the exact rolling allowance in `AllowanceStore.adapter.ts`; this binding replaces neither. Choosing keys, thresholds and failure behavior needs a product decision.

6. **Protect selected previews with Access. Medium; V.** Worker `access` provisions an application and policies, including workers.dev destinations (`D/cloudflare/security/access.mdx`; `P/cloudflare/src/Access/Application.ts`, `P/cloudflare/src/Workers/WorkerAccess.ts`). `Website.Vite` accepts it, so add stage-specific policy in `Inventory.stack.ts`. This adds a gate around shared test-account previews. It does not replace Better Auth. Blockers are visitor eligibility, Access account configuration and automated smoke-test authentication. I8 rejected Access for public sign-up; preview-only protection requires a separate decision and must preserve invited staging access.

7. **Add platform telemetry export; trial native Effect tracing later. Medium; V.** `ObservabilityDestination` exports platform OTLP, while `Cloudflare.Telemetry()` joins Effect spans to Cloudflare's waterfall (`D/cloudflare/observability/workers-tracing.mdx`, `D/testing/observability.mdx`; `P/cloudflare/src/Workers/{ObservabilityDestination,Telemetry}.ts`). Add destinations to `Inventory.stack.ts`; the Effect bridge could replace server-side flushing in `apps/inventory/src/server/RequestTelemetry.ts` and parts of `Telemetry.ts`. Native tracing needs the Effect runtime constructor; compatibility date already qualifies. Preserve browser `/api/otlp`, application metrics and error reporting. Export requires a reachable HTTPS collector accepting preflight POSTs; avoid duplicate trace exporters.

8. **Add an explicit D1 export/recovery procedure. Medium; V.** Alchemy's export helper polls for a SQL-dump download URL (`D/cloudflare/data/d1.mdx` describes D1, but does not document this helper; source `P/cloudflare/src/D1/ExportDatabase.ts`, exposed through the package wildcard). Add an operator procedure around the database from `Inventory.stack.ts`; no equivalent appears in app scripts or deploy YAML. Download, retention, encryption and restore verification remain our work. The helper has no bounded poll schedule. I could not confirm a managed Time Travel/backup resource in Alchemy source; do not describe this export as automated backups.

## What an Effect Worker would actually remove

`D/infrastructure-as-effects/{runtime,binding,layers,phases}.mdx` and `D/apis/effect-http.mdx` describe construction at plan time and cold start, then request Effects. Source confirms `P/cloudflare/src/Workers/{Worker,ConfigProvider,HttpServer}.ts` and `P/alchemy/src/Runtime.ts`. HttpApi can remain through `HttpRouter.toHttpEffect`; RPC adds no needed capability.

A migration could remove the env-to-ConfigProvider bridge in `worker.ts`, hand-maintained binding types in `env.d.ts` (also replaceable incrementally with `InferEnv`), and `App.ts`'s web-handler/runtime adapters after preserving security and tracing. `Settings.ts` still owns validation/defaults. `P/cloudflare/src/D1/SQL.ts` supplies deferred `D1Layer`, but does not replace `D1.statement`, result decoding or atomic batches in `packages/drivers/d1/src/D1.service.ts`; Better Auth still needs the raw binding. Vite assets and `import.meta.env` must survive. Remove `wrangler.jsonc` only after standalone Vite development/builds no longer consume it; the driver's test Wrangler config is separate. I did not confirm this app's combined Effect-constructor/Vite bundle works. `Website.Vite` has no constructor-Effect argument (`P/cloudflare/src/Website/Vite.ts`); replacing it conflicts with I1. Large effort; V; defer pending that decision and bundled-workerd proof.

## Considered, not worth it now

Below, doc paths are under D; source paths under P. Effort and availability apply to each entry.

- **Queues/Workflows:** large, V; retries/steps do not preserve the current single-batch confirm automatically; require job/status/idempotency design (`cloudflare/messaging/queues.mdx`, `cloudflare/compute/workflows.mdx`; `cloudflare/src/{Queues/Queue,Workflows/Workflow}.ts`).
- **AI Gateway:** medium, V; extra hop/logging/retries overlap OpenRouter policy; `.model()` targets Workers AI, and OpenRouter-specific compatibility was not confirmed (`cloudflare/ai/ai-gateway.mdx`; `cloudflare/src/AI/{Gateway,QueryGatewayBinding}.ts`).
- **Analytics Engine, Logpush, tail:** medium, V; duplicate today's OTLP pipeline (`cloudflare/observability/analytics-engine.mdx`, `cloudflare/compute/workers.mdx`; `cloudflare/src/{AnalyticsEngine/Dataset,Logpush/Job,Workers/Worker}.ts`).
- **KV/R2:** medium, V; eventual consistency cannot serve allowance accounting; retaining original files adds a new requirement (`cloudflare/data/{kv,r2}.mdx`; `cloudflare/src/{KV/Namespace,R2/Bucket}.ts`).
- **Turnstile:** medium, V; closed sign-up, extra browser origin/CSP changes (`cloudflare/security/turnstile.mdx`; `cloudflare/src/Turnstile/Widget.ts`).
- **Secrets Store:** medium, V; one Worker gains little from live shared secrets (`cloudflare/security/secrets-store.mdx`; `cloudflare/src/SecretsStore/ReadSecretBinding.ts`).
- **D1 replicas/jurisdiction:** medium, V; need session/bookmark design; jurisdiction/location changes replace databases (`cloudflare/data/d1.mdx`; `cloudflare/src/D1/Database.ts`).
- **Versions/previews/crons:** medium, V; existing isolated stages fit I4; gradual deploys need compatible shared schemas; no new housekeeping requirement (`cloudflare/compute/{gradual-deployments,previews}.mdx`, `cloudflare/messaging/cron.mdx`; `cloudflare/src/Workers/Worker.ts`).
- **Email:** medium, V; I6 says not now; routing/sender restrictions need review (`cloudflare/email/send-and-receive.mdx`; `cloudflare/src/Email/SendEmail.ts`).
- **Domains/DNS:** small, V; already declared through `domain`/`zoneName` (`cloudflare/networking/custom-domains.mdx`; `cloudflare/src/Workers/Worker.ts`).
- **Command memo/dev:** small, V; Vite already hashes imported workspaces, contrary to older examples; no extra build wrapper (`command/{memoization,dev-servers}.mdx`; `cloudflare/src/Workers/Sources/Vite.ts`).
- **GitHub extras/OIDC:** medium, V; Ruleset already owns protection, webhooks have no consumer; Cloudflare CI source supports tokens/keys, not GitHub OIDC (`github/{repository,events}.mdx`, `environments/profiles.mdx`; `github/src/{BranchProtection,Webhook}.ts`, `cloudflare/src/Auth/AuthProvider.ts`).
- **1Password/Axiom/AI:** medium; 1Password V, others Add; references already integrated, backend migration unnecessary, agent processes exceed present model calls (`environments/1password.mdx`, `axiom/data/ingest.mdx`, `ai/models.mdx`; `{1password/src/SecretsProvider,axiom/src/Telemetry,ai/src/Model}.ts`).
- **Test-tools:** medium, Add; private framework/Miniflare utilities do not replace domain fixtures (`testing/index.mdx`; `cloudflare-test-tools/src/{e2e/Framework,miniflare/miniflare}.ts`).
- **Adopt/state mutation/nuke:** small, V; recovery tools, no routine gap; nuke enumerates the ambient account, not one stage (`cli/{adopting-resources,nuke}.mdx`; `alchemy/src/Cli/commands/{deploy,nuke,state}.ts`).
