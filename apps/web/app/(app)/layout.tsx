"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { RefreshCwIcon, ShieldAlertIcon, WifiOffIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { ShellProvider } from "@/components/shell-context"
import { canAccess, homeForRole } from "@/lib/navigation"
import { useSession } from "@/lib/session"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session, error, refresh } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [retrying, setRetrying] = React.useState(false)

  React.useEffect(() => {
    if (session === null) router.replace("/login")
  }, [session, router])

  if (error && session === undefined) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <Empty className="max-w-md border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WifiOffIcon />
            </EmptyMedia>
            <EmptyTitle>Sem conexão com o servidor</EmptyTitle>
            <EmptyDescription>{error}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              onClick={async () => {
                setRetrying(true)
                await refresh()
                setRetrying(false)
              }}
              disabled={retrying}
            >
              <RefreshCwIcon data-icon="inline-start" className={retrying ? "animate-spin" : undefined} />
              Tentar de novo
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-svh" aria-busy="true">
        <div className="hidden w-64 flex-col gap-3 border-r p-4 md:flex">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  const allowed = canAccess(session.activeRole, pathname)

  return (
    <ShellProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader />
          <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {allowed ? (
              children
            ) : (
              <Empty className="flex-1">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ShieldAlertIcon />
                  </EmptyMedia>
                  <EmptyTitle>Você não tem permissão para esta tela</EmptyTitle>
                  <EmptyDescription>
                    O perfil atual não acessa esta área. Se precisar, troque de perfil no menu do usuário.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button render={<Link href={homeForRole(session.activeRole)} />} nativeButton={false}>
                    Ir para o início
                  </Button>
                </EmptyContent>
              </Empty>
            )}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </ShellProvider>
  )
}
