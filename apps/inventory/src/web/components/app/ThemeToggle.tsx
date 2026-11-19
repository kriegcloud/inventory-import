import { MoonIcon, SunIcon } from "lucide-react"
import { useAtomSet, useAtomValue } from "@effect/atom-react"
import { resolvedTheme, theme } from "@inventory/ui/Theme"
import { Button } from "@inventory/ui/components/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@inventory/ui/components/tooltip"

export function ThemeToggle() {
  const setTheme = useAtomSet(theme)
  const next = useAtomValue(resolvedTheme) === "dark" ? "light" : "dark"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Switch to ${next} theme`} onClick={() => setTheme(next)}>
          <SunIcon className="hidden dark:block" />
          <MoonIcon className="dark:hidden" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Switch to {next} theme</TooltipContent>
    </Tooltip>
  )
}
