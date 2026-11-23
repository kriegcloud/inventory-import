// `infra setup` on a workstation that is not one: every tool is a stand-in that answers from a small world the test
// writes (who is logged in, which accounts, profiles, vaults and items there are) and every thing said, asked, run
// or handed the terminal is written down in order. No real `op-human`, `cf`, `gh` or `alchemy` is started, so what
// these tests show is what the command would start, in which order and with which words, never that the tools
// themselves do what their help says.
import { describe, expect, it } from "@effect/vitest"
import { beforeEach, vi } from "vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Result from "effect/Result"
import * as Str from "effect/String"
import {
  accountIn,
  dryRun,
  envFilesFor,
  localEnvFile,
  opEnvFile,
  outranking,
  previewTokenNeeds,
  previewPasswordItem,
  profilesOf,
  referenceGiven,
  referenceState,
  subdomainCall,
  subdomainSaid,
  filesStop,
  onePasswordFailure,
  onePasswordSaid,
  onePasswordUnreachable,
  shellQuoted,
  stateStoreFailed,
  type SetupOptions,
  setup,
  Step,
  stepsFor,
  strayLines,
  withReference
} from "../src/commands/Infra/InfraSetup.rules.ts"
import { type Answer, Workstation } from "../src/commands/Infra/Workstation.service.ts"
import { Repo } from "../src/Repo.service.ts"
import { inTree, json } from "./support/tree.ts"

/** `op.env` as the repository has it before the owner fills anything in. */
const untouched = A.join(
  [
    "# References only: NAME=op://vault/item/field.",
    "# OPENROUTER_API_KEY=op://<vault>/<item>/<field>",
    "#",
    "# PREVIEW_TEST_ACCOUNT_PASSWORD=op://<vault>/<item>/<field>",
    ""
  ],
  "\n"
)

/** What op says when its client cannot reach the 1Password app, as Benjamin's run printed it. */
const opDownSaid =
  "[ERROR] 2026/11/22 10:00:00 error initializing client: connecting to desktop app: read: connection reset"

/** What op says when it reached the app and the reference named no item: 1Password answered, and refused. */
const opRefusedSaid = "[ERROR] 2026/11/22 10:00:00 could not resolve item: no item matched the reference"

/** What op says when the app was reached and its approval prompt was dismissed: 1Password held the call back. */
const opHeldSaid = "[ERROR] 2026/11/22 10:00:00 authorization prompt dismissed, please try again"

/** A value no line of output and no argument may ever hold. */
const secret = "sk-live-do-not-print"

interface World {
  terminal: boolean
  cloudflare: boolean
  accounts: ReadonlyArray<{ readonly id: string; readonly name: string }>
  /** Each Alchemy profile with what it is connected to, as `profile list` prints it. */
  profiles: Record<string, string>
  vaults: ReadonlyArray<{ readonly id: string; readonly name: string }>
  items: Array<{ id: string; title: string; additional_information: string }>
  github: O.Option<string>
  /** The id of the account that holds production's zone, when cf can tell. */
  zone: O.Option<string>
  /** Whether cf's answer gives the zone's account a name: Cloudflare's published schema makes it optional. */
  zoneNamed: boolean
  /** cf's error words when the zone listing fails. */
  zoneFails: O.Option<string>
  /** What a failing `op-human vault list` writes, when it fails with no op line of its own. */
  vaultsFail: O.Option<string>
  /** How many `alchemy profile list` calls answer before the listing fails; each call counts. */
  listFailsAfter: number
  /** The account each profile ends up connected to when Alchemy's own login is used. */
  connects: Record<string, string>
  /** The account the owner's own token belongs to. */
  tokenAccount: string
  /** Production's sign-up list as GitHub's production environment holds it, when it holds one. */
  signUpOnGitHub: O.Option<string>
  /** The second account's token: whether it verifies, and what it allows (none when it may not say). */
  token: { active: boolean; allows: O.Option<ReadonlyArray<string>> }
  /** What `op-human run` exits with when 1Password itself does not answer (locked, declined). */
  opFails: O.Option<number>
  /** Part of the `op-human` calls 1Password's app does not answer: each fails with op's own error line. */
  opDown: O.Option<string>
  /** Part of the `op-human` calls 1Password answers and refuses: the reference names no item. */
  opRefuses: O.Option<string>
  /** Part of the `op-human` calls 1Password holds back: the app is locked or its prompt was dismissed. */
  opHeld: O.Option<string>
  /** What a failing `op-human item create` writes. */
  createFails: O.Option<string>
  /** What `cf accounts tokens verify` answers in place of its usual answer: an API error, or something unreadable. */
  verifyRaw: O.Option<Answer>
  /** Cloudflare's error code for the previews' workers.dev subdomain; none when the account has one. */
  subdomainError: O.Option<number>
  /** His answer to a yes-or-no question. */
  yes: (question: string) => boolean
  /** What a tool handed the terminal exits with. */
  exits: (line: string) => number
  log: Array<string>
}

const world = (over: Partial<World> = {}): World => ({
  terminal: true,
  cloudflare: true,
  accounts: [{ id: "acc-preview", name: "Previews" }],
  profiles: {},
  vaults: [{ id: "vault-1", name: "Deploys" }],
  items: [],
  github: O.some("octo-owner"),
  zone: O.some("acc-production"),
  zoneNamed: true,
  zoneFails: O.none(),
  vaultsFail: O.none(),
  listFailsAfter: Number.POSITIVE_INFINITY,
  connects: { "inventory-preview": "acc-preview", "inventory-production": "acc-production" },
  tokenAccount: "acc-preview",
  signUpOnGitHub: O.some("closed"),
  token: { active: true, allows: O.some(previewTokenNeeds) },
  opFails: O.none(),
  opDown: O.none(),
  opRefuses: O.none(),
  opHeld: O.none(),
  createFails: O.none(),
  verifyRaw: O.none(),
  subdomainError: O.none(),
  yes: () => true,
  exits: () => 0,
  log: [],
  ...over
})

const answer = (stdout: string, code = 0): Answer => ({ stdout, stderr: code === 0 ? "" : "refused", code })

/** The stand-in workstation: tools that read and change `w`, and a log of everything in order. */
const standIn = (w: World): Workstation["Service"] => {
  const line = (command: string, args: ReadonlyArray<string>) => A.join([command, ...args], " ")
  return {
    say: (text) => Effect.sync(() => void w.log.push(`say: ${Str.trim(text)}`)),
    ask: (command, args) =>
      Effect.sync(() => {
        const asked = line(command, args)
        w.log.push(`ask: ${asked}`)
        if (command === "op-human" && O.exists(w.opDown, (part) => Str.includes(part)(asked))) {
          return { stdout: "", stderr: `${opDownSaid}\n`, code: 1 }
        }
        if (command === "op-human" && O.exists(w.opRefuses, (part) => Str.includes(part)(asked))) {
          return { stdout: "", stderr: `${opRefusedSaid}\n`, code: 1 }
        }
        if (command === "op-human" && O.exists(w.opHeld, (part) => Str.includes(part)(asked))) {
          return { stdout: "", stderr: `${opHeldSaid}\n`, code: 1 }
        }
        if (Str.includes("/workers/subdomain")(asked)) {
          return O.match(w.subdomainError, {
            onNone: () => answer(json({ success: true, errors: [], result: { subdomain: "previews-owner" } })),
            onSome: (code) =>
              answer(
                json({ success: false, errors: [{ code, message: `error ${code} from Cloudflare` }], result: null })
              )
          })
        }
        if (asked === "cf auth whoami") {
          return w.cloudflare
            ? answer(json({ authenticated: true, tokenValid: true, email: "owner@example.test", accounts: w.accounts }))
            : answer(json({ authenticated: false, accounts: [] }))
        }
        if (asked === "cf zones list --name beep-effect.com --status active") {
          if (O.isSome(w.zoneFails)) return { stdout: "", stderr: w.zoneFails.value, code: 1 }
          const zones = A.map(A.fromOption(w.zone), (id) => ({
            name: "beep-effect.com",
            account: w.zoneNamed
              ? {
                  id,
                  name: A.findFirst(w.accounts, (one) => one.id === id).pipe(
                    O.match({ onNone: () => "Zone holder", onSome: (one) => one.name })
                  )
                }
              : { id }
          }))
          return answer(json(zones))
        }
        if (Str.endsWith("cf accounts tokens verify")(asked)) {
          if (O.isSome(w.verifyRaw)) return w.verifyRaw.value
          return answer(
            json({ id: "0123456789abcdef0123456789abcdef", status: w.token.active ? "active" : "disabled" })
          )
        }
        if (Str.includes("cf accounts tokens get 0123456789abcdef0123456789abcdef")(asked)) {
          return O.match(w.token.allows, {
            onNone: () => answer("", 1),
            onSome: (names) =>
              answer(json({ policies: [{ effect: "allow", permission_groups: A.map(names, (name) => ({ name })) }] }))
          })
        }
        const shown = Str.match(/^bunx alchemy profile show --profile (\S+)$/)(asked)
        if (O.isSome(shown)) {
          const name = `${shown.value[1]}`
          const providers = R.get(w.profiles, name).pipe(O.getOrElse(() => ""))
          if (!Str.includes("Cloudflare (")(providers)) return answer(`- ${name}`, R.has(w.profiles, name) ? 0 : 1)
          const account = Str.includes("Cloudflare (stored)")(providers)
            ? O.some(w.tokenAccount)
            : R.get(w.connects, name)
          // A profile the tool cannot say an account for: its Cloudflare lines carry none.
          if (O.isNone(account)) return answer(`- ${name}\n  Cloudflare (oauth) — needs a login again`)
          // As the tool prints it: part of a token among the lines, which must reach nothing.
          return answer(
            A.join(
              [
                `- ${name}`,
                "  Cloudflare (oauth) — ok",
                `    accessToken: ${secret}`,
                `    accountId: ${account.value}`
              ],
              "\n"
            )
          )
        }
        if (asked === "gh variable get SIGN_UP --env production --repo kriegcloud/inventory-import") {
          return O.match(w.signUpOnGitHub, { onNone: () => answer("", 1), onSome: (list) => answer(`${list}\n`) })
        }
        // The comparison 1Password fills: 0 the same, 3 they differ, and whatever `opFails` says when 1Password
        // itself does not answer.
        const compared = Str.match(/^op-human run --env-file \S+ -- sh -c .*\|\| exit 3 sh (\S+)$/)(asked)
        if (O.isSome(compared)) {
          return O.match(w.opFails, {
            onSome: (code) => answer("", code),
            onNone: () => answer("", compared.value[1] === w.tokenAccount ? 0 : 3)
          })
        }
        if (asked === "bunx alchemy profile list") {
          w.listFailsAfter -= 1
          if (w.listFailsAfter < 0) return answer("", 1)
          return answer(
            A.join(
              [
                `Profiles (${R.size(w.profiles)})`,
                ...A.map(R.toEntries(w.profiles), ([name, to]) => `- ${name}${to === "" ? "" : `: ${to}`}`)
              ],
              "\n"
            )
          )
        }
        if (Str.startsWith("bunx alchemy profile create ")(asked)) {
          w.profiles = { ...w.profiles, [`${A.last(args).pipe(O.getOrElse(() => ""))}`]: "" }
          return answer("")
        }
        if (asked === "op-human vault list --format json") {
          if (O.isSome(w.vaultsFail)) return { stdout: "", stderr: w.vaultsFail.value, code: 1 }
          return answer(json(w.vaults))
        }
        if (Str.startsWith("op-human item list ")(asked)) return answer(json(w.items))
        if (asked === "gh api user --jq .login") {
          return O.match(w.github, { onNone: () => answer("", 1), onSome: (login) => answer(`${login}\n`) })
        }
        return answer("", 1)
      }),
    quiet: (command, args) =>
      Effect.sync(() => {
        w.log.push(`quiet: ${line(command, args)}`)
        if (O.isSome(w.createFails)) return { stderr: w.createFails.value, code: 1 }
        w.items.push({ id: `item-${w.items.length + 1}`, title: previewPasswordItem, additional_information: secret })
        return { stderr: "", code: 0 }
      }),
    hand: (command, args, given = {}) =>
      Effect.sync(() => {
        const handed = line(command, args)
        if (command === "sh") return w.terminal ? 0 : 1
        const names = A.map(R.toEntries(given), ([name, value]) => `${name}=${value}`)
        w.log.push(`hand: ${handed}${A.isReadonlyArrayNonEmpty(names) ? ` | given ${A.join(names, " ")}` : ""}`)
        const code = w.exits(handed)
        if (code !== 0) return code
        if (handed === "cf auth login") w.cloudflare = true
        if (handed === "gh auth login") w.github = O.some("octo-owner")
        const edited = Str.match(/bunx alchemy profile edit --profile (\S+) (.*)$/)(handed)
        if (O.isSome(edited)) {
          const name = `${edited.value[1]}`
          const added = A.map(
            A.filter(
              Str.split(" ")(`${edited.value[2]}`),
              (word) => word === "Cloudflare" || word === "GitHub" || word === "1Password"
            ),
            (provider) =>
              `${provider} (${provider === "GitHub" ? "gh-cli" : provider === "1Password" ? "desktop" : Str.includes("--method stored")(handed) ? "stored" : "oauth"})`
          )
          const before = R.get(w.profiles, name).pipe(O.getOrElse(() => ""))
          w.profiles = { ...w.profiles, [name]: A.join([...(before === "" ? [] : [before]), ...added], ", ") }
        }
        return 0
      }),
    confirm: (question) =>
      Effect.sync(() => {
        const yes = w.yes(question)
        w.log.push(`confirm: ${question} -> ${yes ? "yes" : "no"}`)
        return yes
      }),
    choose: (question, choices) =>
      Effect.sync(() => {
        w.log.push(`choose: ${question}`)
        // He picks the last one listed for production and the first for anything else.
        return Str.includes("production")(question) ? A.lastNonEmpty(choices).value : choices[0].value
      })
  }
}

