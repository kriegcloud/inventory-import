import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Known on the first render (local change): starting at undefined drew a phone a desktop table, then its cards.
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => window.innerWidth < MOBILE_BREAKPOINT)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile === true
}
