import { defineConfig } from "vitest/config"
import { limits } from "../../../../vitest.shared.ts"

// Every test starts with no `LEDGER_BASE`: CI names one for the laws it runs on the real tree, and a test's own
// repository does not hold that commit, so the laws would refuse it there. "" reads as unset (`internal/ledger.ts`),
// and a test that names a base stubs its own; `vi.unstubAllEnvs()` puts back this "", not the shell's value.
export default defineConfig({ test: { include: ["test/**/*.test.ts"], env: { LEDGER_BASE: "" }, ...limits } })
