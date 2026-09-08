// Route registry: menu, breadcrumbs and role guard share this single source of truth.

import type { LucideIcon } from "lucide-react"
import {
  CreditCardIcon,
  DollarSignIcon,
  HistoryIcon,
  HomeIcon,
  ReceiptIcon,
  Settings2Icon,
  ShoppingCartIcon,
  UserCheckIcon,
  UsersIcon,
} from "lucide-react"

import type { Role } from "@/lib/demo/types"

export type AppRoute = {
  href: string
  label: string
  icon: LucideIcon
  roles: Role[]
  group: "operacao" | "gestao" | "cooperado"
}

export const APP_ROUTES: AppRoute[] = [
  { href: "/inicio", label: "Início", icon: HomeIcon, roles: ["manager", "operator"], group: "operacao" },
  { href: "/chamada", label: "Chamada", icon: UserCheckIcon, roles: ["manager", "operator"], group: "operacao" },
  { href: "/vendas", label: "Vendas", icon: ShoppingCartIcon, roles: ["manager", "operator"], group: "operacao" },
  { href: "/financeiro", label: "Despesas e vales", icon: CreditCardIcon, roles: ["manager", "operator"], group: "operacao" },
  { href: "/fechamento", label: "Fechamento", icon: DollarSignIcon, roles: ["manager"], group: "gestao" },
  { href: "/fechamento/historico", label: "Histórico", icon: HistoryIcon, roles: ["manager"], group: "gestao" },
  { href: "/cooperados", label: "Cooperados", icon: UsersIcon, roles: ["manager"], group: "gestao" },
  { href: "/configuracoes/rateio", label: "Configurações", icon: Settings2Icon, roles: ["manager"], group: "gestao" },
  { href: "/extrato", label: "Meu extrato", icon: ReceiptIcon, roles: ["member"], group: "cooperado" },
]

export const GROUP_LABEL = {
  operacao: "Operação",
  gestao: "Gestão",
  cooperado: "Cooperado",
} as const

export function routesForRole(role: Role) {
  return APP_ROUTES.filter((r) => r.roles.includes(role))
}

export function homeForRole(role: Role) {
  return routesForRole(role)[0]?.href ?? "/login"
}

/** Whether `pathname` is allowed for `role`. Detail routes inherit their parent. */
export function canAccess(role: Role, pathname: string) {
  if (pathname.startsWith("/fechamento/")) return role === "manager"
  return APP_ROUTES.some((r) => r.roles.includes(role) && pathname === r.href)
}

export type Crumb = { label: string; href?: string }

export function breadcrumbsFor(pathname: string, detailLabel?: string): Crumb[] {
  if (pathname.startsWith("/fechamento/historico")) {
    return [{ label: "Fechamento", href: "/fechamento" }, { label: "Histórico" }]
  }
  if (pathname.startsWith("/fechamento/") && pathname !== "/fechamento") {
    return [
      { label: "Fechamento", href: "/fechamento" },
      { label: "Histórico", href: "/fechamento/historico" },
      { label: detailLabel ?? "Detalhe" },
    ]
  }
  if (pathname.startsWith("/configuracoes/")) {
    return [{ label: "Configurações" }, { label: "Parâmetros de rateio" }]
  }
  const route = APP_ROUTES.find((r) => r.href === pathname)
  return route ? [{ label: route.label }] : [{ label: "Página" }]
}