const options = (over: Partial<SetupOptions> = {}): SetupOptions => ({
  sizes: ["test-stage"],
  dryRun: false,
  user: "ben",
  vault: O.none(),
  previewAccount: O.none(),
  productionAccount: O.none(),
  previewProfile: "inventory-preview",
  productionProfile: "inventory-production",
  approver: O.none(),
  signUp: O.none(),
  ...over
})

// His own references, with a space in the item's name as his are; the names here are made up.
const own = O.some(
  A.join(
    [
      'PREVIEW_CLOUDFLARE_API_TOKEN="op://Vault/Second Account/ACCOUNT_API_TOKEN"',
      'PREVIEW_CLOUDFLARE_ACCOUNT_ID="op://Vault/Second Account/ACCOUNT_ID"',
      ""
    ],
    "\n"
  )
)

/** One run in a repository holding this `op.env`: why it stopped (if it did), and the file afterwards. */
// A run that sets up the repository's stack has his own file unless the test says otherwise: the stack needs it.
const run = (
  w: World,
  given: SetupOptions,
  env = untouched,
  mine: O.Option<string> = A.contains(given.sizes, "staging") ? own : O.none(),
  // Other files of the repository, such as a root `.env`.
  beside: Record<string, string> = {}
) =>
  inTree(
    {
      [opEnvFile]: env,
      ...O.match(mine, { onNone: () => ({}), onSome: (text) => ({ [localEnvFile]: text }) }),
      ...beside
    },
    Effect.gen(function* () {
      const repo = yield* Repo
      const stopped = yield* setup(given).pipe(
        Effect.provideService(Workstation, standIn(w)),
        Effect.match({ onFailure: (error) => O.some(error.message), onSuccess: () => O.none<string>() })
      )
      return { stopped, env: yield* repo.text(repo.join(repo.root, opEnvFile)) }
    })
  )

/** A look that changes nothing and is the same in every run: which account a profile deploys into, GitHub's list. */
const isCheck = (entry: string) =>
  /^ask: (bunx alchemy profile show |gh variable get |op-human run .* sh -c v=)/.test(entry)

/** The tools a run started, without what was said or asked of him and without those looks (`checks`). */
const started = (w: World) => A.filter(w.log, (entry) => /^(ask|quiet|hand): /.test(entry) && !isCheck(entry))
const checks = (w: World) => A.filter(w.log, isCheck)
const at = (w: World, part: string) => A.findFirstIndex(w.log, Str.includes(part)).pipe(O.getOrElse(() => -1))

const twoAccounts = [
  { id: "acc-preview", name: "Previews" },
  { id: "acc-production", name: "Production" }
]
const productionOnly = [{ id: "acc-production", name: "Production" }]
const connected = {
  "inventory-preview": "Cloudflare (oauth)",
  "inventory-production": "Cloudflare (oauth), GitHub (gh-cli), 1Password (desktop)"
}

// Every run starts with none of the variables the command stops on, whatever the shell or the workflow running these
// tests exports; a test that wants one sets it as a shell would (`vi.stubEnv`), and vitest takes it back afterwards.
beforeEach(() => {
  vi.unstubAllEnvs()
  A.forEach(outranking(["test-stage", "staging", "production"]), (name) => vi.stubEnv(name, undefined))
})

describe("infra setup: the steps", () => {
  it("a test stage needs one account and no 1Password; each size adds its own steps, smallest first", () => {
    const tags = (sizes: SetupOptions["sizes"]) =>
      A.map(
        stepsFor(sizes),
        Step.match({
          PreviewPassword: () => "PreviewPassword",
          Cloudflare: () => "Cloudflare",
          Profile: (step) => `Profile:${step.role}`,
          StateStore: (step) => `StateStore:${step.role}`,
          GitHubLogin: () => "GitHubLogin",
          Deploy: (step) => `Deploy:${step.target}`
        })
      )
    expect(tags(["test-stage"])).toEqual(["Cloudflare", "Profile:preview", "StateStore:preview", "Deploy:test-stage"])
    expect(tags(["test-stage", "staging", "production"])).toEqual([
      "PreviewPassword",
      "Cloudflare",
      "Profile:preview",
      "StateStore:preview",
      "Deploy:test-stage",
      "Profile:production",
      "StateStore:production",
      "GitHubLogin",
      "Deploy:repository",
      "Deploy:production"
    ])
    expect(tags(["production"])).toEqual([
      "Cloudflare",
      "Profile:production",
      "StateStore:production",
      "Deploy:production"
    ])
  })

  it.effect("a dry run says every command and starts no tool, with no terminal either", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      const result = yield* run(w, options({ sizes: ["test-stage", "staging", "production"], dryRun: true }))
      expect(result.stopped).toEqual(O.none())
      expect(started(w)).toEqual([])
      expect(result.env).toBe(untouched)
      const said = A.join(w.log, "\n")
      expect(said).toContain("bunx alchemy plan --stage test_ben --profile inventory-preview")
      expect(said).toContain(
        "bunx alchemy deploy packages/infra/src/GitHub.stack.ts --stage prod --profile inventory-production --yes"
      )
      expect(A.length(dryRun({ options: options({ sizes: ["test-stage"] }), previewByToken: false }))).toBeGreaterThan(
        4
      )
    })
  )

  it.effect("with no terminal, or under CI, a real run stops before its first tool", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      const result = yield* run(w, options())
      expect(O.getOrElse(result.stopped, () => "")).toContain("run by the repository's owner at a terminal")
      expect(started(w)).toEqual([])
    })
  )

  it.effect("no size, or a user that is no stage name, stops before anything", () =>
    Effect.gen(function* () {
      const none = world()
      expect(O.isSome((yield* run(none, options({ sizes: [] }))).stopped)).toBe(true)
      const named = world()
      const result = yield* run(named, options({ user: "Ben Smith" }))
      expect(O.getOrElse(result.stopped, () => "")).toContain("--user")
      expect([...started(none), ...started(named)]).toEqual([])
    })
  )
})

describe("infra setup: a test stage", () => {
  it.effect("first run: profile made and connected, store asked about, plan shown, then asked, then deployed", () =>
    Effect.gen(function* () {
      const w = world()
      const result = yield* run(w, options())
      expect(result.stopped).toEqual(O.none())
      expect(started(w)).toEqual([
        "ask: cf auth whoami",
        "ask: cf zones list --name beep-effect.com --status active",
        "ask: bunx alchemy profile list",
        "ask: bunx alchemy profile create inventory-preview",
        "hand: bunx alchemy profile edit --profile inventory-preview --add Cloudflare",
        "ask: bunx alchemy profile list",
        "hand: bunx alchemy state bootstrap --profile inventory-preview",
        "hand: bunx alchemy plan --stage test_ben --profile inventory-preview | given HIDE_TEST_ACCOUNT_PASSWORD=true",
        "hand: bunx alchemy deploy --stage test_ben --profile inventory-preview --yes | given HIDE_TEST_ACCOUNT_PASSWORD=true"
      ])
      // The one account is used only after he says so, and each thing outside this machine after its own question.
      expect(at(w, 'confirm: Use the Cloudflare account "Previews" for preview? -> yes')).toBeGreaterThan(-1)
      expect(at(w, "confirm: Make sure the state store exists")).toBeLessThan(
        at(w, "hand: bunx alchemy state bootstrap")
      )
      expect(at(w, "hand: bunx alchemy plan")).toBeLessThan(at(w, "confirm: Deploy your test stage test_ben"))
      expect(at(w, "confirm: Deploy your test stage test_ben")).toBeLessThan(at(w, "hand: bunx alchemy deploy"))
      // A test stage asks nothing of 1Password or GitHub and leaves the references alone.
      expect(A.some(w.log, Str.includes("op-human"))).toBe(false)
      expect(A.some(w.log, Str.includes("gh "))).toBe(false)
      expect(result.env).toBe(untouched)
    })
  )

  it.effect("run again: a profile that is there and connected is left alone", () =>
    Effect.gen(function* () {
      const w = world({ profiles: { "inventory-preview": "Cloudflare (oauth)" } })
      yield* run(w, options())
      expect(A.some(started(w), Str.includes("profile create"))).toBe(false)
      expect(A.some(started(w), Str.includes("profile edit"))).toBe(false)
    })
  )

  it.effect("a no to the plan deploys nothing", () =>
    Effect.gen(function* () {
      const w = world({ yes: (question) => !Str.startsWith("Deploy ")(question) })
      const result = yield* run(w, options())
      expect(O.getOrElse(result.stopped, () => "")).toContain("was not deployed")
      expect(A.some(started(w), Str.includes("alchemy plan"))).toBe(true)
      expect(A.some(started(w), Str.includes("alchemy deploy"))).toBe(false)
    })
  )

  it.effect("a plan that fails is never asked about and never deployed", () =>
    Effect.gen(function* () {
      const w = world({ exits: (handed) => (Str.includes("alchemy plan")(handed) ? 1 : 0) })
      const result = yield* run(w, options())
      expect(O.getOrElse(result.stopped, () => "")).toContain("Nothing was deployed")
      expect(A.some(w.log, Str.startsWith("confirm: Deploy "))).toBe(false)
      expect(A.some(started(w), Str.includes("alchemy deploy"))).toBe(false)
    })
  )

  it.effect("a no to the account, or to the state store, starts nothing in the cloud", () =>
    Effect.gen(function* () {
      const account = world({ yes: (question) => !Str.startsWith("Use the Cloudflare account")(question) })
      yield* run(account, options())
      expect(started(account)).toEqual([
        "ask: cf auth whoami",
        "ask: cf zones list --name beep-effect.com --status active"
      ])
      const store = world({ yes: (question) => !Str.startsWith("Make sure the state store")(question) })
      yield* run(store, options())
      expect(A.some(started(store), Str.includes("state bootstrap"))).toBe(false)
      expect(A.some(started(store), Str.includes("alchemy plan"))).toBe(false)
    })
  )

  it.effect("cf not logged in: the login is started, then the accounts are read again", () =>
    Effect.gen(function* () {
      const w = world({ cloudflare: false })
      const result = yield* run(w, options())
      expect(result.stopped).toEqual(O.none())
      expect(A.take(started(w), 3)).toEqual(["ask: cf auth whoami", "hand: cf auth login", "ask: cf auth whoami"])
      const failed = world({ cloudflare: false, exits: (handed) => (handed === "cf auth login" ? 1 : 0) })
      yield* run(failed, options())
      expect(started(failed)).toEqual(["ask: cf auth whoami", "hand: cf auth login"])
    })
  )
})

