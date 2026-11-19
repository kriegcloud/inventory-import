import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Result } from "effect"
import { useId, useState } from "react"
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
import { useActor } from "@/lib/actor"
import { call, callWrite } from "@/lib/api"
import { cacheChange, useOptimisticWrite } from "@/lib/optimistic"
import type { Person } from "../../api/v1/People.ts"
import { hasRole, type Role } from "@inventory/kernel/Role"
import { when } from "./import/format.tsx"
import { sayError } from "@/lib/errors"
import { queryKeys } from "@/lib/queries"

/** A person as the table shows them: with whether their role is being saved. */
type PersonRow = Person & { readonly saving: boolean }

/** The person a row shows, as the server and the cache have them. */
const personOf = ({ saving: _saving, ...person }: PersonRow): Person => person

/** A role as one word, as the Role column's filter and the rows of people who cannot change it show it. */
const roleWords: Record<Role, string> = { viewer: "Viewer", editor: "Editor", admin: "Admin" }

const roles: ReadonlyArray<{ value: Role; label: string }> = [
  { value: "viewer", label: "Viewer: can look" },
  { value: "editor", label: "Editor: can import" },
  { value: "admin", label: "Admin: can manage people" }
]

/**
 * The form that adds a person by the email they signed up with. Not optimistic: only the server knows whose email it
 * is. The button says it is adding while it waits, and an email nobody signed up with comes back as data, said
 * beside the email so it can be corrected in place.
 */
