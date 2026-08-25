"use client"

import {
  Activity,
  ChevronsUpDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { BrandMark } from "@/components/brand-mark"
import { buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

type AppShellProps = {
  workspace: { name: string; slug: string; role: string }
  user: { name: string; email: string; image?: string | null }
  impersonating: boolean
  children: React.ReactNode
}

export function AppShell({ workspace, user, impersonating, children }: AppShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/app/${workspace.slug}`
  const nav = [
    [LayoutDashboard, "Overview", base],
    [ReceiptText, "Receipts", `${base}/receipts`],
    [FolderKanban, "Projects", `${base}/projects`],
    [Activity, "Audit activity", `${base}/audit`],
    [Users, "Members", `${base}/members`],
    [Settings, "Settings", `${base}/settings`],
  ] as const
  const isActive = (href: string) => href === base ? pathname === href : pathname.startsWith(href)
  const currentLabel = [...nav].reverse().find(([, , href]) => isActive(href))?.[1] ?? "Workspace"

  async function endSupportView() {
    await fetch("/api/platform/impersonation/end", { method: "POST" })
    await authClient.admin.stopImpersonating()
    router.push("/app/platform")
    router.refresh()
  }

  return (
    <div className="app-ui min-h-screen bg-background lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="no-print sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pb-4 pt-5"><BrandMark href={base} inverse /></div>
        <div className="mx-3 rounded-lg border border-white/10 bg-white/[.045] p-3.5">
          <p className="text-[10px] font-medium uppercase tracking-[.16em] text-white/45">Workspace</p>
          <div className="mt-2 flex items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-emerald-400/15 text-xs font-semibold text-emerald-300">{workspace.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{workspace.name}</span><span className="block text-[11px] capitalize text-white/45">{workspace.role} access</span></span>
            <ChevronsUpDown className="size-3.5 text-white/35" aria-hidden="true" />
          </div>
        </div>
        <div className="px-5 pb-2 pt-6 text-[10px] font-medium uppercase tracking-[.16em] text-white/35">Operations</div>
        <nav aria-label="Workspace navigation" className="flex-1 space-y-1 px-3">
          {nav.map(([Icon, label, href]) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={cn(
                "group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm text-white/58 transition-colors hover:bg-white/[.06] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400",
                isActive(href) && "bg-white/[.09] font-medium text-white before:absolute before:-left-3 before:h-5 before:w-0.5 before:rounded-full before:bg-emerald-400"
              )}
            >
              <Icon className={cn("size-4", isActive(href) ? "text-emerald-300" : "text-white/42 group-hover:text-white/75")} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-white/[.06] focus-visible:outline-2 focus-visible:outline-emerald-400">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">{user.name.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm text-white">{user.name}</span><span className="block truncate text-[10px] text-white/40">{user.email}</span></span>
              <ChevronsUpDown className="size-3.5 text-white/35" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/") } })}><LogOut data-icon="inline-start" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="min-w-0">
        {impersonating && (
          <div className="no-print sticky top-0 z-50 flex items-center justify-center gap-3 bg-amber-300 px-4 py-2 text-xs font-semibold text-black">
            <ShieldCheck className="size-4" aria-hidden="true" />Support view · read only · all access is audited
            <button className="ml-3 underline underline-offset-2" onClick={endSupportView}>End view</button>
          </div>
        )}
        <header className="no-print sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-card/92 px-4 backdrop-blur-xl lg:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="lg:hidden"><BrandMark href={base} compact /></div>
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{currentLabel}</p><p className="hidden truncate text-xs text-muted-foreground sm:block">{workspace.name} workspace</p></div>
          </div>
          {!impersonating && <Link href={`${base}/receipts/new`} className={cn(buttonVariants({ size: "lg" }), "px-4 shadow-sm")}><ScanLine aria-hidden="true" />Scan receipt</Link>}
        </header>
        <main className="mx-auto w-full max-w-[1560px] p-4 pb-24 sm:p-6 sm:pb-24 lg:p-8 lg:pb-10">{children}</main>
      </div>

      <nav aria-label="Mobile workspace navigation" className="no-print fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t bg-card/95 px-2 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl lg:hidden">
        {nav.slice(0, 4).map(([Icon, label, href]) => (
          <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={cn("flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 text-[10px] font-medium text-muted-foreground", isActive(href) && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
            <Icon className="size-4" aria-hidden="true" />{label === "Audit activity" ? "Audit" : label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
