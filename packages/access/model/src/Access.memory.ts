/**
 * The access context on in-memory twins of its four ports, sharing one state: a person added through the people
 * store signs in through the directory, and their audit line reads back from the audit trail, as on D1.
 *
 * @packageDocumentation
 */
import { Layer } from "effect"
import type { AccessPorts } from "./Access.ports.ts"
import { AuditTrailStore } from "./Activity/AuditTrailStore.store.ts"
import { AllowanceStore } from "./Allowance/AllowanceStore.store.ts"
import { AccessMemoryRef, type AccessMemoryState } from "./internal/memory.ts"
import { PeopleStore } from "./People/PeopleStore.store.ts"
import { MemberDirectory } from "./Session/MemberDirectory.store.ts"

export type { AccessMemoryState, MemoryAccount, MemoryCall, MemoryMembership } from "./internal/memory.ts"
export { AccessMemoryRef } from "./internal/memory.ts"

/** What the twins start with: accounts, memberships (earliest first), audit lines (oldest first) and calls taken. */
export type AccessSeed = Partial<AccessMemoryState>

/**
 * The four ports in memory, starting from `seed`. Also provides the state itself, so a test can read what was
 * written.
 *
 * @category layers
 */
export const accessMemory = (seed: AccessSeed = {}): Layer.Layer<AccessPorts | AccessMemoryRef> =>
  Layer.mergeAll(MemberDirectory.memory, PeopleStore.memory, AuditTrailStore.memory, AllowanceStore.memory).pipe(
    Layer.provideMerge(
      AccessMemoryRef.layer({
        accounts: seed.accounts ?? [],
        memberships: seed.memberships ?? [],
        lines: seed.lines ?? [],
        calls: seed.calls ?? []
      })
    )
  )
