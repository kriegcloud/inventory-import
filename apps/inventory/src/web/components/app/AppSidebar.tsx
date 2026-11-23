import { useAtomSet, useAtomValue } from "@effect/atom-react"
import * as A from "effect/Array"
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import { pipe } from "effect/Function"
import * as O from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as S from "effect/Schema"
import * as Str from "effect/String"
import {
  CheckIcon,
  ChevronsUpDownIcon,
  HistoryIcon,
  LogOutIcon,
  type LucideIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  TableIcon,
  UploadIcon,
  UserRoundIcon,
  UsersIcon
} from "lucide-react"
import { toast } from "sonner"
import { toastError } from "@inventory/client/SayError"
import { Avatar, AvatarFallback } from "@inventory/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@inventory/ui/components/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar
} from "@inventory/ui/components/sidebar"
import { sessionView, signInAs, signOut, switchOrganization } from "@inventory/access-web/Session"
import { linkTo, navigate } from "@inventory/ui/Route"
import { type Theme, theme as themeChoice } from "@inventory/ui/Theme"
import { BrandMark } from "./BrandMark.tsx"

/** A page the sidebar links to. `path` is its address; `icon` is all that shows when the sidebar is collapsed. */
export type AppPage = { path: string; label: string; icon: LucideIcon }

/** The app's pages, in the order the sidebar lists them. */
export const appPages: ReadonlyArray<AppPage> = [
  { path: "/", label: "Import", icon: UploadIcon },
  { path: "/items", label: "Items", icon: TableIcon },
  { path: "/activity", label: "Activity", icon: HistoryIcon },
  { path: "/people", label: "People", icon: UsersIcon }
]

const initials = (name: string): string =>
  pipe(
    Str.split(name, /\s+/),
    A.map((word) => O.getOrElse(Str.at(word, 0), () => "")),
    A.join(""),
    Str.takeLeft(2),
    Str.toUpperCase
  )

const roleWords = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const

const themes: ReadonlyArray<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon }
]

/**
 * Where the page goes as the person switches organization. An import belongs to the organization being left: its address
 * would open on "not found", so the page goes back to the first screen. A search, a filter or a page of a table is of
 * that organization's too: the address keeps its page alone.
 *
 * @example addressInAnother({ pathname: "/items", search: "?search=oak" }) // "/items"
 */
export const addressInAnother = (at: { readonly pathname: string; readonly search: string }): string =>
  new URLSearchParams(at.search).has("import") ? "/" : at.pathname

/**
 * A switch of organization, said as it happens: a toast while the server checks the membership, gone when it has
 * answered, and the reason when the person is still in the organization they were in.
 */
const switchSaid = Atom.fn(
  Effect.fnUntraced(function* (
    target: { readonly id: string; readonly name: string; readonly from: string },
    get: Atom.FnContext
  ) {
    const switching = toast.loading(`Switching to ${target.name}`)
    const exit = yield* Effect.exit(get.setResult(switchOrganization, target.id))
    toast.dismiss(switching)
    if (Exit.isFailure(exit)) toastError(Cause.squash(exit.cause), { lead: `Still in ${target.from}.` })
  })
)

/** Better Auth's client did not change who is signed in; its own error is kept for the sentence the toast says. */
class AccountNotChanged extends S.TaggedError<AccountNotChanged, { readonly brand: unique symbol }>()(
  "AccountNotChanged",
  { cause: S.Defect() }
) {}

/** Signing in as another test account, said as it happens. When it works the page reloads, so only a refusal is said. */
const signInSaid = Atom.fn(
  (target: { readonly email: string; readonly password: string; readonly name: string; readonly from: string }) => {
    const switching = toast.loading(`Signing in as ${target.name}`)
    return Effect.tryPromise({
      try: () => signInAs({ email: target.email, password: target.password }),
      catch: (cause) => AccountNotChanged.make({ cause })
    }).pipe(
      Effect.catch((refused) =>
        Effect.sync(() => {
          toast.dismiss(switching)
          toastError(refused.cause, { lead: `Still signed in as ${target.from}.` })
        })
      )
    )
  }
)

/** Signing out; a refusal is said, and the person stays signed in. */
const signOutSaid = Atom.fn(() =>
  Effect.tryPromise({ try: () => signOut(), catch: (cause) => AccountNotChanged.make({ cause }) }).pipe(
    Effect.catch((refused) => Effect.sync(() => toastError(refused.cause, { lead: "You are still signed in." })))
  )
)

/**
 * Which organization the person is working in, and their role there. With more than one they switch here: the
 * server changes the session's organization after checking membership, and everything on screen is asked for again.
 */
