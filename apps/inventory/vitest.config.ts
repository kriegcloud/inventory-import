import { fileURLToPath } from "node:url"
import { configDefaults, defineConfig } from "vitest/config"
import { limits, realTime, saidAloud, slowLimits } from "../../vitest.shared.ts"

// Unit tests run in Node, without the Cloudflare plugin: they cover the domain and
// services through their Effect interfaces. The running app is checked in workerd by `bun run dev`.
// Three projects. "fast" is what the loop check runs (`bun run check`). "slow" holds the files named `*.slow.test.ts`:
// tests that start workerd, sign in or use a real database; turbo replays them until the app or a package it
// imports changes. "live" holds the files named `*.live.test.ts`: a test that calls a real service on the network,
// whose answer no file of the repository decides, so turbo never replays it (`test:live`). `bun run check:full`
// and `bun run test` run all three.
const slow = ["test/**/*.slow.test.ts"]
const live = ["test/**/*.live.test.ts"]

export default defineConfig({
  // The app's own address of its web code, as vite.config.ts has it.
  resolve: { alias: { "@": fileURLToPath(new URL("./src/web", import.meta.url)) } },
  test: {
    environment: "node",
    // The fast project tries tests that wait in real time again (`realTime`); this names each one that needed it.
    ...saidAloud,
    // Where vitest keeps what it knows of the lockfile, which no project sets: the app's own folder, not the
    // repository's (../../vitest.shared.ts says why).
    fsModuleCachePath: "node_modules/.vitest-cache",
    projects: [
      {
        extends: true,
        test: {
          name: "fast",
          include: ["test/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...slow, ...live],
          ...limits,
          ...realTime
        }
      },
      // The slow tests' own limits: sign-in hashes passwords, a busy machine slows workerd down, and a save of
      // 50,000 rows took 34 s on two cores (../../vitest.shared.ts).
      { extends: true, test: { name: "slow", include: slow, ...slowLimits } },
      // The slow limits, with a module cache of its own: turbo starts `test:slow` and `test:live` side by side, and
      // each would empty the other's folder (../../vitest.shared.ts says why).
      {
        extends: true,
        test: { name: "live", include: live, ...slowLimits, fsModuleCachePath: "node_modules/.vitest-cache/live" }
      }
    ]
  }
})
