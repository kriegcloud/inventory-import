// Writes scripts/dev-accounts.sql: sign-in accounts for the seeded people, for local development only.
//   bun scripts/dev-accounts.mjs > scripts/dev-accounts.sql
// `bun run dev` (scripts/migrate-local.mjs) applies that file to the local database after the migrations. It is not a
// migration, so a deployed database never gets these accounts. Passwords are hashed with Better Auth's own
// hashPassword (scrypt), so the rows are what its sign-up would have written. The accounts and their password are
// defined once, in @inventory/access-host (internal/TestAccounts.ts), which the sign-in page's list is read through as well.
import { hashPassword } from "better-auth/crypto"
import { seededAccounts, testAccountPassword } from "../../../packages/access/host/src/internal/TestAccounts.ts"

const at = "2026-11-13T00:00:00.000Z"
const q = (value) => `'${String(value).replaceAll("'", "''")}'`
const lines = [
  "-- Local test accounts, written by scripts/dev-accounts.mjs. Applied by scripts/migrate-local.mjs, never deployed.",
  `-- Every account's password is ${q(testAccountPassword)}. Re-running it changes nothing (INSERT OR IGNORE, guarded UPDATE).`
]
for (const account of seededAccounts) {
  const hash = await hashPassword(testAccountPassword)
  lines.push(
    `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, image, createdAt, updatedAt) VALUES (${q(account.userId)}, ${q(account.name)}, ${q(account.email)}, 1, NULL, ${q(at)}, ${q(at)});`,
    `INSERT OR IGNORE INTO account (id, accountId, providerId, userId, password, createdAt, updatedAt) VALUES (${q(`acc_${account.userId.slice(4)}`)}, ${q(account.userId)}, 'credential', ${q(account.userId)}, ${q(hash)}, ${q(at)}, ${q(at)});`
  )
  for (const membership of account.memberships) {
    if (membership.role === null) {
      // One of the people 0001 seeded: link the existing member row to the account.
      lines.push(
        `UPDATE member SET userId = ${q(account.userId)} WHERE id = ${q(membership.memberId)} AND userId IS NULL;`
      )
    } else {
      // A second organization for the same person, joined after the first, so a new session still opens in the first.
      lines.push(
        `INSERT OR IGNORE INTO member (id, organizationId, name, role, userId, createdAt) VALUES (${q(membership.memberId)}, ${q(membership.organizationId)}, ${q(account.name)}, ${q(membership.role)}, ${q(account.userId)}, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));`
      )
    }
  }
}
console.log(lines.join("\n"))
