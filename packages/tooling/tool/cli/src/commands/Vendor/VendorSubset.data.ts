/**
 * What is vendored from beep-effect's kit, as data: the four packages, the modules the format packages import (the
 * subset is their import closure, computed, never hand-listed), the tests copied with each package, the import
 * rewrites applied to those tests, and the deliberate patches to source files.
 *
 * @packageDocumentation
 */

/** One kit package: its name, and its folder, the same upstream and here. */
export interface KitPackage {
  readonly name: string
  readonly dir: string
}

/** The four packages, where they live upstream and here (the same path). */
export const packages: ReadonlyArray<KitPackage> = [
  { name: "@beep/types", dir: "packages/foundation/primitive/types" },
  { name: "@beep/identity", dir: "packages/foundation/modeling/identity" },
  { name: "@beep/schema", dir: "packages/foundation/modeling/schema" },
  { name: "@beep/utils", dir: "packages/foundation/modeling/utils" }
]

/** What the format packages import. Everything these reach is vendored, nothing else. */
export const entries: ReadonlyArray<string> = [
  "@beep/identity/packages",
  "@beep/schema/LiteralKit",
  "@beep/schema/SchemaUtils/index",
  "@beep/schema/SchemaUtils/defectDiagnostics",
  "@beep/schema/SchemaUtils/optionalDefect",
  "@beep/utils/Schema"
]

/** Upstream tests copied with their package, per package, by file name under `test/`. */
export const tests: Readonly<Record<string, ReadonlyArray<string>>> = {
  "@beep/types": ["TString.test.ts"],
  "@beep/identity": [
    "AnnoteError.test.ts",
    "Curie.test.ts",
    "Fibered.test.ts",
    "Identity.test.ts",
    "IdentityRegistry.test.ts",
    "IriBinding.test.ts",
    "OntologyEntrypoints.test.ts",
    "PnLocal.test.ts",
    "SchemaStatics.test.ts",
    "TaggedError.equivalence.test.ts",
    "TemplateGuards.test.ts",
    "Vocab.test.ts",
    "shape-stable.test.ts"
  ],
  "@beep/schema": [
    "LiteralKit.test.ts",
    "collectAnnotationsAt.test.ts",
    "withKeyDefaults.test.ts",
    "SchemaUtils/defectDiagnostics.test.ts",
    "SchemaUtils/optionalDefect.test.ts"
  ],
  "@beep/utils": [
    "Array.test.ts",
    "DrainableWorker.test.ts",
    "Errors.test.ts",
    "FileSystem.test.ts",
    "FormatHelpers.test.ts",
    "HostProcess.test.ts",
    "Number.test.ts",
    "Option.test.ts",
    "Path.test.ts",
    "Predicate.test.ts",
    "Schema.test.ts",
    "SchemaParity.test.ts",
    "Str.test.ts",
    "Struct.test.ts",
    "TaggedError.equivalence.test.ts"
  ]
}

/**
 * Import rewrites applied to copied tests only. beep-effect's instrumented runner (`@beep/test-runner`) and run-count
 * helper (`@beep/fc-runs`) are not vendored: the runner's `it` is a drop-in for `@effect/vitest`'s, and the run count
 * comes from `test/support/fcRuns.ts`. Internal modules are imported by relative path, never through an export.
 * Each entry: the specifier, and what replaces it: a fixed specifier, or a file of the package the test reaches by
 * relative path.
 */
export const testRewrites: ReadonlyArray<{
  readonly specifier: string
  readonly to: { readonly specifier: string } | { readonly file: string }
}> = [
  { specifier: "@beep/test-runner", to: { specifier: "@effect/vitest" } },
  { specifier: "@beep/fc-runs/FastCheckRuns", to: { file: "test/support/fcRuns.ts" } },
  { specifier: "@beep/fc-runs", to: { file: "test/support/fcRuns.ts" } },
  { specifier: "@beep/identity/internal/schemaStatics", to: { file: "src/internal/schemaStatics.ts" } },
  {
    specifier: "@beep/schema/SchemaUtils/internal/staticDescriptors",
    to: { file: "src/SchemaUtils/internal/staticDescriptors.ts" }
  }
]

// The patches hold import statements as text. The keyword is kept apart so that the rules which read this
// repository's own imports (laws boundaries, laws effect-imports) do not take the text for an import of this file.
const statement = "import"
// And `try` statements, which this repository bans: kept apart for the same reason, so the text is not taken for one.
const keyword = "try"

/**
 * Deliberate, minimal patches to vendored source and test files (a test's after its import rewrites), each with the
 * reason it exists and what would make it unnecessary upstream. A patch replaces exact text; a refresh fails when the text is gone, so a patch that upstream
 * has made unnecessary is noticed and removed. The import closure (which files are vendored) is computed from the
 * unpatched upstream files, so a patch never changes the vendored subset.
 */
