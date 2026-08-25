"use client"

import { useLayoutEffect } from "react"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"

function SystemThemeSync() {
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const applyTheme = () => {
      const storedTheme = localStorage.getItem("theme")
      const isDark = storedTheme === "dark" || (storedTheme !== "light" && media.matches)
      document.documentElement.classList.toggle("dark", isDark)
      document.documentElement.style.colorScheme = isDark ? "dark" : "light"
    }

    applyTheme()
    media.addEventListener("change", applyTheme)
    window.addEventListener("storage", applyTheme)
    return () => {
      media.removeEventListener("change", applyTheme)
      window.removeEventListener("storage", applyTheme)
    }
  }, [])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SystemThemeSync />
      <TooltipProvider>
        {children}
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </>
  )
}
