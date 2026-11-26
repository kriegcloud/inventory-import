// Compile-only (report 14 section 6.6): each call under a directive must stay a type error, or the unused directive
// fails the type-check. Not a `*.test.ts` file, so Vitest never collects it; `tsconfig.test.json` compiles it.
import { aboutClass, aboutPath, aboutProperty, aboutScheme } from "@inventory/kernel/TermsPointer"

const node = { property: "inv:grantedTo", reverse: true, node: "inv:Grant" } as const
const scope = { property: "inv:grantScope" } as const
const value = { property: "inv:grantsRole" } as const

// @ts-expect-error a property where a class is wanted
aboutClass("inv:membershipIn")
// @ts-expect-error a class where a property is wanted
aboutProperty("inv:Member")
// @ts-expect-error a misspelt class
aboutClass("inv:Organisation")
// @ts-expect-error a misspelt class
aboutClass("inv:Membr")
// @ts-expect-error a misspelt notation
aboutPath([{ ...node, fixed: [{ ...scope, concept: "inv:GrantScopeKindScheme-organizaton" }] }, value])
// the same call spelt right compiles, so the directive above answers to the notation alone
aboutPath([{ ...node, fixed: [{ ...scope, concept: "inv:GrantScopeKindScheme-organization" }] }, value])

// Step 11's terms (report 18): a misspelling of each new class and scheme, a kind put in another's place, and a stage
// the closed scheme does not hold, each beside the same call spelt right.
// @ts-expect-error a misspelt class
aboutClass("inv:SignInAcount")
aboutClass("inv:SignInAccount")
// @ts-expect-error a class where a property is wanted
aboutProperty("inv:AgentRun")
aboutProperty("inv:agentName")
// @ts-expect-error a property where a class is wanted
aboutClass("inv:memberAccount")
aboutClass("inv:ModelCall")
// @ts-expect-error a misspelt scheme
aboutScheme("inv:MembershipStatus")
aboutScheme("inv:MembershipStatusScheme")
// @ts-expect-error a stage the scheme does not hold: an invitation is the concept pending
aboutPath([
  { ...node, fixed: [{ property: "inv:membershipStatus", concept: "inv:MembershipStatusScheme-invited" }] },
  value
])
aboutPath([
  { ...node, fixed: [{ property: "inv:membershipStatus", concept: "inv:MembershipStatusScheme-pending" }] },
  value
])
