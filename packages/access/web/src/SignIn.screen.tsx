import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { identity } from "effect/Function"
import * as O from "effect/Option"
import * as S from "effect/Schema"
import * as SchemaTransformation from "effect/SchemaTransformation"
import * as SecureRandom from "effect/crypto/SecureRandom"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import { type SubmitEvent, useId } from "react"
import { Button } from "@inventory/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@inventory/ui/components/card"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@inventory/ui/components/field"
import { Input } from "@inventory/ui/components/input"
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@inventory/ui/components/item"
import { Spinner } from "@inventory/ui/components/spinner"
import type { SignInFeatures, TestAccount } from "@inventory/access-contract/SessionState"
import { $AccessWebId } from "./internal/identity.ts"

const $I = $AccessWebId.create("SignIn")

// The sign-in page, drawn with the first paint (the app's sign-in gate says why). Better Auth's client is loaded
// only when a person reaches for the page or presses, so the first page of the app does not carry it.

/** Better Auth's browser client, fetched when it is first needed. Asking again returns the same module. */
const authClient = () => import("./internal/authClient.ts")

/**
 * The words of an organization's slug, read from its name: lowercase letters and digits joined by hyphens, forty
 * characters at most. A name with no letter or digit reads as "organization", so the plugin always gets a slug.
 */
const OrganizationSlugStem = S.String.pipe(
  S.decode(SchemaTransformation.toLowerCase()),
  S.decodeTo(
    S.String,
    SchemaTransformation.transform({
      decode: (name) => {
        const stem = name
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40)
        return stem === "" ? "organization" : stem
      },
      encode: identity
    })
  )
).annotate({ description: "The words of an organization's slug, read from the name the person typed." })

/** A slug the organization plugin requires: the name's words, plus a short suffix so two names can match. */
const slugFor = (name: string) =>
  S.decodeEffect(OrganizationSlugStem)(name).pipe(
    Effect.orDie,
    Effect.map((stem) => `${stem}-${SecureRandom.uuidV4Unsafe().slice(0, 6)}`)
  )

const roleWord = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const

/** Where the account belongs, and as what: one line per organization ("Admin, Example Works (test)"). */
const membershipsOf = (account: TestAccount) =>
  A.map(account.memberships, (membership) => `${roleWord[membership.role]}, ${membership.organizationName}`)

/** What the person asked for: to sign in to an account, or to make one and its organization. */
type Attempt = Data.TaggedEnum<{
  readonly SignIn: { readonly email: string; readonly password: string }
  readonly SignUp: {
    readonly name: string
    readonly email: string
    readonly password: string
    readonly organization: string
  }
}>
const Attempt = Data.taggedEnum<Attempt>()

/** Better Auth said no, in a sentence already written for the person ("Invalid email or password"). */
class AuthRefused extends S.TaggedError<AuthRefused, { readonly brand: unique symbol }>()(
  "AuthRefused",
  { message: S.String },
  $I.annote("AuthRefused", { description: "Better Auth refused a sign-in, a sign-up or a new organization." })
) {}

/** A Better Auth step as an Effect: its refusal is `AuthRefused` with Better Auth's own sentence. */
const authStep = (step: () => Promise<unknown>): Effect.Effect<void, AuthRefused> =>
  Effect.tryPromise({
    try: () => step().then(() => undefined),
    catch: (cause) =>
      AuthRefused.make({
        message: cause instanceof Error ? cause.message : "Something went wrong. Try again."
      })
  })

/** Sends one attempt to Better Auth: a sign-in, or a sign-up followed by the new organization. */
const submitAttempt = Atom.fn((attempt: Attempt) =>
  Attempt.$match(attempt, {
    SignIn: ({ email, password }) =>
      authStep(() =>
        authClient().then(({ authClient: client, orThrow }) =>
          client.signIn.email({ email, password }).then((answer) => orThrow(answer))
        )
      ),
    SignUp: ({ name, email, password, organization }) =>
      Effect.flatMap(slugFor(organization), (slug) =>
        authStep(() =>
          authClient().then(({ authClient: client, orThrow }) =>
            client.signUp
              .email({ name, email, password })
              .then((answer) => orThrow(answer))
              .then(() => client.organization.create({ name: organization, slug }))
              .then((answer) => orThrow(answer))
          )
        )
      )
  })
)

/** The attempt last sent, so the button pressed shows that it is working. */
const lastAttempt = Atom.make<O.Option<Attempt>>(O.none())

/** The sign-in form: which form it is, and what is typed in it. */
const mode = Atom.make<"sign-in" | "sign-up">("sign-in")
const emailTyped = Atom.make("")
const passwordTyped = Atom.make("")
const nameTyped = Atom.make("")
const organizationTyped = Atom.make("")

