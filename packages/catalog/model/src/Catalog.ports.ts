// The ports of the catalog context, and the type that keeps its handlers on them. A handler may use the six ports,
// how a row becomes items, the kernel's actor and agent and Effect's random source; anything else (a driver, SQL,
// another context's service) does not type-check where the handler is registered.
import type { CurrentActor } from "@inventory/kernel/Actor"
import type { CurrentAgent } from "@inventory/kernel/Agent"
import type { Effect } from "effect"
import type { SecureRandom } from "effect/crypto"
import type { Answerer } from "./Answer/Answerer.external.ts"
import type { ModelAllowance } from "./Answer/ModelAllowance.external.ts"
import type { AssistantLog } from "./Assistant/AssistantLog.store.ts"
import type { ImportStore } from "./Import/ImportStore.store.ts"
import type { ItemStore } from "./Item/ItemStore.store.ts"
import type { SuggestionStore } from "./Suggestion/SuggestionStore.store.ts"

/** The six ports of the catalog context. */
export type CatalogPorts = ImportStore | ItemStore | SuggestionStore | AssistantLog | ModelAllowance | Answerer

/** Everything a handler of the catalog context may require. */
export type CatalogHandlerContext = CatalogPorts | CurrentActor | CurrentAgent | SecureRandom.SecureRandom

/** A handler: an Effect, or a function answering one, that requires nothing beyond `CatalogHandlerContext`. */
type PureHandler =
  | Effect.Effect<unknown, unknown, CatalogHandlerContext>
  | ((...args: ReadonlyArray<never>) => Effect.Effect<unknown, unknown, CatalogHandlerContext>)

/**
 * Registers the catalog's handlers. Returns them as they are; its parameter type is the check: a handler that yields
 * a service outside `CatalogHandlerContext` is a type error here.
 */
export const handlersOf = <const Handlers extends Readonly<Record<string, PureHandler>>>(
  handlers: Handlers
): Handlers => handlers
