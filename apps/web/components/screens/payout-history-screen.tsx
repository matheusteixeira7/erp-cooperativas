"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRightIcon, HistoryIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent } from "@workspace/ui/components/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@workspace/ui/components/empty"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"

import { PageHeader } from "@/components/page-header"
import { TableSkeleton } from "@/components/table-skeleton"
import { useDemo, useSimulatedLoading } from "@/lib/demo/store"
import { PAYOUT_STATUS_LABEL } from "@/lib/demo/types"
import { formatDateTime, formatMoney, formatPeriod } from "@/lib/format"

export function PayoutHistoryScreen() {
  const { data, resetCount } = useDemo()
  const router = useRouter()
  const loading = useSimulatedLoading(`history-${resetCount}`)
  const payouts = [...data.payouts].sort((a, b) => b.period.localeCompare(a.period) || b.closedAt.localeCompare(a.closedAt))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Histórico de fechamentos" description="Cada linha é um snapshot oficial. Mudanças posteriores não alteram meses fechados.">
        <Button variant="outline" render={<Link href="/fechamento" />} nativeButton={false}>
          Ir para o fechamento
        </Button>
      </PageHeader>

      <Card>
        <CardContent>
          {loading ? (
            <TableSkeleton rows={3} columns={6} />
          ) : payouts.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HistoryIcon />
                </EmptyMedia>
                <EmptyTitle>Nenhum mês fechado ainda</EmptyTitle>
                <EmptyDescription>Quando você fechar o primeiro mês, o demonstrativo aparece aqui.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button render={<Link href="/fechamento" />} nativeButton={false}>
                  Fazer o primeiro fechamento
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Sobra distribuível</TableHead>
                  <TableHead className="text-right">Diária</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Pagos</TableHead>
                  <TableHead className="hidden lg:table-cell">Fechado em</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => {
                  const payable = payout.items.filter((i) => i.netAmount > 0)
                  const paid = payable.filter((i) => i.paidAt).length
                  return (
                    <TableRow
                      key={payout.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/fechamento/${payout.id}`)}
                    >
                      <TableCell className="font-medium">{formatPeriod(payout.period)}</TableCell>
                      <TableCell>
                        <Badge variant={payout.status === "closed" ? "default" : "outline"}>{PAYOUT_STATUS_LABEL[payout.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(payout.distributableSurplus)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(payout.dayValue)}</TableCell>
                      <TableCell className="hidden md:table-cell text-right tabular-nums">
                        {payout.status === "closed" ? `${paid} / ${payable.length}` : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {formatDateTime(payout.closedAt)} por {payout.closedBy}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon-sm" aria-label="Abrir" render={<Link href={`/fechamento/${payout.id}`} />} nativeButton={false}>
                          <ChevronRightIcon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
