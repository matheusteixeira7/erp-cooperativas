"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { RecycleIcon } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"

import { NavUser } from "@/components/nav-user"
import { useRequiredSession } from "@/lib/demo/session"
import { GROUP_LABEL, homeForRole, routesForRole } from "@/lib/navigation"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { session } = useRequiredSession()
  const routes = routesForRole(session.activeRole)
  const groups = Array.from(new Set(routes.map((r) => r.group)))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href={homeForRole(session.activeRole)} />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <RecycleIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{session.cooperativeName}</span>
                <span className="truncate text-xs text-muted-foreground">Recicla ERP</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group}>
            <SidebarGroupLabel>{GROUP_LABEL[group]}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {routes
                  .filter((r) => r.group === group)
                  .map((route) => {
                    const active =
                      pathname === route.href ||
                      (route.href === "/fechamento/historico" && pathname.startsWith("/fechamento/") && pathname !== "/fechamento")
                    return (
                      <SidebarMenuItem key={route.href}>
                        <SidebarMenuButton
                          tooltip={route.label}
                          isActive={active}
                          render={<Link href={route.href} />}
                        >
                          <route.icon />
                          <span>{route.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
