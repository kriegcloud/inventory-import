// Vendored from beep-effect c5cebd5c9de7:packages/foundation/modeling/utils/test/SchemaParity.test.ts (MIT, see LICENSE). Do not edit: bun run beep vendor check compares the rest of this file with its recorded hash.
import { fcRuns } from "./support/fcRuns.ts";
import { it } from "@effect/vitest";
import { AppendFileSyncOptions, ReaddirSyncOptions, RmSyncOptions } from "@beep/utils/FileSystem";
import { PathInput } from "@beep/utils/Struct";
import { describe, expect } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const encode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): C["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Encoded"]): C["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <C extends S.Codec<unknown, unknown>>(schema: C, value: C["Type"]): void => {
  const decoded = decode(schema, encode(schema, value));

  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("@beep/utils schema parity", () => {
  it("preserves representative encoded option and path shapes", () => {
    expect(
      encode(
        AppendFileSyncOptions,
        AppendFileSyncOptions.make({
          encoding: "utf8",
          flag: "a",
          mode: 0,
        })
      )
    ).toEqual({
      encoding: "utf8",
      flag: "a",
      mode: 0,
    });
    expect(encode(RmSyncOptions, RmSyncOptions.make({ force: true, recursive: false }))).toEqual({
      force: true,
      recursive: false,
    });
    expect(encode(ReaddirSyncOptions, ReaddirSyncOptions.make({ withFileTypes: true }))).toEqual({
      withFileTypes: true,
    });
    expect(encode(PathInput, "profile.name")).toBe("profile.name");
    expect(encode(PathInput, ["profile", "name"])).toEqual(["profile", "name"]);
  });

  it.prop(
    "round-trips AppendFileSyncOptions",
    { value: AppendFileSyncOptions },
    ({ value }) => {
      expectRoundTrip(AppendFileSyncOptions, AppendFileSyncOptions.make(value));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips RmSyncOptions",
    { value: RmSyncOptions },
    ({ value }) => {
      expectRoundTrip(RmSyncOptions, RmSyncOptions.make(value));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips ReaddirSyncOptions",
    { value: ReaddirSyncOptions },
    ({ value }) => {
      expectRoundTrip(ReaddirSyncOptions, ReaddirSyncOptions.make(value));
    },
    { arbitrary: fcRuns(50) }
  );

  it.prop(
    "round-trips PathInput",
    { value: PathInput },
    ({ value }) => {
      expectRoundTrip(PathInput, value);
    },
    { arbitrary: fcRuns(50) }
  );
});