describe("infra setup: the previews' password", () => {
  it.effect("no item: 1Password makes one unseen, and only its reference is written", () =>
    Effect.gen(function* () {
      const w = world({ accounts: twoAccounts, profiles: connected })
      const result = yield* run(w, options({ sizes: ["staging"] }))
      expect(result.stopped).toEqual(O.none())
      expect(A.filter(w.log, Str.startsWith("quiet: "))).toEqual([
        `quiet: op-human item create --category password --title ${previewPasswordItem} --vault vault-1 --generate-password`
      ])
      expect(result.env).toBe(
        Str.replace(
          "# PREVIEW_TEST_ACCOUNT_PASSWORD=op://<vault>/<item>/<field>",
          "PREVIEW_TEST_ACCOUNT_PASSWORD=op://vault-1/item-1/password"
        )(untouched)
      )
      // What the item list said beside ids and titles is dropped: it reaches no line and no argument.
      expect(A.some(w.log, Str.includes(secret))).toBe(false)
      expect(result.env).not.toContain(secret)
    })
  )

  it.effect("an item that is there is used, not made again; a reference that is there asks 1Password nothing", () =>
    Effect.gen(function* () {
      const there = world({
        accounts: twoAccounts,
        profiles: connected,
        items: [{ id: "item-7", title: previewPasswordItem, additional_information: secret }]
      })
      const first = yield* run(there, options({ sizes: ["staging"] }))
      expect(A.some(there.log, Str.startsWith("quiet: "))).toBe(false)
      expect(first.env).toContain("PREVIEW_TEST_ACCOUNT_PASSWORD=op://vault-1/item-7/password")
      const again = world({ accounts: twoAccounts, profiles: connected })
      const second = yield* run(again, options({ sizes: ["staging"] }), first.env)
      expect(A.some(started(again), (entry) => /op-human (vault|item)/.test(entry))).toBe(false)
      expect(second.env).toBe(first.env)
    })
  )

  it.effect("two items with the title stop it, and the file is as it was", () =>
    Effect.gen(function* () {
      const w = world({
        items: [
          { id: "item-1", title: previewPasswordItem, additional_information: "" },
          { id: "item-2", title: previewPasswordItem, additional_information: "" }
        ]
      })
      const result = yield* run(w, options({ sizes: ["staging"] }))
      expect(O.getOrElse(result.stopped, () => "")).toContain("2 items titled")
      expect(result.env).toBe(untouched)
      expect(A.some(w.log, Str.startsWith("quiet: "))).toBe(false)
    })
  )

  it.effect("any line of the tracked file that is no comment and no reference stops it at once, unprinted", () =>
    Effect.gen(function* () {
      // Each a way a value gets typed there: the plain form, with `export`, with spaces, under another name.
      const forms = [
        `PREVIEW_TEST_ACCOUNT_PASSWORD=${secret}`,
        `export OPENROUTER_API_KEY=${secret}`,
        `OPENROUTER_API_KEY = ${secret}`,
        `SOMETHING_ELSE=${secret}`,
        "OPENROUTER_API_KEY=op://<vault>/<item>/<field>"
      ]
      const runs = yield* Effect.forEach(
        forms,
        (line) => {
          const w = world({ accounts: productionOnly, profiles: connected })
          return Effect.map(run(w, options({ sizes: ["staging"] }), `# a comment\n\n${line}\n`), (result) => ({
            w,
            result
          }))
        },
        { concurrency: 1 }
      )
      A.forEach(runs, ({ w, result }) => {
        const said = O.getOrElse(result.stopped, () => "")
        expect(said).toContain("Line 3 is neither")
        expect(said).not.toContain(secret)
        // Before the first tool, and so before the reference is written and "commit that file" is said.
        expect(w.log).toEqual([])
      })
      // A test stage reads nothing from that file, and is still stopped: the file is the same tracked file.
      const test = world()
      const stopped = yield* run(test, options(), `export A=${secret}\n`)
      expect(O.getOrElse(stopped.stopped, () => "")).toContain("Line 1 is neither")
      expect(test.log).toEqual([])
    })
  )
})

