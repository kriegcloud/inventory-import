// LOCAL TEST ACCOUNTS. Five real accounts in the two seeded organizations, all three roles, and one person in both,
// so nobody who runs the app has to sign up to see it. `bun run dev` writes them into the local database
// (scripts/migrate-local.mjs applies scripts/dev-accounts.sql, which scripts/dev-accounts.mjs writes from the list
// below), and the sign-in page offers them in one click while TEST_ACCOUNTS is on (development; off in a production
// build). They are ordinary Better Auth accounts with a scrypt password hash: nothing about signing in as one differs
// from signing in as anyone else.
//
// The one thing not to break: the page offers only the accounts the database holds (`Members.testAccounts`), so a
// database that was never seeded (a deployed one) offers none, whatever the setting says.

/** The one password of every test account. Written in README.md; it opens nothing outside a local database. */
export const testAccountPassword = "local-test-password"

/** One membership of a test account: `role` null for a member 0001_init.sql seeded, linked to the account. */
type SeededMembership = {
  readonly memberId: string
  readonly organizationId: string
  readonly role: "admin" | "editor" | "viewer" | null
}

/** The seeded people: user id, name, email and memberships, in the order the sign-in page lists them. */
export const seededAccounts: ReadonlyArray<{
  readonly userId: string
  readonly name: string
  readonly email: string
  readonly memberships: ReadonlyArray<SeededMembership>
}> = [
  {
    userId: "usr_dana",
    name: "Dana Whitfield",
    email: "dana@example-works.test",
    memberships: [
      { memberId: "mem_dana", organizationId: "org_prairie", role: null },
      { memberId: "mem_dana_northline", organizationId: "org_northline", role: "viewer" }
    ]
  },
  {
    userId: "usr_marcus",
    name: "Marcus Oyelaran",
    email: "marcus@example-works.test",
    memberships: [{ memberId: "mem_marcus", organizationId: "org_prairie", role: null }]
  },
  {
    userId: "usr_priya",
    name: "Priya Raman",
    email: "priya@example-works.test",
    memberships: [{ memberId: "mem_priya", organizationId: "org_prairie", role: null }]
  },
  {
    userId: "usr_elena",
    name: "Elena Sokolova",
    email: "elena@sample-supply.test",
    memberships: [{ memberId: "mem_elena", organizationId: "org_northline", role: null }]
  },
  {
    userId: "usr_tom",
    name: "Tom Becker",
    email: "tom@sample-supply.test",
    memberships: [{ memberId: "mem_tom", organizationId: "org_northline", role: null }]
  }
]
