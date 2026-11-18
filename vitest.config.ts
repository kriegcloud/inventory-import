import { configDefaults, defineConfig } from "vitest/config"

// Unit tests run in Node, without the Cloudflare plugin: they cover the domain and
// services through their Effect interfaces. The running app is checked in workerd by `bun run dev`.
// Two projects. "fast" is what the loop check runs (`bun run check`). "slow" holds the files named `*.slow.test.ts`:
// tests that start workerd, sign in or use a real database. `bun run check:full` and
// `bun run test` run both.
const slow = ["test/**/*.slow.test.ts"]

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: { name: "fast", include: ["test/**/*.test.ts"], exclude: [...configDefaults.exclude, ...slow] }
      },
      // Each slow test may take 30 s: sign-in hashes passwords, and a busy machine slows workerd down.
      { extends: true, test: { name: "slow", include: slow, testTimeout: 30_000 } }
    ]
  }
})
