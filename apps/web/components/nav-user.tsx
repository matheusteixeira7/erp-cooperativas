"use client"

import { useRouter } from "next/navigation"
import { BugIcon, ChevronsUpDownIcon, LogOutIcon, RotateCcwIcon, UserCogIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@workspace/ui/components/sidebar"
import { toast } from "@workspace/ui/components/toast"

import { useRequiredSession } from "@/lib/demo/session"
import { useDemo } from "@/lib/demo/store"
import { ROLE_LABEL, type Role } from "@/lib/demo/types"
import { initials } from "@/lib/format"
import { homeForRole } from "@/lib/navigation"

export function NavUser() {
  const router = useRouter()
  const { isMobile } = useSidebar()
  const { session, logout, switchRole } = useRequiredSession()
  const { failNext, setFailNext, resetDemo } = useDemo()

  function handleSwitchRole(role: Role) {
    switchRole(role)
    router.push(homeForRole(role))
    toast.add({ type: "info", title: `Agora você está como ${ROLE_LABEL[role]}` })
  }

  function handleReset() {
    resetDemo()
    toast.add({ type: "success", title: "Dados de demonstração redefinidos" })
  }

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}>
            <Avatar>
              <AvatarFallback>{initials(session.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{session.name}</span>
              <span className="truncate text-xs text-muted-foreground">{ROLE_LABEL[session.activeRole]}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-56" side={isMobile ? "bottom" : "right"} align="end" sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarFallback>{initials(session.name)}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{session.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{session.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {session.roles.length > 1 && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <UserCogIcon className="size-3.5" /> Perfil ativo
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={session.activeRole}
                    onValueChange={(value) => handleSwitchRole(value as Role)}
                  >
                    {session.roles.map((role) => (
                      <DropdownMenuRadioItem key={role} value={role}>
                        {ROLE_LABEL[role]}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Protótipo</DropdownMenuLabel>
              <DropdownMenuCheckboxItem checked={failNext} onCheckedChange={(checked) => setFailNext(checked)}>
                <BugIcon />
                Simular erro na próxima ação
              </DropdownMenuCheckboxItem>
              <DropdownMenuItem onClick={handleReset}>
                <RotateCcwIcon />
                Redefinir dados de demonstração
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOutIcon />
                Sair
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
