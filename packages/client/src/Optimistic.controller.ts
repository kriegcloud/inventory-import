// Optimistic writes, one way for all of them. The rule this file protects: the screen changes the moment the person
// acts; the request goes once per press (`callWrite`: retried with the press's own `requestId` only for a failure
// that may pass, so a repeat is the same write); a failure puts back what this write changed, and only that, and says
// in a sentence what happened and what to do; and once the server has answered, the keys it touched are fetched
// again, so the cache ends at the server's word. A write whose outcome only the server knows (lines it checks one by
// one, a take-back, a model's answer) is not written here: it shows its progress instead (CLAUDE.md, "Adding a
// feature").
import { type QueryKey, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Effect } from "effect"
import type { Call } from "@inventory/client/ApiRuntime"
import { toastError } from "@inventory/client/SayError"
import { rollback } from "@inventory/client/Rollback"

export { rollback } from "@inventory/client/Rollback"

/** How one write changes the cached entries under `key` before the server answers, and how that is taken back. */
export interface CacheChange<in Input> {
  readonly key: QueryKey
  /** The entry as it will be once the server agrees. */
  readonly apply: (data: unknown, input: Input) => unknown
  /** The entry as it is now with this write's change taken out, from the entry as it was before the write. */
  readonly undo: (now: unknown, before: unknown, input: Input) => unknown
}

/**
 * A `CacheChange` for entries of one type. `undo` takes out only what `apply` put in (one row, one value), so a
 * change another write made to the same entry meanwhile stays.
 */
export const cacheChange = <Data, Input>(spec: {
  readonly key: QueryKey
  readonly apply: (data: Data, input: Input) => Data
  readonly undo: (now: Data, before: Data, input: Input) => Data
}): CacheChange<Input> => spec as unknown as CacheChange<Input>

type Written = {
  readonly key: QueryKey
  readonly before: unknown
  readonly written: unknown
  readonly undo: (now: unknown, before: unknown) => unknown
}

/**
 * What one optimistic write is. `changes` says what the screen shows at once; `failed` is the sentence put before the
 * reason when the server refuses ("Your line was not recorded."); `retry` offers the person's own input again
 * instead of making them repeat it; `settled` names what else to fetch once the server has answered. `onRefused`
 * handles a refusal the screen says in its own place (it returns true, and no toast is shown). */
export interface OptimisticWrite<Client, Input, A, E> {
  /** The writes of one kind, so the cache is fetched again only when the last of them has answered. */
  readonly name: string
  readonly write: (client: Client, input: Input) => Effect.Effect<A, E>
  readonly changes: (input: Input) => ReadonlyArray<CacheChange<Input>>
  readonly failed: (input: Input) => string
  readonly retry?: (input: Input) => { readonly label: string; readonly onClick: () => void } | undefined
  readonly settled?: (input: Input) => ReadonlyArray<QueryKey>
  readonly onAnswer?: (answer: A, input: Input) => void
  readonly onRefused?: (error: unknown, input: Input) => boolean
}

/**
 * One optimistic write through a client's `callWrite`: the hook itself, for a screen that gets its client from
 * `useApi`. `makeOptimisticWrite` binds it to one `callWrite` once.
 */
export function useOptimisticWriteVia<Client, Input, A, E>(
  write: OptimisticWrite<Client, Input, A, E> & { readonly callWrite: Call<Client> }
) {
  const { callWrite, ...spec } = write
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [spec.name],
    mutationFn: (input: Input) => callWrite((client) => spec.write(client, input)),
    onMutate: (input): Promise<{ readonly written: ReadonlyArray<Written> }> => {
      const changes = spec.changes(input)
      // A list request already on its way would land on top of the change and undo it on screen: stop it first.
      return Promise.all(changes.map((change) => queryClient.cancelQueries({ queryKey: change.key }))).then(() => {
        const written: Array<Written> = []
        for (const change of changes) {
          for (const [key, before] of queryClient.getQueriesData({ queryKey: change.key })) {
            if (before === undefined) continue
            const after = change.apply(before, input)
            queryClient.setQueryData(key, after)
            written.push({ key, before, written: after, undo: (now, was) => change.undo(now, was, input) })
          }
        }
        return { written }
      })
    },
    onError: (error, input, context) => {
      for (const entry of context?.written ?? []) {
        const now = queryClient.getQueryData(entry.key)
        queryClient.setQueryData(entry.key, rollback({ ...entry, now }))
      }
      if (spec.onRefused?.(error, input) === true) return
      const retry = spec.retry?.(input)
      toastError(error, { lead: spec.failed(input), ...(retry === undefined ? {} : { action: retry }) })
    },
    onSuccess: (answer, input) => spec.onAnswer?.(answer, input),
    // Fetched again only once the last write of this kind has answered: a list fetched while another is still on its
    // way would show the server's state before that one, and the screen would jump back and forth.
    onSettled: (_answer, _error, input) => {
      if (queryClient.isMutating({ mutationKey: [spec.name] }) > 1) return
      const keys = [...spec.changes(input).map((change) => change.key), ...(spec.settled?.(input) ?? [])]
      for (const key of keys) void queryClient.invalidateQueries({ queryKey: key })
    }
  })
}

/** The hook bound to one client's `callWrite`: what an app with a single client exports as `useOptimisticWrite`. */
export const makeOptimisticWrite = <Client>(callWrite: Call<Client>) =>
  function useOptimisticWrite<Input, A, E>(spec: OptimisticWrite<Client, Input, A, E>) {
    return useOptimisticWriteVia({ ...spec, callWrite })
  }