describe("infra setup: the repository's stack and production", () => {
  it.effect("one Cloudflare account for both roles stops it: decision I4 is not decided here", () =>
    Effect.gen(function* () {
      // A test stage and production in one run, with no token of his own for a second account: both roles are cf's.
      const one = world({ profiles: connected })
      const result = yield* run(one, options({ sizes: ["test-stage", "production"], signUp: O.some("closed") }))
      expect(O.getOrElse(result.stopped, () => "")).toContain("cf sees one account. Production and the previews")
      expect(O.getOrElse(result.stopped, () => "")).toContain("Name the second account's token and id in")
      expect(A.some(started(one), Str.includes("alchemy"))).toBe(false)
      // It stops on what cf said, before asking him which account is which.
      expect(A.some(one.log, Str.startsWith("confirm: Use the Cloudflare account"))).toBe(false)
      const same = world({ accounts: twoAccounts, profiles: connected })
      const named = yield* run(
        same,
        options({
          sizes: ["test-stage", "production"],
          signUp: O.some("closed"),
          previewAccount: O.some("Previews"),
          productionAccount: O.some("acc-preview")
        })
      )
      expect(O.getOrElse(named.stopped, () => "")).toContain("Both roles were given")
      expect(A.some(started(same), Str.includes("alchemy"))).toBe(false)
    })
  )

  it.effect("the account that holds the zone is production's: both roles are shown and asked before anything", () =>
    Effect.gen(function* () {
      // The zone is in the account listed first, so a pick by position would get the roles the wrong way round.
      const accounts = [
        { id: "acc-production", name: "Production" },
        { id: "acc-preview", name: "Previews" }
      ]
      const w = world({ accounts, profiles: connected, zone: O.some("acc-production") })
      const result = yield* run(w, options({ sizes: ["test-stage", "production"], signUp: O.some("closed") }))
      expect(result.stopped).toEqual(O.none())
      const asked =
        'confirm: Use "Production" for production and "Previews" for previews, test stages and staging? -> yes'
      expect(at(w, asked)).toBeGreaterThan(-1)
      expect(at(w, asked)).toBeLessThan(at(w, "ask: bunx alchemy profile list"))
      expect(A.some(w.log, Str.startsWith("choose: Which Cloudflare account"))).toBe(false)
      expect(
        at(w, 'say: Cloudflare: production is "Production"; previews, test stages and staging are "Previews".')
      ).toBeLessThan(at(w, asked))
      const refused = world({
        accounts,
        profiles: connected,
        zone: O.some("acc-production"),
        yes: (question) => !Str.startsWith('Use "Production" for production')(question)
      })
      const stopped = yield* run(refused, options({ sizes: ["test-stage", "production"], signUp: O.some("closed") }))
      expect(O.getOrElse(stopped.stopped, () => "")).toContain("were not confirmed")
      expect(A.some(started(refused), Str.includes("alchemy"))).toBe(false)
    })
  )

  it.effect("when cf cannot name who holds the zone, production's setup stops before any account is picked", () =>
    Effect.gen(function* () {
      const said = "cf cannot name the account that holds the zone beep-effect.com"
      const w = world({ accounts: twoAccounts, profiles: connected, zone: O.none() })
      const result = yield* run(w, options({ sizes: ["test-stage", "production"], signUp: O.some("closed") }))
      expect(O.getOrElse(result.stopped, () => "")).toContain(said)
      expect(A.some(w.log, Str.startsWith("choose: "))).toBe(false)
      expect(A.some(started(w), Str.includes("alchemy"))).toBe(false)
      // The review's case: his file names the zone's account for previews by mistake, and cf is logged in to the
      // other one only. Production would be the account cf sees, and every pull request would deploy into the zone's.
      const wrong = world({ accounts: [{ id: "acc-b", name: "B" }], zone: O.none(), tokenAccount: "acc-production" })
      const stack = yield* run(wrong, options({ sizes: ["staging"], signUp: O.some("me@example.test") }))
      expect(O.getOrElse(stack.stopped, () => "")).toContain(said)
      expect(A.some(wrong.log, Str.startsWith("confirm: Use the Cloudflare account"))).toBe(false)
      expect(A.some(started(wrong), Str.includes("alchemy"))).toBe(false)
      // A test stage alone needs no production account: with nothing to tell them apart, he is asked.
      const stage = world({ accounts: twoAccounts, zone: O.none() })
      const went = yield* run(stage, options())
      expect(went.stopped).toEqual(O.none())
      expect(A.filter(stage.log, Str.startsWith("choose: Which Cloudflare account"))).toEqual([
        "choose: Which Cloudflare account is for preview?"
      ])
    })
  )

  it.effect("a zone whose account cf gives no name is still production's, called by its id", () =>
    Effect.gen(function* () {
      const w = world({ accounts: productionOnly, profiles: connected, zoneNamed: false })
      const result = yield* run(w, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(result.stopped).toEqual(O.none())
      expect(at(w, 'say: Cloudflare: "acc-production" holds the zone beep-effect.com')).toBeGreaterThan(-1)
    })
  )

  it.effect("a test stage in the account that holds the zone says it is production's before he says yes", () =>
    Effect.gen(function* () {
      const w = world({ zone: O.some("acc-preview") })
      yield* run(w, options())
      expect(
        at(
          w,
          'confirm: Use the Cloudflare account "Previews" for preview? It holds the zone beep-effect.com, so it is production\'s account'
        )
      ).toBeGreaterThan(-1)
    })
  )

  it.effect(
    "the stack is planned and deployed with his own token for the previews: checked first, and never given by this command",
    () =>
      Effect.gen(function* () {
        const w = world({ accounts: productionOnly, profiles: connected })
        const result = yield* run(w, options({ sizes: ["staging"] }))
        expect(result.stopped).toEqual(O.none())
        const under = "bunx alchemy"
        // The previews' account id and token are not among what the command gives: the stack asks 1Password.
        const given =
          "given PRODUCTION_CLOUDFLARE_ACCOUNT_ID=acc-production PRODUCTION_APPROVER=octo-owner SIGN_UP=closed DEPLOY_WITHOUT_MODEL_KEY=true"
        // The token is verified and its permissions read before the first thing is made, the 1Password item included.
        expect(A.take(started(w), 2)).toEqual([
          'ask: op-human run --env-file packages/infra/env/op.env.local -- sh -c CLOUDFLARE_API_TOKEN="$PREVIEW_CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$PREVIEW_CLOUDFLARE_ACCOUNT_ID" cf accounts tokens verify',
          'ask: op-human run --env-file packages/infra/env/op.env.local -- sh -c CLOUDFLARE_API_TOKEN="$PREVIEW_CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$PREVIEW_CLOUDFLARE_ACCOUNT_ID" cf accounts tokens get 0123456789abcdef0123456789abcdef'
        ])
        expect(at(w, "cf accounts tokens get")).toBeLessThan(at(w, "ask: op-human vault list"))
        expect(A.takeRight(started(w), 2)).toEqual([
          `hand: ${under} plan packages/infra/src/GitHub.stack.ts --stage prod --profile inventory-production | ${given}`,
          `hand: ${under} deploy packages/infra/src/GitHub.stack.ts --stage prod --profile inventory-production --yes | ${given}`
        ])
        expect(at(w, "say: Model key: packages/infra/env/op.env names none")).toBeGreaterThan(-1)
        expect(
          at(w, "say: Sign-up in production: closed, as GitHub's production environment already holds it")
        ).toBeLessThan(at(w, "ask: op-human run"))
        expect(at(w, `hand: ${under} plan`)).toBeLessThan(at(w, "confirm: Deploy the repository's stack"))
      })
  )

  it.effect("a model key reference is left to 1Password: the flag is not given, the reference is not read", () =>
    Effect.gen(function* () {
      const w = world({ accounts: productionOnly, profiles: connected })
      const env = A.join(
        [
          "OPENROUTER_API_KEY=op://vault-1/model/credential",
          "PREVIEW_TEST_ACCOUNT_PASSWORD=op://vault-1/item-1/password",
          ""
        ],
        "\n"
      )
      const result = yield* run(
        w,
        options({
          sizes: ["staging"],
          approver: O.some("someone-else"),
          signUp: O.some("owner@example.test")
        }),
        env
      )
      expect(result.stopped).toEqual(O.none())
      const deploy = A.last(started(w)).pipe(O.getOrElse(() => ""))
      expect(deploy).not.toContain("DEPLOY_WITHOUT_MODEL_KEY")
      expect(deploy).toContain("PRODUCTION_APPROVER=someone-else SIGN_UP=owner@example.test")
      expect(A.some(started(w), (entry) => /op-human (read|item get|inject)/.test(entry))).toBe(false)
      expect(A.some(started(w), (entry) => /op-human run.*alchemy (plan|deploy)/.test(entry))).toBe(false)
      expect(result.env).toBe(env)
    })
  )

  it.effect("a reference in his own file is the one the stacks take, so the command reads and says it there", () =>
    Effect.gen(function* () {
      // op.env still holds the template; his own file names the model key and the previews' password.
      const mine = O.map(
        own,
        (text) =>
          `${text}OPENROUTER_API_KEY="op://Vault/Model Key/credential"\nPREVIEW_TEST_ACCOUNT_PASSWORD="op://Vault/Previews/password"\n`
      )
      const w = world({ accounts: productionOnly, profiles: connected })
      const result = yield* run(
        w,
        options({ sizes: ["staging", "production"], signUp: O.some("closed") }),
        untouched,
        mine
      )
      expect(result.stopped).toEqual(O.none())
      // No item is looked for or made, and op.env gets no second reference beside his.
      expect(A.some(started(w), (entry) => /op-human (vault|item)/.test(entry))).toBe(false)
      expect(result.env).toBe(untouched)
      expect(
        at(
          w,
          "say: 1Password: packages/infra/env/op.env.local already names a reference for PREVIEW_TEST_ACCOUNT_PASSWORD"
        )
      ).toBeGreaterThan(-1)
      expect(
        at(w, "say: Model key: packages/infra/env/op.env.local names a reference for OPENROUTER_API_KEY")
      ).toBeGreaterThan(-1)
      expect(A.some(w.log, Str.includes("DEPLOY_WITHOUT_MODEL_KEY"))).toBe(false)
      // His own line wins over op.env's: one that is no reference there leaves the stacks none, and the command says so.
      const shadowed = world({ accounts: productionOnly, profiles: connected })
      const env =
        "OPENROUTER_API_KEY=op://vault-1/model/credential\nPREVIEW_TEST_ACCOUNT_PASSWORD=op://vault-1/item-1/password\n"
      yield* run(
        shadowed,
        options({ sizes: ["production"], signUp: O.some("closed") }),
        env,
        O.some("OPENROUTER_API_KEY=\n")
      )
      expect(at(shadowed, "say: Model key: packages/infra/env/op.env.local names none")).toBeGreaterThan(-1)
      expect(A.last(started(shadowed)).pipe(O.getOrElse(() => ""))).toContain("DEPLOY_WITHOUT_MODEL_KEY=true")
      // The review's case: the template left uncommented above his real line. The stack takes his line, and so does
      // the command: production is deployed with its key, not told it has none.
      const below = world({ accounts: productionOnly, profiles: connected })
      yield* run(
        below,
        options({ sizes: ["production"], signUp: O.some("closed") }),
        untouched,
        O.some('OPENROUTER_API_KEY=op://<vault>/<item>/<field>\nOPENROUTER_API_KEY="op://Vault/Model Key/credential"\n')
      )
      expect(at(below, "say: Model key: packages/infra/env/op.env.local names a reference")).toBeGreaterThan(-1)
      expect(A.some(below.log, Str.includes("DEPLOY_WITHOUT_MODEL_KEY"))).toBe(false)
    })
  )

  it.effect("production's sign-up list is the flag's or the one GitHub holds, settled before the first step", () =>
    Effect.gen(function* () {
      // No flag and nothing on GitHub: it stops before anything, and never picks a list itself.
      const without = world({ accounts: productionOnly, profiles: connected, signUpOnGitHub: O.none() })
      const stopped = yield* run(without, options({ sizes: ["test-stage", "production"] }))
      expect(O.getOrElse(stopped.stopped, () => "")).toContain("--sign-up")
      expect(started(without)).toEqual([])
      const w = world({ accounts: productionOnly, profiles: connected })
      const result = yield* run(w, options({ sizes: ["production"], signUp: O.some("owner@example.test") }))
      expect(result.stopped).toEqual(O.none())
      const under = "bunx alchemy"
      const given = "given SIGN_UP=owner@example.test DEPLOY_WITHOUT_MODEL_KEY=true"
      expect(A.takeRight(started(w), 2)).toEqual([
        `hand: ${under} plan --stage prod --profile inventory-production | ${given}`,
        `hand: ${under} deploy --stage prod --profile inventory-production --yes | ${given}`
      ])
      expect(at(w, "an email on the sign-up list can open an account")).toBeGreaterThan(-1)
    })
  )

  it.effect("a run again without the flag keeps the list GitHub holds: it does not close production", () =>
    Effect.gen(function* () {
      const w = world({ accounts: productionOnly, profiles: connected, signUpOnGitHub: O.some("me@example.test") })
      const result = yield* run(w, options({ sizes: ["staging"] }))
      expect(result.stopped).toEqual(O.none())
      expect(A.last(started(w)).pipe(O.getOrElse(() => ""))).toContain("SIGN_UP=me@example.test")
      expect(
        at(w, "say: Sign-up in production: me@example.test, as GitHub's production environment already holds it")
      ).toBeLessThan(at(w, "ask: op-human run"))
      // A list that is closed is said to be closed when production is deployed, not "sign up with your email".
      const closed = world({ accounts: productionOnly, profiles: connected })
      yield* run(closed, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(at(closed, "say: Deployed production. Sign-up is closed there")).toBeGreaterThan(-1)
    })
  )

  it.effect(
    "a profile that deploys into another account than the one named stops it before anything is made there",
    () =>
      Effect.gen(function* () {
        // Left alone: connected in an earlier run, to production's account.
        const earlier = world({
          accounts: twoAccounts,
          profiles: { "inventory-preview": "Cloudflare (oauth)" },
          connects: { "inventory-preview": "acc-production" }
        })
        const first = yield* run(earlier, options({ previewAccount: O.some("Previews") }))
        expect(O.getOrElse(first.stopped, () => "")).toContain(
          'Profile "inventory-preview" deploys into the account acc-production, not "Previews" (acc-preview), the one named for preview'
        )
        // Just connected: he picked the other account in Alchemy's own question.
        const picked = world({ accounts: twoAccounts, connects: { "inventory-preview": "acc-production" } })
        const second = yield* run(picked, options({ previewAccount: O.some("Previews") }))
        expect(O.getOrElse(second.stopped, () => "")).toContain("deploys into the account acc-production, not")
        // By his token: a profile that is there, connected by a login to another account than the token's.
        const byToken = world({
          profiles: { "inventory-preview": "Cloudflare (oauth)" },
          connects: { "inventory-preview": "acc-production" }
        })
        const third = yield* run(byToken, options(), untouched, own)
        expect(O.getOrElse(third.stopped, () => "")).toContain(
          "deploys into the account acc-production, which is not the one packages/infra/env/op.env.local names"
        )
        // A profile whose account cannot be read is not used either.
        const unread = world({ profiles: { "inventory-preview": "Cloudflare (oauth)" }, connects: {} })
        const fourth = yield* run(unread, options())
        expect(O.getOrElse(fourth.stopped, () => "")).toContain(
          'Could not read which Cloudflare account profile "inventory-preview" deploys into'
        )
        A.forEach([earlier, picked, byToken, unread], (w) => {
          expect(A.some(started(w), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
          expect(A.some(w.log, Str.startsWith("confirm: Make sure the state store"))).toBe(false)
          // What the tool prints beside the account's line reaches no line and no argument.
          expect(A.some(w.log, Str.includes(secret))).toBe(false)
        })
        expect(checks(picked)).toContain("ask: bunx alchemy profile show --profile inventory-preview")
      })
  )

  it.effect("production alone stops when the previews' profile already deploys into the same account", () =>
    Effect.gen(function* () {
      const w = world({
        accounts: productionOnly,
        profiles: connected,
        connects: { "inventory-preview": "acc-production", "inventory-production": "acc-production" }
      })
      const result = yield* run(w, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(O.getOrElse(result.stopped, () => "")).toContain(
        'Profiles "inventory-preview" and "inventory-production" both deploy into the account acc-production'
      )
      expect(A.some(started(w), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
    })
  )

  it.effect(
    "an account named for production that does not hold the zone stops it; two named accounts are still asked",
    () =>
      Effect.gen(function* () {
        const accounts = [
          { id: "acc-production", name: "Production" },
          { id: "acc-preview", name: "Previews" }
        ]
        const swapped = world({ accounts, profiles: connected, zone: O.some("acc-production") })
        const stopped = yield* run(
          swapped,
          options({
            sizes: ["test-stage", "production"],
            signUp: O.some("closed"),
            productionAccount: O.some("Previews"),
            previewAccount: O.some("Production")
          })
        )
        // The previews' account named is the zone's: he is asked first, and after his yes the swap still stops.
        expect(O.getOrElse(stopped.stopped, () => "")).toContain(
          '"Previews" was named for production, but "Production" holds the zone'
        )
        expect(A.some(started(swapped), Str.includes("alchemy"))).toBe(false)
        const right = world({ accounts, profiles: connected, zone: O.some("acc-production") })
        const result = yield* run(
          right,
          options({
            sizes: ["test-stage", "production"],
            signUp: O.some("closed"),
            productionAccount: O.some("Production"),
            previewAccount: O.some("Previews")
          })
        )
        expect(result.stopped).toEqual(O.none())
        expect(
          at(
            right,
            'confirm: Use "Production" for production and "Previews" for previews, test stages and staging? -> yes'
          )
        ).toBeLessThan(at(right, "ask: bunx alchemy profile list"))
      })
  )

  it.effect("a test stage named into the zone's account is asked about in a question that says so", () =>
    Effect.gen(function* () {
      const accounts = [
        { id: "acc-production", name: "Production" },
        { id: "acc-preview", name: "Previews" }
      ]
      const question =
        'confirm: Use the Cloudflare account "Production" for preview? It holds the zone beep-effect.com, so it is production\'s account: a test stage here shares it.'
      const named = world({
        accounts,
        zone: O.some("acc-production"),
        yes: (asked) => !Str.includes("so it is production's account")(asked)
      })
      const stopped = yield* run(named, options({ previewAccount: O.some("Production") }))
      expect(at(named, `${question} -> no`)).toBeGreaterThan(-1)
      expect(O.isSome(stopped.stopped)).toBe(true)
      expect(A.some(started(named), Str.includes("alchemy"))).toBe(false)
      // Picked from the list instead: the same question follows the pick.
      const picked = world({
        accounts,
        zone: O.some("acc-production"),
        connects: { "inventory-preview": "acc-production" }
      })
      yield* run(picked, options())
      expect(at(picked, "choose: Which Cloudflare account is for preview?")).toBeLessThan(
        at(picked, `${question} -> yes`)
      )
    })
  )

  it.effect(
    "a stop after earlier steps says they are done; a name that is no stage matters only with a test stage",
    () =>
      Effect.gen(function* () {
        const w = world({ yes: (question) => !Str.startsWith("Make sure the state store")(question) })
        const result = yield* run(w, options())
        expect(O.getOrElse(result.stopped, () => "")).toContain(
          "Steps 1 to 2 of this run are done and stay as they are; a run again goes on from them."
        )
        const named = world({ accounts: productionOnly, profiles: connected })
        const production = yield* run(
          named,
          options({ sizes: ["production"], user: "Ben Smith", signUp: O.some("closed") })
        )
        expect(production.stopped).toEqual(O.none())
      })
  )

  it.effect("a test stage's password is left out of the command's deploy, and he is told how to read it", () =>
    Effect.gen(function* () {
      const w = world()
      yield* run(w, options())
      expect(
        A.every(
          A.filter(started(w), (entry) => /alchemy (plan|deploy)/.test(entry)),
          Str.includes("HIDE_TEST_ACCOUNT_PASSWORD=true")
        )
      ).toBe(true)
      expect(
        at(
          w,
          "Its password was left out of this run on purpose. To read it, run `bunx alchemy deploy --stage test_ben --profile inventory-preview` yourself"
        )
      ).toBeGreaterThan(-1)
    })
  )

  it.effect(
    "the repository's stack: the previews' profile reaches 1Password too, for a stage run from it by hand",
    () =>
      Effect.gen(function* () {
        const w = world({ accounts: productionOnly, profiles: {} })
        yield* run(w, options({ sizes: ["staging"] }))
        expect(started(w)).toContain("hand: bunx alchemy profile edit --profile inventory-preview --add 1Password")
      })
  )

  it.effect("no run ever starts a destroy, and `--yes` goes only on a deploy that followed a yes", () =>
    Effect.gen(function* () {
      const w = world({ accounts: productionOnly, profiles: {} })
      yield* run(w, options({ sizes: ["test-stage", "staging", "production"], signUp: O.some("closed") }))
      const calls = started(w)
      expect(A.filter(calls, Str.includes("alchemy deploy")).length).toBe(3)
      expect(A.some(calls, (entry) => /destroy|nuke|teardown|state delete/.test(entry))).toBe(false)
      expect(A.every(A.filter(calls, Str.includes("--yes")), Str.includes("alchemy deploy"))).toBe(true)
      expect(A.some(calls, (entry) => /--reveal|op-human read|op-human run.*alchemy (plan|deploy)/.test(entry))).toBe(
        false
      )
      // Production's profile is connected to 1Password too: its stacks ask it for their secrets themselves.
      expect(calls).toContain(
        "hand: bunx alchemy profile edit --profile inventory-production --add Cloudflare --add GitHub --add 1Password"
      )
    })
  )
})

describe("infra setup: what is set outside it", () => {
  const tools = (w: World) => A.filter(w.log, (entry) => /^(ask|quiet|hand): /.test(entry))

  it.effect("a Cloudflare variable in his shell stops it before any tool, named and never shown", () =>
    Effect.gen(function* () {
      vi.stubEnv("CLOUDFLARE_API_TOKEN", secret)
      vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "")
      const w = world()
      const result = yield* run(w, options())
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain(
        "Set outside this command: CLOUDFLARE_ACCOUNT_ID (your shell), CLOUDFLARE_API_TOKEN (your shell)."
      )
      expect(said).toContain("Nothing was started")
      expect(tools(w)).toEqual([])
      expect(A.some([said, ...w.log], Str.includes(secret))).toBe(false)
    })
  )

  it.effect("the same variable in the root .env stops it too, and says that is where it is", () =>
    Effect.gen(function* () {
      const w = world()
      const result = yield* run(w, options(), untouched, O.none(), {
        ".env": `# mine\nexport CLOUDFLARE_API_KEY = ${secret}\nOTHER=1\nCLOUDFLARE_EMAIL=\n`
      })
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain(
        "Set outside this command: CLOUDFLARE_API_KEY (the root .env), CLOUDFLARE_EMAIL (the root .env)."
      )
      expect(said).not.toContain("OTHER")
      expect(tools(w)).toEqual([])
      expect(A.some([said, ...w.log], Str.includes(secret))).toBe(false)
    })
  )

  it.effect("a secret of the stacks in his shell stops the stack and production, and leaves a test stage alone", () =>
    Effect.gen(function* () {
      // The usual name of a personal key, exported for other tools.
      vi.stubEnv("OPENROUTER_API_KEY", secret)
      const stack = world({ accounts: productionOnly, profiles: connected })
      const first = yield* run(stack, options({ sizes: ["staging", "production"], signUp: O.some("closed") }))
      expect(O.getOrElse(first.stopped, () => "")).toContain("OPENROUTER_API_KEY (your shell)")
      expect(tools(stack)).toEqual([])
      // A test stage reads no model key, so nothing it is told differs from what it deploys.
      const stage = world()
      const second = yield* run(stage, options())
      expect(second.stopped).toEqual(O.none())
      expect(A.some(stage.log, Str.includes(secret))).toBe(false)
      vi.stubEnv("OPENROUTER_API_KEY", undefined)
      A.forEach(
        ["PREVIEW_TEST_ACCOUNT_PASSWORD", "PREVIEW_CLOUDFLARE_API_TOKEN", "PREVIEW_CLOUDFLARE_ACCOUNT_ID"],
        (name) => expect(outranking(["staging"])).toContain(name)
      )
    })
  )

  it.effect(
    "a GitHub host in his shell stops the stack: the questions would name one server and the calls go to another",
    () =>
      Effect.gen(function* () {
        vi.stubEnv("GH_HOST", "github.example.test")
        const stack = world({ accounts: productionOnly, profiles: connected })
        const first = yield* run(stack, options({ sizes: ["staging"], signUp: O.some("closed") }))
        expect(O.getOrElse(first.stopped, () => "")).toContain("GH_HOST (your shell)")
        expect(tools(stack)).toEqual([])
        A.forEach(["GITHUB_BASE_URL", "GITHUB_API_URL", "GH_ENTERPRISE_TOKEN", "GITHUB_ENTERPRISE_TOKEN"], (name) =>
          expect(outranking(["production"])).toContain(name)
        )
        expect(outranking(["test-stage"])).not.toContain("GH_HOST")
      })
  )

  it.effect("a name Bun loaded from the root .env.local is said to be that file's, not his shell's", () =>
    Effect.gen(function* () {
      // As `bun run` leaves it: the file's line is in the environment too, and `env -u` would not clear it.
      vi.stubEnv("NODE_ENV", "")
      vi.stubEnv("CLOUDFLARE_API_TOKEN", secret)
      const w = world()
      const result = yield* run(w, options(), untouched, O.none(), {
        ".env.local": `CLOUDFLARE_API_TOKEN=${secret}\n`
      })
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain("Set outside this command: CLOUDFLARE_API_TOKEN (the root .env.local).")
      expect(said).not.toContain("your shell)")
      expect(said).toContain("`env -u` cannot")
      expect(tools(w)).toEqual([])
      expect(A.some([said, ...w.log], Str.includes(secret))).toBe(false)
    })
  )

  it("the root env files Bun loads: .env, the one for NODE_ENV, and .env.local except under test", () => {
    expect(envFilesFor(O.none())).toEqual([".env", ".env.development", ".env.local"])
    expect(envFilesFor(O.some("production"))).toEqual([".env", ".env.production", ".env.local"])
    expect(envFilesFor(O.some("test"))).toEqual([".env", ".env.test"])
  })

  it.effect("with none of them set, a run goes on, and the dry run says which names stop one", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      yield* run(w, options({ sizes: ["production"], dryRun: true }))
      expect(A.join(w.log, "\n")).toContain(
        "A run stops before its first tool when one of these is set in your shell or named in the root .env"
      )
      expect(A.join(w.log, "\n")).toContain("CLOUDFLARE_API_TOKEN, CLOUDFLARE_API_KEY")
    })
  )
})

describe("infra setup: the two accounts told apart", () => {
  it.effect("the other profile's account unread stops it: it does not pass as a different account", () =>
    Effect.gen(function* () {
      // The previews' profile is connected, and the tool cannot say to which account (its login ran out).
      const w = world({
        accounts: productionOnly,
        profiles: connected,
        connects: { "inventory-production": "acc-production" }
      })
      const result = yield* run(w, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(O.getOrElse(result.stopped, () => "")).toContain(
        'Could not read which Cloudflare account profile "inventory-preview" deploys into'
      )
      expect(A.some(started(w), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
      // No previews' profile at all is another matter: there is nothing to share an account with.
      const alone = world({
        accounts: productionOnly,
        profiles: { "inventory-production": "Cloudflare (oauth), GitHub (gh-cli), 1Password (desktop)" }
      })
      const went = yield* run(alone, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(went.stopped).toEqual(O.none())
    })
  )

  it.effect("a listing of the profiles that fails stops it: it does not pass as no previews' profile", () =>
    Effect.gen(function* () {
      const healthy = world({ accounts: productionOnly, profiles: connected })
      yield* run(healthy, options({ sizes: ["production"], signUp: O.some("closed") }))
      const listings = A.filter(healthy.log, (entry) => entry === "ask: bunx alchemy profile list").length
      // The last listing is the one that tells the two profiles apart.
      const w = world({ accounts: productionOnly, profiles: connected, listFailsAfter: listings - 1 })
      const result = yield* run(w, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(O.getOrElse(result.stopped, () => "")).toContain("Could not list the Alchemy profiles")
      expect(A.some(started(w), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
    })
  )

  it.effect("with no previews' profile, production's account is held against the one his file names", () =>
    Effect.gen(function* () {
      const productionAlone = { "inventory-production": "Cloudflare (oauth), GitHub (gh-cli), 1Password (desktop)" }
      // His file names production's own account for the previews, and the previews' profile is under another name.
      const same = world({ accounts: productionOnly, profiles: productionAlone, tokenAccount: "acc-production" })
      const stopped = yield* run(same, options({ sizes: ["production"], signUp: O.some("closed") }), untouched, own)
      expect(O.getOrElse(stopped.stopped, () => "")).toContain(
        'Profile "inventory-production" deploys into the account acc-production, the one packages/infra/env/op.env.local names for the previews.'
      )
      expect(A.some(started(same), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
      // His file names another account: production goes on.
      const apart = world({ accounts: productionOnly, profiles: productionAlone })
      const went = yield* run(apart, options({ sizes: ["production"], signUp: O.some("closed") }), untouched, own)
      expect(went.stopped).toEqual(O.none())
      // No file and no previews' profile: nothing to hold it against, and he is told so.
      const none = world({ accounts: productionOnly, profiles: productionAlone })
      yield* run(none, options({ sizes: ["production"], signUp: O.some("closed") }))
      expect(at(none, "production's account is held against no previews' account here")).toBeGreaterThan(-1)
    })
  )

  it.effect("production's sign-up list is asked of the repository by name, never of gh's default", () =>
    Effect.gen(function* () {
      const w = world({ accounts: productionOnly, profiles: connected, signUpOnGitHub: O.some("a@example.test") })
      const result = yield* run(w, options({ sizes: ["production"] }))
      expect(result.stopped).toEqual(O.none())
      expect(checks(w)).toContain("ask: gh variable get SIGN_UP --env production --repo kriegcloud/inventory-import")
      expect(at(w, "as the production environment of kriegcloud/inventory-import already holds it")).toBeGreaterThan(-1)
    })
  )
})

describe("infra setup: the second account by its token", () => {
  const underOwn = "op-human run --env-file packages/infra/env/op.env.local --"
  const asCf =
    'sh -c CLOUDFLARE_API_TOKEN="$PREVIEW_CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$PREVIEW_CLOUDFLARE_ACCOUNT_ID" cf accounts tokens'

  it.effect(
    "a test stage goes there with no login: the token is checked, then the profile takes it from 1Password",
    () =>
      Effect.gen(function* () {
        const w = world()
        const result = yield* run(w, options(), untouched, own)
        expect(result.stopped).toEqual(O.none())
        expect(started(w)).toEqual([
          `ask: ${underOwn} ${asCf} verify`,
          `ask: ${underOwn} ${asCf} get 0123456789abcdef0123456789abcdef`,
          `ask: ${A.join(["op-human", ...subdomainCall.args], " ")}`,
          "ask: cf auth whoami",
          "ask: cf zones list --name beep-effect.com --status active",
          "ask: bunx alchemy profile list",
          "ask: bunx alchemy profile create inventory-preview",
          `hand: ${underOwn} bunx alchemy profile edit --profile inventory-preview --add Cloudflare --method stored --set apiToken=env:PREVIEW_CLOUDFLARE_API_TOKEN --set accountId=env:PREVIEW_CLOUDFLARE_ACCOUNT_ID`,
          "ask: bunx alchemy profile list",
          "hand: bunx alchemy state bootstrap --profile inventory-preview",
          "hand: bunx alchemy plan --stage test_ben --profile inventory-preview | given HIDE_TEST_ACCOUNT_PASSWORD=true",
          "hand: bunx alchemy deploy --stage test_ben --profile inventory-preview --yes | given HIDE_TEST_ACCOUNT_PASSWORD=true"
        ])
        // Neither a reference nor the names in it reach a line or an argument: only the file's path does.
        expect(A.some(w.log, (entry) => /op:\/\/|Second Account/.test(entry))).toBe(false)
        expect(at(w, "say: Cloudflare: the previews' token is active and allows what a deploy needs")).toBeGreaterThan(
          -1
        )
      })
  )

  it.effect("every question that makes something names the account it is about, by id, with a login or a token", () =>
    Effect.gen(function* () {
      const byToken = world()
      yield* run(byToken, options(), untouched, own)
      const byLogin = world()
      yield* run(byLogin, options())
      A.forEach([byToken, byLogin], (w) => {
        const making = A.filter(w.log, (entry) => /^confirm: (Make sure the state store|Deploy )/.test(entry))
        expect(making.length).toBe(2)
        expect(A.every(making, Str.includes("acc-preview"))).toBe(true)
        // The id asked about is the one read from the profile the tool is then started with.
        expect(at(w, "ask: bunx alchemy profile show --profile inventory-preview")).toBeLessThan(
          at(w, "confirm: Make sure the state store")
        )
      })
      // All three sizes: production's questions name production's account, the previews' theirs.
      const all = world({ accounts: productionOnly })
      yield* run(all, options({ sizes: ["test-stage", "staging", "production"], signUp: O.some("closed") }))
      const asked = A.filter(all.log, (entry) => /^confirm: (Make sure the state store|Deploy )/.test(entry))
      expect(asked.length).toBe(5)
      // The repository's question names both: it makes a token in production's account, and gives previews and
      // staging the previews' account to deploy into.
      expect(A.filter(asked, Str.includes("acc-preview")).length).toBe(3)
      expect(A.filter(asked, Str.includes("acc-production")).length).toBe(3)
      expect(
        at(
          all,
          'and one token in the account "Production" (acc-production); previews and staging then deploy into the account acc-preview (the previews\') with your token)'
        )
      ).toBeGreaterThan(-1)
    })
  )

  it.effect("by his token, the account is still asked whether it holds production's zone", () =>
    Effect.gen(function* () {
      // cf is logged in to production's account, which is also the one his token belongs to.
      const shared = { accounts: productionOnly, zone: O.some("acc-production"), tokenAccount: "acc-production" }
      const question =
        "confirm: The previews' account by your token is acc-production. It holds the zone beep-effect.com, so it is production's account: a test stage here shares it. Use it?"
      const no = world({ ...shared, yes: (asked) => !Str.includes("by your token")(asked) })
      const stopped = yield* run(no, options(), untouched, own)
      expect(at(no, `${question} -> no`)).toBeGreaterThan(-1)
      expect(O.isSome(stopped.stopped)).toBe(true)
      expect(A.some(started(no), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
      const yes = world(shared)
      yield* run(yes, options(), untouched, own)
      expect(at(yes, `${question} -> yes`)).toBeLessThan(at(yes, "hand: bunx alchemy state bootstrap"))
      // The repository's stack never shares it: it stops, whatever he would answer.
      const strict = world({
        ...shared,
        profiles: { "inventory-production": "Cloudflare (oauth), GitHub (gh-cli), 1Password (desktop)" }
      })
      const stack = yield* run(strict, options({ sizes: ["staging"] }))
      expect(O.getOrElse(stack.stopped, () => "")).toContain(
        'Profile "inventory-preview" deploys into the account acc-production, which is production\'s: it holds the zone beep-effect.com'
      )
      expect(A.some(started(strict), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
      // With cf logged out nothing can say, and he is told so before the first question that makes something.
      const blind = world({ cloudflare: false })
      yield* run(blind, options(), untouched, own)
      expect(at(blind, "nothing here could say whether the account acc-preview holds the zone")).toBeLessThan(
        at(blind, "confirm: Make sure the state store")
      )
      expect(A.some(started(blind), (entry) => entry === "hand: cf auth login")).toBe(false)
    })
  )

  it.effect("a comparison 1Password did not answer is said as that, not as a wrong account", () =>
    Effect.gen(function* () {
      const locked = world({ opFails: O.some(1) })
      const first = yield* run(locked, options(), untouched, own)
      const said = O.getOrElse(first.stopped, () => "")
      expect(said).toContain('1Password stopped the comparison of profile "inventory-preview"\'s account')
      expect(said).toContain("Either the app was locked or its prompt went unanswered")
      expect(said).toContain("or it refused (check the references in packages/infra/env/op.env.local")
      expect(said).not.toContain("which is not the one")
      const held = world({ opHeld: O.some("tr '[:upper:]'") })
      const heldOnce = O.getOrElse((yield* run(held, options(), untouched, own)).stopped, () => "")
      expect(heldOnce).toContain('1Password did not let the comparison of profile "inventory-preview"\'s account')
      expect(heldOnce).toContain("approve its prompt when it asks")
      expect(heldOnce).not.toContain("Check the references")
      const other = world({ tokenAccount: "acc-other", connects: { "inventory-preview": "acc-preview" } })
      // A profile connected by a login, to another account than the id his file names.
      other.profiles = { "inventory-preview": "Cloudflare (oauth)" }
      const second = yield* run(other, options(), untouched, own)
      expect(O.getOrElse(second.stopped, () => "")).toContain(
        "deploys into the account acc-preview, which is not the one packages/infra/env/op.env.local names"
      )
      A.forEach([locked, other], (w) =>
        expect(A.some(started(w), (entry) => /state bootstrap|alchemy plan|alchemy deploy/.test(entry))).toBe(false)
      )
    })
  )

  it.effect(
    "a token that lacks a permission, or may not show its own, is said and asked about before the profile",
    () =>
      Effect.gen(function* () {
        const lacking = world({
          token: { active: true, allows: O.some(["Workers Scripts Write", "Account Settings Read"]) },
          yes: (question) => question !== "Go on with this token?"
        })
        const stopped = yield* run(lacking, options(), untouched, own)
        expect(O.getOrElse(stopped.stopped, () => "")).toContain("Stopped at the previews' token")
        expect(at(lacking, "lacks: D1 Write, Secrets Store Write, Workers Tail Read")).toBeGreaterThan(-1)
        expect(A.some(started(lacking), Str.includes("profile edit"))).toBe(false)
        const silent = world({ token: { active: true, allows: O.none() } })
        const went = yield* run(silent, options(), untouched, own)
        expect(went.stopped).toEqual(O.none())
        // cf's own words for why it would not show them, not a guess about the token.
        const notShown =
          "its permissions were not shown (`cf accounts tokens get 0123456789abcdef0123456789abcdef` failed: refused)"
        expect(at(silent, notShown)).toBeGreaterThan(-1)
        expect(at(silent, notShown)).toBeLessThan(at(silent, "confirm: Go on with this token?"))
        expect(at(silent, "confirm: Go on with this token?")).toBeLessThan(at(silent, "profile edit"))
      })
  )

  it.effect(
    "a token that does not verify stops it before the profile; one line of the two alone stops it at once",
    () =>
      Effect.gen(function* () {
        const dead = world({ token: { active: false, allows: O.none() } })
        const first = yield* run(dead, options(), untouched, own)
        expect(O.getOrElse(first.stopped, () => "")).toContain('is "disabled", not active')
        expect(A.some(started(dead), Str.includes("profile edit"))).toBe(false)
        const half = world()
        const second = yield* run(half, options(), untouched, O.some("PREVIEW_CLOUDFLARE_API_TOKEN=op://v/i/f\n"))
        expect(O.getOrElse(second.stopped, () => "")).toContain("must name both")
        const value = world()
        const third = yield* run(
          value,
          options(),
          untouched,
          O.some(`PREVIEW_CLOUDFLARE_API_TOKEN=${secret}\nPREVIEW_CLOUDFLARE_ACCOUNT_ID=op://v/i/f\n`)
        )
        expect(O.getOrElse(third.stopped, () => "")).toContain("must name both")
        expect([...started(half), ...started(value)]).toEqual([])
        expect(A.some([...value.log, ...A.getSomes([third.stopped])], Str.includes(secret))).toBe(false)
      })
  )

  it.effect("the token's names are read as the stack reads them: the last line, across op.env and op.env.local", () =>
    Effect.gen(function* () {
      // The template line he copied is left above his real one; the stack takes the last, and so does a run.
      const template = 'PREVIEW_CLOUDFLARE_API_TOKEN="op://<vault>/<item>/<field>"\n'
      const honest = world()
      const first = yield* run(
        honest,
        options(),
        untouched,
        O.map(own, (text) => `${template}${text}`)
      )
      expect(O.getOrElse(first.stopped, () => "")).not.toContain("must name both")
      expect(A.some(started(honest), Str.includes("cf accounts tokens verify"))).toBe(true)
      // A real line above the template one: the stack takes the template, so the run stops.
      const below = world()
      const second = yield* run(
        below,
        options(),
        untouched,
        O.map(own, (text) => `${text}${template}`)
      )
      expect(O.getOrElse(second.stopped, () => "")).toContain("must name both")
      // Named only in the public op.env: the stack would take them there, and the run says to move them.
      const committedOnly = world()
      const third = yield* run(committedOnly, options(), `${untouched}${O.getOrElse(own, () => "")}`, O.none())
      expect(O.getOrElse(third.stopped, () => "")).toContain(
        `${opEnvFile} names PREVIEW_CLOUDFLARE_API_TOKEN and PREVIEW_CLOUDFLARE_ACCOUNT_ID, and the repository's stack would take them from there`
      )
      expect(O.getOrElse(third.stopped, () => "")).toContain("move both lines there")
      const idOnly = world()
      const fourth = yield* run(
        idOnly,
        options(),
        `${untouched}PREVIEW_CLOUDFLARE_ACCOUNT_ID=op://v/i/f\n`,
        O.some("PREVIEW_CLOUDFLARE_API_TOKEN=op://v/i/g\n")
      )
      expect(O.getOrElse(fourth.stopped, () => "")).toContain(
        `${opEnvFile} names PREVIEW_CLOUDFLARE_ACCOUNT_ID, and the repository's stack would take it from there`
      )
      expect(O.getOrElse(fourth.stopped, () => "")).toContain("move that line there")
      expect([...started(below), ...started(committedOnly), ...started(idOnly)]).toEqual([])
    })
  )

  it.effect("without his own file the repository's stack is not set up: it stops at once and names the two lines", () =>
    Effect.gen(function* () {
      const w = world({ accounts: productionOnly, profiles: connected })
      const result = yield* run(w, options({ sizes: ["staging"] }), untouched, O.none())
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain("your own token for the previews' account, and makes none there")
      expect(said).toContain("packages/infra/env/op.env.local")
      expect(started(w)).toEqual([])
      expect(result.env).toBe(untouched)
    })
  )
})

describe("infra setup: the dry run", () => {
  it.effect("with his own file, it prints the token's commands; without it, that a run of the stack stops", () =>
    Effect.gen(function* () {
      const withFile = world({ terminal: false })
      yield* run(withFile, options({ sizes: ["staging"], dryRun: true }))
      const said = A.join(withFile.log, "\n")
      expect(said).toContain("cf accounts tokens verify'")
      expect(said).toContain("--method stored --set apiToken=env:PREVIEW_CLOUDFLARE_API_TOKEN")
      expect(said).toContain("gh variable get SIGN_UP --env production")
      expect(said).toContain("bunx alchemy profile show --profile inventory-production")
      const without = world({ terminal: false })
      yield* run(without, options({ sizes: ["staging"], dryRun: true }), untouched, O.none())
      expect(A.join(without.log, "\n")).toContain("As things are, a run stops before step 1")
      expect([...started(withFile), ...checks(withFile), ...started(without)]).toEqual([])
    })
  )

  it.effect("with no size, it prints the steps of all three sizes and starts nothing", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      const result = yield* run(w, options({ sizes: [], dryRun: true }))
      expect(result.stopped).toEqual(O.none())
      const said = A.join(w.log, "\n")
      expect(said).toContain("No size was given, so these are the steps of all three sizes at once.")
      expect(said).toContain("bunx alchemy plan --stage test_ben --profile inventory-preview")
      expect(said).toContain(
        "bunx alchemy deploy packages/infra/src/GitHub.stack.ts --stage prod --profile inventory-production --yes"
      )
      expect([...started(w), ...checks(w)]).toEqual([])
      // A real run with no size still stops and says how much to set up.
      const real = yield* run(world(), options({ sizes: [] }))
      expect(O.getOrElse(real.stopped, () => "")).toContain("Say how much to set up")
    })
  )
})

describe("infra setup: what it reads", () => {
  it("a variable of op.env is missing, a reference, or something else", () => {
    const name = "PREVIEW_TEST_ACCOUNT_PASSWORD"
    expect(referenceState({ text: untouched, name })).toBe("missing")
    expect(referenceState({ text: `${name}=op://vault/item/password\n`, name })).toBe("reference")
    expect(referenceState({ text: `  ${name}="op://v/i/section/field"`, name })).toBe("reference")
    expect(referenceState({ text: `${name}=op://<vault>/<item>/<field>`, name })).toBe("not-a-reference")
    expect(referenceState({ text: `${name}=hunter2`, name })).toBe("not-a-reference")
    expect(referenceState({ text: `${name}="op://Vault/An Item/FIELD"`, name })).toBe("reference")
    expect(referenceState({ text: `${name}=op://Vault/An Item/FIELD`, name })).toBe("not-a-reference")
    expect(referenceState({ text: `${name}=op://v/i/f\n${name}=hunter2`, name })).toBe("not-a-reference")
  })

  it("a variable's reference is his own file's when that file has a line for it, as the stacks read them", () => {
    const committed = "A=op://v/i/f\nB=op://v/i/g\n"
    expect(referenceGiven({ committed, own: "A=op://w/j/k\n", name: "A" })).toEqual({
      state: "reference",
      file: localEnvFile
    })
    expect(referenceGiven({ committed, own: "A=\n", name: "A" })).toEqual({
      state: "not-a-reference",
      file: localEnvFile
    })
    expect(referenceGiven({ committed, own: "A=op://w/j/k\n", name: "B" })).toEqual({
      state: "reference",
      file: opEnvFile
    })
    expect(referenceGiven({ committed: "", own: "", name: "B" })).toEqual({ state: "missing", file: opEnvFile })
    // Within a file the last line is the one taken, as the stack takes it: a template left above his line does not
    // hide it, and one left below it does.
    const template = "A=op://<vault>/<item>/<field>"
    expect(referenceGiven({ committed, own: `${template}\nA=op://w/j/k\n`, name: "A" })).toEqual({
      state: "reference",
      file: localEnvFile
    })
    expect(referenceGiven({ committed, own: `A=op://w/j/k\n${template}\n`, name: "A" })).toEqual({
      state: "not-a-reference",
      file: localEnvFile
    })
    expect(referenceGiven({ committed: `${template}\nA=op://v/i/f\n`, own: "", name: "A" })).toEqual({
      state: "reference",
      file: opEnvFile
    })
  })

  it("a reference takes its commented line's place, or the end of the file, and no other line changes", () => {
    const written = withReference({
      text: untouched,
      name: "PREVIEW_TEST_ACCOUNT_PASSWORD",
      reference: "op://v/i/password"
    })
    expect(Str.split("\n")(written)).toEqual([
      "# References only: NAME=op://vault/item/field.",
      "# OPENROUTER_API_KEY=op://<vault>/<item>/<field>",
      "#",
      "PREVIEW_TEST_ACCOUNT_PASSWORD=op://v/i/password",
      ""
    ])
    expect(withReference({ text: "# other", name: "A", reference: "op://v/i/f" })).toBe("# other\nA=op://v/i/f\n")
  })

  it("the lines of the tracked file that are neither a comment nor a reference, by number", () => {
    expect(strayLines(untouched)).toEqual([])
    expect(strayLines('# c\nA=op://v/i/f\n\n  B="op://A Vault/An Item/f"\n')).toEqual([])
    expect(strayLines("A=op://v/i/f\nexport B=x\nC = y\nD=z\nE=op://<vault>/<item>/<field>\nnot a line")).toEqual([
      2, 3, 4, 5, 6
    ])
  })

  it("a profile's account is the one line kept of what `alchemy profile show` prints", () => {
    const shown =
      "- p\n  GitHub (gh-cli) — ok\n    accountId: not-this-one\n  Cloudflare (oauth) — ok\n    accessToken: abc…\n    accountId: 0123456789abcdef0123456789abcdef\n  1Password (desktop) — ok"
    expect(accountIn(shown)).toEqual(O.some("0123456789abcdef0123456789abcdef"))
    expect(accountIn("- p\n  GitHub (gh-cli) — ok\n    accountId: not-this-one")).toEqual(O.none())
  })

  it("the profiles `alchemy profile list` names, with what each is connected to", () => {
    expect(
      profilesOf(
        "Profiles (3)\n* default\n- inventory-preview: Cloudflare (oauth)\n- p2: Cloudflare (stored), GitHub (gh-cli)"
      )
    ).toEqual([
      { name: "default", providers: "" },
      { name: "inventory-preview", providers: "Cloudflare (oauth)" },
      { name: "p2", providers: "Cloudflare (stored), GitHub (gh-cli)" }
    ])
  })
})

describe("infra setup: who did not answer", () => {
  it.effect("1Password not answering is said as that, with op's words, and nothing is said of the token", () =>
    Effect.gen(function* () {
      const w = world({ opDown: O.some("cf accounts tokens verify") })
      const result = yield* run(w, options(), untouched, own)
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain("1Password did not answer, so `cf accounts tokens verify` was never asked")
      expect(said).toContain(opDownSaid)
      expect(said).toContain('"Integrate with 1Password CLI"')
      expect(said).toContain("from your own terminal")
      expect(said).not.toContain("verify as active")
      expect(said).not.toContain("Check PREVIEW_CLOUDFLARE_API_TOKEN")
      expect(A.some(started(w), Str.includes("profile edit"))).toBe(false)
      // The same for the permissions, the subdomain and 1Password's own lists.
      const get = yield* run(world({ opDown: O.some("tokens get") }), options(), untouched, own)
      expect(O.getOrElse(get.stopped, () => "")).toContain("1Password did not answer, so `cf accounts tokens get")
      const sub = yield* run(world({ opDown: O.some("workers/subdomain") }), options(), untouched, own)
      expect(O.getOrElse(sub.stopped, () => "")).toContain(
        "1Password did not answer, so Cloudflare's workers.dev subdomain question was never asked"
      )
      const vaults = yield* run(world({ opDown: O.some("vault list") }), options({ sizes: ["staging"] }))
      expect(O.getOrElse(vaults.stopped, () => "")).toContain("1Password did not answer, so `op-human vault list`")
    })
  )

  it.effect("cf answering with an error shows cf's words; an answer it cannot read is said as that", () =>
    Effect.gen(function* () {
      const words = "Authentication error [code: 10001]"
      const refused = world({ verifyRaw: O.some({ stdout: "", stderr: words, code: 1 }) })
      const first = yield* run(refused, options(), untouched, own)
      expect(O.getOrElse(first.stopped, () => "")).toContain(`\`cf accounts tokens verify\` failed: ${words}`)
      // A verify that failed decides nothing about the token, and says so.
      expect(O.getOrElse(first.stopped, () => "")).toContain("was not verified")
      expect(O.getOrElse(first.stopped, () => "")).toContain("That decides nothing about the token")
      expect(O.getOrElse(first.stopped, () => "")).not.toContain("did not verify")
      expect(O.getOrElse(first.stopped, () => "")).not.toContain("1Password did not answer")
      const garbled = world({ verifyRaw: O.some({ stdout: "not json", stderr: "", code: 0 }) })
      const second = yield* run(garbled, options(), untouched, own)
      expect(O.getOrElse(second.stopped, () => "")).toContain(
        "`cf accounts tokens verify` answered something this command cannot read"
      )
      expect(A.filter([...started(refused), ...started(garbled)], Str.includes("profile edit"))).toEqual([])
    })
  )

  it("an app op never reached is told from 1Password refusing", () => {
    expect(onePasswordUnreachable(opDownSaid)).toBe(true)
    expect(onePasswordUnreachable("[ERROR] 2026/11/22 10:00:00 connecting to desktop app: timeout")).toBe(true)
    expect(onePasswordUnreachable("[ERROR] 2026/11/22 10:00:00 error initializing client: no account found")).toBe(true)
    expect(onePasswordUnreachable(opRefusedSaid)).toBe(false)
    expect(onePasswordUnreachable("")).toBe(false)
  })

  it("op's own error lines are told from a tool's", () => {
    expect(onePasswordSaid(opDownSaid)).toBe(true)
    expect(onePasswordSaid("error initializing client: connecting to desktop app: read: connection reset")).toBe(true)
    expect(onePasswordSaid("[ERROR] 2026/11/22 10:00:00 authorization prompt dismissed, please try again")).toBe(true)
    expect(onePasswordSaid("Authentication error [code: 10001]")).toBe(false)
    expect(onePasswordSaid("")).toBe(false)
  })
})

describe("infra setup: the previews' workers.dev subdomain", () => {
  it.effect("an account with none stops the run before the state store, and says where he picks one", () =>
    Effect.gen(function* () {
      const w = world({ subdomainError: O.some(10007) })
      const result = yield* run(w, options(), untouched, own)
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain("The previews' account has no workers.dev subdomain yet")
      expect(said).toContain("Workers & Pages")
      expect(A.some(started(w), Str.includes("state bootstrap"))).toBe(false)
      expect(A.some(started(w), Str.includes("profile edit"))).toBe(false)
      // The token reaches curl on its input, never in an argument, and no reference reaches a line.
      const asked = A.join(subdomainCall.args, " ")
      expect(asked).toContain(
        "printf 'Authorization: Bearer %s\\n' \"$PREVIEW_CLOUDFLARE_API_TOKEN\" | curl -sS -H @- "
      )
      expect(A.some(w.log, (entry) => /op:\/\/|Second Account/.test(entry))).toBe(false)
    })
  )

  it.effect("a token not allowed to ask names the permission; any other error is Cloudflare's own words", () =>
    Effect.gen(function* () {
      const denied = yield* run(world({ subdomainError: O.some(10000) }), options(), untouched, own)
      expect(O.getOrElse(denied.stopped, () => "")).toContain("Cloudflare answered 10000 (not authorized)")
      expect(O.getOrElse(denied.stopped, () => "")).toContain("Workers Scripts")
      const other = yield* run(world({ subdomainError: O.some(10013) }), options(), untouched, own)
      expect(O.getOrElse(other.stopped, () => "")).toContain("10013: error 10013 from Cloudflare")
      const fine = world()
      const went = yield* run(fine, options(), untouched, own)
      expect(went.stopped).toEqual(O.none())
      expect(at(fine, "workers.dev subdomain, previews-owner.workers.dev")).toBeLessThan(at(fine, "state bootstrap"))
      expect(at(fine, "workers.dev subdomain, previews-owner.workers.dev")).toBeGreaterThan(-1)
    })
  )

  it("reads Cloudflare's answer by its code", () => {
    expect(subdomainSaid({ success: true, errors: [], result: { subdomain: "ab" } })).toEqual(
      Result.succeed("Cloudflare: the previews' account has its workers.dev subdomain, ab.workers.dev.")
    )
    expect(Result.isFailure(subdomainSaid({ success: true, errors: [], result: null }))).toBe(true)
    expect(
      subdomainSaid({
        success: false,
        errors: [
          { code: 10000, message: "x" },
          { code: 10007, message: "y" }
        ]
      })
    ).toEqual(subdomainSaid({ success: false, errors: [{ code: 10007, message: "y" }] }))
  })

  it.effect("the dry run lists the question", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      yield* run(w, options({ dryRun: true }), untouched, own)
      expect(A.join(w.log, "\n")).toContain("/workers/subdomain")
      expect(A.join(w.log, "\n")).toContain("workers.dev subdomain")
      expect([...started(w), ...checks(w)]).toEqual([])
    })
  )
})

describe("infra setup: failures named for what failed", () => {
  it.effect("a zone listing that fails is said in cf's words, not as a zone in no account", () =>
    Effect.gen(function* () {
      const w = world({ zoneFails: O.some("zones: rate limited") })
      const result = yield* run(w, options({ sizes: ["production"] }))
      expect(O.getOrElse(result.stopped, () => "")).toContain(
        "(`cf zones list --name beep-effect.com --status active` failed: zones: rate limited)"
      )
      const byToken = world({ zoneFails: O.some("zones: rate limited") })
      yield* run(byToken, options(), untouched, own)
      expect(at(byToken, "cf could not say which account holds the zone beep-effect.com (")).toBeGreaterThan(-1)
    })
  )

  it.effect("a failing 1Password command of its own is said by op's words, with where to look", () =>
    Effect.gen(function* () {
      const w = world({ vaultsFail: O.some("You are not currently signed in. Please run `op signin --help`") })
      const result = yield* run(w, options({ sizes: ["staging"] }))
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain("1Password did not let `op-human vault list` through: You are not currently signed in")
      expect(said).toContain('"Integrate with 1Password CLI" is on')
      expect(said).not.toContain("did not answer")
      // Words that name neither: both places are said, the vault's hint among them.
      const other = O.getOrElse(
        (yield* run(world({ vaultsFail: O.some("something odd") }), options({ sizes: ["staging"] }))).stopped,
        () => ""
      )
      expect(other).toContain("1Password stopped `op-human vault list`: something odd")
      expect(other).toContain("may see its vaults")
      expect(other).toContain("approve its prompt when it asks")
    })
  )

  it.effect(
    "op's words are sorted: an app never reached, one that held the call back, a reference refused, or unclear",
    () =>
      Effect.sync(() => {
        expect(onePasswordFailure(opDownSaid)).toBe("unreachable")
        expect(onePasswordFailure("[ERROR] x connecting to desktop app: timeout")).toBe("unreachable")
        for (const said of [
          opHeldSaid,
          "[ERROR] 2026/11/22 10:00:00 You are not currently signed in. Please run `op signin --help` for instructions",
          "[ERROR] 2026/11/22 10:00:00 account is not signed in",
          "[ERROR] 2026/11/22 10:00:00 the account is locked",
          "[ERROR] 2026/11/22 10:00:00 authorization timeout",
          "[ERROR] 2026/11/22 10:00:00 the request timed out",
          "[ERROR] 2026/11/22 10:00:00 Timed out waiting for the 1Password app"
        ]) {
          expect(onePasswordFailure(said)).toBe("held")
        }
        for (const said of [
          opRefusedSaid,
          '[ERROR] 2026/11/22 10:00:00 "Second" isn\'t an item in the "Vault" vault',
          '[ERROR] 2026/11/22 10:00:00 "Vault" isn\'t a vault in this account',
          "[ERROR] 2026/11/22 10:00:00 invalid secret reference 'op://v'",
          '[ERROR] 2026/11/22 10:00:00 "ACCOUNT_ID" isn\'t a field in the "Second" item',
          "[ERROR] 2026/11/22 10:00:00 could not read secret: no item matched",
          "[ERROR] 2026/11/22 10:00:00 could not resolve item"
        ]) {
          expect(onePasswordFailure(said)).toBe("refused")
        }
        expect(onePasswordFailure("[ERROR] 2026/11/22 10:00:00 something else")).toBe("unclear")
        // A name op quotes is not op's words: a held word inside one says nothing about the app.
        expect(
          onePasswordFailure(
            '[ERROR] 2026/11/22 10:00:00 "Cloudflare timeout token" isn\'t an item in the "Vault" vault'
          )
        ).toBe("refused")
        expect(onePasswordFailure('[ERROR] 2026/11/22 10:00:00 "Vault is locked" isn\'t a vault in this account')).toBe(
          "refused"
        )
        expect(
          onePasswordFailure(
            "[ERROR] 2026/11/22 10:00:00 could not read secret 'op://Vault/Not signed in/field': no item matched"
          )
        ).toBe("refused")
        expect(onePasswordFailure('[ERROR] 2026/11/22 10:00:00 "timed out" item: something else')).toBe("unclear")
        // An apostrophe inside a quoted name does not end it: the rest of the name is still not op's words.
        expect(
          onePasswordFailure(
            "[ERROR] 2026/11/22 10:00:00 could not read secret 'op://Benjamin's vault/token is locked/field': no item matched"
          )
        ).toBe("refused")
        expect(
          onePasswordFailure(
            '[ERROR] 2026/11/22 10:00:00 "Benjamin\'s timeout token" isn\'t an item in the "Benjamin\'s vault" vault'
          )
        ).toBe("refused")
        expect(
          onePasswordFailure(
            "[ERROR] 2026/11/22 10:00:00 could not read secret 'op://Benjamin's vault/i/f': authorization timeout"
          )
        ).toBe("held")
        // Outside a name the held words still count.
        expect(onePasswordFailure('[ERROR] 2026/11/22 10:00:00 reading "Vault": authorization timeout')).toBe("held")
        expect(onePasswordFailure("")).toBe("unclear")
      })
  )

  it.effect("a token check 1Password held back sends the person to the app, not to the references", () =>
    Effect.gen(function* () {
      const w = world({ opHeld: O.some("cf accounts tokens verify") })
      const said = O.getOrElse((yield* run(w, options(), untouched, own)).stopped, () => "")
      expect(said).toContain(`1Password did not let \`cf accounts tokens verify\` through: ${opHeldSaid}`)
      expect(said).toContain("open the 1Password app and unlock it, approve its prompt when it asks")
      expect(said).not.toContain("Check the references")
      expect(said).not.toContain("refused")
    })
  )

  it.effect("1Password answering and refusing a reference is a refusal, not an app that did not answer", () =>
    Effect.gen(function* () {
      const w = world({ opRefuses: O.some("cf accounts tokens verify") })
      const result = yield* run(w, options(), untouched, own)
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain(`1Password refused \`cf accounts tokens verify\`: ${opRefusedSaid}`)
      expect(said).toContain("each names a vault, an item and a field that exist")
      expect(said).not.toContain("did not answer")
      expect(said).not.toContain("unlock")
      // The comparison and a new item, refused the same way.
      const compared = yield* run(world({ opFails: O.some(1) }), options(), untouched, own)
      expect(O.getOrElse(compared.stopped, () => "")).not.toContain("did not answer")
      const made = yield* run(world({ createFails: O.some(opRefusedSaid) }), options({ sizes: ["staging"] }))
      expect(O.getOrElse(made.stopped, () => "")).toContain(
        `1Password refused \`op-human item create\`: ${opRefusedSaid}`
      )
      expect(O.getOrElse(made.stopped, () => "")).toContain('may make items in the vault "Deploys"')
      // An app op did not reach, on the same call, is said as that.
      const down = yield* run(world({ createFails: O.some(opDownSaid) }), options({ sizes: ["staging"] }))
      expect(O.getOrElse(down.stopped, () => "")).toContain("1Password did not answer, so `op-human item create`")
    })
  )

  it.effect("by a login, a failed state store names the missing workers.dev subdomain as the likely cause", () =>
    Effect.gen(function* () {
      const w = world({ exits: (line) => (Str.includes("state bootstrap")(line) ? 1 : 0) })
      const result = yield* run(w, options())
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain("bunx alchemy state bootstrap --profile inventory-preview` failed; what it said is above")
      expect(said).toContain('If it says the current credentials "can\'t access" the account')
      expect(said).toContain("no workers.dev subdomain yet")
      expect(said).toContain("Workers & Pages")
    })
  )

  it.effect("a profile edit under 1Password that fails points at 1Password as well as what is above", () =>
    Effect.gen(function* () {
      const w = world({ exits: (line) => (Str.includes("--method stored")(line) ? 1 : 0) })
      const result = yield* run(w, options(), untouched, own)
      const said = O.getOrElse(result.stopped, () => "")
      expect(said).toContain('Connecting profile "inventory-preview" did not finish; what it said is above')
      expect(said).toContain('"Integrate with 1Password CLI"')
      // A line of 1Password's is not all one thing: the app's lines and a refused reference are told apart.
      expect(said).toContain("that it is locked or not signed in, or that a prompt was dismissed or timed out")
      expect(said).toContain("1Password refused a reference: check the references in packages/infra/env/op.env.local")
      // The stop names a refused reference by the same words the classifier reads.
      for (const word of [
        "isn't a vault",
        "isn't an item",
        "isn't a field",
        "could not resolve item",
        "no item matched",
        "invalid secret reference"
      ]) {
        expect(said).toContain(`"${word}"`)
      }
      // A line of 1Password's that says neither is not said to be a refused reference: both fixes are named.
      expect(said).toContain("Any other line of 1Password's may be either: try both")
      expect(said).not.toContain("Any other line of 1Password's is a reference it refused")
      expect(said).not.toContain("1Password did not answer")
    })
  )
})

describe("infra setup: the dry run says what a run would", () => {
  it.effect("with no size it needs no user: one this machine's user does not make is shown as the placeholder", () =>
    Effect.gen(function* () {
      for (const user of ["", "Benjamin", "b.smith"]) {
        const w = world({ terminal: false })
        const result = yield* run(w, options({ sizes: [], dryRun: true, user }))
        expect(result.stopped).toEqual(O.none())
        expect(A.join(w.log, "\n")).toContain("bunx alchemy plan --stage test_<user> --profile inventory-preview")
      }
      // Asked for a test stage, a name that is none still stops, dry run or not.
      const sized = yield* run(world(), options({ dryRun: true, user: "Benjamin" }))
      expect(O.getOrElse(sized.stopped, () => "")).toContain('"test_Benjamin" is not a stage name')
      const fine = world({ terminal: false })
      yield* run(fine, options({ sizes: [], dryRun: true }))
      expect(A.join(fine.log, "\n")).toContain("--stage test_ben ")
    })
  )

  it.effect("token lines the stack would take from op.env are said as a stop before step 1", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      yield* run(w, options({ dryRun: true }), `${untouched}${O.getOrElse(own, () => "")}`, O.none())
      expect(A.join(w.log, "\n")).toContain(
        "As things are, a run stops before step 1: packages/infra/env/op.env names PREVIEW_CLOUDFLARE_API_TOKEN and PREVIEW_CLOUDFLARE_ACCOUNT_ID"
      )
      const one = world({ terminal: false })
      yield* run(
        one,
        options({ dryRun: true }),
        `${untouched}PREVIEW_CLOUDFLARE_ACCOUNT_ID=op://v/i/f\n`,
        O.some("PREVIEW_CLOUDFLARE_API_TOKEN=op://v/i/g\n")
      )
      expect(A.join(one.log, "\n")).toContain("op.env names PREVIEW_CLOUDFLARE_ACCOUNT_ID, and the repository's stack")
      const placed = world({ terminal: false })
      yield* run(placed, options({ dryRun: true }), untouched, own)
      expect(A.join(placed.log, "\n")).not.toContain("op.env names")
    })
  )

  it.effect("every stop a run makes on the two files before step 1 is the one the dry run says", () =>
    Effect.gen(function* () {
      const mine = O.getOrElse(own, () => "")
      const tokenLine = 'PREVIEW_CLOUDFLARE_API_TOKEN="op://Vault/Second Account/ACCOUNT_API_TOKEN"\n'
      const cases: ReadonlyArray<readonly [string, SetupOptions, string, O.Option<string>, string]> = [
        ["a stray line", options(), `${untouched}export FOO=hunter2\n`, own, "is neither"],
        ["one of the two", options(), untouched, O.some(tokenLine), "must name both"],
        [
          "not a reference",
          options(),
          untouched,
          O.some(`${tokenLine}PREVIEW_CLOUDFLARE_ACCOUNT_ID=abc\n`),
          "must name both"
        ],
        [
          "one misplaced, staging",
          options({ sizes: ["staging"] }),
          `${untouched}PREVIEW_CLOUDFLARE_ACCOUNT_ID=op://v/i/f\n`,
          O.some(tokenLine),
          "names PREVIEW_CLOUDFLARE_ACCOUNT_ID, and"
        ],
        ["staging without them", options({ sizes: ["staging"] }), untouched, O.none(), "makes none there"]
      ]
      for (const [, given, env, file, words] of cases) {
        const real = O.getOrElse((yield* run(world(), given, env, file)).stopped, () => "")
        expect(real).toContain(words)
        const dry = world({ terminal: false })
        yield* run(dry, { ...given, dryRun: true }, env, file)
        expect(A.filter(dry.log, Str.includes("As things are"))).toEqual([
          `say: As things are, a run stops before step 1: ${real}`
        ])
        expect(started(dry)).toEqual([])
      }
      // With one of the two in op.env, staging is not said to be missing what op.env.local names.
      const one = world({ terminal: false })
      yield* run(
        one,
        options({ sizes: ["staging"], dryRun: true }),
        `${untouched}PREVIEW_CLOUDFLARE_ACCOUNT_ID=op://v/i/f\n`,
        O.some(tokenLine)
      )
      expect(A.join(A.filter(one.log, Str.includes("As things are")), "\n")).not.toContain("Write PREVIEW")
      // Files that are fine: no stop is said, by the function or the dry run.
      const fine = world({ terminal: false })
      yield* run(fine, options({ sizes: ["staging"], dryRun: true }), untouched, own)
      expect(A.join(fine.log, "\n")).not.toContain("As things are")
      const given = { committed: untouched, own: mine }
      expect(
        filesStop({
          committed: untouched,
          token: referenceGiven({ ...given, name: "PREVIEW_CLOUDFLARE_API_TOKEN" }),
          accountId: referenceGiven({ ...given, name: "PREVIEW_CLOUDFLARE_ACCOUNT_ID" }),
          previewByToken: true,
          sizes: ["staging"]
        })
      ).toEqual(O.none())
    })
  )

  it.effect("the subdomain line is the argument a run hands op-human, quoted as a shell reads it back", () =>
    Effect.gen(function* () {
      const w = world({ terminal: false })
      yield* run(w, options({ dryRun: true }), untouched, own)
      const script = A.last(subdomainCall.args).pipe(O.getOrElse(() => ""))
      expect(A.join(w.log, "\n")).toContain(`sh -c ${shellQuoted(script)}`)
      expect(shellQuoted("printf 'a' x")).toBe("'printf '\\''a'\\'' x'")
      expect(shellQuoted("plain")).toBe("'plain'")
      expect(stateStoreFailed("p")).toContain("--profile p` failed")
    })
  )
})
