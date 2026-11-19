/**
 * The four ports of the access context on D1.
 *
 * @packageDocumentation
 */
import * as Layer from "effect/Layer"
import { AllowanceStoreD1 } from "./AllowanceStore.adapter.ts"
import { AuditTrailStoreD1 } from "./AuditTrailStore.adapter.ts"
import { MemberDirectoryD1 } from "./MemberDirectory.adapter.ts"
import { PeopleStoreD1 } from "./PeopleStore.adapter.ts"

/**
 * Every access port on the database the caller provides.
 *
 * @category layers
 */
export const AccessAdaptersD1 = Layer.mergeAll(MemberDirectoryD1, PeopleStoreD1, AuditTrailStoreD1, AllowanceStoreD1)
