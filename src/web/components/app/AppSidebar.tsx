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
import { toastError } from "@/lib/errors"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
} from "@/components/ui/dropdown-menu"
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
} from "@/components/ui/sidebar"
import { useActor } from "@/lib/actor"
import { linkTo, navigate } from "@/lib/route"
import { type Theme, useTheme } from "@/lib/theme"
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
  name
    .split(/\s+/)
    .map((word) => word[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase()

const roleWords = { admin: "Admin", editor: "Editor", viewer: "Viewer" } as const

const themes: ReadonlyArray<{ value: Theme; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon }
]

/**
 * Which organization the person is working in, and their role there. With more than one they switch here: the
 * server changes the session's organization after checking membership, and everything on screen is asked for again.
 */
function OrganizationPicker() {
  const { actor, organizations, switchTo } = useActor()
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
              {organizations.map((organization) => (
                <DropdownMenuItem
                  key={organization.id}
                  onSelect={() => {
                    if (organization.id !== actor.organizationId) {
                      // An import belongs to the organization being left: its address would open on "not found",
                      // so the page goes back to the first screen before everything is asked for again.
                      if (new URLSearchParams(window.location.search).has("import")) navigate("/")
                      // The server checks the membership, so the switch is not shown before it answers: it says
                      // what it is doing, and the pages show their skeletons while everything is asked for again.
                      const switching = toast.loading(`Switching to ${organization.name}`)
                      switchTo(organization.id).then(
                        () => toast.dismiss(switching),
                        (error: unknown) => {
                          toast.dismiss(switching)
                          toastError(error, { lead: `Still in ${actor.organizationName}.` })
                        }
                      )
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
  const { actor, email, features, signOut, signInAs } = useActor()
  const { theme, setTheme } = useTheme()
  const { isMobile } = useSidebar()
  if (actor === undefined) return null
  const testAccounts = features?.testAccounts
  const otherAccounts = (testAccounts?.accounts ?? []).filter((account) => account.email !== email)
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
                  const chosen = themes.find((entry) => entry.value === next)
                  if (chosen !== undefined) setTheme(chosen.value)
                }}
              >
                {themes.map((entry) => (
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
            {otherAccounts.length === 0 || testAccounts === undefined || testAccounts === null ? null : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Sign in as a test account</DropdownMenuLabel>
                  {otherAccounts.map((account) => (
                    <DropdownMenuItem
                      key={account.email}
                      onSelect={() => {
                        const switching = toast.loading(`Signing in as ${account.name}`)
                        signInAs(account.email, testAccounts.password).catch((error: unknown) => {
                          toast.dismiss(switching)
                          toastError(error, { lead: `Still signed in as ${actor.name}.` })
                        })
                      }}
                    >
                      <UserRoundIcon />
                      <span className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate">{account.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {account.memberships
                            .map((membership) => `${roleWords[membership.role]}, ${membership.organizationName}`)
                            .join("; ")}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                signOut().catch((error: unknown) => toastError(error, { lead: "You are still signed in." }))
              }
            >
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
              {appPages.map((page) => (
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
