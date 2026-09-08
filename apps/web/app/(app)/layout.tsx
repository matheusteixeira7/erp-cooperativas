"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ShieldAlertIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { AppHeader } from "@/components/app-header"
import { AppSidebar } from "@/components/app-sidebar"
import { ShellProvider } from "@/components/shell-context"
import { useSession } from "@/lib/demo/session"
import { canAccess, homeForRole } from "@/lib/navigation"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  React.useEffect(() => {
    if (session === null) router.replace("/login")
  }, [session, router])

  if (!session) {
    return (
      <div className="flex min-h-svh">
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
