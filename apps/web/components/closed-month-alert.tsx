"use client"

import Link from "next/link"
import { LockIcon } from "lucide-react"

import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert"
import { Button } from "@workspace/ui/components/button"

import { useRequiredSession } from "@/lib/demo/session"
import { formatPeriod } from "@/lib/format"

export function ClosedMonthAlert({ period, payoutId }: { period: string; payoutId?: string }) {
  const { session } = useRequiredSession()
  const isManager = session.activeRole === "manager"
  return (
    <Alert>
      <LockIcon />
      <AlertTitle>Mês fechado: {formatPeriod(period)}</AlertTitle>
      <AlertDescription>
        {isManager
          ? "Os lançamentos deste mês estão bloqueados. Para alterar, reabra o mês no histórico."
          : "Os lançamentos deste mês estão bloqueados. Peça ao gestor para reabrir, se precisar corrigir algo."}
      </AlertDescription>
      {isManager && payoutId && (
        <AlertAction>
          <Button variant="outline" size="sm" render={<Link href={`/fechamento/${payoutId}`} />} nativeButton={false}>
            Ver fechamento
          </Button>
        </AlertAction>
      )}
    </Alert>
  )
}