/** Making the first organization of an account that has none. */
const createOrganization = Atom.fn((name: string) =>
  Effect.flatMap(slugFor(name), (slug) =>
    authStep(() =>
      authClient().then(({ authClient: client, orThrow }) =>
        client.organization.create({ name, slug }).then((answer) => orThrow(answer))
      )
    )
  )
)
const organizationName = Atom.make("")

/**
 * What to say under the form after a refusal, while nothing is on its way: Better Auth's own sentence, or a general one
 * for a failure that is not a refusal.
 */
const refusalOf = (result: AsyncResult.AsyncResult<void, AuthRefused>): O.Option<string> =>
  !AsyncResult.isFailure(result) || result.waiting
    ? O.none()
    : result.pipe(
        AsyncResult.error,
        O.match({
          onNone: () => "Something went wrong. Try again.",
          onSome: (refused) => refused.message
        }),
        O.some
      )

/** The first screen when nobody is signed in: the test accounts in one click, sign in, or create an account. */
export function SignIn(props: { readonly features: O.Option<SignInFeatures>; readonly onSignedIn: () => void }) {
  const id = useId()
  const [current, setMode] = useAtom(mode)
  const [email, setEmail] = useAtom(emailTyped)
  const [password, setPassword] = useAtom(passwordTyped)
  const [name, setName] = useAtom(nameTyped)
  const [organization, setOrganization] = useAtom(organizationTyped)
  const result = useAtomValue(submitAttempt)
  const submit = useAtomSet(submitAttempt, { mode: "promiseExit" })
  const reset = useAtomSet(submitAttempt)
  const [last, setLast] = useAtom(lastAttempt)
  const testAccounts = O.flatMap(props.features, (features) => features.testAccounts)
  // Until the features are known nothing is offered that may then be refused.
  const offer = O.match(props.features, { onNone: () => "closed" as const, onSome: (features) => features.signUp })

  const send = (attempt: Attempt) => {
    setLast(O.some(attempt))
    void submit(attempt).then((exit) => {
      if (Exit.isSuccess(exit)) props.onSignedIn()
    })
  }
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    send(
      current === "sign-in"
        ? Attempt.SignIn({ email, password })
        : Attempt.SignUp({ name, email, password, organization })
    )
  }
  const signUp = current === "sign-up"
  const pending = result.waiting
  const pendingEmail = O.map(
    O.filter(last, () => pending),
    (attempt) => attempt.email
  )
  const refused = refusalOf(result)

  return (
    <div
      className={`mx-auto grid w-full gap-6 ${O.isNone(testAccounts) ? "max-w-sm" : "max-w-3xl md:grid-cols-2 md:items-start"}`}
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
                    {O.exists(props.features, (features) => features.pwnedPasswordCheck)
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
              {O.match(refused, { onNone: () => null, onSome: (message) => <FieldError>{message}</FieldError> })}
              <Field>
                <Button type="submit" disabled={pending}>
                  {pending && O.contains(pendingEmail, email) ? <Spinner /> : null}
                  {signUp ? "Create account" : "Sign in"}
                </Button>
                {/* Offered only where an account can be made: closed, the page is sign-in alone. */}
                {offer === "closed" ? null : (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      reset(Atom.Reset)
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

      {O.match(testAccounts, {
        onNone: () => null,
        onSome: (testAccounts) => (
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
                  {A.map(testAccounts.accounts, (account) => (
                    <Item key={account.email} role="listitem" variant="outline" size="sm">
                      <ItemContent className="min-w-0">
                        <ItemTitle>{account.name}</ItemTitle>
                        {A.map(membershipsOf(account), (line) => (
                          <ItemDescription key={line}>{line}</ItemDescription>
                        ))}
                      </ItemContent>
                      <ItemActions>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            send(Attempt.SignIn({ email: account.email, password: testAccounts.password }))
                          }
                        >
                          {O.contains(pendingEmail, account.email) ? <Spinner /> : null}
                          Sign in<span className="sr-only"> as {account.name}</span>
                        </Button>
                      </ItemActions>
                    </Item>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

/** Signed in, but in no organization yet (an account whose organization was not created): create one. */
export function CreateOrganization(props: { readonly onCreated: () => void; readonly onSignOut: () => void }) {
  const id = useId()
  const [name, setName] = useAtom(organizationName)
  const result = useAtomValue(createOrganization)
  const create = useAtomSet(createOrganization, { mode: "promiseExit" })
  const refused = refusalOf(result)
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
            void create(name).then((exit) => {
              if (Exit.isSuccess(exit)) props.onCreated()
            })
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
            {O.match(refused, { onNone: () => null, onSome: (message) => <FieldError>{message}</FieldError> })}
            <Field>
              <Button type="submit" disabled={result.waiting}>
                {result.waiting && <Spinner />}
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
