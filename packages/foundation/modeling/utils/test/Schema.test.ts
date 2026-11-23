// Vendored from beep-effect c5cebd5c9de7:packages/foundation/modeling/utils/test/Schema.test.ts (MIT, see LICENSE). Patched on purpose: the patch and its reason are in vendor.json (patches) and in the patches bun run beep vendor sync applies (sourcePatches). Do not edit: bun run beep vendor check compares the rest of this file with its recorded hash.
import { it } from "@effect/vitest";
import { compileAssertion } from "@beep/utils/Schema";
import { describe, expect } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as Str from "effect/String";

const assertString: <I>(input: I) => asserts input is I & string = compileAssertion(S.String);

const DefectSchema = S.declareConstructor<string>()([], () => () => Effect.die(new Error("assert defect")));
const assertDefect: <I>(input: I) => asserts input is I & string = compileAssertion(DefectSchema);

const captureError = (assertion: () => void): Error => {
  const thrown = Result.try({
    try: assertion,
    catch: (error) => (error instanceof Error ? O.some(error) : O.none()),
  });
  if (Result.isFailure(thrown) && O.isSome(thrown.failure)) return thrown.failure.value;
  throw new Error("Expected assertion to throw an Error");
};

describe("compileAssertion", () => {
  it("returns normally and narrows valid input", () => {
    const input: unknown = "beep";
    assertString(input);
    expect(Str.toUpperCase(input)).toBe("BEEP");
  });

  it("preserves the Schema.asserts validation error contract", () => {
    const error = captureError(() => assertString(1));

    expect(error.message).toBe("Schema validation failed");
    expect(SchemaIssue.isIssue(error.cause)).toBe(true);
  });

  it("preserves the Schema.asserts non-schema cause contract", () => {
    const error = captureError(() => assertDefect("beep"));

    expect(error.message).toBe("Assertion adapter can only throw schema issues");
    expect(Cause.isCause(error.cause) && Cause.hasDies(error.cause)).toBe(true);
  });
});
