// `infra setup` on a workstation that is not one: every tool is a stand-in that answers from a small world the test
// writes (who is logged in, which accounts, profiles, vaults and items there are) and every thing said, asked, run
// or handed the terminal is written down in order. No real `op-human`, `cf`, `gh` or `alchemy` is started, so what
// these tests show is what the command would start, in which order and with which words, never that the tools
// themselves do what their help says.
import { describe, expect, it } from "@effect/vitest"
import * as A from "effect/Array"
import * as Effect from "effect/Effect"
import * as O from "effect/Option"
import * as R from "effect/Record"
import * as Str from "effect/String"
import {
  dryRun,
  localEnvFile,
  opEnvFile,
  previewTokenNeeds,
  previewPasswordItem,
  profilesOf,
  referenceState,
  type SetupOptions,
  setup,
  Step,
  stepsFor,
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
  /** The second account's token: whether it verifies, and what it allows (none when it may not say). */
  token: { active: boolean; allows: O.Option<ReadonlyArray<string>> }
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
  zone: O.none(),
  token: { active: true, allows: O.some(previewTokenNeeds) },
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
        if (asked === "cf auth whoami") {
          return w.cloudflare
            ? answer(json({ authenticated: true, tokenValid: true, email: "owner@example.test", accounts: w.accounts }))
            : answer(json({ authenticated: false, accounts: [] }))
        }
        if (asked === "cf zones list --name beep-effect.com") {
          const zones = A.map(A.fromOption(w.zone), (id) => ({ name: "beep-effect.com", account: { id } }))
          return answer(json(zones))
        }
        if (Str.endsWith("cf accounts tokens verify")(asked)) {
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
        if (asked === "bunx alchemy profile list") {
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
        if (asked === "op-human vault list --format json") return answer(json(w.vaults))
        if (Str.startsWith("op-human item list ")(asked)) return answer(json(w.items))
        if (asked === "gh api user --jq .login") {
          return O.match(w.github, { onNone: () => answer("", 1), onSome: (login) => answer(`${login}\n`) })
        }
        return answer("", 1)
      }),
    quiet: (command, args) =>
      Effect.sync(() => {
        w.log.push(`quiet: ${line(command, args)}`)
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
  mine: O.Option<string> = A.contains(given.sizes, "staging") ? own : O.none()
) =>
  inTree(
    { [opEnvFile]: env, ...O.match(mine, { onNone: () => ({}), onSome: (text) => ({ [localEnvFile]: text }) }) },
    Effect.gen(function* () {
      const repo = yield* Repo
      const stopped = yield* setup(given).pipe(
        Effect.provideService(Workstation, standIn(w)),
        Effect.match({ onFailure: (error) => O.some(error.message), onSuccess: () => O.none<string>() })
      )
      return { stopped, env: yield* repo.text(repo.join(repo.root, opEnvFile)) }
    })
  )

/** The tools a run started, without what was said or asked of him. */
const started = (w: World) => A.filter(w.log, (entry) => /^(ask|quiet|hand): /.test(entry))
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
      expect(A.length(dryRun(options({ sizes: ["test-stage"] })))).toBeGreaterThan(4)
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
        "ask: cf zones list --name beep-effect.com",
        "ask: bunx alchemy profile list",
        "ask: bunx alchemy profile create inventory-preview",
        "hand: bunx alchemy profile edit --profile inventory-preview --add Cloudflare",
        "ask: bunx alchemy profile list",
        "hand: bunx alchemy state bootstrap --profile inventory-preview",
        "hand: bunx alchemy plan --stage test_ben --profile inventory-preview",
        "hand: bunx alchemy deploy --stage test_ben --profile inventory-preview --yes"
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
      expect(started(account)).toEqual(["ask: cf auth whoami", "ask: cf zones list --name beep-effect.com"])
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

  it.effect("a line that holds a value, not a reference, stops it and is never printed", () =>
    Effect.gen(function* () {
      const password = world()
      const first = yield* run(password, options({ sizes: ["staging"] }), `PREVIEW_TEST_ACCOUNT_PASSWORD=${secret}\n`)
      expect(O.getOrElse(first.stopped, () => "")).toContain("not an op:// reference")
      const key = world({ profiles: connected })
      const second = yield* run(
        key,
        options({ sizes: ["production"], signUp: O.some("closed") }),
        `OPENROUTER_API_KEY=${secret}\n`
      )
      expect(O.getOrElse(second.stopped, () => "")).toContain("not an op:// reference")
      expect(A.some(started(key), Str.includes("alchemy plan"))).toBe(false)
      const everything = [...password.log, ...key.log, ...A.getSomes([first.stopped, second.stopped])]
      expect(A.some(everything, Str.includes(secret))).toBe(false)
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

  it.effect("when cf cannot tell who holds the zone, he is asked which account is which", () =>
    Effect.gen(function* () {
      const w = world({ accounts: twoAccounts, profiles: connected })
      const result = yield* run(w, options({ sizes: ["test-stage", "production"], signUp: O.some("closed") }))
      expect(result.stopped).toEqual(O.none())
      expect(A.filter(w.log, Str.startsWith("choose: Which Cloudflare account"))).toEqual([
        "choose: Which Cloudflare account is for preview?",
        "choose: Which Cloudflare account is for production?"
      ])
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
        expect(at(w, "say: Sign-up in production: closed")).toBeGreaterThan(-1)
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

  it.effect("production without --sign-up stops before its plan; with it, plan, yes, deploy", () =>
    Effect.gen(function* () {
      const without = world({ profiles: connected })
      const stopped = yield* run(without, options({ sizes: ["production"] }))
      expect(O.getOrElse(stopped.stopped, () => "")).toContain("--sign-up")
      expect(A.some(started(without), Str.includes("alchemy plan"))).toBe(false)
      const w = world({ profiles: connected })
      const result = yield* run(w, options({ sizes: ["production"], signUp: O.some("owner@example.test") }))
      expect(result.stopped).toEqual(O.none())
      const under = "bunx alchemy"
      const given = "given SIGN_UP=owner@example.test DEPLOY_WITHOUT_MODEL_KEY=true"
      expect(A.takeRight(started(w), 2)).toEqual([
        `hand: ${under} plan --stage prod --profile inventory-production | ${given}`,
        `hand: ${under} deploy --stage prod --profile inventory-production --yes | ${given}`
      ])
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
          "ask: bunx alchemy profile list",
          "ask: bunx alchemy profile create inventory-preview",
          `hand: ${underOwn} bunx alchemy profile edit --profile inventory-preview --add Cloudflare --method stored --set apiToken=env:PREVIEW_CLOUDFLARE_API_TOKEN --set accountId=env:PREVIEW_CLOUDFLARE_ACCOUNT_ID`,
          "ask: bunx alchemy profile list",
          "hand: bunx alchemy state bootstrap --profile inventory-preview",
          "hand: bunx alchemy plan --stage test_ben --profile inventory-preview",
          "hand: bunx alchemy deploy --stage test_ben --profile inventory-preview --yes"
        ])
        // Neither a reference nor the names in it reach a line or an argument: only the file's path does.
        expect(A.some(w.log, (entry) => /op:\/\/|Second Account/.test(entry))).toBe(false)
        expect(at(w, "say: Cloudflare: the previews' token is active and allows what a deploy needs")).toBeGreaterThan(
          -1
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
        expect(at(silent, "may not read its own permissions")).toBeLessThan(
          at(silent, "confirm: Go on with this token?")
        )
        expect(at(silent, "confirm: Go on with this token?")).toBeLessThan(at(silent, "profile edit"))
      })
  )

  it.effect(
    "a token that does not verify stops it before the profile; one line of the two alone stops it at once",
    () =>
      Effect.gen(function* () {
        const dead = world({ token: { active: false, allows: O.none() } })
        const first = yield* run(dead, options(), untouched, own)
        expect(O.getOrElse(first.stopped, () => "")).toContain("did not verify as active")
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
