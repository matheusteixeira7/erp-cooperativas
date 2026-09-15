"use client"

import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"

import { errorMessage } from "@/lib/trpc/errors"

/** Error state for a screen or card whose data failed to load, with a retry. */
export function QueryError({
  error,
  onRetry,
  retrying = false,
  title = "Não foi possível carregar",
  className,
}: {
  error: unknown
  onRetry?: () => void
  retrying?: boolean
  title?: string
  className?: string
}) {
  return (
    <Empty className={className ?? "border"}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{errorMessage(error)}</EmptyDescription>
      </EmptyHeader>
      {onRetry && (
        <EmptyContent>
          <Button variant="outline" onClick={onRetry} disabled={retrying}>
            <RefreshCwIcon data-icon="inline-start" className={retrying ? "animate-spin" : undefined} />
            Tentar de novo
          </Button>
        </EmptyContent>
      )}
    </Empty>
  )
}