export const sourcePatches: ReadonlyArray<{
  readonly pkg: string
  readonly file: string
  readonly from: string
  readonly to: string
  readonly reason: string
}> = [
  {
    pkg: "@beep/schema",
    file: "src/LiteralKit/LiteralKit.schema.ts",
    from: `${statement} { A } from "@beep/utils";`,
    to: `${statement} * as A from "@beep/utils/Array";`,
    reason:
      "The @beep/utils root re-exports modules that name Node types (FileSystem, Path, NodeUrl), and Node's URL type clashes with the Workers one, so a Worker that imports LiteralKit failed to type-check. The subpath holds the same module. Unnecessary once beep-effect's LiteralKit imports @beep/utils/Array itself."
  },
  {
    pkg: "@beep/schema",
    file: "src/LiteralKit/internal/builders.ts",
    from: `${statement} { A, R } from "@beep/utils";`,
    to: `${statement} * as A from "@beep/utils/Array";\n${statement} * as R from "@beep/utils/Record";`,
    reason:
      "As LiteralKit.schema.ts: the @beep/utils root brings Node types into a Worker's type-check. Unnecessary once beep-effect's builders.ts imports @beep/utils/Array and @beep/utils/Record itself."
  },
  {
    pkg: "@beep/identity",
    file: "src/Id.ts",
    from: ` * ${statement} { make, IdentityInterpolationError } from "@beep/identity/Id"
 *
 * const { $MyPkgId } = make("my-pkg")
 *
 * ${keyword} {
 *   $MyPkgId\`User\${"Name"}\`
 * } catch (error) {
 *   console.log(error instanceof IdentityInterpolationError)
 * }`,
    to: ` * ${statement} * as Result from "effect/Result"
 * ${statement} { make, IdentityInterpolationError } from "@beep/identity/Id"
 *
 * const { $MyPkgId } = make("my-pkg")
 *
 * const refused = Result.try({
 *   try: () => $MyPkgId\`User\${"Name"}\`,
 *   catch: (error) => error instanceof IdentityInterpolationError
 * })
 * console.log(Result.isFailure(refused) && refused.failure) // true`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. The example reads the refusal with Result.try. Unnecessary once beep-effect's example does."
  },
  {
    pkg: "@beep/utils",
    file: "src/Number.ts",
    from: ` * ${statement} { makeCapAssertion } from "@beep/utils/Number"
 *
 * const assertCap = makeCapAssertion("@beep/example", (message) => new Error(message))
 *
 * console.log(assertCap("maxDepth", 256)) // 256
 * console.log(assertCap(64)("maxDepth")) // 64
 * ${keyword} {
 *   assertCap("maxDepth", 0)
 * } catch (error) {
 *   console.log(String(error)) // Error: @beep/example internal cap maxDepth must be a positive integer, received 0
 * }`,
    to: ` * ${statement} * as Result from "effect/Result"
 * ${statement} { makeCapAssertion } from "@beep/utils/Number"
 *
 * const assertCap = makeCapAssertion("@beep/example", (message) => new Error(message))
 *
 * console.log(assertCap("maxDepth", 256)) // 256
 * console.log(assertCap(64)("maxDepth")) // 64
 * const refused = Result.try({ try: () => assertCap("maxDepth", 0), catch: String })
 * if (Result.isFailure(refused)) {
 *   console.log(refused.failure) // Error: @beep/example internal cap maxDepth must be a positive integer, received 0
 * }`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. The example reads the refusal with Result.try. Unnecessary once beep-effect's example does."
  },
  {
    pkg: "@beep/utils",
    file: "src/Utils.ts",
    from: `${statement} * as GlobalValue from "./GlobalValue.ts";`,
    to: `${statement} * as Result from "effect/Result";
${statement} * as GlobalValue from "./GlobalValue.ts";`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. Result, for structuralRegion's patch below. Unnecessary once beep-effect's Utils.ts imports it itself."
  },
  {
    pkg: "@beep/utils",
    file: "src/Utils.ts",
    from: `  ${keyword} {
    return body();
  } finally {
    structuralRegionState.enabled = current;
    structuralRegionState.tester = currentTester;
  }
};`,
    to: `  // The region ends whether \`body\` returns or throws; what it threw is thrown on unchanged.
  const outcome = Result.try({ try: body, catch: (thrown) => ({ thrown }) });
  structuralRegionState.enabled = current;
  structuralRegionState.tester = currentTester;
  return Result.getOrThrowWith(outcome, ({ thrown }) => thrown);
};`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. structuralRegion restores the region with Result.try where upstream has try and finally; the body's answer, and what it throws, are the same. Unnecessary once beep-effect's structuralRegion does."
  },
  {
    pkg: "@beep/utils",
    file: "test/FileSystem.test.ts",
    from: `      ${keyword} {
        expect((yield* FileSystem.statSync("socket")).type).toBe("Socket");
      } finally {
        stat.mockRestore();
        socket.mockRestore();
        directory.mockRestore();
      }`,
    to: `      const found = yield* FileSystem.statSync("socket").pipe(
        Effect.ensuring(
          Effect.sync(() => {
            stat.mockRestore();
            socket.mockRestore();
            directory.mockRestore();
          })
        )
      );
      expect(found.type).toBe("Socket");`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. The spies are restored with Effect.ensuring where upstream has try and finally. Unnecessary once beep-effect's test does."
  },
  {
    pkg: "@beep/utils",
    file: "test/FileSystem.test.ts",
    from: `      ${keyword} {
        const error = yield* Effect.flip(FileSystem.statSync("unavailable.txt"));
        expect(error.reason._tag).toBe("Unknown");
        expect(error.reason.method).toBe("statSync");
        expect(error.reason.cause).toBe(cause);
      } finally {
        stat.mockRestore();
      }`,
    to: `      const error = yield* Effect.flip(FileSystem.statSync("unavailable.txt")).pipe(
        Effect.ensuring(Effect.sync(() => stat.mockRestore()))
      );
      expect(error.reason._tag).toBe("Unknown");
      expect(error.reason.method).toBe("statSync");
      expect(error.reason.cause).toBe(cause);`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. As the patch above. Unnecessary once beep-effect's test does."
  },
  {
    pkg: "@beep/utils",
    file: "test/Schema.test.ts",
    from: `${statement} * as Effect from "effect/Effect";
`,
    to: `${statement} * as Effect from "effect/Effect";
${statement} * as O from "effect/Option";
${statement} * as Result from "effect/Result";
`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. Option and Result, for captureError's patch below. Unnecessary once beep-effect's test imports them."
  },
  {
    pkg: "@beep/utils",
    file: "test/Schema.test.ts",
    from: `const captureError = (assertion: () => void): Error => {
  ${keyword} {
    assertion();
  } catch (error) {
    if (error instanceof Error) return error;
  }
  throw new Error("Expected assertion to throw an Error");
};`,
    to: `const captureError = (assertion: () => void): Error => {
  const thrown = Result.try({
    try: assertion,
    catch: (error) => (error instanceof Error ? O.some(error) : O.none()),
  });
  if (Result.isFailure(thrown) && O.isSome(thrown.failure)) return thrown.failure.value;
  throw new Error("Expected assertion to throw an Error");
};`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. captureError reads the throw with Result.try where upstream has a try statement. Unnecessary once beep-effect's test does."
  },
  {
    pkg: "@beep/utils",
    file: "test/TaggedError.equivalence.test.ts",
    from: `      ${keyword} {
        const fileSystemFirst = yield* captureEffectDefect(FileSystem.existsSync("missing"));
        const fileSystemSecond = yield* captureEffectDefect(FileSystem.existsSync("missing"));
        const pathFirst = capture(() => Path.join("one", "two"));
        const pathSecond = capture(() => Path.join("one", "two"));
        const urlFirst = capture(() => NodeUrl.fileURLToPath("file:///tmp/one"));
        const urlSecond = capture(() => NodeUrl.fileURLToPath("file:///tmp/one"));

        expectPrivateEquivalence(fileSystemFirst, fileSystemSecond, pathFirst);
        expectPrivateEquivalence(pathFirst, pathSecond, urlFirst);
        expectPrivateEquivalence(urlFirst, urlSecond, fileSystemFirst);
      } finally {
        if (P.isNotUndefined(descriptor)) {
          Reflect.defineProperty(globalThis.process, "getBuiltinModule", descriptor);
        }
      }`,
    to: `      yield* Effect.gen(function* () {
        const fileSystemFirst = yield* captureEffectDefect(FileSystem.existsSync("missing"));
        const fileSystemSecond = yield* captureEffectDefect(FileSystem.existsSync("missing"));
        const pathFirst = capture(() => Path.join("one", "two"));
        const pathSecond = capture(() => Path.join("one", "two"));
        const urlFirst = capture(() => NodeUrl.fileURLToPath("file:///tmp/one"));
        const urlSecond = capture(() => NodeUrl.fileURLToPath("file:///tmp/one"));

        expectPrivateEquivalence(fileSystemFirst, fileSystemSecond, pathFirst);
        expectPrivateEquivalence(pathFirst, pathSecond, urlFirst);
        expectPrivateEquivalence(urlFirst, urlSecond, fileSystemFirst);
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            if (P.isNotUndefined(descriptor)) {
              Reflect.defineProperty(globalThis.process, "getBuiltinModule", descriptor);
            }
          })
        )
      );`,
    reason:
      "This repository bans the `try` statement (Benjamin, 2026-11-22: failures are Effects or effect/Result), the vendored kit included. The process is restored with Effect.ensuring where upstream has try and finally. Unnecessary once beep-effect's test does."
  }
]

/** Packages outside the kit the closure may reach. */
export const allowedOutside: ReadonlyArray<string> = ["type-fest"]

/** Stands in for beep-effect's run-count helper in the vendored tests. */
export const fcRuns = `// Stands in for beep-effect's @beep/fc-runs in the vendored tests: a fixed property-test run count.
import type * as Arbitrary from "effect/Arbitrary"

export const DEFAULT_FC_NUM_RUNS = 100

export const fcRuns = (inline?: number): Arbitrary.CheckOptions & { readonly runs: number } => ({
  runs: inline ?? DEFAULT_FC_NUM_RUNS
})
`
