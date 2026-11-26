import { useAtom, useAtomMount, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import { identity } from "effect/Function"
import * as R from "effect/Record"
import * as Cause from "effect/Cause"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as HashSet from "effect/HashSet"
import * as O from "effect/Option"
import * as Result from "effect/Result"
import * as S from "effect/Schema"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Atom from "effect/reactivity/Atom"
import * as AtomRegistry from "effect/reactivity/AtomRegistry"
import { type ReactNode, useId } from "react"
import { toast } from "sonner"
import { PageHeader } from "@inventory/ui/PageHeader"
import { TableSkeleton } from "@inventory/ui/Skeletons"
import { NotSet } from "@inventory/ui/NotSet"
import { type ListColumn, ListTable } from "@inventory/ui/ListTable"
import { Alert, AlertDescription, AlertTitle } from "@inventory/ui/components/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@inventory/ui/components/alert-dialog"
import { Button } from "@inventory/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@inventory/ui/components/dialog"
import { Field, FieldGroup, FieldLabel } from "@inventory/ui/components/field"
import { Input } from "@inventory/ui/components/input"
import { NativeSelect, NativeSelectOption } from "@inventory/ui/components/native-select"
import { ofMember } from "@inventory/client/MemberAtoms"
import { optimisticChange, optimisticWrite, shown } from "@inventory/client/OptimisticAtoms"
import { AddPerson as AddPersonCommand, ChangeRole } from "@inventory/access-contract/PeopleCommand"
import { Person } from "@inventory/access-contract/Person"
import type { MemberId } from "@inventory/kernel/Ids"
import { hasRole, Role } from "@inventory/kernel/Role"
import { when } from "@inventory/ui/Dates"
import { sayError } from "@inventory/client/SayError"
import { accessApi, accessKeys } from "./Access.runtime.ts"
import { actor as signedIn } from "./Session.atoms.ts"

/** A person as the table shows them: with whether their role is being saved. */
type PersonRow = Person & { readonly saving: boolean }

/** The person a row shows, as the server and the cache have them. */
const personOf = ({ saving: _saving, ...person }: PersonRow): Person => Person.make(person)

/** A role as one word, as the Role column's filter and the rows of people who cannot change it show it. */
const roleWords: Record<Role, string> = { viewer: "Viewer", editor: "Editor", admin: "Admin" }

const roles: ReadonlyArray<{ readonly value: Role; readonly label: string }> = [
  { value: "viewer", label: "Viewer: can look" },
  { value: "editor", label: "Editor: can import" },
  { value: "admin", label: "Admin: can manage people" }
]

/** The people of the organization, as the server has them, with each optimistic change on top while it is saved. */
const people = shown(
  accessApi.query((api) => api.people.list(), { keep: "unwatched", reactivityKeys: O.some(accessKeys.people) })
)

/** The people whose role is on its way to the server: their row shows the new role, and waits for it. */
const savingRoles = Atom.make(HashSet.empty<MemberId>())

/** A role change the person made on one row. */
type RoleChange = { readonly person: Person; readonly role: Role }

/**
 * A role change, shown at once and put back, with the reason, if the server refuses (the last admin of an
 * organization cannot become a viewer). It writes an audit line, so the activity is asked again.
 */
const sendRoleChange = Effect.fn("People.setRole")(function* (input: RoleChange) {
  const registry = yield* AtomRegistry.AtomRegistry
  const memberId = input.person.memberId
  registry.update(savingRoles, HashSet.add(memberId))
  return yield* accessApi
    .send((api) => api.people.setRole({ params: { memberId }, payload: ChangeRole.make({ role: input.role }) }))
    .pipe(Effect.ensuring(Effect.sync(() => registry.update(savingRoles, HashSet.remove(memberId)))))
})

const setRole = optimisticWrite({
  send: sendRoleChange,
  changes: [
    optimisticChange(people, (list: ReadonlyArray<Person>, input: RoleChange) =>
      A.map(list, (entry) =>
        entry.memberId === input.person.memberId ? Person.make({ ...entry, role: input.role }) : entry
      )
    )
  ],
  failed: (input) => `${input.person.name}'s role was not changed.`,
  settled: O.some(accessKeys.activity)
})

/** A removal, shown at once and put back, with the reason, if the server refuses (an organization keeps an admin). */
const remove = optimisticWrite({
  send: (person: Person) => accessApi.send((api) => api.people.remove({ params: { memberId: person.memberId } })),
  changes: [
    optimisticChange(people, (list: ReadonlyArray<Person>, person: Person) =>
      A.filter(list, (entry) => entry.memberId !== person.memberId)
    )
  ],
  failed: (person) => `${person.name} was not removed.`,
  settled: O.some(accessKeys.activity)
})

/** The add form: whether it is open, and what the person signed in has typed in it. */
export const addOpen = ofMember(() => false)
export const addEmail = ofMember(() => "")
export const addRole = ofMember((): Role => "editor")

/**
 * Adding a person. Not optimistic: only the server knows whose email it is. Through the command's schema, which trims
 * the email and lower-cases it: the rule is said once, there. Who is in the organization and the audit trail change.
 */
const addPerson = accessApi.write<{ readonly email: string; readonly role: Role }>()(
  (api, input) =>
    S.decodeEffect(AddPersonCommand)(input).pipe(Effect.flatMap((payload) => api.people.add({ payload }))),
  { reactivityKeys: O.some([...accessKeys.people, ...accessKeys.activity]) }
)

/**
 * The form that adds a person by the email they signed up with. Not optimistic: only the server knows whose email it
 * is. The button says it is adding while it waits, and an email nobody signed up with comes back as data, said
 * beside the email so it can be corrected in place.
 */
function AddPerson() {
  const emailId = useId()
  const roleId = useId()
  const [open, setOpen] = useAtom(addOpen)
  const [email, setEmail] = useAtom(addEmail)
  const [role, setRole] = useAtom(addRole)
  const result = useAtomValue(addPerson)
  const add = useAtomSet(addPerson, { mode: "promiseExit" })
  const reset = useAtomSet(addPerson)
  const pending = result.waiting
  const problem = O.flatMap(
    O.filter(AsyncResult.value(result), () => !pending),
    Result.getFailure
  )
  const failed = !pending && AsyncResult.isFailure(result) ? result.cause.pipe(Cause.squash, O.some) : O.none()
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        reset(Atom.Reset)
      }}
    >
      <DialogTrigger asChild>
        <Button>Add a person</Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void add({ email, role }).then((exit) => {
              if (!Exit.isSuccess(exit) || Result.isFailure(exit.value)) return
              toast.success(`${exit.value.success.name} added as ${exit.value.success.role}`)
              setOpen(false)
              setEmail("")
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Add a person</DialogTitle>
            <DialogDescription>They sign up first. Then add them here by the email they used.</DialogDescription>
          </DialogHeader>
          <FieldGroup className="my-4">
            <Field>
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <Input
                id={emailId}
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={roleId}>Role</FieldLabel>
              <NativeSelect
                id={roleId}
                value={role}
                onChange={(event) => {
                  const role = event.target.value
                  if (S.is(Role)(role)) setRole(role)
                }}
              >
                {A.map(roles, (entry) => (
                  <NativeSelectOption key={entry.value} value={entry.value}>
                    {entry.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {O.match(problem, {
              onNone: () => null,
              onSome: (problem) => (
                <Alert variant="destructive">
                  <AlertTitle>Not added</AlertTitle>
                  <AlertDescription>
                    <p>{problem.problem}</p>
                    <p>{problem.todo}</p>
                  </AlertDescription>
                </Alert>
              )
            })}
            {O.match(failed, {
              onNone: () => null,
              onSome: (failed) => (
                <Alert variant="destructive">
                  <AlertTitle>Not added</AlertTitle>
                  <AlertDescription>{sayError(failed, { fields: {} }).sentence}</AlertDescription>
                </Alert>
              )
            })}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The list's rows: each says whether its role is on its way to the server. Carried in the row itself: the table
 * redraws a row when its data changes, and the list the server sends back after a change can be the very object shown
 * before.
 */
const peopleRows = Atom.readable((get): ReadonlyArray<PersonRow> => {
  const saving = get(savingRoles)
  return A.map(O.match(AsyncResult.value(get(people)), { onNone: A.empty<Person>, onSome: identity }), (person) => ({
    ...person,
    saving: HashSet.has(saving, person.memberId)
  }))
})

/**
 * The list's columns, for the person signed in: an admin's Role is a choice and their rows have Remove. The cells
 * write through the registry they are read in, so the columns are made again only when the person signed in changes.
 */
const peopleColumns = Atom.readable((get): ReadonlyArray<ListColumn<PersonRow>> => {
  const actor = get(signedIn)
  const admin = O.exists(actor, (member) => hasRole(member.role, "admin"))
  const registry = get.registry
  const changeRole = (change: { readonly person: Person; readonly role: Role }) => registry.set(setRole, change)
  const removePerson = (person: Person) => registry.set(remove, person)
  return [
    {
      title: O.none(),
      id: "name",
      label: "Name",
      width: O.some(280),
      value: O.some((person) => person.name),
      // The signed-in person's own row says so: the role and Remove beside it act on themself.
      cell: O.some((person) =>
        O.exists(actor, (member) => person.memberId === member.id) ? (
          <>
            {person.name} <span className="font-normal text-muted-foreground">(you)</span>
          </>
        ) : (
          person.name
        )
      )
    },
    {
      width: O.none(),
      id: "email",
      label: "Email",
      value: O.some((person) => O.match(person.email, { onNone: () => "", onSome: identity })),
      cell: O.some((person) =>
        O.match(person.email, { onNone: (): ReactNode => <NotSet />, onSome: (email) => email })
      ),
      title: O.some((person) => O.match(person.email, { onNone: () => "Not set", onSome: identity })),
      blank: (person) => O.isNone(person.email)
    },
    {
      title: O.none(),
      id: "role",
      label: "Role",
      width: O.some(260),
      // Admin, Editor, Viewer: in the order of what each may do, and alphabetical too.
      value: O.some((person) => roleWords[person.role]),
      facet: true,
      cell: O.some((person) =>
        admin && O.isSome(person.email) ? (
          <NativeSelect
            size="sm"
            aria-label={`Role of ${person.name}`}
            value={person.role}
            // This person's role is on its way to the server: the new one shows, and a second change waits for it.
            disabled={person.saving}
            onChange={(event) => {
              const role = event.target.value
              if (S.is(Role)(role)) changeRole({ person: personOf(person), role })
            }}
          >
            {A.map(roles, (entry) => (
              <NativeSelectOption key={entry.value} value={entry.value}>
                {entry.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          roleWords[person.role]
        )
      )
    },
    {
      id: "joined",
      label: "Joined",
      width: O.some(190),
      // Sorted by the moment itself, as ISO text.
      value: O.some((person) => O.match(person.joinedAt, { onNone: () => "", onSome: DateTime.formatIso })),
      searchable: false,
      cell: O.some((person) => O.match(person.joinedAt, { onNone: (): ReactNode => <NotSet />, onSome: when })),
      title: O.some((person) => O.match(person.joinedAt, { onNone: () => "Not set", onSome: when })),
      blank: (person) => O.isNone(person.joinedAt)
    },
    ...(admin
      ? [
          {
            title: O.none(),
            value: O.none(),
            id: "actions",
            label: "Remove",
            width: O.some(120),
            end: true,
            cell: O.some((person: PersonRow) => (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="xs">
                    Remove<span className="sr-only"> {person.name}</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove {person.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      They lose access to{" "}
                      {O.match(actor, { onNone: () => null, onSome: (member) => member.organizationName })} at once.
                      Their account and what they imported stay.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removePerson(personOf(person))}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ))
          }
        ]
      : [])
  ]
})

/** Who is in the organization and with what role. An admin adds people, changes roles and removes members here. */
export function PeoplePage() {
  const who = useAtomValue(signedIn)
  const admin = O.exists(who, (member) => hasRole(member.role, "admin"))
  const list = useAtomValue(people)
  const askAgain = useAtomRefresh(people)
  // The two writes the list's cells make are mounted while the page is, so one under way is not let go.
  useAtomMount(setRole)
  useAtomMount(remove)
  const columns = useAtomValue(peopleColumns)
  const data = AsyncResult.value(list)
  const error = AsyncResult.isFailure(list) && !list.waiting ? list.cause.pipe(Cause.squash, O.some) : O.none()
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="People"
        {...R.getSomes({
          line: O.orElse(
            O.map(
              O.all({ actor: who, data }),
              ({ actor, data }) =>
                `${actor.organizationName} · ${data.length} ${data.length === 1 ? "person" : "people"}`
            ),
            () => (O.isNone(error) ? O.some("loading") : O.none())
          )
        })}
        actions={admin ? <AddPerson /> : undefined}
      />
      {O.match(error, {
        onSome: (error) => (
          <div className="px-4 sm:px-9">
            <Alert variant="destructive">
              <AlertTitle>The people could not be loaded</AlertTitle>
              <AlertDescription>
                {sayError(error, { fields: {} }).sentence}
                <Button variant="outline" size="sm" onClick={askAgain}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ),
        onNone: () =>
          O.match(data, {
            onNone: () => (
              <TableSkeleton
                caption="People in the organization"
                columns={A.map(columns, (column) => ({
                  label: O.some(column.label),
                  ...R.getSomes({ width: column.width })
                }))}
              />
            ),
            onSome: () => (
              <ListTable
                caption="People in the organization"
                searchLabel="Search people"
                columns={peopleColumns}
                rows={peopleRows}
                rowKey={(person) => person.memberId}
                empty="Nobody is here yet."
                updating={list.waiting}
              />
            )
          })
      })}
    </div>
  )
}
