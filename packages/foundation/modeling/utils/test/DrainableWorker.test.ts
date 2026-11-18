// Vendored from beep-effect c5cebd5c9de7:packages/foundation/modeling/utils/test/DrainableWorker.test.ts (MIT, see LICENSE). Do not edit: scripts/vendor-check.mjs compares the rest of this file with its recorded hash.
import { it } from "@effect/vitest";
import { makeDrainableWorker } from "@beep/utils/DrainableWorker";
import { describe, expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";

describe("makeDrainableWorker", () => {
  it.effect("waits for work enqueued during active processing before draining", () =>
    Effect.gen(function* () {
      const processed: string[] = [];
      const firstStarted = yield* Deferred.make<void>();
      const releaseFirst = yield* Deferred.make<void>();
      const secondStarted = yield* Deferred.make<void>();
      const releaseSecond = yield* Deferred.make<void>();

      const worker = yield* makeDrainableWorker((item: string) =>
        Effect.gen(function* () {
          if (item === "first") {
            yield* Deferred.succeed(firstStarted, undefined).pipe(Effect.orDie);
            yield* Deferred.await(releaseFirst);
          }

          if (item === "second") {
            yield* Deferred.succeed(secondStarted, undefined).pipe(Effect.orDie);
            yield* Deferred.await(releaseSecond);
          }

          processed.push(item);
        })
      );

      yield* worker.enqueue("first");
      yield* Deferred.await(firstStarted);

      const drained = yield* Deferred.make<void>();
      yield* Effect.forkChild(
        worker.drain.pipe(Effect.tap(() => Deferred.succeed(drained, undefined).pipe(Effect.orDie)))
      );

      yield* worker.enqueue("second");
      yield* Deferred.succeed(releaseFirst, undefined);
      yield* Deferred.await(secondStarted);

      const isDone1 = yield* Deferred.isDone(drained);
      expect(isDone1).toBe(false);

      yield* Deferred.succeed(releaseSecond, undefined);
      yield* Deferred.await(drained);

      expect(processed).toEqual(["first", "second"]);
    })
  );
});
