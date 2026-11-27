/**
 * How long the model's Worker keeps the rows only dedupe needs: one value, given once to the platform every model of
 * the Worker shares (`ModelWorker.ts`), so no model of the Worker keeps them for another time. Benjamin, 2026-11-27,
 * "Receipts forever" (`explorations/alchemy-domain/DECISIONS.md`, host-07): a receipt is what makes a command sent
 * twice under one id apply once, and the library's default drops it after 30 days, after which a press kept that
 * long would be applied again. Deliveries and cancelled rows stay at the library's 7 days. The one thing not to
 * break: `receipts` is `"forever"`, and the Worker's platform is given this value and no other.
 *
 * @packageDocumentation
 */
import type { Retention } from "@alchemy.run/domain/DurableObjects"

/** The retention of every model the Worker hosts: receipts for ever, the rest at the library's windows. */
export const modelRetention = { receipts: "forever" } as const satisfies Retention
