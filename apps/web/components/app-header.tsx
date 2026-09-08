"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { FlaskConicalIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

import { useShell } from "@/components/shell-context"
import { useRequiredSession } from "@/lib/demo/session"
import { ROLE_LABEL } from "@/lib/demo/types"
import { breadcrumbsFor } from "@/lib/navigation"

export function AppHeader() {
  const pathname = usePathname()
  const { detailLabel } = useShell()
  const { session } = useRequiredSession()
  const crumbs = breadcrumbsFor(pathname, detailLabel)

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1
            return (
              <React.Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbItem className={last ? undefined : "hidden md:block"}>
                  {last || !crumb.href ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!last && <BreadcrumbSeparator className="hidden md:block" />}
              </React.Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger render={<Badge variant="outline" />}>
            <FlaskConicalIcon />
            <span className="hidden sm:inline">Protótipo</span>
          </TooltipTrigger>
          <TooltipContent>Dados simulados. Nada é salvo em servidor.</TooltipContent>
        </Tooltip>
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {ROLE_LABEL[session.activeRole]}
        </Badge>
      </div>
    </header>
  )
}
