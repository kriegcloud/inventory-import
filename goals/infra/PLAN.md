---
type: Plan
title: "Infra, plan"
description: The steps of the infra goal, their status, the choices made, what was proved without a cloud, what waits for the first apply, and what Benjamin does by hand.
from: explorations/ideal-architecture
---

# Plan

[SPEC](SPEC.md) holds the objective and acceptance. Status is one of `todo`, `doing`, `done`. The steps are the
brief's "Order of moves" up to the first one that touches anything outside this machine, with closed sign-up (I8)
as a step of its own.

| # | Step | Status |
| --- | --- | --- |
| 1 | The seed rows out of the migration into `seeds/`; the local script and the tests apply them | done |
| 2 | Sign-up closed, with a first-admin path (I8) | done |
| 3 | `packages/infra`: the stage schema, `planFor` and its test | doing |
| 4 | Alchemy at one exact version; the two stacks; `deploy.yml`, not merged to `main` | todo |
| 5 | Browser pass, the documents the moves made false, and the hand-over list | todo |

**Not done by this goal, and Benjamin's:** step 5 of the brief (his Cloudflare login and `alchemy state bootstrap`)
and everything after it.

## Current blocker

None.

## Choices made

Where the brief left a choice open, or the code showed the brief could not be followed as written.

- **The seeds are idempotent** (`INSERT OR IGNORE`), since the local script applies them on every start. A local
  database made before this goal already holds the rows from the old migration and needs no reset.
- **Closed sign-up is a setting with a list, `SIGN_UP`** (I8: "Close sign-up; I add accounts"). The brief left the
  first-admin path to be designed. `SIGN_UP` is `open`, `closed`, or the emails that may make an account; it is
  closed by default in a production build and open in development, so `bun run dev` and the tests are as before. The
  refusal is where Better Auth creates a user, so no route makes an account the setting does not allow. Benjamin
  makes the first admin of an organization by naming that person's email in `SIGN_UP` for the stage; they sign up on
  the page and create their organization, as sign-up always worked. Adding a later person means adding their email
  and deploying again, then the People page's "add by email". Rejected while building: a first-run rule (the first
  account ever made is allowed), because whoever reaches a new deployment first would own it; and a secret invite
  code, because it is one more secret to keep. That choice, and the two new sentences on the sign-in page, are his
  to change.

## Seen in the browser: sign-up

Port 5200, fresh database. The dev server was restarted with `SIGN_UP` (and `TEST_ACCOUNTS=false`) appended to
`.dev.vars` by the project's own override recipe, which was put back afterwards; the file was never read.

- **Development, no setting**: opened `/` with no cookie; the Upload step showed, signed in as "Dana Whitfield
  dana@example-works.test", "Example Works (test) · Admin". The user menu listed "Sign in as a test account" with
  Marcus, Priya, Elena and Tom. Signed out: the sign-in page showed "Create an account" and the five test accounts.
- **`SIGN_UP=closed`**: the page read "Sign in", "Use your email and password. New accounts are added by the person
  who runs this app.", Email, Password, "Sign in", and no "Create an account". A sign-up posted from that page
  anyway answered 403 with "New accounts are not open here. Ask the person who runs this app to add your email, then
  try again." Typed that email and password into Sign in: "Invalid email or password", so no account was made.
- **`SIGN_UP=owner@example.test`**: pressed "Create an account"; it read "For an email that has been invited. You
  will be the admin of a new organization." Typed Sam Stranger, stranger@example.test, a password, Stranger Co and
  pressed "Create account": the form read "New accounts are not open here. Ask the person who runs this app to add
  your email, then try again." Typed Olive Owner, Owner@Example.test (other capitals), Owner Works: the app opened,
  signed in as "Olive Owner owner@example.test", "Owner Works · Admin"; the People page listed one person, "Olive
  Owner (you) owner@example.test", with Admin chosen.

Not seen: a production build in the browser (the tests run one: `SignUp.slow.test.ts`), phone width and the dark
theme for these two sentences, and a second named person joining an existing organization.