function OrganizationPicker() {
  const { actor, organizations } = useAtomValue(sessionView)
  const switchTo = useAtomSet(switchSaid)
  const { isMobile } = useSidebar()
  if (actor === undefined) return null
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={actor.organizationName}
              aria-label={`${actor.organizationName}, ${roleWords[actor.role]}. Choose an organization`}
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-background">
                <BrandMark className="size-6" />
              </span>
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{actor.organizationName}</span>
                <span className="truncate text-xs text-muted-foreground">{roleWords[actor.role]}</span>
              </span>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Organizations</DropdownMenuLabel>
              {A.map(organizations, (organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  onSelect={() => {
                    if (organization.id !== actor.organizationId) {
                      navigate(addressInAnother(window.location))
                      // The server checks the membership, so the switch is not shown before it answers: it says
                      // what it is doing, and the pages show their skeletons once it has.
                      switchTo({ id: organization.id, name: organization.name, from: actor.organizationName })
                    }
                  }}
                >
                  <span className="flex-1 truncate">{organization.name}</span>
                  <CheckIcon
                    aria-label={organization.id === actor.organizationId ? "Current" : undefined}
                    className={organization.id === actor.organizationId ? undefined : "invisible"}
                  />
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/**
 * The signed-in person, at the foot of the sidebar: who they are, the theme, signing out and, while the server offers
 * test accounts (TEST_ACCOUNTS, on in development only), signing in as another of them in one click.
 */
function UserMenu() {
  const { actor, email, features } = useAtomValue(sessionView)
  const theme = useAtomValue(themeChoice)
  const setTheme = useAtomSet(themeChoice)
  const signInTo = useAtomSet(signInSaid)
  const leave = useAtomSet(signOutSaid)
  const { isMobile } = useSidebar()
  if (actor === undefined) return null
  // The test accounts other than the signed-in one, with the password they share: only while the server offers them.
  const offered = O.flatMap(features, (known) =>
    O.flatMap(known.testAccounts, (accounts) => {
      const others = A.filter(accounts.accounts, (account) => account.email !== email)
      return others.length === 0 ? O.none() : O.some({ password: accounts.password, others })
    })
  )
  const who = (
    <>
      <Avatar>
        <AvatarFallback>{initials(actor.name)}</AvatarFallback>
      </Avatar>
      <span className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{actor.name}</span>
        <span className="truncate text-xs text-muted-foreground">{email}</span>
      </span>
    </>
  )
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" tooltip={actor.name} aria-label={`${actor.name}. Theme and sign out`}>
              {who}
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel>
              <span className="flex items-center gap-2 font-normal">{who}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Theme</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(next) => {
                  const chosen = A.findFirst(themes, (entry) => entry.value === next)
                  if (O.isSome(chosen)) setTheme(chosen.value.value)
                }}
              >
                {A.map(themes, (entry) => (
                  // Choosing a theme keeps the menu open, so the person sees the change and can pick again.
                  <DropdownMenuRadioItem
                    key={entry.value}
                    value={entry.value}
                    onSelect={(event) => event.preventDefault()}
                  >
                    <entry.icon />
                    {entry.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            {O.match(offered, {
              onNone: () => null,
              onSome: ({ password, others }) => (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Sign in as a test account</DropdownMenuLabel>
                    {A.map(others, (account) => (
                      <DropdownMenuItem
                        key={account.email}
                        onSelect={() => {
                          signInTo({
                            email: account.email,
                            password,
                            name: account.name,
                            from: actor.name
                          })
                        }}
                      >
                        <UserRoundIcon />
                        <span className="grid min-w-0 flex-1 leading-tight">
                          <span className="truncate">{account.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {A.join(
                              A.map(
                                account.memberships,
                                (membership) => `${roleWords[membership.role]}, ${membership.organizationName}`
                              ),
                              "; "
                            )}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => leave()}>
              <LogOutIcon />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

/**
 * The app's sidebar: the organization at the top, the pages, and the signed-in person at the foot. It folds to a
 * strip of icons (the rail, the header's button or Ctrl+B) and is a drawer on a phone.
 */
export function AppSidebar(props: { current: string | undefined }) {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <OrganizationPicker />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <nav aria-label="Pages">
            <SidebarMenu>
              {A.map(appPages, (page) => (
                <SidebarMenuItem key={page.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={page.path === props.current}
                    tooltip={page.label}
                    // In the phone's drawer a link is a finger's height, like every other control there.
                    size={isMobile ? "lg" : "default"}
                  >
                    <a
                      aria-current={page.path === props.current ? "page" : undefined}
                      // On a phone the sidebar is a drawer over the page: going somewhere closes it.
                      {...linkTo(page.path, () => setOpenMobile(false))}
                    >
                      <page.icon />
                      <span>{page.label}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