function AddPerson(props: { onAdded: () => void }) {
  const emailId = useId()
  const roleId = useId()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<Role>("editor")
  const add = useMutation({
    mutationFn: () => callWrite((api) => api.people.add({ payload: { email, role } })),
    onSuccess: (outcome) => {
      if (Result.isFailure(outcome)) return
      toast.success(`${outcome.success.name} added as ${outcome.success.role}`)
      setOpen(false)
      setEmail("")
      props.onAdded()
    }
  })
  const problem = add.data !== undefined && Result.isFailure(add.data) ? add.data.failure : undefined
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        add.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>Add a person</Button>
      </DialogTrigger>
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            add.mutate()
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
              <NativeSelect id={roleId} value={role} onChange={(event) => setRole(event.target.value as Role)}>
                {roles.map((entry) => (
                  <NativeSelectOption key={entry.value} value={entry.value}>
                    {entry.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
            {problem === undefined ? null : (
              <Alert variant="destructive">
                <AlertTitle>Not added</AlertTitle>
                <AlertDescription>
                  <p>{problem.problem}</p>
                  <p>{problem.todo}</p>
                </AlertDescription>
              </Alert>
            )}
            {add.error === null ? null : (
              <Alert variant="destructive">
                <AlertTitle>Not added</AlertTitle>
                <AlertDescription>{sayError(add.error).sentence}</AlertDescription>
              </Alert>
            )}
          </FieldGroup>
          <DialogFooter>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? "Adding" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Who is in the organization and with what role. An admin adds people, changes roles and removes members here. */
export function PeoplePage() {
  const queryClient = useQueryClient()
  const { actor } = useActor()
  const admin = actor !== undefined && hasRole(actor.role, "admin")
  const people = useQuery({ queryKey: queryKeys.people, queryFn: () => call((api) => api.people.list()) })
  // Every change to a membership writes an audit line beside it.
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.people })
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity })
  }
  // A role change and a removal show at once and are put back, with the reason, if the server refuses (the last
  // admin of an organization cannot become a viewer or go). Each writes an audit line, so the activity is fetched too.
  const setRole = useOptimisticWrite({
    name: "people",
    write: (client, input: { person: Person; role: Role }) =>
      client.people.setRole({ params: { memberId: input.person.memberId }, payload: { role: input.role } }),
    changes: (input) => [
      cacheChange<ReadonlyArray<Person>, { person: Person; role: Role }>({
        key: queryKeys.people,
        apply: (list) =>
          list.map((entry) => (entry.memberId === input.person.memberId ? { ...entry, role: input.role } : entry)),
        undo: (now) =>
          now.map((entry) => (entry.memberId === input.person.memberId ? { ...entry, role: input.person.role } : entry))
      })
    ],
    failed: (input) => `${input.person.name}'s role was not changed.`,
    settled: () => [queryKeys.activity]
  })
  const remove = useOptimisticWrite({
    name: "people",
    write: (client, person: Person) => client.people.remove({ params: { memberId: person.memberId } }),
    changes: (person) => [
      cacheChange<ReadonlyArray<Person>, Person>({
        key: queryKeys.people,
        apply: (list) => list.filter((entry) => entry.memberId !== person.memberId),
        // Back in the place they had, unless the list fetched meanwhile already has them.
        undo: (now, before) => {
          const at = before.findIndex((entry) => entry.memberId === person.memberId)
          if (at < 0 || now.some((entry) => entry.memberId === person.memberId)) return now
          return [...now.slice(0, at), person, ...now.slice(at)]
        }
      })
    ],
    failed: (person) => `${person.name} was not removed.`,
    settled: () => [queryKeys.activity]
  })
  // Each row says whether its role is on its way to the server. Carried in the row itself: the table redraws a row
  // when its data changes, and the list the server sends back after a change can be the very object shown before.
  const rows: ReadonlyArray<PersonRow> = (people.data ?? []).map((person) => ({
    ...person,
    saving: setRole.isPending && setRole.variables?.person.memberId === person.memberId
  }))

  const columns: ReadonlyArray<ListColumn<PersonRow>> = [
    {
      id: "name",
      label: "Name",
      width: 280,
      value: (person) => person.name,
      // The signed-in person's own row says so: the role and Remove beside it act on themself.
      cell: (person) =>
        person.memberId === actor?.id ? (
          <>
            {person.name} <span className="font-normal text-muted-foreground">(you)</span>
          </>
        ) : (
          person.name
        )
    },
    {
      id: "email",
      label: "Email",
      value: (person) => person.email ?? "",
      cell: (person) => person.email ?? <NotSet />,
      title: (person) => person.email ?? "Not set",
      blank: (person) => person.email === null
    },
    {
      id: "role",
      label: "Role",
      width: 260,
      // Admin, Editor, Viewer: in the order of what each may do, and alphabetical too.
      value: (person) => roleWords[person.role],
      facet: true,
      cell: (person) =>
        admin && person.email !== null ? (
          <NativeSelect
            size="sm"
            aria-label={`Role of ${person.name}`}
            value={person.role}
            // This person's role is on its way to the server: the new one shows, and a second change waits for it.
            disabled={person.saving}
            onChange={(event) => setRole.mutate({ person: personOf(person), role: event.target.value as Role })}
          >
            {roles.map((entry) => (
              <NativeSelectOption key={entry.value} value={entry.value}>
                {entry.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : (
          roleWords[person.role]
        )
    },
    {
      id: "joined",
      label: "Joined",
      width: 190,
      value: (person) => person.joinedAt ?? "",
      searchable: false,
      cell: (person) => (person.joinedAt === null ? <NotSet /> : when(person.joinedAt)),
      title: (person) => (person.joinedAt === null ? "Not set" : when(person.joinedAt)),
      blank: (person) => person.joinedAt === null
    },
    ...(admin
      ? [
          {
            id: "actions",
            label: "Remove",
            width: 120,
            end: true,
            cell: (person: PersonRow) => (
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
                      They lose access to {actor?.organizationName} at once. Their account and what they imported stay.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate(personOf(person))}>Remove</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )
          }
        ]
      : [])
  ]

  const count = people.data?.length ?? 0
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="People"
        line={
          actor !== undefined && people.data !== undefined
            ? `${actor.organizationName} · ${count} ${count === 1 ? "person" : "people"}`
            : people.error === null
              ? "loading"
              : undefined
        }
        actions={admin ? <AddPerson onAdded={refresh} /> : undefined}
      />
      {people.error !== null ? (
        <div className="px-4 sm:px-9">
          <Alert variant="destructive">
            <AlertTitle>The people could not be loaded</AlertTitle>
            <AlertDescription>
              {sayError(people.error).sentence}
              <Button variant="outline" size="sm" onClick={() => void people.refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : people.data === undefined ? (
        <TableSkeleton caption="People in the organization" columns={columns} />
      ) : (
        <ListTable
          caption="People in the organization"
          searchLabel="Search people"
          columns={columns}
          rows={rows}
          rowKey={(person) => person.memberId}
          empty="Nobody is here yet."
        />
      )}
    </div>
  )
}
