// Compile-only (report 14 section 6.6): each call under a directive must stay a type error, or the unused directive
// fails the type-check. Not a `*.test.ts` file, so Vitest never collects it; `tsconfig.test.json` compiles it.
import { aboutClass, aboutPath, aboutProperty } from "@inventory/kernel/TermsPointer"

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
