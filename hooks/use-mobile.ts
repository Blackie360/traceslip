import { useSyncExternalStore } from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
      query.addEventListener("change", notify)
      return () => query.removeEventListener("change", notify)
    },
    () => window.innerWidth < MOBILE_BREAKPOINT,
    () => false
  )
}
