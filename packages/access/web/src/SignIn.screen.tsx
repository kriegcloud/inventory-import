import * as O from "effect/Option"
import * as SecureRandom from "effect/crypto/SecureRandom"
import { useMutation } from "@tanstack/react-query"
import { type FormEvent, useId, useState } from "react"
import { Button } from "@inventory/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@inventory/ui/components/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@inventory/ui/components/field"
import { Input } from "@inventory/ui/components/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@inventory/ui/components/item"
import { Spinner } from "@inventory/ui/components/spinner"
import type { SignInFeatures, TestAccount } from "@inventory/access-contract/SessionState"

// The sign-in page, drawn with the first paint (the app's sign-in gate says why). Better Auth's client is loaded
// only when a person reaches for the page or presses, so the first page of the app does not carry it.

/** Better Auth's browser client, fetched when it is first needed. Asking again returns the same module. */
const authClient = () => import("./internal/authClient.ts")

/** A slug the organization plugin requires: the name in lowercase words, plus a short suffix so two names can match. */
const slugFor = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "organization"
  }-${SecureRandom.uuidV4Unsafe().slice(0, 6)}`

const roleWord = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const

/** Where the account belongs, and as what: one line per organization ("Admin, Example Works (test)"). */
const membershipsOf = (account: TestAccount) =>
  account.memberships.map((membership) => `${roleWord[membership.role]}, ${membership.organizationName}`)

type Attempt =
  | { readonly mode: "sign-in"; readonly email: string; readonly password: string }
  | {
      readonly mode: "sign-up"
      readonly name: string
      readonly email: string
      readonly password: string
      readonly organization: string
    }

/** The first screen when nobody is signed in: the test accounts in one click, sign in, or create an account. */
export function SignIn(props: { features: SignInFeatures | undefined; onSignedIn: () => void }) {
  const id = useId()
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [organization, setOrganization] = useState("")
  const testAccounts = props.features === undefined ? null : O.getOrNull(props.features.testAccounts)
  // Until the features are known nothing is offered that may then be refused.
  const offer = props.features === undefined ? "closed" : props.features.signUp

  const submit = useMutation({
    mutationFn: (attempt: Attempt) =>
      authClient().then(({ authClient: client, orThrow }) => {
        if (attempt.mode === "sign-in") {
          return client.signIn.email({ email: attempt.email, password: attempt.password }).then((answer) => {
            orThrow(answer)
          })
        }
        return client.signUp
          .email({ name: attempt.name, email: attempt.email, password: attempt.password })
          .then((answer) => {
            orThrow(answer)
          })
          .then(() => client.organization.create({ name: attempt.organization, slug: slugFor(attempt.organization) }))
          .then((answer) => {
            orThrow(answer)
          })
      }),
    onSuccess: props.onSignedIn
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    submit.mutate(mode === "sign-in" ? { mode, email, password } : { mode, name, email, password, organization })
  }
  const signUp = mode === "sign-up"
  const pendingEmail = submit.isPending ? submit.variables.email : undefined

  return (
    <div
      className={`mx-auto grid w-full gap-6 ${testAccounts === null ? "max-w-sm" : "max-w-3xl md:grid-cols-2 md:items-start"}`}
      // Fetch Better Auth's client as soon as the person reaches for the page, so the press itself does not wait.
      onPointerEnter={() => void authClient()}
      onFocus={() => void authClient()}
    >
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold tracking-tight">{signUp ? "Create an account" : "Sign in"}</h1>
          </CardTitle>
          <CardDescription>
            {signUp
              ? offer === "invited"
                ? "For an email that has been invited. You will be the admin of a new organization."
                : "You will be the admin of a new organization."
              : offer === "closed"
                ? "Use your email and password. New accounts are added by the person who runs this app."
                : "Use your email and password."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <FieldGroup>
              {signUp && (
                <Field>
                  <FieldLabel htmlFor={`${id}-name`}>Your name</FieldLabel>
                  <Input
                    id={`${id}-name`}
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
                <Input
                  id={`${id}-email`}
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel>
                <Input
                  id={`${id}-password`}
                  type="password"
                  autoComplete={signUp ? "new-password" : "current-password"}
                  required
                  minLength={signUp ? 12 : undefined}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {signUp && (
                  <FieldDescription>
                    At least 12 characters.
                    {props.features?.pwnedPasswordCheck === true
                      ? " Checked against passwords from known data breaches; only the start of its hash leaves the app."
                      : ""}
                  </FieldDescription>
                )}
              </Field>
              {signUp && (
                <Field>
                  <FieldLabel htmlFor={`${id}-organization`}>Organization name</FieldLabel>
                  <Input
                    id={`${id}-organization`}
                    autoComplete="organization"
                    required
                    maxLength={100}
                    value={organization}
                    onChange={(event) => setOrganization(event.target.value)}
                  />
                </Field>
              )}
              {submit.error !== null && <FieldError>{submit.error.message}</FieldError>}
              <Field>
                <Button type="submit" disabled={submit.isPending}>
                  {submit.isPending && pendingEmail === email ? <Spinner /> : null}
                  {signUp ? "Create account" : "Sign in"}
                </Button>
                {/* Offered only where an account can be made: closed, the page is sign-in alone. */}
                {offer === "closed" ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      submit.reset()
                      setMode(signUp ? "sign-in" : "sign-up")
                    }}
                  >
                    {signUp ? "I already have an account" : "Create an account"}
                  </Button>
                )}
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {testAccounts !== null && (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Test accounts</h2>
            </CardTitle>
            <CardDescription>
              Each signs in with one click. Local only: their password is{" "}
              <code className="font-mono text-foreground">{testAccounts.password}</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {testAccounts.accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This database has none. <code className="font-mono">bun run dev</code> writes them into the local
                database.
              </p>
            ) : (
              <div role="list" className="flex flex-col gap-2">
                {testAccounts.accounts.map((account) => (
                  <Item key={account.email} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle>{account.name}</ItemTitle>
                      {membershipsOf(account).map((line) => (
                        <ItemDescription key={line}>{line}</ItemDescription>
                      ))}
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={submit.isPending}
                        onClick={() =>
                          submit.mutate({ mode: "sign-in", email: account.email, password: testAccounts.password })
                        }
                      >
                        {pendingEmail === account.email ? <Spinner /> : null}
                        Sign in<span className="sr-only"> as {account.name}</span>
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

/** Signed in, but in no organization yet (an account whose organization was not created): create one. */
export function CreateOrganization(props: { onCreated: () => void; onSignOut: () => void }) {
  const id = useId()
  const [name, setName] = useState("")
  const create = useMutation({
    mutationFn: () =>
      authClient().then(({ authClient: client, orThrow }) =>
        client.organization.create({ name, slug: slugFor(name) }).then((answer) => {
          orThrow(answer)
        })
      ),
    onSuccess: props.onCreated
  })
  return (
    <Card className="mx-auto w-full max-w-sm">
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold tracking-tight">Create your organization</h1>
        </CardTitle>
        <CardDescription>You will be its admin. Everything you add belongs to it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-organization`}>Organization name</FieldLabel>
              <Input
                id={`${id}-organization`}
                autoComplete="organization"
                required
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            {create.error !== null && <FieldError>{create.error.message}</FieldError>}
            <Field>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Spinner />}
                Create organization
              </Button>
              <Button type="button" variant="ghost" onClick={props.onSignOut}>
                Sign out
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  )
}
