/**
 * The ports of the access context, and the type that keeps its handlers on them. A handler may use the four ports,
 * the kernel's actor and agent and Effect's random source; anything else (a driver, SQL, another context's service)
 * does not type-check where the handler is registered.
 *
 * @packageDocumentation
 */
import type { CurrentActor } from "@inventory/kernel/Actor"
import type { CurrentAgent } from "@inventory/kernel/Agent"
import type * as Effect from "effect/Effect"
import type * as SecureRandom from "effect/crypto/SecureRandom"
import type { AuditTrailStore } from "./Activity/AuditTrailStore.port.ts"
import type { AllowanceStore } from "./Allowance/AllowanceStore.port.ts"
import type { PeopleStore } from "./People/PeopleStore.port.ts"
import type { MemberDirectory } from "./Session/MemberDirectory.port.ts"

/** The four ports of the access context. */
export type AccessPorts = MemberDirectory | PeopleStore | AuditTrailStore | AllowanceStore

/** Everything a handler of the access context may require. */
export type AccessHandlerContext = AccessPorts | CurrentActor | CurrentAgent | SecureRandom.SecureRandom

/** A handler: any function whose Effect requires nothing beyond `AccessHandlerContext`. */
type PureHandler = (...args: ReadonlyArray<never>) => Effect.Effect<unknown, unknown, AccessHandlerContext>

/**
 * Registers the access handlers. Returns them as they are; its parameter type is the check: a handler that yields a
 * service outside `AccessHandlerContext` is a type error here.
 *
 * @category constructors
 */
export const handlersOf = <const Handlers extends Readonly<Record<string, PureHandler>>>(
  handlers: Handlers
): Handlers => handlers
